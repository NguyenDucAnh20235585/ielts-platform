import { describe, expect, it } from "vitest";

import { buildResultPayload, type ResultContext } from "./result-view";

const ctx = (visibility: ResultContext["visibility"]): ResultContext => ({
  attempt: { id: "a1", status: "submitted", mode: "mock", started_at: new Date("2026-10-10T08:00:00Z"), submitted_at: new Date("2026-10-10T08:50:00Z") },
  test: { id: "t1", title: "Mock", type: "reading" },
  versionNumber: 1,
  visibility,
  result: { correct_count: 1, incorrect_count: 0, unanswered_count: 0, raw_score: "1.00", max_score: "1.00", band_score: null, time_taken_seconds: 3000 },
  snapshot: {
    schema_version: 1, test_version_id: "v1", graded_at: "2026-10-10T08:50:00Z",
    band_table: { id: null, ranges: [] },
    sections: [{ section_id: "s1", order_no: 1, title: "Passage 1", correct_count: 1, max_score: 1 }],
    questions: [{ question_id: "q1", numbers: [1], type: "true_false_not_given", answer_format: "choice", marks: 1,
      your_answer: { choice: "TRUE" }, correct_answer: { choice: "TRUE" }, explanation: "Paragraph 1", score: 1 }],
  },
});

describe("buildResultPayload", () => {
  it("shows scores, correct answers and explanations when visibility allows", () => {
    const payload = buildResultPayload(ctx("after_submit"));
    expect(payload.result).toMatchObject({ status: "SUBMITTED", raw_score: 1, max_score: 1, band_score: null, answers_visible: true, mode: "MOCK" });
    expect(payload.answers[0]).toEqual({
      question_id: "q1", numbers: [1], type: "TRUE_FALSE_NOT_GIVEN", marks: 1,
      your_answer: { choice: "TRUE" }, score: 1, is_correct: true, correct_answer: { choice: "TRUE" }, explanation: "Paragraph 1",
    });
  });

  it("NEVER: only the student's own answers, no correctness or keys", () => {
    const payload = buildResultPayload(ctx("never"));
    expect(payload.result.answers_visible).toBe(false);
    expect(payload.answers[0]).toMatchObject({ your_answer: { choice: "TRUE" }, score: null, is_correct: null, correct_answer: null, explanation: null });
  });
});
