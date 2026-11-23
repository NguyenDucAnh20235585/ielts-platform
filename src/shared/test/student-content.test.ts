import { describe, expect, it } from "vitest";

import { buildStudentContent, type GroupRow, type QuestionRow, type SectionRow, type VersionRow } from "./student-content";

const version: VersionRow = {
  id: "v1", test_id: "t1", version_number: 1, title: "Mock", type: "reading", mode: "mock",
  time_limit_seconds: 3600, answer_visibility: "after_submit", allow_pause: false, allow_replay: false,
  allow_seek: false, max_plays: 1,
};
const sections: SectionRow[] = [
  { id: "s2", position: 2, title: "Passage 2", instructions: null, content: "P2", audio_object_key: null },
  { id: "s1", position: 1, title: "Passage 1", instructions: "Spend 20 minutes", content: "P1", audio_object_key: null },
];
const groups: GroupRow[] = [
  { id: "g1", section_id: "s1", position: 1, instructions: "TFNG", content: null, options: null, rules: {}, image_object_key: null },
  { id: "g2", section_id: "s2", position: 1, instructions: "Choose TWO", content: null, options: null, rules: {}, image_object_key: "map.png" },
];
const q = (id: string, group: string, position: number, extra: Partial<QuestionRow>): QuestionRow => ({
  id, question_group_id: group, position, question_type: "true_false_not_given", answer_format: "choice",
  prompt: `prompt ${id}`, options: null, config: {}, max_score: "1.00", display_number: null, ...extra,
});
const questions: QuestionRow[] = [
  q("q3", "g2", 1, { question_type: "mcq_multi", answer_format: "multi_choice", max_score: "2.00",
    options: [{ key: "A", text: "a" }, { key: "B", text: "b" }, { key: "C", text: "c" }], config: { select_count: 2 } }),
  q("q2", "g1", 2, {}),
  q("q1", "g1", 1, {}),
];

describe("buildStudentContent", () => {
  const content = buildStudentContent(version, sections, groups, questions, (key) => ({ url: `https://cdn/${key}`, expires_at: null }));

  it("orders sections, groups and questions and numbers them across the test", () => {
    expect(content.sections.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(content.sections[0]?.question_groups[0]?.questions.map((x) => [x.id, x.numbers])).toEqual([
      ["q1", [1]],
      ["q2", [2]],
    ]);
    expect(content.sections[1]?.question_groups[0]?.questions[0]).toMatchObject({ id: "q3", numbers: [3, 4], marks: 2, type: "MCQ_MULTI", answer_format: "MULTI_CHOICE" });
    expect(content.sections.map((s) => s.numbers)).toEqual([[1, 2], [3, 4]]);
    expect(content.test_version).toMatchObject({ question_count: 4, type: "READING", mode: "MOCK", duration_seconds: 3600 });
  });

  it("adds fixed TFNG options, effective config and media URLs", () => {
    const first = content.sections[0]?.question_groups[0]?.questions[0];
    expect(first?.options?.map((o) => o.key)).toEqual(["TRUE", "FALSE", "NOT_GIVEN"]);
    expect(content.sections[1]?.question_groups[0]?.questions[0]?.config.select_count).toBe(2);
    expect(content.sections[1]?.question_groups[0]?.image).toEqual({ url: "https://cdn/map.png", expires_at: null });
  });

  it("never contains answer-key fields", () => {
    const json = JSON.stringify(content);
    for (const field of ["correct_answer", "accepted", "grading_config", "explanation"]) {
      expect(json).not.toContain(field);
    }
  });
});
