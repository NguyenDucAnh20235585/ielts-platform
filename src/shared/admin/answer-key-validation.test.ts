import { describe, expect, it } from "vitest";

import { checkAnswerKey, type KeyTarget } from "./answer-key-validation";

const rules = { maxWords: null, allowNumber: false, selectCount: null, allowOptionReuse: false };
const options = [
  { key: "A", text: "a" },
  { key: "B", text: "b" },
  { key: "C", text: "c" },
];
const choice: KeyTarget = { answerFormat: "choice", marks: 1, rules, options };
const multi: KeyTarget = { answerFormat: "multi_choice", marks: 2, rules: { ...rules, selectCount: 2 }, options };
const text: KeyTarget = { answerFormat: "text", marks: 1, rules: { ...rules, maxWords: 2, allowNumber: true }, options: null };

describe("checkAnswerKey (api-contract §2.5)", () => {
  it("accepts a CHOICE key that is one of the options", () => {
    expect(checkAnswerKey(choice, { choice: "B" }, undefined)).toEqual({
      ok: true,
      key: { correct_answer: { choice: "B" }, grading_config: {} },
    });
    expect(checkAnswerKey(choice, { choice: "D" }, undefined)).toMatchObject({ ok: false, code: "INVALID_ANSWER_KEY" });
    expect(checkAnswerKey(choice, { choices: ["A"] }, undefined)).toMatchObject({ ok: false });
  });

  it("needs exactly select_count unique MULTI_CHOICE keys", () => {
    expect(checkAnswerKey(multi, { choices: ["A", "C"] }, {})).toMatchObject({ ok: true });
    expect(checkAnswerKey(multi, { choices: ["A"] }, {})).toMatchObject({ ok: false, reason: expect.stringContaining("Exactly 2") });
    expect(checkAnswerKey(multi, { choices: ["A", "A"] }, {})).toMatchObject({ ok: false, reason: "Choices must be unique." });
    expect(checkAnswerKey(multi, { choices: ["A", "Z"] }, {})).toMatchObject({ ok: false });
  });

  it("checks TEXT variants against the word limit and fills grading_config defaults", () => {
    expect(checkAnswerKey(text, { accepted: [" glass-blowing ", "1,500 people"] }, { case_sensitive: true })).toEqual({
      ok: true,
      key: {
        correct_answer: { accepted: ["glass-blowing", "1,500 people"] },
        grading_config: { case_sensitive: true, strip_punctuation: true },
      },
    });
    expect(checkAnswerKey(text, { accepted: ["three whole words"] }, null)).toMatchObject({
      ok: false,
      code: "ANSWER_EXCEEDS_WORD_LIMIT",
    });
    expect(checkAnswerKey(text, { accepted: [] }, null)).toMatchObject({ ok: false, code: "INVALID_ANSWER_KEY" });
    expect(checkAnswerKey(text, { accepted: ["x"] }, { fuzzy: true })).toMatchObject({ ok: false, code: "INVALID_ANSWER_KEY" });
  });

  it("rejects grading_config on non-TEXT questions", () => {
    expect(checkAnswerKey(choice, { choice: "A" }, { case_sensitive: true })).toMatchObject({ ok: false });
  });
});
