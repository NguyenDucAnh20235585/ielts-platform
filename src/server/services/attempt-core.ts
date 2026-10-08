import "server-only";

import { type AttemptRow, isFinalized } from "@/features/attempt/attempt-view";
import { GRACE_SECONDS, finalOutcome, isPastGrace } from "@/features/attempt/timer";
import type { BandRange } from "@/features/grading/band";
import { type AttemptQuestion, gradeAttempt } from "@/features/grading/grade-attempt";
import { buildGradingSnapshot } from "@/features/grading/snapshot";
import { orderQuestions } from "@/features/test/student-content";
import type { Queryable, Sql } from "@/server/db/types";
import { ApiError } from "@/server/http/errors";

import { loadVersionStructure } from "./test-structure";

/** Loads the caller's own attempt. Someone else's attempt is "not found" (D-011). */
export async function loadOwnAttempt(
  sql: Queryable,
  attemptId: string,
  userId: string,
  options: { lock: boolean } = { lock: false },
): Promise<AttemptRow> {
  const rows = await sql<AttemptRow[]>`
    select id, user_id, test_id, test_version_id, status, mode, time_limit_seconds,
           created_at, started_at, expires_at, submitted_at
    from public.attempts
    where id = ${attemptId} and user_id = ${userId}
    ${options.lock ? sql`for update` : sql``}
  `;
  const attempt = rows[0];
  if (!attempt) {
    throw new ApiError("ATTEMPT_NOT_FOUND", "Attempt not found.");
  }
  return attempt;
}

export function timerOf(attempt: AttemptRow) {
  return { status: attempt.status, expiresAt: attempt.expires_at };
}

/**
 * Grades an IN_PROGRESS attempt and stores the result, inside the caller's
 * transaction (the attempt row must already be locked FOR UPDATE).
 * Lock → grade → save result → update status, all or nothing
 * (BE_and_DATABASE_Agreement §4).
 */
export async function finalizeAttempt(tx: Queryable, attempt: AttemptRow, now: Date): Promise<AttemptRow> {
  if (attempt.status !== "in_progress" || attempt.started_at === null) {
    throw new Error(`Cannot finalize an attempt in status ${attempt.status}.`);
  }

  const structure = await loadVersionStructure(tx, attempt.test_version_id, attempt.mode);
  if (!structure) {
    throw new Error("Test version of the attempt is missing.");
  }

  // Answer keys are read only here, on the grading path.
  const keys = await tx<{ question_id: string; correct_answer: unknown; grading_config: unknown; explanation: string | null }[]>`
    select k.question_id, k.correct_answer, k.grading_config, k.explanation
    from public.answer_keys k
    join public.questions q on q.id = k.question_id
    join public.question_groups g on g.id = q.question_group_id
    join public.sections s on s.id = g.section_id
    where s.test_version_id = ${attempt.test_version_id}
  `;
  const answers = await tx<{ question_id: string; answer: unknown }[]>`
    select question_id, answer from public.attempt_answers where attempt_id = ${attempt.id}
  `;
  const bandTable = await loadBandTable(tx, attempt.test_version_id);

  const keyByQuestion = new Map(keys.map((k) => [k.question_id, k]));
  const answerByQuestion = new Map(answers.map((a) => [a.question_id, a.answer]));
  const outcome = finalOutcome(attempt.expires_at, now);

  const { grade, snapshot } = gradeOrFail(attempt.id, () => {
    const ordered = orderQuestions(structure.sections, structure.groups, structure.questions);
    const gradable: AttemptQuestion[] = ordered.map((q) => ({
      questionId: q.row.id,
      sectionId: q.sectionId,
      numbers: q.numbers,
      answerFormat: q.row.answer_format,
      marks: q.marks,
      rules: q.rules,
      correctAnswer: keyByQuestion.get(q.row.id)?.correct_answer,
      gradingConfig: keyByQuestion.get(q.row.id)?.grading_config ?? {},
      answer: answerByQuestion.get(q.row.id) ?? null,
    }));
    const attemptGrade = gradeAttempt(gradable, bandTable.ranges);
    return {
      grade: attemptGrade,
      snapshot: buildGradingSnapshot({
        testVersionId: attempt.test_version_id,
        gradedAt: now,
        bandTable,
        sections: structure.sections.map((s) => ({ sectionId: s.id, orderNo: s.position, title: s.title })),
        questions: ordered.map((q) => ({
          questionId: q.row.id,
          questionType: q.row.question_type,
          answerFormat: q.row.answer_format,
          answer: answerByQuestion.get(q.row.id) ?? null,
          correctAnswer: keyByQuestion.get(q.row.id)?.correct_answer ?? null,
          explanation: keyByQuestion.get(q.row.id)?.explanation ?? null,
        })),
        grade: attemptGrade,
      }),
    };
  });

  const timeTaken = Math.max(0, Math.floor((outcome.submittedAt.getTime() - attempt.started_at.getTime()) / 1000));
  await tx`
    insert into public.results
      (attempt_id, raw_score, max_score, band_score, grading_snapshot,
       correct_count, incorrect_count, unanswered_count, time_taken_seconds)
    values
      (${attempt.id}, ${grade.rawScore}, ${grade.maxScore}, ${grade.bandScore}, ${tx.json(toJsonValue(snapshot))},
       ${grade.correctCount}, ${grade.incorrectCount}, ${grade.unansweredCount}, ${timeTaken})
  `;
  const updated = await tx<AttemptRow[]>`
    update public.attempts
    set status = ${outcome.status}, submitted_at = ${outcome.submittedAt}
    where id = ${attempt.id}
    returning id, user_id, test_id, test_version_id, status, mode, time_limit_seconds,
              created_at, started_at, expires_at, submitted_at
  `;
  const row = updated[0];
  if (!row) {
    throw new Error("Attempt disappeared while finalizing.");
  }
  return row;
}

