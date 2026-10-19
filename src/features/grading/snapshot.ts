import { z } from "zod";

import type { AttemptGrade } from "./grade-attempt";
import type { BandRange } from "./band";

/**
 * results.grading_snapshot (database-schema §3.6): everything needed to show a
 * result exactly as it was at submit time, independent of later edits.
 */
export const gradingSnapshotSchema = z.object({
  schema_version: z.literal(1),
  test_version_id: z.string(),
  graded_at: z.string(),
  band_table: z.object({
    id: z.string().nullable(),
    ranges: z.array(z.object({ min_raw: z.number(), max_raw: z.number(), band: z.number() })),
  }),
  sections: z.array(
    z.object({
      section_id: z.string(),
      order_no: z.number(),
      title: z.string().nullable(),
      correct_count: z.number(),
      max_score: z.number(),
    }),
  ),
  questions: z.array(
    z.object({
      question_id: z.string(),
      numbers: z.array(z.number()),
      type: z.string(),
      answer_format: z.enum(["choice", "multi_choice", "text"]),
      marks: z.number(),
      your_answer: z.unknown(),
      correct_answer: z.unknown(),
      explanation: z.string().nullable(),
      score: z.number(),
    }),
  ),
});

export type GradingSnapshot = z.infer<typeof gradingSnapshotSchema>;

export type SnapshotQuestionInfo = {
  questionId: string;
  questionType: string;
  answerFormat: "choice" | "multi_choice" | "text";
  answer: unknown;
  correctAnswer: unknown;
  explanation: string | null;
};

export type SnapshotSectionInfo = { sectionId: string; orderNo: number; title: string | null };

export function buildGradingSnapshot(input: {
  testVersionId: string;
  gradedAt: Date;
  bandTable: { id: string | null; ranges: readonly BandRange[] };
  sections: readonly SnapshotSectionInfo[];
  questions: readonly SnapshotQuestionInfo[];
  grade: AttemptGrade;
}): GradingSnapshot {
  const sectionScores = new Map(input.grade.sections.map((s) => [s.sectionId, s]));
  const questionInfo = new Map(input.questions.map((q) => [q.questionId, q]));

  return {
    schema_version: 1,
    test_version_id: input.testVersionId,
    graded_at: input.gradedAt.toISOString(),
    band_table: {
      id: input.bandTable.id,
      ranges: input.bandTable.ranges.map((r) => ({ min_raw: r.minRaw, max_raw: r.maxRaw, band: r.band })),
    },
    sections: input.sections.map((s) => ({
      section_id: s.sectionId,
      order_no: s.orderNo,
      title: s.title,
      correct_count: sectionScores.get(s.sectionId)?.correctCount ?? 0,
      max_score: sectionScores.get(s.sectionId)?.maxScore ?? 0,
    })),
    questions: input.grade.questions.map((graded) => {
      const info = questionInfo.get(graded.questionId);
      if (!info) throw new Error(`Missing snapshot info for question ${graded.questionId}.`);
      return {
        question_id: graded.questionId,
        numbers: graded.numbers,
        type: info.questionType,
        answer_format: info.answerFormat,
        marks: graded.grade.marks,
        your_answer: info.answer ?? null,
        correct_answer: info.correctAnswer,
        explanation: info.explanation,
        score: graded.grade.score,
      };
    }),
  };
}
