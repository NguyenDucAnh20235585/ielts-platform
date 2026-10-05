import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { saveAnswers, setFlag } from "@/server/services/attempt-answers";
import { beginAttempt, getAttempt, getAttemptStatus, startAttempt } from "@/server/services/attempt-lifecycle";
import { getResult, listHistory } from "@/server/services/attempt-results";
import { submitAttempt } from "@/server/services/attempt-submit";
import { getActiveAttemptForTest, getTestDetail, listTests } from "@/server/services/test-catalogue";

import {
  READING_MOCK_1,
  READING_PRACTICE_1,
  allKeys,
  apiError,
  createPublishedTest,
  createUser,
  perfectAnswers,
  secondsAfter,
  testSql,
} from "./helpers";

const sql = testSql();
afterAll(() => sql.end());

const T0 = new Date();
const page = { page: 1, limit: 50 };
const KEY_FIELDS = ["correct_answer", "accepted", "grading_config", "explanation"];

describe("catalogue (W1-06)", () => {
  it("lists the seeded published tests with marks, mode and duration", async () => {
    const user = await createUser(sql);
    const list = await listTests(sql, user, page, T0);
    const mock = list.items.find((t) => t.id === READING_MOCK_1);
    const practice = list.items.find((t) => t.id === READING_PRACTICE_1);
    expect(mock).toMatchObject({ type: "READING", mode: "MOCK", duration_seconds: 3600, question_count: 40, active_attempt_id: null });
    expect(practice).toMatchObject({ mode: "PRACTICE", duration_seconds: null, question_count: 13 });
    expect(list.pagination.total).toBeGreaterThanOrEqual(2);
  });

  it("filters by mode and searches titles", async () => {
    const user = await createUser(sql);
    const practice = await listTests(sql, user, { ...page, mode: "practice" }, T0);
    expect(practice.items.every((t) => t.mode === "PRACTICE")).toBe(true);
    const pencil = await listTests(sql, user, { ...page, search: "pencil" }, T0);
    expect(pencil.items.map((t) => t.id)).toEqual([READING_PRACTICE_1]);
  });

  it("shows test details and rejects unknown tests", async () => {
    const user = await createUser(sql);
    await expect(getTestDetail(sql, user, READING_MOCK_1, T0)).resolves.toMatchObject({
      status: "PUBLISHED",
      section_count: 3,
      active_attempt: null,
      settings: { answer_visibility: "AFTER_SUBMIT" },
    });
    expect((await apiError(getTestDetail(sql, user, randomUUID(), T0))).code).toBe("TEST_NOT_FOUND");
  });
});

