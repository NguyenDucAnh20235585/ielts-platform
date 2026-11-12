import type { DbTestMode, DbTestType } from "@/features/test/api-enums";
import {
  type GroupRow,
  orderQuestions,
  type QuestionRow,
  type SectionRow,
} from "@/features/test/student-content";
import { parseOptions } from "@/features/test/question-options";
import { FULL_TEST_MARKS } from "@/features/grading/band";

import { checkAnswerKey } from "./answer-key-validation";
import type { AnswerKeyRow } from "./answer-key-row";

export type ValidationErrorCode =
  | "NO_SECTIONS"
  | "EMPTY_SECTION"
  | "EMPTY_GROUP"
  | "MISSING_PASSAGE"
  | "MISSING_AUDIO"
  | "MISSING_OPTIONS"
  | "DUPLICATE_OPTION_KEY"
  | "MISSING_ANSWER_KEY"
  | "INVALID_ANSWER_KEY"
  | "MISSING_WORD_LIMIT"
  | "ANSWER_EXCEEDS_WORD_LIMIT"
  | "MISSING_SELECT_COUNT"
  | "NUMBERING_GAP"
  | "NUMBERING_DUPLICATE"
  | "NO_MODE_ENABLED";

export type ValidationWarningCode = "BAND_NOT_AVAILABLE" | "GAP_TOKEN_MISMATCH" | "AUDIO_NOT_VERIFIED";

export type ValidationIssue<Code extends string = string> = {
  code: Code;
  message: string;
  section_id: string | null;
  group_id: string | null;
  question_id: string | null;
  numbers: number[] | null;
};

/** api-contract §6.7 */
export type ValidationReport = {
  valid: boolean;
  errors: ValidationIssue<ValidationErrorCode>[];
  warnings: ValidationIssue<ValidationWarningCode>[];
};

export type VersionContent = {
  version: { type: DbTestType; enabledModes: readonly DbTestMode[] };
  sections: readonly SectionRow[];
  groups: readonly GroupRow[];
  questions: readonly QuestionRow[];
  keys: ReadonlyMap<string, AnswerKeyRow>;
};

type Location = { section?: string; group?: string; question?: string; numbers?: number[] };

const GAP_TOKEN = /\{\{gap:(\d+)\}\}/g;

export function formatNumbers(numbers: readonly number[]): string {
  const first = numbers[0];
  const last = numbers[numbers.length - 1];
  return first === last ? String(first) : `${first}–${last}`;
}

function hasDuplicateKeys(options: unknown): boolean {
  const list = parseOptions(options);
  if (!list) return false;
  return new Set(list.map((option) => option.key)).size !== list.length;
}

function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
  const sa = [...new Set(a)].sort((x, y) => x - y);
  const sb = [...new Set(b)].sort((x, y) => x - y);
  return sa.length === sb.length && sa.every((value, index) => value === sb[index]);
}

/**
 * Publish validation (api-contract §12.6). Pure: the caller loads the version
 * content with its answer keys. `valid` is false when there is any error;
 * warnings never block publishing.
 */
