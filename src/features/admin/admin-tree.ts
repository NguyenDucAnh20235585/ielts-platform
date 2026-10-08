import {
  buildStudentContent,
  type GroupRow,
  type MediaResolver,
  type QuestionRow,
  type SectionRow,
  type VersionRow,
} from "@/features/test/student-content";

import { type AnswerKeyRow, toAnswerKeyView } from "./answer-key-row";

function rowOf<Row>(rows: ReadonlyMap<string, Row>, id: string): Row {
  const row = rows.get(id);
  if (!row) throw new Error(`Row ${id} missing while building the admin tree.`);
  return row;
}

/**
 * The editor tree (api-contract §6.5): the StudentContent sections plus the
 * admin-only fields — section `audio_object_key` and raw `content` (also for
 * LISTENING), group `image_object_key`, question `display_number` and
 * `answer_key`. Pure: rows in, JSON out.
 */
export function buildAdminSections(
  version: VersionRow,
  sections: readonly SectionRow[],
  groups: readonly GroupRow[],
  questions: readonly QuestionRow[],
  keys: ReadonlyMap<string, AnswerKeyRow>,
  media: MediaResolver,
) {
  const student = buildStudentContent(version, sections, groups, questions, media);
  const sectionRows = new Map(sections.map((row) => [row.id, row]));
  const groupRows = new Map(groups.map((row) => [row.id, row]));
  const questionRows = new Map(questions.map((row) => [row.id, row]));

  return student.sections.map((section) => {
    const sectionRow = rowOf(sectionRows, section.id);
    return {
      ...section,
      content: sectionRow.content,
      audio_object_key: sectionRow.audio_object_key,
      question_groups: section.question_groups.map((group) => ({
        ...group,
        image_object_key: rowOf(groupRows, group.id).image_object_key,
        questions: group.questions.map((question) => {
          const key = keys.get(question.id);
          return {
            ...question,
            display_number: rowOf(questionRows, question.id).display_number,
            answer_key: key ? toAnswerKeyView(key) : null,
          };
        }),
      })),
    };
  });
}

export type AdminSection = ReturnType<typeof buildAdminSections>[number];
export type AdminGroup = AdminSection["question_groups"][number];
export type AdminQuestion = AdminGroup["questions"][number];
