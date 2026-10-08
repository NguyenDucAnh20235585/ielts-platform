import "server-only";

import { type AnswerTarget, type StoredAnswer, validateAnswer } from "@/features/attempt/answer-validation";
import { remainingSeconds } from "@/features/attempt/timer";
import type { AnswerFormat } from "@/features/grading/schemas";
import { effectiveOptions } from "@/features/test/question-options";
import type { CurrentUser } from "@/server/auth/current-user";
import type { Queryable, Sql } from "@/server/db/types";
import { ApiError } from "@/server/http/errors";

import { assertAcceptsChanges, finalizeIfExpired, loadOwnAttempt, timerOf } from "./attempt-core";

export type AnswerInput = { question_id: string; answer: Record<string, unknown> | null };

/** Questions of a version, keyed by id, with what validation needs. Unknown ids → QUESTION_NOT_FOUND. */
async function loadAnswerTargets(
  sql: Queryable,
  versionId: string,
  questionIds: readonly string[],
): Promise<Map<string, AnswerTarget>> {
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
  const targets = new Map(
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
  const missing = questionIds.find((id) => !targets.has(id));
  if (missing !== undefined) {
    throw new ApiError("QUESTION_NOT_FOUND", "This question is not part of the attempt.", { question_id: missing });
  }
  return targets;
}

/**
 * Validates and upserts answers inside an open transaction (one row per
 * question, last write wins — D-007). Later items for the same question win.
 * Returns what was stored, in request order.
 */
export async function writeAnswers(
  tx: Queryable,
  attemptId: string,
  versionId: string,
  items: readonly AnswerInput[],
  now: Date,
): Promise<{ question_id: string; answer: StoredAnswer; saved_at: string }[]> {
  const targets = await loadAnswerTargets(tx, versionId, [...new Set(items.map((i) => i.question_id))]);
  const latest = new Map<string, StoredAnswer>();
  for (const item of items) {
    const target = targets.get(item.question_id);
    if (!target) throw new Error("unreachable");
    latest.set(item.question_id, validateAnswer(target, item.answer));
  }
  for (const [questionId, answer] of latest) {
    await tx`
      insert into public.attempt_answers (attempt_id, question_id, answer, saved_at)
      values (${attemptId}, ${questionId}, ${answer === null ? null : tx.json(answer)}, ${now})
      on conflict (attempt_id, question_id)
      do update set answer = excluded.answer, saved_at = excluded.saved_at
    `;
  }
  await tx`update public.attempts set last_saved_at = ${now} where id = ${attemptId}`;
  return [...latest].map(([questionId, answer]) => ({
    question_id: questionId,
    answer,
    saved_at: now.toISOString(),
  }));
}

/** PATCH /api/attempts/:attemptId/answers — autosave (api-contract §5). */
export async function saveAnswers(sql: Sql, user: CurrentUser, attemptId: string, items: readonly AnswerInput[], now: Date) {
  assertAcceptsChanges(await finalizeIfExpired(sql, attemptId, user.id, now), now);

  return sql.begin(async (tx) => {
    const attempt = await loadOwnAttempt(tx, attemptId, user.id, { lock: true });
    assertAcceptsChanges({ attempt, finalizedNow: false }, now); // re-check under the lock
    const saved = await writeAnswers(tx, attempt.id, attempt.test_version_id, items, now);
    return {
      saved_at: now.toISOString(),
      answers: saved,
      server_time: now.toISOString(),
      remaining_seconds: remainingSeconds(timerOf(attempt), now),
    };
  });
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
  assertAcceptsChanges(await finalizeIfExpired(sql, attemptId, user.id, now), now);

  return sql.begin(async (tx) => {
    const attempt = await loadOwnAttempt(tx, attemptId, user.id, { lock: true });
    assertAcceptsChanges({ attempt, finalizedNow: false }, now);
    await loadAnswerTargets(tx, attempt.test_version_id, [questionId]);
    await tx`
      insert into public.attempt_answers (attempt_id, question_id, answer, is_flagged, saved_at)
      values (${attempt.id}, ${questionId}, null, ${flagged}, ${now})
      on conflict (attempt_id, question_id)
      do update set is_flagged = excluded.is_flagged
    `;
    return { question_id: questionId, flagged };
  });
}
