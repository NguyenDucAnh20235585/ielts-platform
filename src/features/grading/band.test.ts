import { describe, expect, it } from "vitest";

import { type BandRange, checkBandRanges, lookupBand } from "./band";

// Same values as the default tables seeded by
// supabase/migrations/20261005075716_prototype_schema_changes.sql
const table = (rows: [number, number, number][]): BandRange[] =>
  rows.map(([minRaw, maxRaw, band]) => ({ minRaw, maxRaw, band }));

const LISTENING = table([
  [39, 40, 9.0], [37, 38, 8.5], [35, 36, 8.0], [32, 34, 7.5], [30, 31, 7.0],
  [26, 29, 6.5], [23, 25, 6.0], [18, 22, 5.5], [16, 17, 5.0], [13, 15, 4.5],
  [10, 12, 4.0], [8, 9, 3.5], [6, 7, 3.0], [4, 5, 2.5], [2, 3, 2.0], [1, 1, 1.0], [0, 0, 0.0],
]);
const READING = table([
  [39, 40, 9.0], [37, 38, 8.5], [35, 36, 8.0], [33, 34, 7.5], [30, 32, 7.0],
  [27, 29, 6.5], [23, 26, 6.0], [19, 22, 5.5], [15, 18, 5.0], [13, 14, 4.5],
  [10, 12, 4.0], [8, 9, 3.5], [6, 7, 3.0], [4, 5, 2.5], [2, 3, 2.0], [1, 1, 1.0], [0, 0, 0.0],
]);

describe("lookupBand", () => {
  it("matches the official anchor points (British Council)", () => {
    expect(lookupBand(16, 40, LISTENING)).toBe(5);
    expect(lookupBand(23, 40, LISTENING)).toBe(6);
    expect(lookupBand(30, 40, LISTENING)).toBe(7);
    expect(lookupBand(35, 40, LISTENING)).toBe(8);
    expect(lookupBand(15, 40, READING)).toBe(5);
    expect(lookupBand(23, 40, READING)).toBe(6);
    expect(lookupBand(30, 40, READING)).toBe(7);
    expect(lookupBand(35, 40, READING)).toBe(8);
  });

  it("uses the half-band rows", () => {
    expect(lookupBand(32, 40, LISTENING)).toBe(7.5);
    expect(lookupBand(32, 40, READING)).toBe(7);
    expect(lookupBand(40, 40, READING)).toBe(9);
    expect(lookupBand(0, 40, READING)).toBe(0);
  });

  it("returns null when the test is not a full 40-mark test (D-006)", () => {
    expect(lookupBand(10, 13, READING)).toBeNull();
  });
});

describe("checkBandRanges", () => {
  it("accepts both default tables", () => {
    expect(checkBandRanges(LISTENING)).toEqual({ ok: true });
    expect(checkBandRanges(READING)).toEqual({ ok: true });
  });

  it("rejects overlaps, gaps and invalid bands", () => {
    expect(checkBandRanges(table([[0, 20, 5], [20, 40, 7]]))).toMatchObject({ ok: false, code: "OVERLAPPING_RANGE" });
    expect(checkBandRanges(table([[0, 19, 5], [21, 40, 7]]))).toMatchObject({ ok: false, code: "INVALID_SCORE_RANGE" });
    expect(checkBandRanges(table([[0, 39, 5]]))).toMatchObject({ ok: false, code: "INVALID_SCORE_RANGE" });
    expect(checkBandRanges(table([[0, 40, 6.3]]))).toMatchObject({ ok: false, code: "INVALID_SCORE_RANGE" });
  });
});
