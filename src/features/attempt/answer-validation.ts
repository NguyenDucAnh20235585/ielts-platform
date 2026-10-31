import type { Option } from "@/features/test/question-options";
import {
  type AnswerFormat,
  type ChoiceAnswer,
  type MultiChoiceAnswer,
  type TextAnswer,
  choiceAnswerSchema,
  multiChoiceAnswerSchema,
  textAnswerSchema,
} from "@/features/grading/schemas";
import { ApiError } from "@/server/http/errors";

export type StoredAnswer = ChoiceAnswer | MultiChoiceAnswer | TextAnswer | null;

/** What autosave needs to know about a question to validate an answer. */
export type AnswerTarget = {
  questionId: string;
  answerFormat: AnswerFormat;
  marks: number;
  /** Effective options (null for TEXT). */
  options: Option[] | null;
};

/**
 * Validates one student answer against its question (api-contract §2.4) and
 * returns the value to store. `null` clears the answer. The word limit is NOT
 * checked here: over-limit answers are saved and marked wrong, as in the exam.
 */
export function validateAnswer(target: AnswerTarget, raw: unknown): StoredAnswer {
  if (raw === null) {
    return null;
  }
  switch (target.answerFormat) {
    case "choice": {
      const parsed = choiceAnswerSchema.safeParse(raw);
      if (!parsed.success) throw invalid(target, 'Expected {"choice": "<option key>"}.');
      if (!hasOption(target, parsed.data.choice)) throw invalid(target, `Unknown option "${parsed.data.choice}".`);
      return { choice: parsed.data.choice };
    }
    case "multi_choice": {
      const parsed = multiChoiceAnswerSchema.safeParse(raw);
      if (!parsed.success) throw invalid(target, 'Expected {"choices": ["<option key>", …]}.');
      const choices = [...new Set(parsed.data.choices)];
      if (choices.length > target.marks) {
        throw invalid(target, `Choose at most ${target.marks} options.`);
      }
      const unknown = choices.find((choice) => !hasOption(target, choice));
      if (unknown !== undefined) throw invalid(target, `Unknown option "${unknown}".`);
      return { choices };
    }
    case "text": {
      const parsed = textAnswerSchema.safeParse(raw);
      if (!parsed.success) throw invalid(target, 'Expected {"text": "<up to 200 characters>"}.');
      const text = parsed.data.text.trim();
      return text === "" ? null : { text };
    }
  }
}

function hasOption(target: AnswerTarget, key: string): boolean {
  return (target.options ?? []).some((option) => option.key === key);
}

function invalid(target: AnswerTarget, message: string): ApiError {
  return new ApiError("INVALID_ANSWER", message, { question_id: target.questionId });
}
