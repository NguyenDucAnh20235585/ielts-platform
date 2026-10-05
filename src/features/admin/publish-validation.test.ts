import { describe, expect, it } from "vitest";

import type { GroupRow, QuestionRow, SectionRow } from "@/features/test/student-content";

import type { AnswerKeyRow } from "./answer-key-row";
import { formatNumbers, validateVersionContent, type VersionContent } from "./publish-validation";

const updated_at = new Date("2026-10-05T00:00:00Z");
const key = (question_id: string, correct_answer: unknown, grading_config: unknown = {}): AnswerKeyRow => ({
  question_id,
  correct_answer,
  grading_config,
  explanation: null,
  updated_at,
});
const section = (id: string, position: number, extra: Partial<SectionRow> = {}): SectionRow => ({
  id, position, title: null, instructions: null, content: "Passage", audio_object_key: null, ...extra,
});
const group = (id: string, section_id: string, position: number, extra: Partial<GroupRow> = {}): GroupRow => ({
  id, section_id, position, instructions: "Instr", content: null, options: null, rules: {}, image_object_key: null, ...extra,
});
const question = (id: string, groupId: string, position: number, extra: Partial<QuestionRow> = {}): QuestionRow => ({
  id, question_group_id: groupId, position, question_type: "true_false_not_given", answer_format: "choice",
  prompt: "Statement", options: null, config: {}, max_score: 1, display_number: null, ...extra,
});

/** A valid reading test: 1 section, TFNG ×1, notes ×1 (TEXT), MCQ_MULTI ×1 (2 marks) = 4 marks. */
function validContent(): VersionContent {
  return {
    version: { type: "reading", mode: "practice", time_limit_seconds: null },
    sections: [section("s1", 1)],
    groups: [
      group("g1", "s1", 1),
      group("g2", "s1", 2, { content: "Notes: {{gap:2}}", rules: { max_words: 2 } }),
      group("g3", "s1", 3),
    ],
    questions: [
      question("q1", "g1", 1),
      question("q2", "g2", 1, { question_type: "note_completion", answer_format: "text" }),
      question("q3", "g3", 1, {
        question_type: "mcq_multi", answer_format: "multi_choice", max_score: 2, config: { select_count: 2 },
        options: [{ key: "A", text: "a" }, { key: "B", text: "b" }, { key: "C", text: "c" }],
      }),
    ],
    keys: new Map([
      ["q1", key("q1", { choice: "TRUE" })],
      ["q2", key("q2", { accepted: ["glass"] }, { case_sensitive: false, strip_punctuation: true })],
      ["q3", key("q3", { choices: ["A", "C"] })],
    ]),
  };
}

const codes = (content: VersionContent) => {
  const report = validateVersionContent(content);
  return { valid: report.valid, errors: report.errors.map((e) => e.code), warnings: report.warnings.map((w) => w.code) };
};

describe("validateVersionContent (api-contract §12.6)", () => {
  it("accepts a complete test; a total other than 40 is only a warning", () => {
    expect(codes(validContent())).toEqual({ valid: true, errors: [], warnings: ["BAND_NOT_AVAILABLE"] });
  });

  it("reports an empty version", () => {
    const content = { ...validContent(), sections: [], groups: [], questions: [], keys: new Map() };
    expect(codes(content).errors).toEqual(["NO_SECTIONS"]);
    expect(codes({ ...content, version: { type: "reading", mode: "mock", time_limit_seconds: null } }).errors).toContain("MISSING_DURATION");
  });

  it("reports empty sections and groups, and a missing passage", () => {
    const content = validContent();
    content.sections = [...content.sections, section("s2", 2, { content: "  " })];
    content.groups = [...content.groups, group("g4", "s1", 4)];
    expect(codes(content).errors).toEqual(["EMPTY_GROUP", "EMPTY_SECTION", "MISSING_PASSAGE"]);
  });

  it("needs audio for LISTENING and warns that it was not verified", () => {
    const content = validContent();
    content.version = { type: "listening", mode: "practice", time_limit_seconds: null };
    content.sections = [section("s1", 1, { content: null })];
    expect(codes(content).errors).toEqual(["MISSING_AUDIO"]);
    content.sections = [section("s1", 1, { content: null, audio_object_key: "tests/l1/s1.mp3" })];
    expect(codes(content)).toMatchObject({ valid: true, warnings: ["AUDIO_NOT_VERIFIED", "BAND_NOT_AVAILABLE"] });
  });

  it("reports missing and invalid answer keys with question numbers", () => {
    const content = validContent();
    content.keys = new Map([
      ["q2", key("q2", { accepted: ["far too many words"] })],
      ["q3", key("q3", { choices: ["A"] })],
    ]);
    const report = validateVersionContent(content);
    expect(report.errors.map((e) => [e.code, e.numbers])).toEqual([
      ["MISSING_ANSWER_KEY", [1]],
      ["ANSWER_EXCEEDS_WORD_LIMIT", [2]],
      ["INVALID_ANSWER_KEY", [3, 4]],
    ]);
    expect(report.errors[0]).toMatchObject({ section_id: "s1", group_id: "g1", question_id: "q1", message: "Question 1 has no answer key." });
  });

  it("reports missing options, select_count and word limits", () => {
    const content = validContent();
    content.groups = content.groups.map((g) => (g.id === "g2" ? { ...g, rules: {} } : g));
    content.questions = content.questions.map((q) =>
      q.id === "q3" ? { ...q, options: null, config: {} } : q.id === "q1" ? { ...q, question_type: "matching_headings" } : q,
    );
    expect(codes(content).errors).toEqual(["MISSING_OPTIONS", "MISSING_WORD_LIMIT", "MISSING_SELECT_COUNT", "MISSING_OPTIONS"]);
  });

  it("reports duplicate option keys", () => {
    const content = validContent();
    content.groups = content.groups.map((g) =>
      g.id === "g1" ? { ...g, options: [{ key: "A", text: "x" }, { key: "A", text: "y" }] } : g,
    );
    expect(codes(content).errors).toEqual(["DUPLICATE_OPTION_KEY"]);
  });

  it("reports numbering gaps and duplicates from display_number overrides", () => {
    const gap = validContent();
    gap.questions = gap.questions.map((q) => (q.id === "q2" ? { ...q, display_number: 5 } : q));
    expect(codes(gap).errors).toEqual(["NUMBERING_GAP"]);
    expect(validateVersionContent(gap).errors[0]?.message).toBe("Question 5: numbers 2–4 are missing before it.");

    const duplicate = validContent();
    duplicate.questions = duplicate.questions.map((q) => (q.id === "q3" ? { ...q, display_number: 2 } : q));
    expect(codes(duplicate).errors).toEqual(["NUMBERING_DUPLICATE"]);
  });

  it("warns when {{gap:N}} tokens do not match the group's numbers", () => {
    const content = validContent();
    content.groups = content.groups.map((g) => (g.id === "g2" ? { ...g, content: "Notes: {{gap:7}}" } : g));
    expect(codes(content)).toMatchObject({ valid: true, warnings: ["GAP_TOKEN_MISMATCH", "BAND_NOT_AVAILABLE"] });
  });

  it("formats number ranges", () => {
    expect(formatNumbers([7])).toBe("7");
    expect(formatNumbers([21, 22])).toBe("21–22");
  });
});
