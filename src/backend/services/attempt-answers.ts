import "server-only";

import { type AnswerTarget, type StoredAnswer, validateAnswer } from "@/backend/attempt/answer-validation";
import { GRACE_SECONDS, remainingSeconds } from "@/shared/attempt/timer";
import type { AnswerFormat } from "@/shared/grading/schemas";
import { effectiveOptions } from "@/shared/test/question-options";
import type { CurrentUser } from "@/backend/auth/current-user";
import { jsonValue } from "@/backend/db/json";
import type { Queryable, Sql } from "@/backend/db/types";
import { ApiError } from "@/backend/http/errors";

import { assertAcceptsChanges, closeIfPastGrace, finalizeIfExpired, loadOwnAttempt, timerOf } from "./attempt-core";

export type AnswerInput = { question_id: string; answer: Record<string, unknown> | null };

/** Whose questions to look up: a version's, or those of the caller's attempt. */
type TargetScope = { versionId: string } | { attemptId: string; userId: string };

/**
 * The asked-for questions of a version, keyed by id, with what validation
 * needs. Ids that are not part of the version are absent (assertKnownQuestions).
 * Scoped by attempt, it can run in parallel with loading the attempt itself.
 */
async function queryAnswerTargets(
  sql: Queryable,
  scope: TargetScope,
  questionIds: readonly string[],
): Promise<Map<string, AnswerTarget>> {
  const versionId =
    "versionId" in scope
      ? sql`${scope.versionId}`
      : sql`(select a.test_version_id from public.attempts a
              where a.id = ${scope.attemptId} and a.user_id = ${scope.userId})`;
  const rows = await sql<{
    id: string;
    question_type: string;
    answer_format: AnswerFormat;
    max_score: string;
    options: unknown;
    group_options: unknown;
  }[]>`
    select q.id, q.question_type, q.answer_format, q.max_score, q.options, g.options as group_options
    from public.questions q
    join public.question_groups g on g.id = q.question_group_id
    join public.sections s on s.id = g.section_id
    where s.test_version_id = ${versionId} and q.id = any(${[...questionIds]}::uuid[])
  `;
  return new Map(
    rows.map((row) => [
      row.id,
      {
        questionId: row.id,
        answerFormat: row.answer_format,
        marks: Number(row.max_score),
        options: effectiveOptions(row.question_type, row.answer_format, row.options, row.group_options),
      },
    ]),
  );
}

function questionIdsOf(items: readonly AnswerInput[]): string[] {
  return [...new Set(items.map((item) => item.question_id))];
}

/** Unknown ids → QUESTION_NOT_FOUND. */
function assertKnownQuestions(targets: ReadonlyMap<string, AnswerTarget>, questionIds: readonly string[]): void {
  const missing = questionIds.find((id) => !targets.has(id));
  if (missing !== undefined) {
    throw new ApiError("QUESTION_NOT_FOUND", "This question is not part of the attempt.", { question_id: missing });
  }
}

/** Validates every item; later items for the same question win (D-007). */
function validateItems(targets: ReadonlyMap<string, AnswerTarget>, items: readonly AnswerInput[]): Map<string, StoredAnswer> {
  const latest = new Map<string, StoredAnswer>();
  for (const item of items) {
    const target = targets.get(item.question_id);
    if (!target) throw new Error("unreachable");
    latest.set(item.question_id, validateAnswer(target, item.answer));
  }
  return latest;
}

/**
 * The caller's attempt row, locked FOR UPDATE, if it still accepts changes at
 * `now`: IN_PROGRESS and not past the grace window (D-016). Used as the first
 * CTE of a write, so that check and write are one statement: the lock makes it
 * wait for a submit in progress, and Postgres re-checks the condition on the
 * row the submit left behind, so nothing is written after grading.
 */
function openAttempt(sql: Queryable, attemptId: string, userId: string, now: Date) {
  return sql`
    select id from public.attempts
    where id = ${attemptId} and user_id = ${userId} and status = 'in_progress'
      and (expires_at is null or ${now} <= expires_at + make_interval(secs => ${GRACE_SECONDS}))
    for update
  `;
}

/**
 * Upserts the answers (one row per question, last write wins — D-007) and
 * touches attempts.last_saved_at, in ONE statement, only while the attempt is
 * open. Returns false when it was not (nothing written).
 */
