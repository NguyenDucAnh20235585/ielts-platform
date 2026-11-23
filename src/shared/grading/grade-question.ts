import { normalizeAnswerText } from "./normalize";
import type { Rules } from "./rules";
import {
  type AnswerFormat,
  choiceAnswerSchema,
  choiceKeySchema,
  gradingConfigSchema,
  multiChoiceAnswerSchema,
  multiChoiceKeySchema,
  textAnswerSchema,
  textKeySchema,
} from "./schemas";
import { withinWordLimit } from "./word-limit";

export type GradableQuestion = {
  answerFormat: AnswerFormat;
  /** questions.max_score — 1, or select_count for "choose TWO/THREE". */
  marks: number;
  rules: Rules;
  /** answer_keys.correct_answer (validated on write; re-checked here). */
  correctAnswer: unknown;
  /** answer_keys.grading_config */
  gradingConfig: unknown;
};

export type QuestionGrade = {
  score: number;
  marks: number;
  correctMarks: number;
  incorrectMarks: number;
  unansweredMarks: number;
  isCorrect: boolean;
};

/**
 * Grades one question (api-contract §12.5). Every mark is exactly one of
 * correct / incorrect / unanswered, so the three always add up to `marks`.
 *
 * A broken answer KEY throws (the submit transaction rolls back →
 * GRADING_FAILED). A malformed STUDENT answer is graded as wrong.
 */
export function gradeQuestion(question: GradableQuestion, answer: unknown): QuestionGrade {
  const { marks } = question;
  if (answer === null || answer === undefined) {
    return result(marks, 0, 0);
  }

  switch (question.answerFormat) {
    case "choice": {
      const key = choiceKeySchema.parse(question.correctAnswer);
      const parsed = choiceAnswerSchema.safeParse(answer);
      if (!parsed.success) return result(marks, 0, marks);
      return parsed.data.choice === key.choice ? result(marks, marks, 0) : result(marks, 0, marks);
    }

    case "multi_choice": {
      const key = new Set(multiChoiceKeySchema.parse(question.correctAnswer).choices);
      const parsed = multiChoiceAnswerSchema.safeParse(answer);
      if (!parsed.success) return result(marks, 0, marks);
      const selected = new Set(parsed.data.choices);
      // Choosing more letters than allowed is rejected on save; if it ever
      // reaches grading, the whole question scores 0.
      if (selected.size > marks) return result(marks, 0, marks);
      let correct = 0;
      for (const choice of selected) if (key.has(choice)) correct += 1;
      correct = Math.min(correct, marks);
      return result(marks, correct, selected.size - correct);
    }

    case "text": {
      const key = textKeySchema.parse(question.correctAnswer);
      const config = gradingConfigSchema.parse(question.gradingConfig ?? {});
      const parsed = textAnswerSchema.safeParse(answer);
      if (!parsed.success) return result(marks, 0, marks);

      const options = {
        caseSensitive: config.case_sensitive,
        stripPunctuation: config.strip_punctuation,
      };
      const given = normalizeAnswerText(parsed.data.text, options);
      if (given === "") return result(marks, 0, 0);

      const matches = key.accepted.some((variant) => normalizeAnswerText(variant, options) === given);
      const correct = matches && withinWordLimit(parsed.data.text, question.rules);
      return correct ? result(marks, marks, 0) : result(marks, 0, marks);
    }
  }
}

function result(marks: number, correctMarks: number, incorrectMarks: number): QuestionGrade {
  return {
    score: correctMarks,
    marks,
    correctMarks,
    incorrectMarks,
    unansweredMarks: marks - correctMarks - incorrectMarks,
    isCorrect: correctMarks === marks,
  };
}
