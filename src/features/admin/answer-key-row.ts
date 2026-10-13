/** A row of answer_keys as loaded for admin views and publish validation. */
export type AnswerKeyRow = {
  question_id: string;
  correct_answer: unknown;
  grading_config: unknown;
  explanation: string | null;
  updated_at: Date;
};

/** api-contract §6.5 question.answer_key and §7.4 response (without question_id). */
export function toAnswerKeyView(row: AnswerKeyRow) {
  return {
    correct_answer: row.correct_answer,
    grading_config: row.grading_config,
    explanation: row.explanation,
    updated_at: row.updated_at.toISOString(),
  };
}
