import { describe, expect, it } from "vitest";

import type { BandRange } from "./band";
import { type AttemptQuestion, gradeAttempt } from "./grade-attempt";

const noRules = { maxWords: null, allowNumber: false, selectCount: null, allowOptionReuse: false };
const bands: BandRange[] = [
  { minRaw: 0, maxRaw: 29, band: 6 },
  { minRaw: 30, maxRaw: 40, band: 7 },
];

function tfng(id: string, section: string, n: number, answer: string | null): AttemptQuestion {
  return {
    questionId: id,
    sectionId: section,
    numbers: [n],
    answerFormat: "choice",
    marks: 1,
    rules: noRules,
    correctAnswer: { choice: "TRUE" },
    gradingConfig: {},
    answer: answer === null ? null : { choice: answer },
  };
}

describe("gradeAttempt", () => {
  it("adds up counts per attempt and per section, in test order", () => {
    const questions: AttemptQuestion[] = [
      tfng("q1", "s1", 1, "TRUE"),
      tfng("q2", "s1", 2, "FALSE"),
      tfng("q3", "s2", 3, null),
      {
        questionId: "q4",
        sectionId: "s2",
        numbers: [4, 5],
        answerFormat: "multi_choice",
        marks: 2,
        rules: { ...noRules, selectCount: 2 },
        correctAnswer: { choices: ["A", "B"] },
        gradingConfig: {},
        answer: { choices: ["A", "C"] },
      },
    ];
    const result = gradeAttempt(questions, bands);

    expect(result).toMatchObject({
      correctCount: 2,
      incorrectCount: 2,
      unansweredCount: 1,
      rawScore: 2,
      maxScore: 5,
      bandScore: null, // not a 40-mark test
    });
    expect(result.sections).toEqual([
      { sectionId: "s1", correctCount: 1, maxScore: 2 },
      { sectionId: "s2", correctCount: 1, maxScore: 3 },
    ]);
    expect(result.questions.map((q) => q.questionId)).toEqual(["q1", "q2", "q3", "q4"]);
  });

  it("gives a band for a full 40-mark test", () => {
    const questions = Array.from({ length: 40 }, (_, i) =>
      tfng(`q${i + 1}`, i < 13 ? "s1" : i < 26 ? "s2" : "s3", i + 1, i < 31 ? "TRUE" : "FALSE"),
    );
    const result = gradeAttempt(questions, bands);
    expect(result).toMatchObject({ rawScore: 31, maxScore: 40, bandScore: 7, incorrectCount: 9 });
    expect(result.correctCount + result.incorrectCount + result.unansweredCount).toBe(result.maxScore);
  });

  it("an empty attempt scores zero", () => {
    expect(gradeAttempt([], bands)).toMatchObject({ rawScore: 0, maxScore: 0, bandScore: null, sections: [] });
  });
});
