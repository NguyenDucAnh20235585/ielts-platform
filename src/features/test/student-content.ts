import { resolveRules, type Rules } from "@/features/grading/rules";
import type { AnswerFormat } from "@/features/grading/schemas";

import {
  ANSWER_FORMATS_API,
  ANSWER_VISIBILITIES,
  type DbAnswerVisibility,
  type DbQuestionType,
  type DbTestMode,
  type DbTestType,
  QUESTION_TYPES,
  TEST_MODES,
  TEST_TYPES,
} from "./api-enums";
import { assignNumbers } from "./numbering";
import { effectiveOptions, parseOptions, type Option } from "./question-options";

// --- Rows loaded from the database (never includes answer_keys) -------------

export type VersionRow = {
  id: string;
  test_id: string;
  version_number: number;
  title: string;
  type: DbTestType;
  mode: DbTestMode;
  time_limit_seconds: number | null;
  answer_visibility: DbAnswerVisibility;
  allow_pause: boolean;
  allow_replay: boolean;
  allow_seek: boolean;
  max_plays: number | null;
};

export type SectionRow = {
  id: string;
  position: number;
  title: string | null;
  instructions: string | null;
  content: string | null;
  audio_object_key: string | null;
};

export type GroupRow = {
  id: string;
  section_id: string;
  position: number;
  instructions: string | null;
  content: string | null;
  options: unknown;
  rules: unknown;
  image_object_key: string | null;
};

export type QuestionRow = {
  id: string;
  question_group_id: string;
  position: number;
  question_type: DbQuestionType;
  answer_format: AnswerFormat;
  prompt: string;
  options: unknown;
  config: unknown;
  max_score: string | number;
  display_number: number | null;
};

export type MediaUrl = { url: string; expires_at: string | null };
export type MediaResolver = (objectKey: string) => MediaUrl | null;

// --- API shapes (api-contract §2.6 StudentContent) ---------------------------

export type ApiRules = {
  max_words: number | null;
  allow_number: boolean;
  select_count: number | null;
  allow_option_reuse: boolean;
};

export type StudentQuestion = {
  id: string;
  order_no: number;
  numbers: number[];
  marks: number;
  type: (typeof QUESTION_TYPES)[DbQuestionType];
  answer_format: (typeof ANSWER_FORMATS_API)[AnswerFormat];
  content: string;
  options: Option[] | null;
  config: ApiRules;
};

export type StudentGroup = {
  id: string;
  order_no: number;
  instruction: string | null;
  content: string | null;
  image: MediaUrl | null;
  options: Option[] | null;
  rules: ApiRules;
  questions: StudentQuestion[];
};

export type StudentSection = {
  id: string;
  order_no: number;
  title: string | null;
  instruction: string | null;
  content: string | null;
  audio: MediaUrl | null;
  numbers: [number, number] | null;
  question_groups: StudentGroup[];
};

export type StudentTestVersion = {
  id: string;
  test_id: string;
  version_number: number;
  title: string;
  type: (typeof TEST_TYPES)[DbTestType];
  mode: (typeof TEST_MODES)[DbTestMode];
  duration_seconds: number | null;
  question_count: number;
  settings: {
    answer_visibility: (typeof ANSWER_VISIBILITIES)[DbAnswerVisibility];
    allow_pause: boolean;
    allow_replay: boolean;
    allow_seek: boolean;
    max_plays: number | null;
  };
};

export type StudentContent = { test_version: StudentTestVersion; sections: StudentSection[] };

/** Question data in test order, with numbers and effective rules/options — shared with grading. */
export type OrderedQuestion = {
  row: QuestionRow;
  sectionId: string;
  marks: number;
  numbers: number[];
  rules: Rules;
  options: Option[] | null;
};

/**
 * Sorts questions into test order (section → group → question position) and
 * computes numbers, marks, effective rules and options.
 */
