import "server-only";

import { type AttemptRow, toActiveAttemptView } from "@/features/attempt/attempt-view";
import {
  ACCESS_TYPES,
  ANSWER_VISIBILITIES,
  type DbAccessType,
  type DbAnswerVisibility,
  type DbTestMode,
  type DbTestStatus,
  type DbTestType,
  TEST_MODES,
  TEST_STATUSES,
  TEST_TYPES,
} from "@/features/test/api-enums";
import type { CurrentUser } from "@/server/auth/current-user";
import { likePattern } from "@/server/db/like";
import type { Sql } from "@/server/db/types";
import { ApiError } from "@/server/http/errors";
import { offsetOf, paginated } from "@/server/http/pagination";

import { finalizeExpiredForUser } from "./attempt-core";

type CatalogueRow = {
  id: string;
  title: string;
  description: string | null;
  type: DbTestType;
  status: DbTestStatus;
  access_type: DbAccessType;
  version_id: string | null;
  version_number: number | null;
  published_at: Date | null;
  mode: DbTestMode | null;
  time_limit_seconds: number | null;
  max_attempts: number | null;
  answer_visibility: DbAnswerVisibility | null;
  allow_pause: boolean | null;
  allow_replay: boolean | null;
  allow_seek: boolean | null;
  max_plays: number | null;
  question_count: number;
  section_count: number;
  attempts_used: number;
  active_attempt_id: string | null;
  total: number;
};

export type CatalogueQuery = {
  type?: DbTestType;
  mode?: DbTestMode;
  search?: string;
  page: number;
  limit: number;
};

/** api-contract §2.6 TestSummary */
function toSummary(row: CatalogueRow) {
  const remaining = row.max_attempts === null ? null : Math.max(0, row.max_attempts - row.attempts_used);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: TEST_TYPES[row.type],
    mode: row.mode ? TEST_MODES[row.mode] : null,
    duration_seconds: row.time_limit_seconds,
    question_count: row.question_count,
    access_type: ACCESS_TYPES[row.access_type],
    attempt_rules: { max_attempts: row.max_attempts, attempts_used: row.attempts_used, attempts_remaining: remaining },
    active_attempt_id: row.active_attempt_id,
  };
}

/**
 * Tests with their current version and this user's attempt counts.
 * Prototype 1: every published test is visible to every student (D-004).
 */
async function queryCatalogue(
  sql: Sql,
  userId: string,
  where: { testId?: string; publishedOnly: boolean; type?: DbTestType; mode?: DbTestMode; search?: string },
  page: { limit: number; offset: number },
) {
  return sql<CatalogueRow[]>`
    select t.id, t.title, t.description, t.type, t.status, t.access_type,
           tv.id as version_id, tv.version_number, tv.published_at, tv.mode, tv.time_limit_seconds,
           tv.max_attempts, tv.answer_visibility, tv.allow_pause, tv.allow_replay, tv.allow_seek, tv.max_plays,
           coalesce((select sum(q.max_score)::int
                     from public.sections s
                     join public.question_groups g on g.section_id = s.id
                     join public.questions q on q.question_group_id = g.id
                     where s.test_version_id = tv.id), 0) as question_count,
           (select count(*)::int from public.sections s where s.test_version_id = tv.id) as section_count,
           (select count(*)::int from public.attempts a where a.user_id = ${userId} and a.test_id = t.id) as attempts_used,
           (select a.id from public.attempts a
             where a.user_id = ${userId} and a.test_id = t.id and a.status in ('created', 'in_progress')
             limit 1) as active_attempt_id,
           count(*) over ()::int as total
    from public.tests t
    left join public.test_versions tv on tv.id = t.current_version_id
    where true
      ${where.testId ? sql`and t.id = ${where.testId}` : sql``}
      ${where.publishedOnly ? sql`and t.status = 'published'` : sql``}
      ${where.type ? sql`and t.type = ${where.type}` : sql``}
      ${where.mode ? sql`and tv.mode = ${where.mode}` : sql``}
      ${where.search ? sql`and t.title ilike ${likePattern(where.search)}` : sql``}
    order by tv.published_at desc nulls last, t.title, t.id
    limit ${page.limit} offset ${page.offset}
  `;
}

/** GET /api/tests */
export async function listTests(sql: Sql, user: CurrentUser, query: CatalogueQuery, now: Date) {
  await finalizeExpiredForUser(sql, user.id, now);
  const rows = await queryCatalogue(
    sql,
    user.id,
    { publishedOnly: true, type: query.type, mode: query.mode, search: query.search?.trim() || undefined },
    { limit: query.limit, offset: offsetOf(query.page, query.limit) },
  );
  return paginated(rows.map(toSummary), rows[0]?.total ?? 0, query.page, query.limit);
}

async function findActiveAttempt(sql: Sql, userId: string, testId: string): Promise<AttemptRow | null> {
  const rows = await sql<AttemptRow[]>`
    select id, user_id, test_id, test_version_id, status, mode, time_limit_seconds,
           created_at, started_at, expires_at, submitted_at
    from public.attempts
    where user_id = ${userId} and test_id = ${testId} and status in ('created', 'in_progress')
    limit 1
  `;
  return rows[0] ?? null;
}

/** GET /api/tests/:testId */
export async function getTestDetail(sql: Sql, user: CurrentUser, testId: string, now: Date) {
  await finalizeExpiredForUser(sql, user.id, now, testId);
  const rows = await queryCatalogue(sql, user.id, { testId, publishedOnly: false }, { limit: 1, offset: 0 });
  const row = rows[0];
  if (!row || row.status === "archived") {
    throw new ApiError("TEST_NOT_FOUND", "Test not found.");
  }
  if (row.status !== "published" || row.version_id === null) {
    throw new ApiError("TEST_NOT_PUBLISHED", "This test is not published.");
  }
  const active = await findActiveAttempt(sql, user.id, testId);
  return {
    ...toSummary(row),
    status: TEST_STATUSES[row.status],
    latest_version: {
      id: row.version_id,
      version_number: row.version_number,
      published_at: row.published_at ? row.published_at.toISOString() : null,
    },
    section_count: row.section_count,
    settings: {
      answer_visibility: row.answer_visibility ? ANSWER_VISIBILITIES[row.answer_visibility] : null,
      allow_pause: row.allow_pause,
      allow_replay: row.allow_replay,
      allow_seek: row.allow_seek,
      max_plays: row.max_plays,
    },
    active_attempt: active ? toActiveAttemptView(active, now) : null,
  };
}

/** GET /api/tests/:testId/active-attempt — works for archived tests too (an attempt may still be running). */
export async function getActiveAttemptForTest(sql: Sql, user: CurrentUser, testId: string, now: Date) {
  const exists = await sql<{ id: string }[]>`select id from public.tests where id = ${testId}`;
  if (!exists[0]) {
    throw new ApiError("TEST_NOT_FOUND", "Test not found.");
  }
  await finalizeExpiredForUser(sql, user.id, now, testId);
  const active = await findActiveAttempt(sql, user.id, testId);
  return { active_attempt: active ? toActiveAttemptView(active, now) : null };
}
