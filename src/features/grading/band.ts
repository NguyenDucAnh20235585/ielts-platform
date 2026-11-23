/** A row of band_table_ranges. */
export type BandRange = { minRaw: number; maxRaw: number; band: number };

/** Band scores are only meaningful for a full 40-mark test (decision D-006). */
export const FULL_TEST_MARKS = 40;

export function lookupBand(rawScore: number, maxScore: number, ranges: readonly BandRange[]): number | null {
  if (maxScore !== FULL_TEST_MARKS) {
    return null;
  }
  const range = ranges.find((r) => rawScore >= r.minRaw && rawScore <= r.maxRaw);
  return range ? range.band : null;
}

export type BandRangesCheck =
  | { ok: true }
  | { ok: false; code: "INVALID_SCORE_RANGE" | "OVERLAPPING_RANGE"; message: string };

/**
 * A band table must cover every raw score 0…maxScore exactly once, with bands
 * 0–9 in steps of 0.5 (api-contract §8).
 */
export function checkBandRanges(ranges: readonly BandRange[], maxScore = FULL_TEST_MARKS): BandRangesCheck {
  for (const r of ranges) {
    const validBand = r.band >= 0 && r.band <= 9 && Number.isInteger(r.band * 2);
    if (!Number.isInteger(r.minRaw) || !Number.isInteger(r.maxRaw) || r.minRaw < 0 || r.maxRaw < r.minRaw || r.maxRaw > maxScore || !validBand) {
      return { ok: false, code: "INVALID_SCORE_RANGE", message: `Invalid range ${r.minRaw}–${r.maxRaw} → ${r.band}.` };
    }
  }
  const sorted = [...ranges].sort((a, b) => a.minRaw - b.minRaw);
  let next = 0;
  for (const r of sorted) {
    if (r.minRaw < next) {
      return { ok: false, code: "OVERLAPPING_RANGE", message: `Range starting at ${r.minRaw} overlaps the previous one.` };
    }
    if (r.minRaw > next) {
      return { ok: false, code: "INVALID_SCORE_RANGE", message: `Raw scores ${next}–${r.minRaw - 1} are not covered.` };
    }
    next = r.maxRaw + 1;
  }
  if (next !== maxScore + 1) {
    return { ok: false, code: "INVALID_SCORE_RANGE", message: `Raw scores ${next}–${maxScore} are not covered.` };
  }
  return { ok: true };
}
