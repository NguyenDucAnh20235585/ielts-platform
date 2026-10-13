import { describe, expect, it } from "vitest";

import type { GroupRow, QuestionRow, SectionRow, VersionRow } from "@/features/test/student-content";

import { buildAdminSections } from "./admin-tree";

const version: VersionRow = {
  id: "v1", test_id: "t1", version_number: 1, title: "Listening 1", type: "listening", mode: "practice",
  time_limit_seconds: null, answer_visibility: "immediately_in_practice", allow_pause: true, allow_replay: true,
  allow_seek: true, max_plays: null,
};
const sections: SectionRow[] = [
  { id: "s1", position: 1, title: "Part 1", instructions: null, content: "Transcript draft", audio_object_key: "tests/l1/p1.mp3" },
];
const groups: GroupRow[] = [
  { id: "g1", section_id: "s1", position: 1, instructions: "Label the map", content: null,
    options: [{ key: "A", text: "A" }, { key: "B", text: "B" }], rules: {}, image_object_key: "tests/l1/map.png" },
];
const questions: QuestionRow[] = [
  { id: "q1", question_group_id: "g1", position: 1, question_type: "map_plan_labelling", answer_format: "choice",
    prompt: "Café", options: null, config: {}, max_score: "1.00", display_number: 11 },
  { id: "q2", question_group_id: "g1", position: 2, question_type: "map_plan_labelling", answer_format: "choice",
    prompt: "Library", options: null, config: {}, max_score: "1.00", display_number: null },
];
const keys = new Map([
  ["q1", { question_id: "q1", correct_answer: { choice: "B" }, grading_config: {}, explanation: "Near the gate.", updated_at: new Date("2026-10-05T01:02:03Z") }],
]);

describe("buildAdminSections (api-contract §6.5)", () => {
  const tree = buildAdminSections(version, sections, groups, questions, keys, (key) => ({ url: `https://cdn/${key}`, expires_at: null }));

  it("adds the admin-only fields to the student tree", () => {
    expect(tree[0]).toMatchObject({
      id: "s1",
      content: "Transcript draft", // raw content, even for LISTENING
      audio_object_key: "tests/l1/p1.mp3",
      audio: { url: "https://cdn/tests/l1/p1.mp3" },
      numbers: [11, 12],
    });
    expect(tree[0]?.question_groups[0]).toMatchObject({ image_object_key: "tests/l1/map.png", image: { url: "https://cdn/tests/l1/map.png" } });
  });

  it("includes display_number and the answer key (or null)", () => {
    const [q1, q2] = tree[0]?.question_groups[0]?.questions ?? [];
    expect(q1).toMatchObject({
      numbers: [11],
      display_number: 11,
      options: [{ key: "A", text: "A" }, { key: "B", text: "B" }],
      answer_key: { correct_answer: { choice: "B" }, grading_config: {}, explanation: "Near the gate.", updated_at: "2026-10-05T01:02:03.000Z" },
    });
    expect(q2).toMatchObject({ numbers: [12], display_number: null, answer_key: null });
  });
});
