import {
  ATTEMPT_STATUSES,
  type ApiAttemptStatus,
  type DbAttemptStatus,
  type DbTestMode,
  TEST_MODES,
} from "@/features/test/api-enums";

import { remainingSeconds } from "./timer";

/** A row of public.attempts as the services load it. */
export type AttemptRow = {
  id: string;
  user_id: string;
  test_id: string;
  test_version_id: string;
  status: DbAttemptStatus;
  mode: DbTestMode;
  time_limit_seconds: number | null;
  created_at: Date;
  started_at: Date | null;
  expires_at: Date | null;
  submitted_at: Date | null;
};

/** api-contract §2.6 Attempt */
export type AttemptView = {
  id: string;
  test_id: string;
  test_version_id: string;
  status: ApiAttemptStatus;
  mode: (typeof TEST_MODES)[DbTestMode];
  created_at: string;
  started_at: string | null;
  expires_at: string | null;
  submitted_at: string | null;
  remaining_seconds: number | null;
  server_time: string;
  result_available: boolean;
};

/** api-contract §2.6 ActiveAttempt */
export type ActiveAttemptView = {
  attempt_id: string;
  status: ApiAttemptStatus;
  mode: (typeof TEST_MODES)[DbTestMode];
  started_at: string | null;
  expires_at: string | null;
  remaining_seconds: number | null;
  server_time: string;
};

export function isFinalized(status: DbAttemptStatus): boolean {
  return status === "submitted" || status === "auto_submitted";
}

export function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

export function toAttemptView(row: AttemptRow, now: Date): AttemptView {
  return {
    id: row.id,
    test_id: row.test_id,
    test_version_id: row.test_version_id,
    status: ATTEMPT_STATUSES[row.status],
    mode: TEST_MODES[row.mode],
    created_at: row.created_at.toISOString(),
    started_at: iso(row.started_at),
    expires_at: iso(row.expires_at),
    submitted_at: iso(row.submitted_at),
    remaining_seconds: remainingSeconds({ status: row.status, expiresAt: row.expires_at }, now),
    server_time: now.toISOString(),
    result_available: isFinalized(row.status),
  };
}

export function toActiveAttemptView(row: AttemptRow, now: Date): ActiveAttemptView {
  return {
    attempt_id: row.id,
    status: ATTEMPT_STATUSES[row.status],
    mode: TEST_MODES[row.mode],
    started_at: iso(row.started_at),
    expires_at: iso(row.expires_at),
    remaining_seconds: remainingSeconds({ status: row.status, expiresAt: row.expires_at }, now),
    server_time: now.toISOString(),
  };
}
