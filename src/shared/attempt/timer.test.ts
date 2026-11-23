import { describe, expect, it } from "vitest";

import { GRACE_SECONDS, finalOutcome, isExpired, isPastGrace, remainingSeconds } from "./timer";

const start = new Date("2026-10-10T08:00:00.000Z");
const expires = new Date(start.getTime() + 3600_000);
const at = (seconds: number) => new Date(start.getTime() + seconds * 1000);
const running = { status: "in_progress", expiresAt: expires } as const;

describe("timer (D-005, D-016)", () => {
  it("uses a 15 s grace period", () => {
    expect(GRACE_SECONDS).toBe(15);
  });

  it("remainingSeconds counts down and never goes below 0", () => {
    expect(remainingSeconds(running, at(0))).toBe(3600);
    expect(remainingSeconds(running, at(3599.5))).toBe(0);
    expect(remainingSeconds(running, at(4000))).toBe(0);
  });

  it("is null without a time limit or before begin", () => {
    expect(remainingSeconds({ status: "in_progress", expiresAt: null }, at(10))).toBeNull();
    expect(remainingSeconds({ status: "created", expiresAt: null }, at(10))).toBeNull();
  });

  it("the clock is up exactly at expires_at", () => {
    expect(isExpired(running, at(3599.999))).toBe(false);
    expect(isExpired(running, at(3600))).toBe(true);
    expect(isExpired(running, at(3601))).toBe(true);
    expect(isExpired({ status: "in_progress", expiresAt: null }, at(999_999))).toBe(false);
    expect(isExpired({ status: "submitted", expiresAt: expires }, at(999_999))).toBe(false);
  });

  it("the grace window includes expires_at + 15 s and ends 1 ms later", () => {
    expect(isPastGrace(running, at(3600))).toBe(false);
    expect(isPastGrace(running, at(3600 + GRACE_SECONDS))).toBe(false);
    expect(isPastGrace(running, at(3600 + GRACE_SECONDS + 0.001))).toBe(true);
    expect(isPastGrace({ status: "in_progress", expiresAt: null }, at(999_999))).toBe(false);
    expect(isPastGrace({ status: "submitted", expiresAt: expires }, at(999_999))).toBe(false);
  });

  it("records SUBMITTED before expires_at and AUTO_SUBMITTED at expires_at from then on", () => {
    expect(finalOutcome(expires, at(100))).toEqual({ status: "submitted", submittedAt: at(100) });
    expect(finalOutcome(expires, at(3599.999))).toEqual({ status: "submitted", submittedAt: at(3599.999) });
    expect(finalOutcome(expires, at(3600))).toEqual({ status: "auto_submitted", submittedAt: expires });
    expect(finalOutcome(expires, at(3605))).toEqual({ status: "auto_submitted", submittedAt: expires });
    expect(finalOutcome(null, at(99_999))).toEqual({ status: "submitted", submittedAt: at(99_999) });
  });
});
