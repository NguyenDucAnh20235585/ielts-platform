import "server-only";

import { isFinalized } from "@/features/attempt/attempt-view";
import { isPastGrace } from "@/features/attempt/timer";
import type { CurrentUser } from "@/backend/auth/current-user";
import type { Sql } from "@/backend/db/types";
import { ApiError } from "@/backend/http/errors";

import { type AnswerInput, writeAnswers } from "./attempt-answers";
import { finalizeAttempt, loadOwnAttempt, timerOf } from "./attempt-core";
import { readResult } from "./attempt-results";

/**
 * POST /api/attempts/:attemptId/submit (api-contract §5).
 * One transaction: lock → save final answers → grade → store result → close.
 * Idempotent: submitting a finalized attempt returns the stored result.
 */
export async function submitAttempt(
  sql: Sql,
  user: CurrentUser,
  attemptId: string,
  finalAnswers: readonly AnswerInput[] | undefined,
  now: Date,
) {
  const attempt = await sql.begin(async (tx) => {
    const locked = await loadOwnAttempt(tx, attemptId, user.id, { lock: true });
    if (locked.status === "created") {
      throw new ApiError(
        "ATTEMPT_NOT_STARTED",
        "Call begin before submitting.",
      );
    }
    if (isFinalized(locked.status)) {
      return locked; // already submitted: same result, nothing re-graded
    }
    // Answers sent with the submit count until the grace window ends (D-016):
    // they cover the FE's submit at 0 s and its last autosave in flight.
    // finalizeAttempt then records AUTO_SUBMITTED at expires_at if the clock was up.
    if (
      finalAnswers &&
      finalAnswers.length > 0 &&
      !isPastGrace(timerOf(locked), now)
    ) {
      await writeAnswers(tx, locked, finalAnswers, now);
    }
    return finalizeAttempt(tx, locked, now);
  });

  return readResult(sql, attempt);
}
