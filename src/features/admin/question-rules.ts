import type { AnswerFormat, RulesInput } from "@/features/grading/schemas";
import { ANSWER_FORMATS_API, type DbQuestionType, dbValueOf, QUESTION_TYPES } from "@/features/test/api-enums";
import type { Option } from "@/features/test/question-options";

/**
 * Which answer formats each IELTS question type may use (api-contract §2.2).
 * The first entry is the default; types that allow both TEXT and CHOICE
 * default to CHOICE when their group has a word bank / option list.
 */
export const ALLOWED_FORMATS: Record<DbQuestionType, readonly AnswerFormat[]> = {
  mcq_single: ["choice"],
  mcq_multi: ["multi_choice"],
  true_false_not_given: ["choice"],
  yes_no_not_given: ["choice"],
  matching_headings: ["choice"],
  matching_information: ["choice"],
  matching_features: ["choice"],
  matching_sentence_endings: ["choice"],
  sentence_completion: ["text", "choice"],
  summary_completion: ["text", "choice"],
  note_completion: ["text"],
  table_completion: ["text"],
  form_completion: ["text"],
  flow_chart_completion: ["text", "choice"],
  diagram_label_completion: ["text"],
  map_plan_labelling: ["choice", "text"],
  short_answer: ["text"],
};

/** Only MCQ questions carry their own option list; other types use the group's. */
export const TYPES_WITH_OWN_OPTIONS: ReadonlySet<DbQuestionType> = new Set(["mcq_single", "mcq_multi"]);

export function defaultAnswerFormat(type: DbQuestionType, groupHasOptions: boolean): AnswerFormat {
  const allowed = ALLOWED_FORMATS[type];
  if (allowed.includes("text") && allowed.includes("choice")) {
    return groupHasOptions ? "choice" : "text";
  }
  return allowed[0] ?? "text";
}

export function isFormatAllowed(type: DbQuestionType, format: AnswerFormat): boolean {
  return ALLOWED_FORMATS[type].includes(format);
}

/** Marks = 1, or select_count for "choose TWO/THREE" (D-006). */
export function marksFor(format: AnswerFormat, selectCount: number | null): number {
  return format === "multi_choice" ? (selectCount ?? 0) : 1;
}

/** Types whose TEXT answers must have a word limit before publishing. */
export function needsWordLimit(format: AnswerFormat): boolean {
  return format === "text";
}

// --- Resolving a question's format, options, config and marks (POST/PATCH questions) ---

export type QuestionSpecInput = {
  type: DbQuestionType;
  /** undefined = use the default for the type (api-contract §7.3). */
  answerFormat: AnswerFormat | undefined;
  options: Option[] | null;
  config: RulesInput;
  groupHasOptions: boolean;
};

export type QuestionSpec = { answerFormat: AnswerFormat; options: Option[] | null; config: RulesInput; marks: number };

export type QuestionSpecResult =
  | { ok: true; spec: QuestionSpec }
  | { ok: false; code: "INVALID_QUESTION_TYPE" | "VALIDATION_ERROR"; message: string; path: string | null };

export function resolveQuestionSpec(input: QuestionSpecInput): QuestionSpecResult {
  const answerFormat = input.answerFormat ?? defaultAnswerFormat(input.type, input.groupHasOptions);
  if (!isFormatAllowed(input.type, answerFormat)) {
    return {
      ok: false,
      code: "INVALID_QUESTION_TYPE",
      message: `${QUESTION_TYPES[input.type]} does not allow answer_format ${ANSWER_FORMATS_API[answerFormat]}.`,
      path: "answer_format",
    };
  }
  if (input.options !== null && !TYPES_WITH_OWN_OPTIONS.has(input.type)) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Only MCQ_SINGLE and MCQ_MULTI questions have their own options; other types use the group's options.",
      path: "options",
    };
  }
  const selectCount = input.config.select_count ?? null;
  if (input.type === "mcq_multi" && selectCount === null) {
    return { ok: false, code: "VALIDATION_ERROR", message: "MCQ_MULTI requires config.select_count.", path: "config.select_count" };
  }
  return {
    ok: true,
    spec: { answerFormat, options: input.options, config: input.config, marks: marksFor(answerFormat, selectCount) },
  };
}

/** API value → DB value, or null when unknown (→ 400 INVALID_QUESTION_TYPE). */
export function parseQuestionType(value: string): DbQuestionType | null {
  return dbValueOf(QUESTION_TYPES, value) ?? null;
}

export function parseAnswerFormat(value: string): AnswerFormat | null {
  return dbValueOf(ANSWER_FORMATS_API, value) ?? null;
}
