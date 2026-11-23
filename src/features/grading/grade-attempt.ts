import { type BandRange, lookupBand } from "./band";
import { type GradableQuestion, type QuestionGrade, gradeQuestion } from "./grade-question";

export type AttemptQuestion = GradableQuestion & {
  questionId: string;
  sectionId: string;
  numbers: number[];
  /** attempt_answers.answer, or null when never answered */
  answer: unknown;
};

export type GradedQuestion = {
  questionId: string;
  sectionId: string;
  numbers: number[];
  grade: QuestionGrade;
};

export type SectionScore = { sectionId: string; correctCount: number; maxScore: number };

export type AttemptGrade = {
  questions: GradedQuestion[];
  sections: SectionScore[];
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  rawScore: number;
  maxScore: number;
  bandScore: number | null;
};

/**
 * Grades a whole attempt. `questions` must be in test order; sections keep
 * the order in which they first appear. Pure function: the caller loads the
 * data and saves the result inside the submit transaction.
 */
export function gradeAttempt(questions: readonly AttemptQuestion[], bandRanges: readonly BandRange[]): AttemptGrade {
  const graded: GradedQuestion[] = [];
  const sections = new Map<string, SectionScore>();
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  let maxScore = 0;

  for (const question of questions) {
    const grade = gradeQuestion(question, question.answer);
    graded.push({ questionId: question.questionId, sectionId: question.sectionId, numbers: question.numbers, grade });

    correctCount += grade.correctMarks;
    incorrectCount += grade.incorrectMarks;
    unansweredCount += grade.unansweredMarks;
    maxScore += grade.marks;

    const section = sections.get(question.sectionId) ?? { sectionId: question.sectionId, correctCount: 0, maxScore: 0 };
    section.correctCount += grade.correctMarks;
    section.maxScore += grade.marks;
    sections.set(question.sectionId, section);
  }

  // One mark per correct answer: the raw score is the number of correct marks.
  const rawScore = correctCount;
  return {
    questions: graded,
    sections: [...sections.values()],
    correctCount,
    incorrectCount,
    unansweredCount,
    rawScore,
    maxScore,
    bandScore: lookupBand(rawScore, maxScore, bandRanges),
  };
}