describe("attempt flow on Reading Mock 1 (W1-07 – W1-09)", () => {
  it("start → begin → autosave → flag → submit → result → history", async () => {
    const student = await createUser(sql);
    const other = await createUser(sql);

    // start: CREATED, no content yet
    const started = await startAttempt(sql, student, READING_MOCK_1, T0);
    expect(started.attempt).toMatchObject({ status: "CREATED", started_at: null, expires_at: null, remaining_seconds: null });
    expect(started.preload).toEqual({ audio: [] });
    const attemptId = started.attempt.id;

    const again = await apiError(startAttempt(sql, student, READING_MOCK_1, T0));
    expect(again).toEqual({ code: "ACTIVE_ATTEMPT_EXISTS", details: { attempt_id: attemptId } });
    expect((await getAttempt(sql, student, attemptId, T0)).sections).toBeNull();
    expect((await getActiveAttemptForTest(sql, student, READING_MOCK_1, T0)).active_attempt?.attempt_id).toBe(attemptId);

    const firstQuestionId = randomUUID();
    expect((await apiError(saveAnswers(sql, student, attemptId, [{ question_id: firstQuestionId, answer: null }], T0))).code).toBe("ATTEMPT_NOT_STARTED");

    // begin: timer starts, content arrives, numbering 1–40, no answer keys anywhere
    const begun = await beginAttempt(sql, student, attemptId, T0);
    expect(begun.attempt).toMatchObject({ status: "IN_PROGRESS", remaining_seconds: 3600 });
    expect(begun.attempt.expires_at).toBe(secondsAfter(T0, 3600).toISOString());
    const sections = begun.sections ?? [];
    expect(sections).toHaveLength(3);
    const questions = sections.flatMap((s) => s.question_groups.flatMap((g) => g.questions));
    expect(questions.flatMap((q) => q.numbers)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
    for (const field of KEY_FIELDS) expect(allKeys(begun).has(field)).toBe(false);

    const later = await beginAttempt(sql, student, attemptId, secondsAfter(T0, 60));
    expect(later.attempt.started_at).toBe(T0.toISOString()); // idempotent, timer not reset

    // autosave
    const q1 = questions[0];
    const q2 = questions[1];
    if (!q1 || !q2) throw new Error("seed has no questions");
    const saved = await saveAnswers(sql, student, attemptId, [{ question_id: q1.id, answer: { choice: "TRUE" } }], secondsAfter(T0, 30));
    expect(saved).toMatchObject({ answers: [{ question_id: q1.id, answer: { choice: "TRUE" } }], remaining_seconds: 3570 });
    expect((await apiError(saveAnswers(sql, student, attemptId, [{ question_id: q1.id, answer: { choice: "MAYBE" } }], T0))).code).toBe("INVALID_ANSWER");
    expect((await apiError(saveAnswers(sql, student, attemptId, [{ question_id: randomUUID(), answer: null }], T0))).code).toBe("QUESTION_NOT_FOUND");

    await setFlag(sql, student, attemptId, q2.id, true, secondsAfter(T0, 40));
    const resumed = await getAttempt(sql, student, attemptId, secondsAfter(T0, 50));
    expect(resumed.answers).toEqual([expect.objectContaining({ question_id: q1.id, answer: { choice: "TRUE" } })]);
    expect(resumed.flags).toEqual([q2.id]);

    // user B cannot see or touch user A's attempt
    for (const call of [
      () => getAttempt(sql, other, attemptId, T0),
      () => saveAnswers(sql, other, attemptId, [{ question_id: q1.id, answer: null }], T0),
      () => submitAttempt(sql, other, attemptId, undefined, T0),
      () => getResult(sql, other, attemptId, T0),
    ]) {
      expect((await apiError(call())).code).toBe("ATTEMPT_NOT_FOUND");
    }

    expect((await apiError(getResult(sql, student, attemptId, T0))).code).toBe("RESULT_NOT_READY");

    // submit with every answer correct → 40/40, band 9
    const answers = await perfectAnswers(sql, begun.test_version.id);
    const result = await submitAttempt(sql, student, attemptId, answers, secondsAfter(T0, 600));
    expect(result.result).toMatchObject({
      status: "SUBMITTED",
      raw_score: 40,
      max_score: 40,
      band_score: 9,
      correct_count: 40,
      incorrect_count: 0,
      unanswered_count: 0,
      time_taken_seconds: 600,
      answers_visible: true,
    });
    expect(result.section_results.map((s) => s.max_score)).toEqual([13, 13, 14]);
    expect(result.answers.every((a) => a.is_correct === true && a.correct_answer !== null)).toBe(true);

    // idempotent submit, one result row, attempt locked
    const twice = await submitAttempt(sql, student, attemptId, undefined, secondsAfter(T0, 700));
    expect(twice).toEqual(result);
    const resultRows = await sql<{ count: number }[]>`select count(*)::int as count from public.results where attempt_id = ${attemptId}`;
    expect(resultRows[0]?.count).toBe(1);
    expect((await apiError(saveAnswers(sql, student, attemptId, [{ question_id: q1.id, answer: null }], secondsAfter(T0, 800)))).code).toBe("ATTEMPT_LOCKED");
    await expect(getResult(sql, student, attemptId, secondsAfter(T0, 900))).resolves.toEqual(result);

    const history = await listHistory(sql, student, page, secondsAfter(T0, 900));
    expect(history.items).toEqual([
      expect.objectContaining({ id: attemptId, status: "SUBMITTED", raw_score: 40, max_score: 40, band_score: 9, time_taken_seconds: 600 }),
    ]);

    // a new attempt may start (no max_attempts on this test)
    await expect(startAttempt(sql, student, READING_MOCK_1, secondsAfter(T0, 1000))).resolves.toBeDefined();
  });
});

describe("server timer and lazy expiry (D-005)", () => {
  async function begunAttempt() {
    const user = await createUser(sql);
    const { attempt } = await startAttempt(sql, user, READING_MOCK_1, T0);
    const begun = await beginAttempt(sql, user, attempt.id, T0);
    const firstQuestion = begun.sections?.[0]?.question_groups[0]?.questions[0];
    if (!firstQuestion) throw new Error("no question");
    return { user, attemptId: attempt.id, questionId: firstQuestion.id };
  }

  it("accepts answers during the 30 s grace period, then auto-submits on the next request", async () => {
    const { user, attemptId, questionId } = await begunAttempt();
    await expect(
      saveAnswers(sql, user, attemptId, [{ question_id: questionId, answer: { choice: "TRUE" } }], secondsAfter(T0, 3600 + 20)),
    ).resolves.toMatchObject({ remaining_seconds: 0 });

    const status = await getAttemptStatus(sql, user, attemptId, secondsAfter(T0, 3600 + 31));
    expect(status).toMatchObject({ status: "AUTO_SUBMITTED", remaining_seconds: 0 });

    const result = await getResult(sql, user, attemptId, secondsAfter(T0, 3700));
    expect(result.result).toMatchObject({ status: "AUTO_SUBMITTED", time_taken_seconds: 3600, correct_count: 1, unanswered_count: 39 });
    expect(result.result.submitted_at).toBe(secondsAfter(T0, 3600).toISOString());
    expect((await apiError(saveAnswers(sql, user, attemptId, [{ question_id: questionId, answer: null }], secondsAfter(T0, 3800)))).code).toBe("ATTEMPT_LOCKED");
  });

  it("an autosave after the grace period finalizes the attempt and reports ATTEMPT_EXPIRED", async () => {
    const { user, attemptId, questionId } = await begunAttempt();
    const error = await apiError(
      saveAnswers(sql, user, attemptId, [{ question_id: questionId, answer: { choice: "TRUE" } }], secondsAfter(T0, 3600 + 31)),
    );
    expect(error).toEqual({ code: "ATTEMPT_EXPIRED", details: { status: "AUTO_SUBMITTED" } });
    await expect(getResult(sql, user, attemptId, secondsAfter(T0, 3700))).resolves.toMatchObject({ result: { unanswered_count: 40 } });
  });

  it("history finalizes the caller's expired attempts", async () => {
    const { user, attemptId } = await begunAttempt();
    const history = await listHistory(sql, user, page, secondsAfter(T0, 4000));
    expect(history.items).toEqual([expect.objectContaining({ id: attemptId, status: "AUTO_SUBMITTED", raw_score: 0 })]);
  });
});

describe("practice test without a time limit", () => {
  it("never expires and gives no band for a 13-mark test", async () => {
    const user = await createUser(sql);
    const { attempt } = await startAttempt(sql, user, READING_PRACTICE_1, T0);
    const begun = await beginAttempt(sql, user, attempt.id, T0);
    expect(begun.attempt).toMatchObject({ expires_at: null, remaining_seconds: null });

    const result = await submitAttempt(sql, user, attempt.id, await perfectAnswers(sql, begun.test_version.id), secondsAfter(T0, 100_000));
    expect(result.result).toMatchObject({ status: "SUBMITTED", raw_score: 13, max_score: 13, band_score: null, answers_visible: true });
  });
});

describe("test settings", () => {
  it("max_attempts and answer_visibility = NEVER", async () => {
    const user = await createUser(sql);
    const test = await createPublishedTest(sql, { mode: "mock", timeLimit: 600, maxAttempts: 1, visibility: "never" });
    const { attempt } = await startAttempt(sql, user, test.testId, T0);
    await beginAttempt(sql, user, attempt.id, T0);
    const result = await submitAttempt(sql, user, attempt.id, [{ question_id: test.questionId, answer: { choice: "FALSE" } }], secondsAfter(T0, 60));

    expect(result.result).toMatchObject({ answers_visible: false, incorrect_count: 1 });
    expect(result.answers[0]).toMatchObject({ your_answer: { choice: "FALSE" }, is_correct: null, correct_answer: null, explanation: null });
    expect((await apiError(startAttempt(sql, user, test.testId, secondsAfter(T0, 120)))).code).toBe("MAX_ATTEMPT_REACHED");
  });
});

describe("concurrency", () => {
  it("two simultaneous starts create one attempt", async () => {
    const user = await createUser(sql);
    const outcomes = await Promise.allSettled([
      startAttempt(sql, user, READING_MOCK_1, T0),
      startAttempt(sql, user, READING_MOCK_1, T0),
    ]);
    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find((o) => o.status === "rejected");
    expect(rejected && "reason" in rejected ? rejected.reason.code : null).toBe("ACTIVE_ATTEMPT_EXISTS");
  });

  it("two simultaneous submits store one result and return the same payload", async () => {
    const user = await createUser(sql);
    const { attempt } = await startAttempt(sql, user, READING_MOCK_1, T0);
    await beginAttempt(sql, user, attempt.id, T0);
    const [a, b] = await Promise.all([
      submitAttempt(sql, user, attempt.id, undefined, secondsAfter(T0, 100)),
      submitAttempt(sql, user, attempt.id, undefined, secondsAfter(T0, 100)),
    ]);
    expect(a).toEqual(b);
    const rows = await sql<{ count: number }[]>`select count(*)::int as count from public.results where attempt_id = ${attempt.id}`;
    expect(rows[0]?.count).toBe(1);
  });
});
