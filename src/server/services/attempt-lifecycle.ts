import "server-only";

import {
  type AttemptRow,
  isFinalized,
  toAttemptView,
} from "@/features/attempt/attempt-view";
import { remainingSeconds } from "@/features/attempt/timer";
import { ATTEMPT_STATUSES, type DbTestMode, type DbTestVisibility, TEST_MODES } from "@/features/test/api-enums";
import type { CurrentUser } from "@/server/auth/current-user";
import { isUniqueViolation } from "@/server/db/errors";
import type { Sql } from "@/server/db/types";
import { ApiError } from "@/server/http/errors";

import { finalizeExpiredForUser, finalizeIfExpired, loadOwnAttempt, timerOf } from "./attempt-core";
import { loadPreload, loadStudentContent } from "./test-structure";

async function findActiveAttemptId(sql: Sql, userId: string, testId: string): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`
    select id from public.attempts
    where user_id = ${userId} and test_id = ${testId} and status in ('created', 'in_progress')
    limit 1
  `;
  return rows[0]?.id ?? null;
}

function activeAttemptExists(attemptId: string | null): ApiError {
  return new ApiError("ACTIVE_ATTEMPT_EXISTS", "You already have an unfinished attempt for this test.", {
    attempt_id: attemptId,
  });
}

/**
 * POST /api/tests/:testId/attempts (api-contract §5, D-013, D-015).
 * Creates the attempt in status CREATED, bound to the test's published
 * version and to the mode the student picked; the timer starts only at `begin`.
 */
export async function startAttempt(sql: Sql, user: CurrentUser, testId: string, mode: DbTestMode, now: Date) {
  // An expired attempt must not block a new one.
  await finalizeExpiredForUser(sql, user.id, now, testId);

  let attempt: AttemptRow;
  try {
    attempt = await sql.begin(async (tx) => {
      const tests = await tx<{
        visibility: DbTestVisibility;
        version_id: string | null;
        enabled: boolean | null;
        time_limit_seconds: number | null;
        max_attempts: number | null;
      }[]>`
        select t.visibility, tv.id as version_id, m.enabled, m.time_limit_seconds, m.max_attempts
        from public.tests t
        left join public.test_versions tv on tv.test_id = t.id and tv.status = 'published'
        left join public.test_version_modes m on m.test_version_id = tv.id and m.mode = ${mode}
        where t.id = ${testId}
        for share of t
      `;
      const test = tests[0];
      if (!test || test.visibility === "archived") {
        throw new ApiError("TEST_NOT_FOUND", "Test not found.");
      }
      if (test.visibility !== "visible" || test.version_id === null) {
        throw new ApiError("TEST_NOT_PUBLISHED", "This test is not published.");
      }
      if (!test.enabled) {
        throw new ApiError("MODE_NOT_AVAILABLE", `This test cannot be taken in ${TEST_MODES[mode]} mode.`, {
          mode: TEST_MODES[mode],
        });
      }
      // Prototype 1: every published test is PUBLIC (D-004), so no access check yet.

      const active = await tx<{ id: string }[]>`
        select id from public.attempts
        where user_id = ${user.id} and test_id = ${testId} and status in ('created', 'in_progress')
        limit 1
      `;
      if (active[0]) {
        throw activeAttemptExists(active[0].id);
      }

      // max_attempts is per mode (D-015).
      if (test.max_attempts !== null) {
        const used = await tx<{ count: number }[]>`
          select count(*)::int as count from public.attempts
          where user_id = ${user.id} and test_id = ${testId} and mode = ${mode}
        `;
        if ((used[0]?.count ?? 0) >= test.max_attempts) {
          throw new ApiError("MAX_ATTEMPT_REACHED", "You have used all attempts for this test in this mode.", {
            mode: TEST_MODES[mode],
            max_attempts: test.max_attempts,
          });
        }
      }

      const created = await tx<AttemptRow[]>`
        insert into public.attempts (user_id, test_id, test_version_id, mode, time_limit_seconds, status, created_at)
        values (${user.id}, ${testId}, ${test.version_id}, ${mode}, ${test.time_limit_seconds}, 'created', ${now})
        returning id, user_id, test_id, test_version_id, status, mode, time_limit_seconds,
                  created_at, started_at, expires_at, submitted_at
      `;
      const row = created[0];
      if (!row) throw new Error("Attempt insert returned no row.");
      return row;
    });
  } catch (error) {
    // Two "start" requests at the same time: the partial unique index lets only one through.
    if (isUniqueViolation(error, "attempts_one_active_per_user_test")) {
      throw activeAttemptExists(await findActiveAttemptId(sql, user.id, testId));
    }
    throw error;
  }

  return {
    attempt: toAttemptView(attempt, now),
    preload: await loadPreload(sql, attempt.test_version_id),
  };
}

