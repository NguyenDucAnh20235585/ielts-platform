import {
  ATTEMPT_STATUSES,
  type DbAnswerVisibility,
  type DbAttemptStatus,
  isDbQuestionType,
  type DbTestMode,
  type DbTestType,
  QUESTION_TYPES,
  TEST_MODES,
  TEST_TYPES,
} from "@/features/test/api-enums";
import type { GradingSnapshot } from "@/features/grading/snapshot";

import { iso } from "./attempt-view";

export type ResultRow = {
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  raw_score: string | number;
  max_score: string | number;
  band_score: string | number | null;
  time_taken_seconds: number;
};

export type ResultContext = {
  attempt: { id: string; status: DbAttemptStatus; mode: DbTestMode; started_at: Date | null; submitted_at: Date | null };
  test: { id: string; title: string; type: DbTestType };
  versionNumber: number;
  visibility: DbAnswerVisibility;
  result: ResultRow;
  snapshot: GradingSnapshot;
};

/** Fields a student may see on the result page (api-contract §12.4). */
export function answersVisible(visibility: DbAnswerVisibility): boolean {
  return visibility !== "never";
}

/** api-contract §2.6 ResultPayload, read from the immutable snapshot. */
export function buildResultPayload(ctx: ResultContext) {
  const visible = answersVisible(ctx.visibility);
  return {
    result: {
      attempt_id: ctx.attempt.id,
      status: ATTEMPT_STATUSES[ctx.attempt.status],
      test: { id: ctx.test.id, title: ctx.test.title, type: TEST_TYPES[ctx.test.type] },
      version_number: ctx.versionNumber,
      mode: TEST_MODES[ctx.attempt.mode],
      correct_count: ctx.result.correct_count,
      incorrect_count: ctx.result.incorrect_count,
      unanswered_count: ctx.result.unanswered_count,
      raw_score: Number(ctx.result.raw_score),
      max_score: Number(ctx.result.max_score),
      band_score: ctx.result.band_score === null ? null : Number(ctx.result.band_score),
      time_taken_seconds: ctx.result.time_taken_seconds,
      started_at: iso(ctx.attempt.started_at),
      submitted_at: iso(ctx.attempt.submitted_at),
      answers_visible: visible,
    },
    section_results: ctx.snapshot.sections.map((s) => ({
      section_id: s.section_id,
      order_no: s.order_no,
      title: s.title,
      correct_count: s.correct_count,
      max_score: s.max_score,
    })),
    answers: ctx.snapshot.questions.map((q) => ({
      question_id: q.question_id,
      numbers: q.numbers,
      type: isDbQuestionType(q.type) ? QUESTION_TYPES[q.type] : q.type.toUpperCase(),
      marks: q.marks,
      your_answer: q.your_answer ?? null,
      score: visible ? q.score : null,
      is_correct: visible ? q.score === q.marks : null,
      correct_answer: visible ? (q.correct_answer ?? null) : null,
      explanation: visible ? q.explanation : null,
    })),
  };
}

export type ResultPayload = ReturnType<typeof buildResultPayload>;
