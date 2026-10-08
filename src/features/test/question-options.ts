import { z } from "zod";

import type { AnswerFormat } from "@/features/grading/schemas";

export type Option = { key: string; text: string };

export const optionListSchema = z
  .array(z.strictObject({ key: z.string().min(1).max(10), text: z.string().min(1).max(500) }))
  .min(1)
  .max(40);

/** Options the server adds for TFNG / YNNG (api-contract §2.2). */
export const FIXED_OPTIONS: Readonly<Record<string, readonly Option[]>> = {
  true_false_not_given: [
    { key: "TRUE", text: "TRUE" },
    { key: "FALSE", text: "FALSE" },
    { key: "NOT_GIVEN", text: "NOT GIVEN" },
  ],
  yes_no_not_given: [
    { key: "YES", text: "YES" },
    { key: "NO", text: "NO" },
    { key: "NOT_GIVEN", text: "NOT GIVEN" },
  ],
};

/**
 * The options a CHOICE / MULTI_CHOICE question offers: fixed options for
 * TFNG/YNNG, otherwise the question's own list, otherwise its group's list.
 * TEXT questions have none.
 */
export function effectiveOptions(
  questionType: string,
  answerFormat: AnswerFormat,
  questionOptions: unknown,
  groupOptions: unknown,
): Option[] | null {
  if (answerFormat === "text") {
    return null;
  }
  const fixed = FIXED_OPTIONS[questionType];
  if (fixed) {
    return [...fixed];
  }
  const own = parseOptions(questionOptions);
  return own ?? parseOptions(groupOptions);
}

/** Parses a stored option list; null when absent. Throws on malformed data. */
export function parseOptions(value: unknown): Option[] | null {
  if (value === null || value === undefined) {
    return null;
  }
  return optionListSchema.parse(value);
}
