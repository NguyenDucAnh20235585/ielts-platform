import type { Rules } from "./rules";

// A number: digits with optional , . : / separators ("1,500", "10.30", "3/4"),
// an optional currency sign before and an optional % after.
const NUMBER_TOKEN = /^[$£€]?\d+(?:[.,:/]\d+)*%?$/;
const TOKEN_EDGE_PUNCTUATION = /^[.,;:!?'"()[\]{}]+|[.,;:!?'"()[\]{}]+$/g;

export type TokenCount = { words: number; numbers: number };

/**
 * Splits on whitespace. A hyphenated word counts as one word ("well-known").
 * Tokens that are only punctuation are ignored.
 */
export function countWordsAndNumbers(text: string): TokenCount {
  let words = 0;
  let numbers = 0;
  for (const raw of text.normalize("NFKC").trim().split(/\s+/)) {
    const token = raw.replace(TOKEN_EDGE_PUNCTUATION, "");
    if (token === "") continue;
    if (NUMBER_TOKEN.test(token)) numbers += 1;
    else words += 1;
  }
  return { words, numbers };
}

/**
 * IELTS word limits (v1 §22):
 * - "NO MORE THAN TWO WORDS"                 → maxWords 2: numbers count as words
 * - "NO MORE THAN TWO WORDS AND/OR A NUMBER" → maxWords 2, allowNumber: ≤ 2 words and ≤ 1 number
 * - "A NUMBER"                               → maxWords 0, allowNumber
 * No `maxWords` = no limit.
 */
export function withinWordLimit(text: string, rules: Pick<Rules, "maxWords" | "allowNumber">): boolean {
  if (rules.maxWords === null) {
    return true;
  }
  const { words, numbers } = countWordsAndNumbers(text);
  if (rules.allowNumber) {
    return words <= rules.maxWords && numbers <= 1;
  }
  return words + numbers <= rules.maxWords;
}
