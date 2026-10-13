export type NumberingInput = { marks: number; displayNumber: number | null };

/**
 * Question numbers shown to students (api-contract §2.2). Questions are given
 * in test order; each takes `marks` consecutive numbers ("choose TWO" = 2).
 * Numbering continues from the previous question unless the admin set
 * `display_number`, which restarts the count from that value.
 */
export function assignNumbers(questions: readonly NumberingInput[]): number[][] {
  let next = 1;
  return questions.map(({ marks, displayNumber }) => {
    const first = displayNumber ?? next;
    const numbers = Array.from({ length: marks }, (_, index) => first + index);
    next = first + marks;
    return numbers;
  });
}