/**
 * POST /api/attempts/:attemptId/begin — starts the timer and returns the
 * content. Idempotent: an IN_PROGRESS attempt keeps its original timer.
 */
export async function beginAttempt(sql: Sql, user: CurrentUser, attemptId: string, now: Date) {
  const check = await finalizeIfExpired(sql, attemptId, user.id, now);
  if (isFinalized(check.attempt.status)) {
    throw new ApiError("ATTEMPT_LOCKED", "This attempt has already been submitted.", {
      status: ATTEMPT_STATUSES[check.attempt.status],
    });
  }

  const attempt = await sql.begin(async (tx) => {
    const locked = await loadOwnAttempt(tx, attemptId, user.id, { lock: true });
    if (locked.status !== "created") {
      return locked; // already begun
    }
    const expiresAt =
      locked.time_limit_seconds === null ? null : new Date(now.getTime() + locked.time_limit_seconds * 1000);
    const updated = await tx<AttemptRow[]>`
      update public.attempts
      set status = 'in_progress', started_at = ${now}, expires_at = ${expiresAt}
      where id = ${attemptId}
      returning id, user_id, test_id, test_version_id, status, mode, time_limit_seconds,
                created_at, started_at, expires_at, submitted_at
    `;
    const row = updated[0];
    if (!row) throw new Error("Attempt update returned no row.");
    return row;
  });

  return buildAttemptPayload(sql, attempt, now);
}

/** GET /api/attempts/:attemptId — resume after reload (api-contract §5). */
export async function getAttempt(sql: Sql, user: CurrentUser, attemptId: string, now: Date) {
  const { attempt } = await finalizeIfExpired(sql, attemptId, user.id, now);
  return buildAttemptPayload(sql, attempt, now);
}

/** GET /api/attempts/:attemptId/status — timer re-sync. */
export async function getAttemptStatus(sql: Sql, user: CurrentUser, attemptId: string, now: Date) {
  const { attempt } = await finalizeIfExpired(sql, attemptId, user.id, now);
  return {
    status: ATTEMPT_STATUSES[attempt.status],
    server_time: now.toISOString(),
    started_at: attempt.started_at ? attempt.started_at.toISOString() : null,
    expires_at: attempt.expires_at ? attempt.expires_at.toISOString() : null,
    remaining_seconds: remainingSeconds(timerOf(attempt), now),
  };
}

/** api-contract §2.6 AttemptPayload. Content is withheld until the attempt has begun. */
async function buildAttemptPayload(sql: Sql, attempt: AttemptRow, now: Date) {
  const content = await loadStudentContent(sql, attempt.test_version_id, attempt.mode);
  if (!content) {
    throw new Error("Test version of the attempt is missing.");
  }
  if (attempt.status === "created") {
    return {
      attempt: toAttemptView(attempt, now),
      test_version: content.test_version,
      sections: null,
      answers: [],
      flags: [],
      preload: await loadPreload(sql, attempt.test_version_id),
    };
  }

  const saved = await sql<{ question_id: string; answer: unknown; saved_at: Date; is_flagged: boolean }[]>`
    select question_id, answer, saved_at, is_flagged
    from public.attempt_answers
    where attempt_id = ${attempt.id}
  `;
  return {
    attempt: toAttemptView(attempt, now),
    test_version: content.test_version,
    sections: content.sections,
    answers: saved
      .filter((row) => row.answer !== null)
      .map((row) => ({ question_id: row.question_id, answer: row.answer, saved_at: row.saved_at.toISOString() })),
    flags: saved.filter((row) => row.is_flagged).map((row) => row.question_id),
    preload: null,
  };
}
