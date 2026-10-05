import { z } from "zod";

import type { Rules } from "@/features/grading/rules";
import {
  type AnswerFormat,
  choiceKeySchema,
  gradingConfigSchema,
  multiChoiceKeySchema,
  textKeySchema,
} from "@/features/grading/schemas";
import { withinWordLimit } from "@/features/grading/word-limit";
import type { Option } from "@/features/test/question-options";

/** What an answer key is checked against: the question's effective format, marks, rules and options. */
export type KeyTarget = {
  answerFormat: AnswerFormat;
  marks: number;
  rules: Rules;
  options: Option[] | null;
};

export type NormalizedKey = {
  correct_answer: { choice: string } | { choices: string[] } | { accepted: string[] };
  grading_config: Record<string, boolean>;
};

export type KeyCheck =
  | { ok: true; key: NormalizedKey }
  | { ok: false; code: "INVALID_ANSWER_KEY" | "ANSWER_EXCEEDS_WORD_LIMIT"; reason: string };

const strictGradingConfig = z.strictObject(gradingConfigSchema.shape);

function isEmptyConfig(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "object" && Object.keys(value).length === 0);
}

function invalid(reason: string): KeyCheck {
  return { ok: false, code: "INVALID_ANSWER_KEY", reason };
}

/**
 * Checks an answer key against its question (api-contract §2.5). Used by
 * PUT …/answer-key (400 INVALID_ANSWER_KEY) and by publish validation (§12.6).
 * TEXT keys come back with the full grading_config (defaults filled in).
 */
export function checkAnswerKey(target: KeyTarget, correctAnswer: unknown, gradingConfig: unknown): KeyCheck {
  if (target.answerFormat !== "text" && !isEmptyConfig(gradingConfig)) {
    return invalid("grading_config applies to TEXT answers only.");
  }
  const keys = new Set((target.options ?? []).map((option) => option.key));

  switch (target.answerFormat) {
    case "choice": {
      const parsed = choiceKeySchema.safeParse(correctAnswer);
      if (!parsed.success) return invalid('Expected {"choice": "<option key>"}.');
      if (!keys.has(parsed.data.choice)) return invalid(`"${parsed.data.choice}" is not one of the options.`);
      return { ok: true, key: { correct_answer: { choice: parsed.data.choice }, grading_config: {} } };
    }
    case "multi_choice": {
      const parsed = multiChoiceKeySchema.safeParse(correctAnswer);
      if (!parsed.success) return invalid('Expected {"choices": ["<option key>", …]}.');
      const choices = parsed.data.choices;
      if (new Set(choices).size !== choices.length) return invalid("Choices must be unique.");
      if (choices.length !== target.marks) {
        return invalid(`Exactly ${target.marks} choices are required (select_count).`);
      }
      const unknownChoice = choices.find((choice) => !keys.has(choice));
      if (unknownChoice !== undefined) return invalid(`"${unknownChoice}" is not one of the options.`);
      return { ok: true, key: { correct_answer: { choices }, grading_config: {} } };
    }
    case "text": {
      const parsed = textKeySchema.safeParse(correctAnswer);
      if (!parsed.success) return invalid('Expected {"accepted": ["<answer>", …]} with 1–20 answers of 1–200 characters.');
      const config = strictGradingConfig.safeParse(gradingConfig ?? {});
      if (!config.success) return invalid("grading_config accepts only case_sensitive and strip_punctuation (booleans).");
      const tooLong = parsed.data.accepted.find((variant) => !withinWordLimit(variant, target.rules));
      if (tooLong !== undefined) {
        return { ok: false, code: "ANSWER_EXCEEDS_WORD_LIMIT", reason: `"${tooLong}" exceeds the word limit of this question.` };
      }
      return { ok: true, key: { correct_answer: { accepted: parsed.data.accepted }, grading_config: config.data } };
    }
  }
}