async function upsertIfOpen(
  sql: Queryable,
  attemptId: string,
  userId: string,
  answers: ReadonlyMap<string, StoredAnswer>,
  now: Date,
): Promise<boolean> {
  const rows = [...answers].map(([question_id, answer]) => ({ question_id, answer }));
  const touched = await sql<{ id: string }[]>`
    with open_attempt as (${openAttempt(sql, attemptId, userId, now)}),
    saved as (
      insert into public.attempt_answers (attempt_id, question_id, answer, saved_at)
      select o.id, x.question_id, x.answer, ${now}
      from open_attempt o
      cross join jsonb_to_recordset(${sql.json(jsonValue(rows))}) as x(question_id uuid, answer jsonb)
      on conflict (attempt_id, question_id)
      do update set answer = excluded.answer, saved_at = excluded.saved_at
    )
    update public.attempts a
    set last_saved_at = ${now}
    from open_attempt o
    where a.id = o.id
    returning a.id
  `;
  return touched.length > 0;
}

/**
 * Saves the final answers sent with a submit, inside its transaction (the
 * attempt row is already locked and was checked to accept changes).
 */
export async function writeAnswers(
  tx: Queryable,
  attempt: { id: string; user_id: string; test_version_id: string },
  items: readonly AnswerInput[],
  now: Date,
): Promise<void> {
  const questionIds = questionIdsOf(items);
  const targets = await queryAnswerTargets(tx, { versionId: attempt.test_version_id }, questionIds);
  assertKnownQuestions(targets, questionIds);
  if (!(await upsertIfOpen(tx, attempt.id, attempt.user_id, validateItems(targets, items), now))) {
    throw new Error("The locked attempt refused its final answers.");
  }
}

/**
 * The attempt was checked open, but the guarded write found it closed: it was
 * submitted or ran out of time in between. Answer as the check would now.
 */
async function rejectClosedAttempt(sql: Sql, attemptId: string, userId: string, now: Date): Promise<never> {
  assertAcceptsChanges(await finalizeIfExpired(sql, attemptId, userId, now), now);
  throw new Error(`Attempt ${attemptId} refused a write but accepts changes.`);
}

/**
 * PATCH /api/attempts/:attemptId/answers — autosave (api-contract §5).
 * Two waits on the database whatever the number of answers: the attempt and
 * its questions (in parallel), then one guarded write.
 */
export async function saveAnswers(sql: Sql, user: CurrentUser, attemptId: string, items: readonly AnswerInput[], now: Date) {
  const questionIds = questionIdsOf(items);
  const [current, targets] = await Promise.all([
    loadOwnAttempt(sql, attemptId, user.id),
    queryAnswerTargets(sql, { attemptId, userId: user.id }, questionIds),
  ]);
  assertAcceptsChanges(await closeIfPastGrace(sql, current, now), now);
  assertKnownQuestions(targets, questionIds);
  const latest = validateItems(targets, items);

  if (!(await upsertIfOpen(sql, current.id, user.id, latest, now))) {
    return rejectClosedAttempt(sql, attemptId, user.id, now);
  }
  return {
    saved_at: now.toISOString(),
    answers: [...latest].map(([questionId, answer]) => ({
      question_id: questionId,
      answer,
      saved_at: now.toISOString(),
    })),
    server_time: now.toISOString(),
    remaining_seconds: remainingSeconds(timerOf(current), now),
  };
}

/** PATCH /api/attempts/:attemptId/questions/:questionId/flag */
export async function setFlag(
  sql: Sql,
  user: CurrentUser,
  attemptId: string,
  questionId: string,
  flagged: boolean,
  now: Date,
) {
  const [current, targets] = await Promise.all([
    loadOwnAttempt(sql, attemptId, user.id),
    queryAnswerTargets(sql, { attemptId, userId: user.id }, [questionId]),
  ]);
  assertAcceptsChanges(await closeIfPastGrace(sql, current, now), now);
  assertKnownQuestions(targets, [questionId]);

  const written = await sql`
    with open_attempt as (${openAttempt(sql, current.id, user.id, now)})
    insert into public.attempt_answers (attempt_id, question_id, answer, is_flagged, saved_at)
    select o.id, ${questionId}::uuid, null::jsonb, ${flagged}, ${now}
    from open_attempt o
    on conflict (attempt_id, question_id)
    do update set is_flagged = excluded.is_flagged
    returning attempt_id
  `;
  if (written.length === 0) {
    return rejectClosedAttempt(sql, attemptId, user.id, now);
  }
  return { question_id: questionId, flagged };
}
