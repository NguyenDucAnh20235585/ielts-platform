/**
 * Server-side timer rules (D-005, D-016, api-contract §1.6, §12.2).
 * All functions take `now` from the caller so one request uses one clock.
 *
 * For a timed attempt that has begun:
 *
 *   started_at ............ expires_at ......... expires_at + 15 s ..........>
 *   | answering            | grace window        | past grace
 *   | remaining_seconds > 0| remaining_seconds 0 |
 *   | autosave: saved      | autosave: saved     | any request finalizes the attempt
 *   | submit: SUBMITTED    | submit: AUTO_SUBMITTED| as AUTO_SUBMITTED; writes get
 *   |  (submitted_at = now)|  (submitted_at =     |  409 ATTEMPT_EXPIRED
 *   |                      |   expires_at)       |
 *
 * Boundaries (all checked by tests):
 * - The clock is up AT expires_at: remaining 0, and a submit is AUTO_SUBMITTED.
 * - The grace window includes expires_at + 15 s exactly; 1 ms later is past grace.
 * - Answers that reach the server inside the grace window count. They absorb
 *   the network delay of the last autosave / the submit the FE sends at 0.
 */

/** Answers are still accepted this long after expires_at (D-016, agreed with the lead). */
export const GRACE_SECONDS = 15;

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

/** The clock of an in-progress timed attempt has run out (now ≥ expires_at). */
export function isExpired(attempt: TimedAttempt, now: Date): boolean {
  return (
    attempt.status === "in_progress" &&
    attempt.expiresAt !== null &&
    now.getTime() >= attempt.expiresAt.getTime()
  );
}

/**
 * Past the grace window (now > expires_at + GRACE_SECONDS): writes are
 * refused and the attempt must be finalized. Until then answers are saved.
 */
export function isPastGrace(attempt: TimedAttempt, now: Date): boolean {
  return (
    attempt.status === "in_progress" &&
    attempt.expiresAt !== null &&
    now.getTime() > attempt.expiresAt.getTime() + GRACE_SECONDS * 1000
  );
}

/**
 * How a finalized attempt is recorded (api-contract §5 submit):
 * SUBMITTED if it is finalized before expires_at, otherwise AUTO_SUBMITTED
 * with submitted_at = expires_at (the time actually allowed). Same boundary
 * as isExpired().
 */
export function finalOutcome(
  expiresAt: Date | null,
  now: Date,
): { status: "submitted" | "auto_submitted"; submittedAt: Date } {
  if (expiresAt !== null && now.getTime() >= expiresAt.getTime()) {
    return { status: "auto_submitted", submittedAt: expiresAt };
  }
  return { status: "submitted", submittedAt: now };
}
