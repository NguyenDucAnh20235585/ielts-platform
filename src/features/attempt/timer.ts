/**
 * Server-side timer rules (D-005, api-contract §1.6, §12.2).
 * All functions take `now` from the caller so one request uses one clock.
 */

/** Answers are still accepted this long after expires_at (absorbs the last autosave). */
export const GRACE_SECONDS = 30;

export type TimedAttempt = {
  status: "created" | "in_progress" | "submitted" | "auto_submitted";
  expiresAt: Date | null;
};

/** Seconds left on the clock; null when the attempt has no time limit or has not begun. */
export function remainingSeconds(attempt: TimedAttempt, now: Date): number | null {
  if (attempt.status === "created" || attempt.expiresAt === null) {
    return null;
  }
  if (attempt.status !== "in_progress") {
    return 0;
  }
  return Math.max(0, Math.floor((attempt.expiresAt.getTime() - now.getTime()) / 1000));
}

/** True when an in-progress timed attempt is past expires_at + grace and must be finalized. */
export function isPastGrace(attempt: TimedAttempt, now: Date): boolean {
  return (
    attempt.status === "in_progress" &&
    attempt.expiresAt !== null &&
    now.getTime() > attempt.expiresAt.getTime() + GRACE_SECONDS * 1000
  );
}

/**
 * How a finalized attempt is recorded (api-contract §5 submit):
 * SUBMITTED if the student submitted before expires_at, otherwise
 * AUTO_SUBMITTED with submitted_at = expires_at (the time actually allowed).
 */
export function finalOutcome(
  expiresAt: Date | null,
  now: Date,
): { status: "submitted" | "auto_submitted"; submittedAt: Date } {
  if (expiresAt !== null && now.getTime() > expiresAt.getTime()) {
    return { status: "auto_submitted", submittedAt: expiresAt };
  }
  return { status: "submitted", submittedAt: now };
}
