import { z } from "zod";

import { rulesInputSchema } from "@/features/grading/schemas";
import { apiEnum } from "@/features/test/api-enum-schema";
import { TEST_MODES, TEST_TYPES } from "@/features/test/api-enums";
import { optionListSchema } from "@/features/test/question-options";
import { paginationQuery } from "@/server/http/pagination";

import { ADMIN_TEST_STATUSES } from "./admin-views";
import { settingsPatchSchema } from "./settings";

/**
 * Request schemas for /api/admin/* (api-contract §6–7). Bodies are strict
 * (unknown fields → 400 VALIDATION_ERROR); query schemas ignore extra params.
 * Enum fields return the database value.
 */

const MARKDOWN_MAX = 100_000;
const TEXT_MAX = 5_000;

const title = z.string().trim().min(1).max(200);
const optionalText = (max: number) => z.string().max(max).nullable().optional();

/**
 * R2 object key, e.g. "tests/reading-mock-1/v1/section-1.mp3" (OI-11).
 * Relative path of letters, digits and - _ . / — no "..", no leading "/".
 */
export const objectKeySchema = z
  .string()
  .min(1)
  .max(500)
  .regex(/^(?!\/)(?!.*\.\.)[A-Za-z0-9._\-/]+$/, "Invalid object key.");

/** Option list with unique keys (api-contract §7.2). */
const optionList = optionListSchema.refine(
  (list) => new Set(list.map((option) => option.key)).size === list.length,
  "Option keys must be unique.",
);

/** Position to insert at (1-based). Omitted = append. */
const orderNo = z.number().int().min(1).optional();

/** Group rules / question config in a request: known keys only. */
export const rulesBody = z.strictObject(rulesInputSchema.shape);

export const adminTestsQuery = z.object({
  status: apiEnum(ADMIN_TEST_STATUSES).optional(),
  type: apiEnum(TEST_TYPES).optional(),
  search: z.string().max(100).optional(),
  ...paginationQuery,
});

/** Both modes are created with their defaults; `settings` overrides them (same shape as the settings PATCH). */
export const createTestBody = z.strictObject({
  title,
  type: apiEnum(TEST_TYPES),
  description: optionalText(TEXT_MAX),
  settings: settingsPatchSchema.optional(),
});

export const updateTestBody = z.strictObject({
  title: title.optional(),
  description: optionalText(TEXT_MAX),
  type: apiEnum(TEST_TYPES).optional(),
});

const sectionFields = {
  title: z.string().trim().max(200).nullable().optional(),
  instruction: optionalText(TEXT_MAX),
  content: optionalText(MARKDOWN_MAX),
  audio_object_key: objectKeySchema.nullable().optional(),
};
export const createSectionBody = z.strictObject({ order_no: orderNo, ...sectionFields });
export const updateSectionBody = z.strictObject(sectionFields);

const groupFields = {
  content: optionalText(MARKDOWN_MAX),
  options: optionList.nullable().optional(),
  rules: rulesBody.nullable().optional(),
  image_object_key: objectKeySchema.nullable().optional(),
};
export const createGroupBody = z.strictObject({
  instruction: z.string().trim().min(1).max(TEXT_MAX),
  order_no: orderNo,
  ...groupFields,
});
export const updateGroupBody = z.strictObject({
  instruction: z.string().trim().min(1).max(TEXT_MAX).optional(),
  ...groupFields,
});

// `type` and `answer_format` are plain strings here: an unknown value is
// 400 INVALID_QUESTION_TYPE (api-contract §7.3), checked by the service.
const questionFields = {
  answer_format: z.string().optional(),
  display_number: z.number().int().min(1).max(200).nullable().optional(),
  options: optionList.nullable().optional(),
  config: rulesBody.nullable().optional(),
};
export const createQuestionBody = z.strictObject({
  type: z.string(),
  content: z.string().trim().min(1).max(TEXT_MAX),
  order_no: orderNo,
  ...questionFields,
});
export const updateQuestionBody = z.strictObject({
  type: z.string().optional(),
  content: z.string().trim().min(1).max(TEXT_MAX).optional(),
  ...questionFields,
});

/** Shapes are checked against the question in checkAnswerKey (→ INVALID_ANSWER_KEY). */
export const answerKeyBody = z.strictObject({
  correct_answer: z.record(z.string(), z.unknown()),
  grading_config: z.record(z.string(), z.unknown()).nullable().optional(),
  explanation: optionalText(TEXT_MAX),
});

/** GET …/preview: the mode whose settings the preview shows (default: first enabled, MOCK before PRACTICE). */
export const previewQuery = z.object({
  mode: apiEnum(TEST_MODES).optional(),
});

/** POST endpoints that take no body (publish, validate, archive, hide, unhide). */
export const emptyBody = z.strictObject({});

export type CreateTestBody = z.infer<typeof createTestBody>;
export type UpdateTestBody = z.infer<typeof updateTestBody>;
export type AdminTestsQuery = z.infer<typeof adminTestsQuery>;
export type CreateSectionBody = z.infer<typeof createSectionBody>;
export type UpdateSectionBody = z.infer<typeof updateSectionBody>;
export type CreateGroupBody = z.infer<typeof createGroupBody>;
export type UpdateGroupBody = z.infer<typeof updateGroupBody>;
export type CreateQuestionBody = z.infer<typeof createQuestionBody>;
export type UpdateQuestionBody = z.infer<typeof updateQuestionBody>;
export type AnswerKeyBody = z.infer<typeof answerKeyBody>;
