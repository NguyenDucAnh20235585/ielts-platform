import { describe, expect, it } from "vitest";

import {
  ALLOWED_FORMATS,
  defaultAnswerFormat,
  isFormatAllowed,
  marksFor,
  parseAnswerFormat,
  parseQuestionType,
  resolveQuestionSpec,
} from "./question-rules";

describe("question format rules (api-contract §2.2)", () => {
  it("lists every question type", () => {
    expect(Object.keys(ALLOWED_FORMATS)).toHaveLength(17);
  });

  it("defaults completion types to CHOICE only when the group has a word bank", () => {
    expect(defaultAnswerFormat("summary_completion", true)).toBe("choice");
    expect(defaultAnswerFormat("summary_completion", false)).toBe("text");
    expect(defaultAnswerFormat("map_plan_labelling", false)).toBe("text");
    expect(defaultAnswerFormat("note_completion", true)).toBe("text");
    expect(defaultAnswerFormat("mcq_multi", false)).toBe("multi_choice");
    expect(defaultAnswerFormat("true_false_not_given", false)).toBe("choice");
  });

  it("rejects formats a type does not allow", () => {
    expect(isFormatAllowed("short_answer", "text")).toBe(true);
    expect(isFormatAllowed("short_answer", "choice")).toBe(false);
    expect(isFormatAllowed("mcq_single", "multi_choice")).toBe(false);
  });

  it("gives MCQ_MULTI select_count marks and everything else 1", () => {
    expect(marksFor("multi_choice", 3)).toBe(3);
    expect(marksFor("choice", 3)).toBe(1);
    expect(marksFor("text", null)).toBe(1);
  });
});

describe("resolveQuestionSpec (api-contract §7.3)", () => {
  const base = { options: null, config: {}, groupHasOptions: false } as const;

  it("defaults the format and computes marks", () => {
    expect(resolveQuestionSpec({ ...base, type: "sentence_completion", answerFormat: undefined })).toEqual({
      ok: true,
      spec: { answerFormat: "text", options: null, config: {}, marks: 1 },
    });
    const multi = resolveQuestionSpec({
      ...base, type: "mcq_multi", answerFormat: undefined, config: { select_count: 3 },
      options: [{ key: "A", text: "a" }],
    });
    expect(multi).toMatchObject({ ok: true, spec: { answerFormat: "multi_choice", marks: 3 } });
  });

  it("rejects a format the type does not allow", () => {
    expect(resolveQuestionSpec({ ...base, type: "note_completion", answerFormat: "choice" })).toMatchObject({
      ok: false,
      code: "INVALID_QUESTION_TYPE",
      message: "NOTE_COMPLETION does not allow answer_format CHOICE.",
    });
  });

  it("allows own options only for MCQ and needs select_count for MCQ_MULTI", () => {
    expect(resolveQuestionSpec({ ...base, type: "matching_headings", answerFormat: undefined, options: [{ key: "i", text: "x" }] }))
      .toMatchObject({ ok: false, code: "VALIDATION_ERROR", path: "options" });
    expect(resolveQuestionSpec({ ...base, type: "mcq_multi", answerFormat: undefined })).toMatchObject({
      ok: false,
      path: "config.select_count",
    });
  });

  it("parses API enum values", () => {
    expect(parseQuestionType("MAP_PLAN_LABELLING")).toBe("map_plan_labelling");
    expect(parseQuestionType("ESSAY")).toBeNull();
    expect(parseAnswerFormat("MULTI_CHOICE")).toBe("multi_choice");
    expect(parseAnswerFormat("choice")).toBeNull();
  });
});
