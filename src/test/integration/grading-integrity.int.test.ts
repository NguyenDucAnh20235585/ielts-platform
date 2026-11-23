import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  answerKeyBody,
  createGroupBody,
  createQuestionBody,
  createSectionBody,
  createTestBody,
} from "@/backend/admin/request-schemas";
import { gradingSnapshotSchema } from "@/shared/grading/snapshot";
import { createGroup, createQuestion, createSection, putAnswerKey } from "@/backend/services/admin-content";
import { createAdminTest } from "@/backend/services/admin-tests";
import { publishVersion } from "@/backend/services/admin-versions";
import { saveAnswers } from "@/backend/services/attempt-answers";
import { beginAttempt, startAttempt } from "@/backend/services/attempt-lifecycle";
import { submitAttempt } from "@/backend/services/attempt-submit";

import { apiError, createUser, testSql } from "./helpers";

/**
 * A 13-question Reading passage shaped like the lead's Cambridge import
 * (TRUE/FALSE/NOT GIVEN + one-word note completion), with ORIGINAL content,
 * graded end to end on a real database. Checks what is stored in `results`
 * and in the snapshot, not only the response.
 */

const sql = testSql();
afterAll(() => sql.end());
const T0 = new Date("2026-11-16T09:00:00.000Z");

type Built = { testId: string; versionId: string; q: string[] };
let built: Built;

// Keys: Q1–7 TFNG, Q8–13 note completion (ONE WORD AND/OR A NUMBER).
const TFNG_KEYS = ["TRUE", "NOT_GIVEN", "NOT_GIVEN", "FALSE", "FALSE", "FALSE", "TRUE"];
const NOTE_KEYS = [["lighthouse"], ["copper"], ["1887"], ["harbour", "harbor"], ["merchants"], ["well-known"]];

beforeAll(async () => {
  const admin = await createUser(sql, "admin");
  const created = await createAdminTest(sql, admin, createTestBody.parse({ title: "IT 13-question passage", type: "READING" }));
  const versionId = created.test_version.id;
  const section = await createSection(sql, versionId, createSectionBody.parse({ title: "Passage 1", content: "Original passage." }));
  const tfng = await createGroup(sql, section.id, createGroupBody.parse({ instruction: "Questions 1–7: TRUE / FALSE / NOT GIVEN" }));
  const notes = await createGroup(sql, section.id, createGroupBody.parse({
    instruction: "Questions 8–13: Complete the notes. Write ONE WORD AND/OR A NUMBER for each answer.",
    rules: { max_words: 1, allow_number: true },
  }));
  const q: string[] = [];
  for (const [i, key] of TFNG_KEYS.entries()) {
    const question = await createQuestion(sql, tfng.id, createQuestionBody.parse({ type: "TRUE_FALSE_NOT_GIVEN", content: `Statement ${i + 1}` }));
    await putAnswerKey(sql, admin, question.id, answerKeyBody.parse({ correct_answer: { choice: key } }));
    q.push(question.id);
  }
  for (const [i, accepted] of NOTE_KEYS.entries()) {
    const question = await createQuestion(sql, notes.id, createQuestionBody.parse({ type: "NOTE_COMPLETION", content: `Note ${i + 8}` }));
    await putAnswerKey(sql, admin, question.id, answerKeyBody.parse({ correct_answer: { accepted } }));
    q.push(question.id);
  }
  await publishVersion(sql, admin, versionId, T0);
  built = { testId: created.test.id, versionId, q };
});

async function begun() {
  const student = await createUser(sql);
  const { attempt } = await startAttempt(sql, student, built.testId, "practice", T0);
  await beginAttempt(sql, student, attempt.id, T0);
  return { student, attemptId: attempt.id };
}

const id = (n: number) => built.q[n - 1] ?? "";

