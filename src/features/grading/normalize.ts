/**
 * Text answer normalization (v1 §21, api-contract §12.5). The same function is
 * applied to the student's answer and to every accepted variant, then the two
 * are compared for equality.
 */

const SINGLE_QUOTES = /[‘’‚‛′`´]/g;
const DOUBLE_QUOTES = /[“”„‟″]/g;
const DASHES = /[‐‑‒–—―−]/g;
// Sentence punctuation, quotes and brackets only — not %, $ or hyphens,
// which can change the meaning of an answer.
const EDGE_PUNCTUATION = /^[.,;:!?'"()[\]{}]+|[.,;:!?'"()[\]{}]+$/g;

export type NormalizeOptions = { caseSensitive: boolean; stripPunctuation: boolean };

export function normalizeAnswerText(input: string, options: NormalizeOptions): string {
  let text = input
    .normalize("NFKC")
    .replace(SINGLE_QUOTES, "'")
    .replace(DOUBLE_QUOTES, '"')
    .replace(DASHES, "-")
    .replace(/\s+/g, " ")
    .trim();

  if (options.stripPunctuation) {
    // Repeat until stable: "( car )" → " car " → "car".
    let previous: string;
    do {
      previous = text;
      text = text.replace(EDGE_PUNCTUATION, "").trim();
    } while (text !== previous);
  }

  return options.caseSensitive ? text : text.toLowerCase();
}
