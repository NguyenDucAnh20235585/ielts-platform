import { afterAll, describe, expect, it } from "vitest";

import { GRACE_SECONDS } from "@/shared/attempt/timer";
import { saveAnswers, setFlag } from "@/backend/services/attempt-answers";
import { beginAttempt, getAttemptStatus, startAttempt } from "@/backend/services/attempt-lifecycle";
import { getResult } from "@/backend/services/attempt-results";
import { submitAttempt } from "@/backend/services/attempt-submit";
import { getTestDetail, listTests } from "@/backend/services/test-catalogue";

import { apiError, createPublishedTest, createUser, secondsAfter, testSql } from "./helpers";

/**
 * The timer rule at its exact boundaries, on a real database (D-016):
 * the clock is up AT expires_at; answers still count until expires_at + 15 s
 * inclusive; 1 ms later the attempt is closed with what was saved — by any
 * request that looks at it: its own endpoints, the test list and page, a new start.
 */

const sql = testSql();
afterAll(() => sql.end());

const T0 = new Date("2026-11-16T09:00:00.000Z");
const LIMIT = 600; // seconds
const at = (seconds: number) => secondsAfter(T0, seconds);
const END = LIMIT; // expires_at, in seconds after T0
const GRACE_END = LIMIT + GRACE_SECONDS;

/** A begun attempt on a one-question MOCK test (10 min); the key of the question is TRUE. */
async function running() {
  const test = await createPublishedTest(sql, { mode: "mock", timeLimit: LIMIT, maxAttempts: null, visibility: "after_submit" });
  const user = await createUser(sql);
  const { attempt } = await startAttempt(sql, user, test.testId, "mock", T0);
  await beginAttempt(sql, user, attempt.id, T0);
  const correct = [{ question_id: test.questionId, answer: { choice: "TRUE" } }];
  return { user, attemptId: attempt.id, questionId: test.questionId, correct };
}

async function savedAnswerCount(attemptId: string) {
  const rows = await sql<{ count: number }[]>`
    select count(*)::int as count from public.attempt_answers where attempt_id = ${attemptId} and answer is not null
  `;
  return rows[0]?.count ?? 0;
}

async function resultCount(attemptId: string) {
  const rows = await sql<{ count: number }[]>`select count(*)::int as count from public.results where attempt_id = ${attemptId}`;
  return rows[0]?.count ?? 0;
}

