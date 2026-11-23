import "server-only";

import {
  type AttemptRow,
  isFinalized,
  toAttemptView,
} from "@/shared/attempt/attempt-view";
import { isPastGrace, remainingSeconds } from "@/shared/attempt/timer";
import { canOpenTest } from "@/shared/test/access";
import {
  ATTEMPT_STATUSES,
  type DbAccessType,
  type DbTestMode,
  type DbTestVisibility,
  TEST_MODES,
} from "@/shared/test/api-enums";
import type { CurrentUser } from "@/backend/auth/current-user";
import { isUniqueViolation } from "@/backend/db/errors";
import type { Sql } from "@/backend/db/types";
import { ApiError } from "@/backend/http/errors";

import { finalizeAttempt, finalizeIfExpired, loadOwnAttempt, timerOf } from "./attempt-core";
import { type AudioRow, loadPreload, loadStudentContent, toPreload } from "./test-structure";

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
  let created: { attempt: AttemptRow; audio: AudioRow[] };
  try {
    created = await sql.begin(async (tx) => {
      // One read: the test, its published version and mode, the version's audio
      // (preload), and the caller's attempts on the test.
      const tests = await tx<{
        visibility: DbTestVisibility;
        access_type: DbAccessType;
        version_id: string | null;
        enabled: boolean | null;
        time_limit_seconds: number | null;
        max_attempts: number | null;
        audio: AudioRow[];
        active_attempt_id: string | null;
        attempts_used: number;
      }[]>`
        select t.visibility, t.access_type, tv.id as version_id, m.enabled, m.time_limit_seconds, m.max_attempts,
               (select coalesce(json_agg(r order by s.position), '[]')
                  from public.sections s
                  cross join lateral (select s.id, s.audio_object_key) r
                  where s.test_version_id = tv.id and s.audio_object_key is not null) as audio,
               (select a.id from public.attempts a
                 where a.user_id = ${user.id} and a.test_id = t.id and a.status in ('created', 'in_progress')
                 limit 1) as active_attempt_id,
               -- max_attempts is per mode (D-015).
               (select count(*)::int from public.attempts a
                 where a.user_id = ${user.id} and a.test_id = t.id and a.mode = ${mode}) as attempts_used
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
      // Checked before the mode so a closed test reveals nothing about its settings (D-017).
      if (!canOpenTest(user.role, test.access_type)) {
        throw new ApiError("ACCESS_DENIED", "You do not have access to this test.");
      }
      if (!test.enabled) {
        throw new ApiError("MODE_NOT_AVAILABLE", `This test cannot be taken in ${TEST_MODES[mode]} mode.`, {
          mode: TEST_MODES[mode],
        });
      }
      if (test.active_attempt_id !== null) {
        // One that ran out of time must not block a new one (lazy expiry, D-005): close it here.
        const active = await loadOwnAttempt(tx, test.active_attempt_id, user.id, { lock: true });
        if (!isFinalized(active.status)) {
          if (!isPastGrace(timerOf(active), now)) {
            throw activeAttemptExists(active.id);
          }
          await finalizeAttempt(tx, active, now);
        }
      }
      if (test.max_attempts !== null && test.attempts_used >= test.max_attempts) {
        throw new ApiError("MAX_ATTEMPT_REACHED", "You have used all attempts for this test in this mode.", {
          mode: TEST_MODES[mode],
          max_attempts: test.max_attempts,
        });
      }

      const inserted = await tx<AttemptRow[]>`
        insert into public.attempts (user_id, test_id, test_version_id, mode, time_limit_seconds, status, created_at)
        values (${user.id}, ${testId}, ${test.version_id}, ${mode}, ${test.time_limit_seconds}, 'created', ${now})
        returning id, user_id, test_id, test_version_id, status, mode, time_limit_seconds,
                  created_at, started_at, expires_at, submitted_at
      `;
      const row = inserted[0];
      if (!row) throw new Error("Attempt insert returned no row.");
      return { attempt: row, audio: test.audio };
    });
  } catch (error) {
    // Two "start" requests at the same time: the partial unique index lets only one through.
    if (isUniqueViolation(error, "attempts_one_active_per_user_test")) {
      throw activeAttemptExists(await findActiveAttemptId(sql, user.id, testId));
    }
    throw error;
  }

  return {
    attempt: toAttemptView(created.attempt, now),
    preload: toPreload(created.audio),
  };
}

/**
 * POST /api/attempts/:attemptId/begin — starts the timer and returns the
 * content. Idempotent: an IN_PROGRESS attempt keeps its original timer.
 */
export async function beginAttempt(sql: Sql, user: CurrentUser, attemptId: string, now: Date) {
  // First call: start the timer in one guarded statement (no transaction needed).
  const started = await sql<AttemptRow[]>`
    update public.attempts
    set status = 'in_progress', started_at = ${now},
        expires_at = ${now}::timestamptz + make_interval(secs => time_limit_seconds)
    where id = ${attemptId} and user_id = ${user.id} and status = 'created'
    returning id, user_id, test_id, test_version_id, status, mode, time_limit_seconds,
              created_at, started_at, expires_at, submitted_at
  `;
  let attempt = started[0];
  if (!attempt) {
    // Not CREATED (or not the caller's: 404 below). An IN_PROGRESS attempt keeps its timer.
    const check = await finalizeIfExpired(sql, attemptId, user.id, now);
    if (isFinalized(check.attempt.status)) {
      throw new ApiError("ATTEMPT_LOCKED", "This attempt has already been submitted.", {
        status: ATTEMPT_STATUSES[check.attempt.status],
      });
    }
    attempt = check.attempt;
  }

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
  const begun = attempt.status !== "created";
  // Independent reads, in parallel.
  const [content, saved, preload] = await Promise.all([
    loadStudentContent(sql, attempt.test_version_id, attempt.mode),
    begun
      ? sql<{ question_id: string; answer: unknown; saved_at: Date; is_flagged: boolean }[]>`
          select question_id, answer, saved_at, is_flagged
          from public.attempt_answers
          where attempt_id = ${attempt.id}
        `
      : [],
    begun ? null : loadPreload(sql, attempt.test_version_id),
  ]);
  if (!content) {
    throw new Error("Test version of the attempt is missing.");
  }
  if (!begun) {
    return {
      attempt: toAttemptView(attempt, now),
      test_version: content.test_version,
      sections: null,
      answers: [],
      flags: [],
      preload,
    };
  }

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
