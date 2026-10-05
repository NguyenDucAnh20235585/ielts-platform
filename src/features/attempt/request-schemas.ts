import { z } from "zod";

import { paginationQuery } from "@/server/http/pagination";

import { ATTEMPT_STATUSES, TEST_MODES, TEST_TYPES } from "@/features/test/api-enums";

/** One answer in PATCH …/answers and POST …/submit (api-contract §2.4). Shape per format is checked later. */
const answerItem = z.strictObject({
  question_id: z.uuid(),
  answer: z.union([z.record(z.string(), z.unknown()), z.null()]),
});

export const saveAnswersBody = z.strictObject({
  answers: z.array(answerItem).min(1).max(100),
});

export const submitBody = z.strictObject({
  answers: z.array(answerItem).max(100).optional(),
});

export const flagBody = z.strictObject({ flagged: z.boolean() });

/** Accepts the API value ("READING") and returns the DB value ("reading"). */
function apiEnum<Map extends Record<string, string>>(map: Map) {
  const entries = Object.entries(map);
  const apiValues = entries.map(([, api]) => api);
  return z
    .string()
    .refine((value) => apiValues.includes(value), { message: `Expected one of: ${apiValues.join(", ")}` })
    .transform((value) => {
      const entry = entries.find(([, api]) => api === value);
      if (!entry) throw new Error("unreachable");
      return entry[0] as keyof Map & string;
    });
}

// Unknown query parameters are ignored (e.g. cache-busting "?_=123"); bodies are strict.
export const catalogueQuery = z.object({
  type: apiEnum(TEST_TYPES).optional(),
  mode: apiEnum(TEST_MODES).optional(),
  search: z.string().max(100).optional(),
  ...paginationQuery,
});

export const historyQuery = z.object({
  status: apiEnum(ATTEMPT_STATUSES).optional(),
  test_id: z.uuid().optional(),
  ...paginationQuery,
});