/**
 * The snapshot holds students' answers and answer keys typed as `unknown`;
 * a JSON round trip gives postgres.js a plain JSON value to store as jsonb.
 */
function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

/** Runs grading; any failure becomes GRADING_FAILED so the transaction rolls back. */
function gradeOrFail<Result>(attemptId: string, run: () => Result): Result {
  try {
    return run();
  } catch (error) {
    const summary = error instanceof Error ? `${error.name}: ${error.message}` : "unknown error";
    console.error(`[grading] attempt ${attemptId} could not be graded — ${summary}`);
    throw new ApiError("GRADING_FAILED", "The attempt could not be graded. It was not submitted; please try again.");
  }
}

/** The version's band table, or the default table for its test type. */
async function loadBandTable(tx: Queryable, versionId: string): Promise<{ id: string | null; ranges: BandRange[] }> {
  const rows = await tx<{ id: string; min_raw: number; max_raw: number; band: string }[]>`
    select b.id, r.min_raw, r.max_raw, r.band
    from public.test_versions tv
    join public.tests t on t.id = tv.test_id
    join public.band_tables b
      on b.id = coalesce(tv.band_table_id,
                         (select d.id from public.band_tables d where d.skill = t.type and d.is_default))
    join public.band_table_ranges r on r.band_table_id = b.id
    where tv.id = ${versionId}
    order by r.min_raw
  `;
  return {
    id: rows[0]?.id ?? null,
    ranges: rows.map((r) => ({ minRaw: r.min_raw, maxRaw: r.max_raw, band: Number(r.band) })),
  };
}

export type ExpiryCheck = { attempt: AttemptRow; finalizedNow: boolean };

/**
 * Lazy expiry (D-005): if the attempt is past expires_at + grace, grade and
 * finalize it now as AUTO_SUBMITTED. Commits on its own, so callers can
 * report "expired" afterwards without rolling the finalization back.
 */
export async function finalizeIfExpired(sql: Sql, attemptId: string, userId: string, now: Date): Promise<ExpiryCheck> {
  const current = await loadOwnAttempt(sql, attemptId, userId);
  if (!isPastGrace(timerOf(current), now)) {
    return { attempt: current, finalizedNow: false };
  }
  return sql.begin(async (tx) => {
    const locked = await loadOwnAttempt(tx, attemptId, userId, { lock: true });
    if (!isPastGrace(timerOf(locked), now)) {
      return { attempt: locked, finalizedNow: false }; // finalized by a parallel request
    }
    return { attempt: await finalizeAttempt(tx, locked, now), finalizedNow: true };
  });
}

/** Finalizes all of a user's expired attempts (optionally for one test) before listing them. */
export async function finalizeExpiredForUser(sql: Sql, userId: string, now: Date, testId?: string): Promise<void> {
  const cutoff = new Date(now.getTime() - GRACE_SECONDS * 1000);
  const expired = await sql<{ id: string }[]>`
    select id from public.attempts
    where user_id = ${userId} and status = 'in_progress' and expires_at < ${cutoff}
    ${testId ? sql`and test_id = ${testId}` : sql``}
  `;
  for (const { id } of expired) {
    await finalizeIfExpired(sql, id, userId, now);
  }
}

/** Shared state checks before changing answers or flags. */
export function assertAcceptsChanges(check: ExpiryCheck, now: Date): void {
  const { attempt } = check;
  if (check.finalizedNow) {
    throw new ApiError("ATTEMPT_EXPIRED", "Time is up; the attempt was submitted automatically.", {
      status: "AUTO_SUBMITTED",
    });
  }
  if (attempt.status === "created") {
    throw new ApiError("ATTEMPT_NOT_STARTED", "Call begin before answering.");
  }
  if (isFinalized(attempt.status)) {
    throw new ApiError("ATTEMPT_LOCKED", "This attempt has already been submitted.", {
      status: attempt.status === "auto_submitted" ? "AUTO_SUBMITTED" : "SUBMITTED",
    });
  }
  if (isPastGrace(timerOf(attempt), now)) {
    throw new ApiError("ATTEMPT_EXPIRED", "Time is up for this attempt.", { status: "IN_PROGRESS" });
  }
}
