/**
 * The database stores lowercase enum values ('reading'); the API returns
 * UPPER_SNAKE_CASE ('READING') — api-contract §1.3, database-schema §1.
 */

export const TEST_TYPES = { reading: "READING", listening: "LISTENING" } as const;
export type DbTestType = keyof typeof TEST_TYPES;
export type ApiTestType = (typeof TEST_TYPES)[DbTestType];

export const TEST_MODES = { practice: "PRACTICE", mock: "MOCK" } as const;
export type DbTestMode = keyof typeof TEST_MODES;
export type ApiTestMode = (typeof TEST_MODES)[DbTestMode];

/** Status of a test VERSION (draft → published → archived). Tests have no publish status (D-015). */
export const TEST_STATUSES = { draft: "DRAFT", published: "PUBLISHED", archived: "ARCHIVED" } as const;
export type DbTestStatus = keyof typeof TEST_STATUSES;

/** Admin switch on a test (D-015): students see it only when VISIBLE and a version is published. */
export const TEST_VISIBILITIES = { visible: "VISIBLE", hidden: "HIDDEN", archived: "ARCHIVED" } as const;
export type DbTestVisibility = keyof typeof TEST_VISIBILITIES;

export const ACCESS_TYPES = { public: "PUBLIC", private: "PRIVATE", assigned: "ASSIGNED" } as const;
export type DbAccessType = keyof typeof ACCESS_TYPES;

export const ANSWER_VISIBILITIES = {
  never: "NEVER",
  after_submit: "AFTER_SUBMIT",
  immediately_in_practice: "IMMEDIATELY_IN_PRACTICE",
} as const;
export type DbAnswerVisibility = keyof typeof ANSWER_VISIBILITIES;

export const ATTEMPT_STATUSES = {
  created: "CREATED",
  in_progress: "IN_PROGRESS",
  submitted: "SUBMITTED",
  auto_submitted: "AUTO_SUBMITTED",
} as const;
export type DbAttemptStatus = keyof typeof ATTEMPT_STATUSES;
export type ApiAttemptStatus = (typeof ATTEMPT_STATUSES)[DbAttemptStatus];

export const ANSWER_FORMATS_API = { choice: "CHOICE", multi_choice: "MULTI_CHOICE", text: "TEXT" } as const;

export const QUESTION_TYPES = {
  mcq_single: "MCQ_SINGLE",
  mcq_multi: "MCQ_MULTI",
  true_false_not_given: "TRUE_FALSE_NOT_GIVEN",
  yes_no_not_given: "YES_NO_NOT_GIVEN",
  matching_headings: "MATCHING_HEADINGS",
  matching_information: "MATCHING_INFORMATION",
  matching_features: "MATCHING_FEATURES",
  matching_sentence_endings: "MATCHING_SENTENCE_ENDINGS",
  sentence_completion: "SENTENCE_COMPLETION",
  summary_completion: "SUMMARY_COMPLETION",
  note_completion: "NOTE_COMPLETION",
  table_completion: "TABLE_COMPLETION",
  form_completion: "FORM_COMPLETION",
  flow_chart_completion: "FLOW_CHART_COMPLETION",
  diagram_label_completion: "DIAGRAM_LABEL_COMPLETION",
  map_plan_labelling: "MAP_PLAN_LABELLING",
  short_answer: "SHORT_ANSWER",
} as const;
export type DbQuestionType = keyof typeof QUESTION_TYPES;

export function isDbQuestionType(value: string): value is DbQuestionType {
  return Object.hasOwn(QUESTION_TYPES, value);
}

/** Reverse lookup for query parameters: "IN_PROGRESS" → "in_progress". */
export function dbValueOf<Map extends Record<string, string>>(
  map: Map,
  apiValue: string,
): keyof Map | undefined {
  return (Object.keys(map) as (keyof Map)[]).find((key) => map[key] === apiValue);
}