describe("timer boundaries (D-016, grace = 15 s)", () => {
  it("submit 1 ms before expires_at is SUBMITTED at that moment", async () => {
    const a = await running();
    const result = await submitAttempt(sql, a.user, a.attemptId, a.correct, at(END - 0.001));
    expect(result.result).toMatchObject({ status: "SUBMITTED", correct_count: 1, time_taken_seconds: LIMIT - 1 });
    expect(result.result.submitted_at).toBe(at(END - 0.001).toISOString());
  });

  it("submit exactly at expires_at is AUTO_SUBMITTED at expires_at and keeps the answers sent with it", async () => {
    const a = await running();
    const result = await submitAttempt(sql, a.user, a.attemptId, a.correct, at(END));
    expect(result.result).toMatchObject({ status: "AUTO_SUBMITTED", correct_count: 1, time_taken_seconds: LIMIT });
    expect(result.result.submitted_at).toBe(at(END).toISOString());
  });

  it("autosave in the grace window is saved, up to expires_at + 15 s inclusive", async () => {
    const a = await running();
    await expect(saveAnswers(sql, a.user, a.attemptId, a.correct, at(GRACE_END))).resolves.toMatchObject({
      remaining_seconds: 0,
    });
    expect(await savedAnswerCount(a.attemptId)).toBe(1);
    await expect(getAttemptStatus(sql, a.user, a.attemptId, at(GRACE_END))).resolves.toMatchObject({ status: "IN_PROGRESS" });

    // 1 ms later the next request closes it with the answer saved in the grace window.
    await expect(getAttemptStatus(sql, a.user, a.attemptId, at(GRACE_END + 0.001))).resolves.toMatchObject({
      status: "AUTO_SUBMITTED",
    });
    const result = await getResult(sql, a.user, a.attemptId, at(GRACE_END + 1));
    expect(result.result).toMatchObject({ status: "AUTO_SUBMITTED", correct_count: 1, time_taken_seconds: LIMIT });
    expect(result.result.submitted_at).toBe(at(END).toISOString());
  });

  it("submit in the grace window keeps the final answers", async () => {
    const a = await running();
    const result = await submitAttempt(sql, a.user, a.attemptId, a.correct, at(END + 12));
    expect(result.result).toMatchObject({ status: "AUTO_SUBMITTED", correct_count: 1, unanswered_count: 0 });
  });

  it("submit 1 ms after the grace window ignores the answers in the body and returns the auto-submitted result", async () => {
    const a = await running();
    const result = await submitAttempt(sql, a.user, a.attemptId, a.correct, at(GRACE_END + 0.001));
    expect(result.result).toMatchObject({ status: "AUTO_SUBMITTED", correct_count: 0, unanswered_count: 1 });
    expect(await savedAnswerCount(a.attemptId)).toBe(0);
    expect(await resultCount(a.attemptId)).toBe(1);
  });

  it("autosave and flag after the grace window are refused and close the attempt", async () => {
    const a = await running();
    expect(await apiError(saveAnswers(sql, a.user, a.attemptId, a.correct, at(GRACE_END + 0.001)))).toEqual({
      code: "ATTEMPT_EXPIRED",
      details: { status: "AUTO_SUBMITTED" },
    });
    expect((await apiError(setFlag(sql, a.user, a.attemptId, a.questionId, true, at(GRACE_END + 5)))).code).toBe("ATTEMPT_LOCKED");
    expect(await savedAnswerCount(a.attemptId)).toBe(0);
  });

  it("an explicit submit and a lazy expiry at the same moment store one result", async () => {
    const a = await running();
    const moment = at(GRACE_END + 30);
    const outcomes = await Promise.allSettled([
      submitAttempt(sql, a.user, a.attemptId, a.correct, moment),
      getAttemptStatus(sql, a.user, a.attemptId, moment),
      getResult(sql, a.user, a.attemptId, moment),
    ]);
    expect(outcomes.every((o) => o.status === "fulfilled")).toBe(true);
    expect(await resultCount(a.attemptId)).toBe(1);
    await expect(getAttemptStatus(sql, a.user, a.attemptId, moment)).resolves.toMatchObject({ status: "AUTO_SUBMITTED" });
  });

  it("the test page and a new start see the attempt running until the grace window ends, closed 1 ms later", async () => {
    const a = await running();
    const testId = (await sql<{ test_id: string }[]>`select test_id from public.attempts where id = ${a.attemptId}`)[0]?.test_id ?? "";
    await saveAnswers(sql, a.user, a.attemptId, a.correct, at(END + 1));

    const detail = await getTestDetail(sql, a.user, testId, at(GRACE_END));
    expect(detail.active_attempt).toMatchObject({ attempt_id: a.attemptId, status: "IN_PROGRESS" });
    const blocked = await apiError(startAttempt(sql, a.user, testId, "mock", at(GRACE_END)));
    expect(blocked).toEqual({ code: "ACTIVE_ATTEMPT_EXISTS", details: { attempt_id: a.attemptId } });

    // Past the grace window: the list and the test page close it, with the answer saved in time.
    const list = await listTests(sql, a.user, { page: 1, limit: 100 }, at(GRACE_END + 0.001));
    expect(list.items.find((t) => t.id === testId)).toMatchObject({ active_attempt_id: null });
    await expect(getTestDetail(sql, a.user, testId, at(GRACE_END + 0.001))).resolves.toMatchObject({ active_attempt: null });
    const result = await getResult(sql, a.user, a.attemptId, at(GRACE_END + 1));
    expect(result.result).toMatchObject({ status: "AUTO_SUBMITTED", correct_count: 1 });
  });

  it("an expired attempt nobody closed yet does not block a new start", async () => {
    const a = await running();
    const testId = (await sql<{ test_id: string }[]>`select test_id from public.attempts where id = ${a.attemptId}`)[0]?.test_id ?? "";
    await saveAnswers(sql, a.user, a.attemptId, a.correct, at(60));

    const { attempt } = await startAttempt(sql, a.user, testId, "mock", at(GRACE_END + 0.001));
    expect(attempt).toMatchObject({ status: "CREATED" });
    expect(attempt.id).not.toBe(a.attemptId);
    expect(await resultCount(a.attemptId)).toBe(1);
    const old = await getResult(sql, a.user, a.attemptId, at(GRACE_END + 1));
    expect(old.result).toMatchObject({ status: "AUTO_SUBMITTED", correct_count: 1 });
    expect(old.result.submitted_at).toBe(at(END).toISOString());
  });
});
