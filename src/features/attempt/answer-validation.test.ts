import { describe, expect, it } from "vitest";

import { type AnswerTarget, validateAnswer } from "./answer-validation";

const options = [
  { key: "A", text: "a" },
  { key: "B", text: "b" },
  { key: "C", text: "c" },
];
const choice: AnswerTarget = { questionId: "q1", answerFormat: "choice", marks: 1, options };
const multi: AnswerTarget = { questionId: "q2", answerFormat: "multi_choice", marks: 2, options };
const text: AnswerTarget = { questionId: "q3", answerFormat: "text", marks: 1, options: null };

const invalid = expect.objectContaining({ code: "INVALID_ANSWER", details: expect.objectContaining({ question_id: expect.any(String) }) });

describe("validateAnswer", () => {
  it("null clears the answer", () => {
    expect(validateAnswer(choice, null)).toBeNull();
  });

  it("CHOICE: key must be one of the options", () => {
    expect(validateAnswer(choice, { choice: "B" })).toEqual({ choice: "B" });
    expect(() => validateAnswer(choice, { choice: "Z" })).toThrow(invalid);
    expect(() => validateAnswer(choice, { choices: ["A"] })).toThrow(invalid);
  });

  it("MULTI_CHOICE: unique keys, at most `marks` of them", () => {
    expect(validateAnswer(multi, { choices: ["C", "A", "A"] })).toEqual({ choices: ["C", "A"] });
    expect(() => validateAnswer(multi, { choices: ["A", "B", "C"] })).toThrow(invalid);
    expect(() => validateAnswer(multi, { choices: ["A", "Z"] })).toThrow(invalid);
  });

  it("TEXT: trimmed, blank becomes null, max 200 characters, word limit not checked", () => {
    expect(validateAnswer(text, { text: "  carbon dioxide " })).toEqual({ text: "carbon dioxide" });
    expect(validateAnswer(text, { text: "   " })).toBeNull();
    expect(validateAnswer(text, { text: "one two three four five six" })).toEqual({ text: "one two three four five six" });
    expect(() => validateAnswer(text, { text: "x".repeat(201) })).toThrow(invalid);
    expect(() => validateAnswer(text, { text: "a", extra: 1 })).toThrow(invalid);
  });
});