export function validateVersionContent(content: VersionContent): ValidationReport {
  const errors: ValidationIssue<ValidationErrorCode>[] = [];
  const warnings: ValidationIssue<ValidationWarningCode>[] = [];
  const issue = <Code extends string>(code: Code, message: string, at: Location = {}): ValidationIssue<Code> => ({
    code,
    message,
    section_id: at.section ?? null,
    group_id: at.group ?? null,
    question_id: at.question ?? null,
    numbers: at.numbers ?? null,
  });

  const { version, groups, questions, keys } = content;
  const sections = [...content.sections].sort((a, b) => a.position - b.position);

  if (version.enabledModes.length === 0) {
    errors.push(issue("NO_MODE_ENABLED", "Enable at least one mode (PRACTICE or MOCK)."));
  }
  if (sections.length === 0) {
    errors.push(issue("NO_SECTIONS", "The test has no sections."));
  }

  const ordered = orderQuestions(sections, groups, questions);
  const numbersByGroup = new Map<string, number[]>();
  for (const q of ordered) {
    const list = numbersByGroup.get(q.row.question_group_id) ?? [];
    list.push(...q.numbers);
    numbersByGroup.set(q.row.question_group_id, list);
  }

  // Sections and groups
  for (const section of sections) {
    const at = { section: section.id };
    const sectionGroups = groups.filter((g) => g.section_id === section.id).sort((a, b) => a.position - b.position);
    if (sectionGroups.length === 0) {
      errors.push(issue("EMPTY_SECTION", `Section ${section.position} has no question groups.`, at));
    }
    if (version.type === "reading" && !section.content?.trim()) {
      errors.push(issue("MISSING_PASSAGE", `Section ${section.position} has no passage.`, at));
    }
    if (version.type === "listening") {
      if (!section.audio_object_key) {
        errors.push(issue("MISSING_AUDIO", `Section ${section.position} has no audio.`, at));
      } else {
        // Prototype 1 has no R2 credentials on the server (D-009), so the object is not checked.
        warnings.push(issue("AUDIO_NOT_VERIFIED", `Audio of section ${section.position} was not checked in storage.`, at));
      }
    }

    for (const group of sectionGroups) {
      const groupAt = { section: section.id, group: group.id };
      const label = `Question group ${group.position} of section ${section.position}`;
      const groupNumbers = numbersByGroup.get(group.id) ?? [];
      if (groupNumbers.length === 0) {
        errors.push(issue("EMPTY_GROUP", `${label} has no questions.`, groupAt));
      }
      if (hasDuplicateKeys(group.options)) {
        errors.push(issue("DUPLICATE_OPTION_KEY", `${label} has duplicate option keys.`, groupAt));
      }
      const tokens = [...(group.content ?? "").matchAll(GAP_TOKEN)].map((match) => Number(match[1]));
      if (tokens.length > 0 && !sameNumbers(tokens, groupNumbers)) {
        warnings.push(
          issue(
            "GAP_TOKEN_MISMATCH",
            `${label}: gap tokens {{gap:${tokens.join("}}, {{gap:")}}} do not match question numbers ${groupNumbers.join(", ") || "(none)"}.`,
            groupAt,
          ),
        );
      }
    }
  }

  // Questions, in test order
  let expected = 1;
  let totalMarks = 0;
  for (const q of ordered) {
    const at = { section: q.sectionId, group: q.row.question_group_id, question: q.row.id, numbers: q.numbers };
    const label = `Question ${formatNumbers(q.numbers)}`;
    const format = q.row.answer_format;
    totalMarks += q.marks;

    const first = q.numbers[0] ?? expected;
    if (first > expected) {
      errors.push(issue("NUMBERING_GAP", `${label}: number${first - expected > 1 ? "s" : ""} ${formatNumbers([expected, first - 1])} ${first - expected > 1 ? "are" : "is"} missing before it.`, at));
    } else if (first < expected) {
      errors.push(issue("NUMBERING_DUPLICATE", `${label} reuses number ${first}.`, at));
    }
    expected = Math.max(expected, first + q.marks);

    let keyCheckable = true;
    if (hasDuplicateKeys(q.row.options)) {
      errors.push(issue("DUPLICATE_OPTION_KEY", `${label} has duplicate option keys.`, at));
      keyCheckable = false;
    }
    if (format === "multi_choice" && q.rules.selectCount === null) {
      errors.push(issue("MISSING_SELECT_COUNT", `${label} needs select_count.`, at));
      keyCheckable = false;
    }
    if (format !== "text" && (q.options === null || q.options.length === 0)) {
      errors.push(issue("MISSING_OPTIONS", `${label} has no options to choose from.`, at));
      keyCheckable = false;
    }
    if (format === "text" && q.rules.maxWords === null) {
      errors.push(issue("MISSING_WORD_LIMIT", `${label} has no word limit (max_words).`, at));
    }

    const key = keys.get(q.row.id);
    if (!key) {
      errors.push(issue("MISSING_ANSWER_KEY", `${label} has no answer key.`, at));
    } else if (keyCheckable) {
      const check = checkAnswerKey(
        { answerFormat: format, marks: q.marks, rules: q.rules, options: q.options },
        key.correct_answer,
        key.grading_config,
      );
      if (!check.ok) {
        errors.push(issue(check.code, `${label}: ${check.reason}`, at));
      }
    }
  }

  if (totalMarks !== FULL_TEST_MARKS) {
    warnings.push(issue("BAND_NOT_AVAILABLE", `Total marks is ${totalMarks}; band score needs ${FULL_TEST_MARKS}.`));
  }

  return { valid: errors.length === 0, errors, warnings };
}
