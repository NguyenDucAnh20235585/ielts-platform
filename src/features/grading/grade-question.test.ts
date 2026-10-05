import { describe, expect, it } from "vitest";

import { type GradableQuestion, gradeQuestion } from "./grade-question";
import type { Rules } from "./rules";

const noRules: Rules = { maxWords: null, allowNumber: false, selectCount: null, allowOptionReuse: false };

const choice = (key: string): GradableQuestion => ({
  answerFormat: "choice",
  marks: 1,
  rules: noRules,
  correctAnswer: { choice: key },
  gradingConfig: {},
});

const multi = (keys: string[]): GradableQuestion => ({
  answerFormat: "multi_choice",
  marks: keys.length,
  rules: { ...noRules, selectCount: keys.length },
  correctAnswer: { choices: keys },
  gradingConfig: {},
});

const text = (accepted: string[], rules: Partial<Rules> = {}, gradingConfig: unknown = {}): GradableQuestion => ({
  answerFormat: "text",
  marks: 1,
  rules: { ...noRules, ...rules },
  correctAnswer: { accepted },
  gradingConfig,
});

describe("gradeQuestion — every mark is correct, incorrect or unanswered", () => {
  it("CHOICE (TFNG / matching / MCQ single)", () => {
    expect(gradeQuestion(choice("NOT_GIVEN"), { choice: "NOT_GIVEN" })).toMatchObject({ score: 1, correctMarks: 1, isCorrect: true });
    expect(gradeQuestion(choice("NOT_GIVEN"), { choice: "FALSE" })).toMatchObject({ score: 0, incorrectMarks: 1, isCorrect: false });
    expect(gradeQuestion(choice("B"), null)).toMatchObject({ score: 0, unansweredMarks: 1 });
  });

  it("MULTI_CHOICE: one mark per correct letter, order does not matter, no negative marking (D-006)", () => {
    const q = multi(["A", "D"]);
    expect(gradeQuestion(q, { choices: ["D", "A"] })).toMatchObject({ score: 2, correctMarks: 2, incorrectMarks: 0, unansweredMarks: 0, isCorrect: true });
    expect(gradeQuestion(q, { choices: ["A", "C"] })).toMatchObject({ score: 1, correctMarks: 1, incorrectMarks: 1, unansweredMarks: 0 });
    expect(gradeQuestion(q, { choices: ["A"] })).toMatchObject({ score: 1, correctMarks: 1, incorrectMarks: 0, unansweredMarks: 1 });
    expect(gradeQuestion(q, { choices: ["B"] })).toMatchObject({ score: 0, correctMarks: 0, incorrectMarks: 1, unansweredMarks: 1 });
    expect(gradeQuestion(q, null)).toMatchObject({ score: 0, unansweredMarks: 2 });
  });

  it("MULTI_CHOICE: duplicates count once; more letters than allowed scores 0", () => {
    expect(gradeQuestion(multi(["A", "D"]), { choices: ["A", "A"] })).toMatchObject({ score: 1, unansweredMarks: 1 });
    expect(gradeQuestion(multi(["A", "D"]), { choices: ["A", "D", "E"] })).toMatchObject({ score: 0, incorrectMarks: 2 });
  });

  it("TEXT: normalised comparison against every accepted variant", () => {
    const q = text(["car", "a car"]);
    expect(gradeQuestion(q, { text: " Car. " })).toMatchObject({ score: 1 });
    expect(gradeQuestion(q, { text: "A CAR" })).toMatchObject({ score: 1 });
    expect(gradeQuestion(q, { text: "the car" })).toMatchObject({ score: 0, incorrectMarks: 1 });
  });

  it("TEXT: spelling must be exact", () => {
    expect(gradeQuestion(text(["environment"]), { text: "enviroment" })).toMatchObject({ score: 0 });
  });

  it("TEXT: a correct answer over the word limit is wrong", () => {
    const q = text(["the old bridge", "old bridge"], { maxWords: 2 });
    expect(gradeQuestion(q, { text: "old bridge" })).toMatchObject({ score: 1 });
    expect(gradeQuestion(q, { text: "the old bridge" })).toMatchObject({ score: 0, incorrectMarks: 1 });
  });

  it("TEXT: blank text counts as unanswered", () => {
    expect(gradeQuestion(text(["car"]), { text: "   " })).toMatchObject({ unansweredMarks: 1, incorrectMarks: 0 });
  });

  it("TEXT: grading_config case_sensitive", () => {
    const q = text(["Paris"], {}, { case_sensitive: true });
    expect(gradeQuestion(q, { text: "Paris" })).toMatchObject({ score: 1 });
    expect(gradeQuestion(q, { text: "paris" })).toMatchObject({ score: 0 });
  });

  it("a malformed student answer is graded as wrong, not as an error", () => {
    expect(gradeQuestion(choice("A"), { text: "A" })).toMatchObject({ score: 0, incorrectMarks: 1 });
    expect(gradeQuestion(text(["car"]), { choice: "A" })).toMatchObject({ score: 0, incorrectMarks: 1 });
  });

  it("a malformed answer KEY throws (submit rolls back with GRADING_FAILED)", () => {
    const broken: GradableQuestion = { ...choice("A"), correctAnswer: { accepted: ["A"] } };
    expect(() => gradeQuestion(broken, { choice: "A" })).toThrow();
  });
});