describe("grading a 13-question passage on Postgres", () => {
  it("rejects answers in the wrong format at autosave (TFNG keys, text length)", async () => {
    const { student, attemptId } = await begun();
    for (const bad of [{ choice: "NOT GIVEN" }, { choice: "true" }, { choice: "T" }, { text: "TRUE" }]) {
      const error = await apiError(saveAnswers(sql, student, attemptId, [{ question_id: id(1), answer: bad }], T0));
      expect([bad, error.code]).toEqual([bad, "INVALID_ANSWER"]);
    }
    const tooLong = await apiError(saveAnswers(sql, student, attemptId, [{ question_id: id(8), answer: { text: "x".repeat(201) } }], T0));
    expect(tooLong.code).toBe("INVALID_ANSWER");
    expect((await apiError(saveAnswers(sql, student, attemptId, [{ question_id: id(8), answer: { choice: "A" } }], T0))).code)
      .toBe("INVALID_ANSWER");
  });

  it("scores each answer as expected and stores exactly that in results and the snapshot", async () => {
    const { student, attemptId } = await begun();
    const answers: [number, Record<string, unknown>, number][] = [
      // [question number, answer sent, expected score]
      [1, { choice: "TRUE" }, 1],
      [2, { choice: "FALSE" }, 0], // key NOT_GIVEN
      [3, { choice: "NOT_GIVEN" }, 1],
      // 4: not answered → unanswered
      [5, { choice: "TRUE" }, 0], // key FALSE
      [6, { choice: "FALSE" }, 1],
      [7, { choice: "NOT_GIVEN" }, 0], // key TRUE
      [8, { text: "Lighthouse." }, 1], // case and trailing full stop are ignored
      [9, { text: "the copper" }, 0], // 2 words: over the ONE WORD limit
      [10, { text: "1887" }, 1], // a number is allowed
      [11, { text: "harbor" }, 1], // second accepted spelling
      [12, { text: "merchant" }, 0], // spelling must be exact
      [13, { text: "  WELL-KNOWN " }, 1], // hyphenated word = one word; spaces and case ignored
    ];
    await saveAnswers(sql, student, attemptId, answers.map(([n, answer]) => ({ question_id: id(n), answer })), T0);
    const { result, answers: perQuestion } = await submitAttempt(sql, student, attemptId, undefined, T0);

    expect(result).toMatchObject({
      status: "SUBMITTED", correct_count: 7, incorrect_count: 5, unanswered_count: 1,
      raw_score: 7, max_score: 13, band_score: null, answers_visible: true,
    });
    const expected = new Map(answers.map(([n, , score]) => [n, score]));
    for (const a of perQuestion) {
      const n = a.numbers[0] ?? 0;
      expect([n, a.score]).toEqual([n, expected.get(n) ?? 0]);
    }

    // What is in the database, read back directly.
    const rows = await sql<{
      correct_count: number; incorrect_count: number; unanswered_count: number;
      raw_score: string; max_score: string; band_score: string | null; grading_snapshot: unknown;
    }[]>`select correct_count, incorrect_count, unanswered_count, raw_score, max_score, band_score, grading_snapshot
          from public.results where attempt_id = ${attemptId}`;
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row && [row.correct_count, row.incorrect_count, row.unanswered_count, Number(row.raw_score), Number(row.max_score), row.band_score])
      .toEqual([7, 5, 1, 7, 13, null]);
    const snapshot = gradingSnapshotSchema.parse(row?.grading_snapshot);
    expect(snapshot.questions.map((q) => [q.numbers[0], q.score])).toEqual(
      Array.from({ length: 13 }, (_, i) => [i + 1, expected.get(i + 1) ?? 0]),
    );
    expect(snapshot.questions[3]).toMatchObject({ your_answer: null, correct_answer: { choice: "FALSE" } });
    expect(snapshot.questions[10]).toMatchObject({ your_answer: { text: "harbor" }, correct_answer: { accepted: ["harbour", "harbor"] } });
  });

  it("an empty text answer is stored as no answer (unanswered, not incorrect)", async () => {
    const { student, attemptId } = await begun();
    await saveAnswers(sql, student, attemptId, [{ question_id: id(8), answer: { text: "   " } }], T0);
    const stored = await sql<{ answer: unknown }[]>`
      select answer from public.attempt_answers where attempt_id = ${attemptId} and question_id = ${id(8)}`;
    expect(stored[0]?.answer).toBeNull();
    const { result } = await submitAttempt(sql, student, attemptId, undefined, T0);
    expect(result).toMatchObject({ correct_count: 0, incorrect_count: 0, unanswered_count: 13 });
  });
});

describe("concurrency on submit and autosave", () => {
  it("ten parallel submits with different answers: one result, one grading, ten identical responses", async () => {
    const { student, attemptId } = await begun();
    const calls = Array.from({ length: 10 }, (_, i) =>
      submitAttempt(sql, student, attemptId, [{ question_id: id(1), answer: { choice: i % 2 === 0 ? "TRUE" : "FALSE" } }], T0),
    );
    const responses = await Promise.all(calls);
    for (const response of responses) expect(response).toEqual(responses[0]);

    const rows = await sql<{ results: number; graded: number }[]>`
      select (select count(*)::int from public.results where attempt_id = ${attemptId}) as results,
             (select count(*)::int from public.attempts where id = ${attemptId} and status = 'submitted') as graded`;
    expect(rows[0]).toEqual({ results: 1, graded: 1 });
    // The stored answer is the one the result was graded with.
    const stored = await sql<{ answer: unknown }[]>`
      select answer from public.attempt_answers where attempt_id = ${attemptId} and question_id = ${id(1)}`;
    expect(responses[0]?.answers[0]?.your_answer).toEqual(stored[0]?.answer);
  });

  it("an autosave racing a submit is either graded or refused, never saved after grading", async () => {
    for (let round = 0; round < 5; round += 1) {
      const { student, attemptId } = await begun();
      const [save, submit] = await Promise.allSettled([
        saveAnswers(sql, student, attemptId, [{ question_id: id(1), answer: { choice: "TRUE" } }], T0),
        submitAttempt(sql, student, attemptId, undefined, T0),
      ]);
      expect(submit.status).toBe("fulfilled");
      const graded = submit.status === "fulfilled" ? submit.value.answers[0]?.your_answer : undefined;
      if (save.status === "fulfilled") {
        expect(graded).toEqual({ choice: "TRUE" }); // saved before grading → graded
      } else {
        expect((save.reason as { code?: string }).code).toBe("ATTEMPT_LOCKED"); // came after → refused
        expect(graded).toBeNull();
      }
    }
  });

  it("submitting again later returns the stored result unchanged, even with new answers", async () => {
    const { student, attemptId } = await begun();
    const first = await submitAttempt(sql, student, attemptId, [{ question_id: id(1), answer: { choice: "TRUE" } }], T0);
    const again = await submitAttempt(sql, student, attemptId, [{ question_id: id(1), answer: { choice: "FALSE" } }], new Date(T0.getTime() + 60_000));
    expect(again).toEqual(first);
  });
});
