import "server-only";

import type postgres from "postgres";

import { type AttemptRow, isFinalized } from "@/shared/attempt/attempt-view";
import { buildResultPayload, type ResultRow } from "@/shared/attempt/result-view";
import { gradingSnapshotSchema } from "@/shared/grading/snapshot";
import {
  ATTEMPT_STATUSES,
  type DbAnswerVisibility,
  type DbAttemptStatus,
  type DbTestMode,
  type DbTestType,
  TEST_MODES,
  TEST_TYPES,
} from "@/shared/test/api-enums";
import type { CurrentUser } from "@/backend/auth/current-user";
import type { Queryable, Sql } from "@/backend/db/types";
import { ApiError } from "@/backend/http/errors";
import { offsetOf, paginated } from "@/backend/http/pagination";

import { finalizeIfExpired, readAfterExpiry } from "./attempt-core";

type StoredResultRow = ResultRow & {
  attempt_id: string;
  attempt_status: DbAttemptStatus;
  attempt_mode: DbTestMode;
  started_at: Date | null;
  submitted_at: Date | null;
  test_id: string;
  grading_snapshot: unknown;
  test_title: string;
  test_type: DbTestType;
  version_number: number;
  answer_visibility: DbAnswerVisibility;
};

/** The stored result with its attempt and test, for the attempts matching `where` (alias a = attempts). */
function queryStoredResults(sql: Queryable, where: postgres.Fragment) {
  return sql<StoredResultRow[]>`
    select a.id as attempt_id, a.status as attempt_status, a.mode as attempt_mode,
           a.started_at, a.submitted_at, a.test_id,
           r.correct_count, r.incorrect_count, r.unanswered_count, r.raw_score, r.max_score, r.band_score,
           r.time_taken_seconds, r.grading_snapshot,
           t.title as test_title, t.type as test_type, tv.version_number, m.answer_visibility
    from public.results r
    join public.attempts a on a.id = r.attempt_id
    join public.tests t on t.id = a.test_id
    join public.test_versions tv on tv.id = a.test_version_id
    -- visibility of the mode the student picked (D-015)
    join public.test_version_modes m on m.test_version_id = a.test_version_id and m.mode = a.mode
    where ${where}
  `;
}

function toResultPayload(row: StoredResultRow) {
  return buildResultPayload({
    attempt: {
      id: row.attempt_id,
      status: row.attempt_status,
      mode: row.attempt_mode,
      started_at: row.started_at,
      submitted_at: row.submitted_at,
    },
    test: { id: row.test_id, title: row.test_title, type: row.test_type },
    versionNumber: row.version_number,
    visibility: row.answer_visibility,
    result: row,
    snapshot: gradingSnapshotSchema.parse(row.grading_snapshot),
  });
}

/** Reads the stored result of a finalized attempt (never re-grades). */
export async function readResult(sql: Queryable, attempt: AttemptRow) {
  const row = (await queryStoredResults(sql, sql`r.attempt_id = ${attempt.id}`))[0];
  if (!row) {
    throw new Error(`Finalized attempt ${attempt.id} has no result row.`);
  }
  return toResultPayload(row);
}

/** GET /api/attempts/:attemptId/result */
export async function getResult(sql: Sql, user: CurrentUser, attemptId: string, now: Date) {
  // A finalized attempt has a result row: one read answers it.
  const stored = (await queryStoredResults(sql, sql`a.id = ${attemptId} and a.user_id = ${user.id}`))[0];
  if (stored) {
    return toResultPayload(stored);
  }
  // No result yet (or not the caller's attempt: 404 below). It may have expired just now.
  const { attempt } = await finalizeIfExpired(sql, attemptId, user.id, now);
  if (!isFinalized(attempt.status)) {
    throw new ApiError("RESULT_NOT_READY", "This attempt has not been submitted yet.", {
      status: ATTEMPT_STATUSES[attempt.status],
    });
  }
  return readResult(sql, attempt);
}

export type HistoryQuery = { status?: DbAttemptStatus; test_id?: string; page: number; limit: number };

/** GET /api/attempts — the caller's attempts, newest first (api-contract §2.6 HistoryItem). */
export async function listHistory(sql: Sql, user: CurrentUser, query: HistoryQuery, now: Date) {
  const rows = await readAfterExpiry(sql, user.id, now, undefined, () => sql<{
    id: string;
    status: DbAttemptStatus;
    mode: DbTestMode;
    started_at: Date | null;
    submitted_at: Date | null;
    test_id: string;
    title: string;
    type: DbTestType;
    version_number: number;
    raw_score: string | null;
    max_score: string | null;
    band_score: string | null;
    time_taken_seconds: number | null;
    total: number;
  }[]>`
    select a.id, a.status, a.mode, a.started_at, a.submitted_at,
           t.id as test_id, t.title, t.type, tv.version_number,
           r.raw_score, r.max_score, r.band_score, r.time_taken_seconds,
           count(*) over ()::int as total
    from public.attempts a
    join public.tests t on t.id = a.test_id
    join public.test_versions tv on tv.id = a.test_version_id
    left join public.results r on r.attempt_id = a.id
    where a.user_id = ${user.id}
      ${query.status ? sql`and a.status = ${query.status}` : sql``}
      ${query.test_id ? sql`and a.test_id = ${query.test_id}` : sql``}
    order by a.created_at desc, a.id
    limit ${query.limit} offset ${offsetOf(query.page, query.limit)}
  `);
  const items = rows.map((row) => ({
    id: row.id,
    test: { id: row.test_id, title: row.title, type: TEST_TYPES[row.type] },
    version_number: row.version_number,
    mode: TEST_MODES[row.mode],
    status: ATTEMPT_STATUSES[row.status],
    started_at: row.started_at ? row.started_at.toISOString() : null,
    submitted_at: row.submitted_at ? row.submitted_at.toISOString() : null,
    time_taken_seconds: row.time_taken_seconds,
    raw_score: row.raw_score === null ? null : Number(row.raw_score),
    max_score: row.max_score === null ? null : Number(row.max_score),
    band_score: row.band_score === null ? null : Number(row.band_score),
  }));
  return paginated(items, rows[0]?.total ?? 0, query.page, query.limit);
}