export function orderQuestions(
  sections: readonly SectionRow[],
  groups: readonly GroupRow[],
  questions: readonly QuestionRow[],
): OrderedQuestion[] {
  const sectionPosition = new Map(sections.map((s) => [s.id, s.position]));
  const groupById = new Map(groups.map((g) => [g.id, g]));

  const sorted = [...questions].sort((a, b) => {
    const ga = groupById.get(a.question_group_id);
    const gb = groupById.get(b.question_group_id);
    if (!ga || !gb) throw new Error("Question without a group.");
    return (
      (sectionPosition.get(ga.section_id) ?? 0) - (sectionPosition.get(gb.section_id) ?? 0) ||
      ga.position - gb.position ||
      a.position - b.position
    );
  });

  const marks = sorted.map((q) => Number(q.max_score));
  const numbers = assignNumbers(sorted.map((q, i) => ({ marks: marks[i] ?? 1, displayNumber: q.display_number })));

  return sorted.map((row, i) => {
    const group = groupById.get(row.question_group_id);
    if (!group) throw new Error("Question without a group.");
    return {
      row,
      sectionId: group.section_id,
      marks: marks[i] ?? 1,
      numbers: numbers[i] ?? [],
      rules: resolveRules(group.rules, row.config),
      options: effectiveOptions(row.question_type, row.answer_format, row.options, group.options),
    };
  });
}

export function toApiRules(rules: Rules): ApiRules {
  return {
    max_words: rules.maxWords,
    allow_number: rules.allowNumber,
    select_count: rules.selectCount,
    allow_option_reuse: rules.allowOptionReuse,
  };
}

/** Builds the student view of a test version. Pure: rows in, JSON out. */
export function buildStudentContent(
  version: VersionRow,
  sections: readonly SectionRow[],
  groups: readonly GroupRow[],
  questions: readonly QuestionRow[],
  media: MediaResolver,
): StudentContent {
  const ordered = orderQuestions(sections, groups, questions);
  const questionsByGroup = new Map<string, StudentQuestion[]>();
  for (const q of ordered) {
    const list = questionsByGroup.get(q.row.question_group_id) ?? [];
    list.push({
      id: q.row.id,
      order_no: q.row.position,
      numbers: q.numbers,
      marks: q.marks,
      type: QUESTION_TYPES[q.row.question_type],
      answer_format: ANSWER_FORMATS_API[q.row.answer_format],
      content: q.row.prompt,
      options: q.options,
      config: toApiRules(q.rules),
    });
    questionsByGroup.set(q.row.question_group_id, list);
  }

  const studentSections = [...sections]
    .sort((a, b) => a.position - b.position)
    .map((section): StudentSection => {
      const sectionGroups = groups
        .filter((g) => g.section_id === section.id)
        .sort((a, b) => a.position - b.position)
        .map((group): StudentGroup => ({
          id: group.id,
          order_no: group.position,
          instruction: group.instructions,
          content: group.content,
          image: group.image_object_key ? media(group.image_object_key) : null,
          options: parseOptions(group.options),
          rules: toApiRules(resolveRules(group.rules, {})),
          questions: questionsByGroup.get(group.id) ?? [],
        }));
      const allNumbers = sectionGroups.flatMap((g) => g.questions.flatMap((q) => q.numbers));
      return {
        id: section.id,
        order_no: section.position,
        title: section.title,
        instruction: section.instructions,
        // Listening transcripts are not shown in Prototype 1.
        content: version.type === "reading" ? section.content : null,
        audio: section.audio_object_key ? media(section.audio_object_key) : null,
        numbers: allNumbers.length > 0 ? [Math.min(...allNumbers), Math.max(...allNumbers)] : null,
        question_groups: sectionGroups,
      };
    });

  return {
    test_version: {
      id: version.id,
      test_id: version.test_id,
      version_number: version.version_number,
      title: version.title,
      type: TEST_TYPES[version.type],
      mode: TEST_MODES[version.mode],
      duration_seconds: version.time_limit_seconds,
      question_count: ordered.reduce((sum, q) => sum + q.marks, 0),
      settings: {
        answer_visibility: ANSWER_VISIBILITIES[version.answer_visibility],
        allow_pause: version.allow_pause,
        allow_replay: version.allow_replay,
        allow_seek: version.allow_seek,
        max_plays: version.max_plays,
      },
    },
    sections: studentSections,
  };
}
