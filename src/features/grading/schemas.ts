import { z } from "zod";

/**
 * Shapes stored in jsonb columns (database-schema.md §3). Shared by autosave
 * validation, admin answer-key validation and grading.
 */

export const ANSWER_FORMATS = ["choice", "multi_choice", "text"] as const;
export type AnswerFormat = (typeof ANSWER_FORMATS)[number];

const optionKey = z.string().min(1).max(10);

// --- Student answers (attempt_answers.answer) ---
export const choiceAnswerSchema = z.strictObject({ choice: optionKey });
export const multiChoiceAnswerSchema = z.strictObject({
  choices: z.array(optionKey).min(1).max(5),
});
export const textAnswerSchema = z.strictObject({ text: z.string().max(200) });

export type ChoiceAnswer = z.infer<typeof choiceAnswerSchema>;
export type MultiChoiceAnswer = z.infer<typeof multiChoiceAnswerSchema>;
export type TextAnswer = z.infer<typeof textAnswerSchema>;

// --- Answer keys (answer_keys.correct_answer) ---
export const choiceKeySchema = z.strictObject({ choice: optionKey });
export const multiChoiceKeySchema = z.strictObject({
  choices: z.array(optionKey).min(1).max(5),
});
export const textKeySchema = z.strictObject({
  accepted: z.array(z.string().trim().min(1).max(200)).min(1).max(20),
});

// --- answer_keys.grading_config (TEXT only) ---
export const gradingConfigSchema = z.object({
  case_sensitive: z.boolean().default(false),
  strip_punctuation: z.boolean().default(true),
});
export type GradingConfig = z.infer<typeof gradingConfigSchema>;

// --- question_groups.rules / questions.config (all keys optional) ---
export const rulesInputSchema = z.object({
  max_words: z.number().int().min(0).max(10).nullable().optional(),
  allow_number: z.boolean().optional(),
  select_count: z.number().int().min(2).max(5).nullable().optional(),
  allow_option_reuse: z.boolean().optional(),
});
export type RulesInput = z.infer<typeof rulesInputSchema>;
