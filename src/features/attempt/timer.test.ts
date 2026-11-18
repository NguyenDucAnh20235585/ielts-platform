import { describe, expect, it } from "vitest";

import { GRACE_SECONDS, finalOutcome, isPastGrace, remainingSeconds } from "./timer";

const start = new Date("2026-10-10T08:00:00.000Z");
const expires = new Date(start.getTime() + 3600_000);
const at = (seconds: number) => new Date(start.getTime() + seconds * 1000);

describe("timer", () => {
  it("remainingSeconds counts down and never goes below 0", () => {
    expect(remainingSeconds({ status: "in_progress", expiresAt: expires }, at(0))).toBe(3600);
    expect(remainingSeconds({ status: "in_progress", expiresAt: expires }, at(3599.5))).toBe(0);
    expect(remainingSeconds({ status: "in_progress", expiresAt: expires }, at(4000))).toBe(0);
  });

  it("is null without a time limit or before begin", () => {
    expect(remainingSeconds({ status: "in_progress", expiresAt: null }, at(10))).toBeNull();
    expect(remainingSeconds({ status: "created", expiresAt: null }, at(10))).toBeNull();
  });

  it(`gives ${GRACE_SECONDS} s of grace after expires_at`, () => {
    expect(isPastGrace({ status: "in_progress", expiresAt: expires }, at(3600 + GRACE_SECONDS))).toBe(false);
    expect(isPastGrace({ status: "in_progress", expiresAt: expires }, at(3600 + GRACE_SECONDS + 1))).toBe(true);
    expect(isPastGrace({ status: "in_progress", expiresAt: null }, at(999_999))).toBe(false);
    expect(isPastGrace({ status: "submitted", expiresAt: expires }, at(999_999))).toBe(false);
  });

  it("submitting after expires_at is recorded as AUTO_SUBMITTED at expires_at", () => {
    expect(finalOutcome(expires, at(100))).toEqual({ status: "submitted", submittedAt: at(100) });
    expect(finalOutcome(expires, at(3605))).toEqual({ status: "auto_submitted", submittedAt: expires });
    expect(finalOutcome(null, at(99_999))).toEqual({ status: "submitted", submittedAt: at(99_999) });
  });
});
