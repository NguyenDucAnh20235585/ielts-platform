import "server-only";

import { type AttemptRow, toActiveAttemptView } from "@/features/attempt/attempt-view";
import {
  ACCESS_TYPES,
  type DbAccessType,
  type DbTestMode,
  type DbTestType,
  type DbTestVisibility,
  TEST_TYPES,
} from "@/features/test/api-enums";
import { type ModeOption, type ModeSettingsRow, sortModes, toModeOption } from "@/features/test/mode-settings";
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
  visibility: DbTestVisibility;
  access_type: DbAccessType;
  /** The published version (null when nothing is published). */
  version_id: string | null;
  version_number: number | null;
  published_at: Date | null;
  question_count: number;
  section_count: number;
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
function toSummary(row: CatalogueRow, modes: ModeOption[]) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: TEST_TYPES[row.type],
    question_count: row.question_count,
    access_type: ACCESS_TYPES[row.access_type],
    modes,
    active_attempt_id: row.active_attempt_id,
  };
}

/**
 * Tests with their published version and this user's active attempt.
 * Prototype 1: every published test is visible to every student (D-004).
 * "Published" = visibility VISIBLE and a version with status published (D-015).
 */
async function queryCatalogue(
  sql: Sql,
  userId: string,
  where: { testId?: string; publishedOnly: boolean; type?: DbTestType; mode?: DbTestMode; search?: string },
  page: { limit: number; offset: number },
) {
  return sql<CatalogueRow[]>`
    select t.id, t.title, t.description, t.type, t.visibility, t.access_type,
           tv.id as version_id, tv.version_number, tv.published_at,
           coalesce((select sum(q.max_score)::int
                     from public.sections s
                     join public.question_groups g on g.section_id = s.id
                     join public.questions q on q.question_group_id = g.id
                     where s.test_version_id = tv.id), 0) as question_count,
           (select count(*)::int from public.sections s where s.test_version_id = tv.id) as section_count,
           (select a.id from public.attempts a
             where a.user_id = ${userId} and a.test_id = t.id and a.status in ('created', 'in_progress')
             limit 1) as active_attempt_id,
           count(*) over ()::int as total
    from public.tests t
    left join public.test_versions tv on tv.test_id = t.id and tv.status = 'published'
    where true
      ${where.testId ? sql`and t.id = ${where.testId}` : sql``}
      ${where.publishedOnly ? sql`and t.visibility = 'visible' and tv.id is not null` : sql``}
      ${where.type ? sql`and t.type = ${where.type}` : sql``}
      ${where.mode
        ? sql`and exists (select 1 from public.test_version_modes m
                          where m.test_version_id = tv.id and m.mode = ${where.mode} and m.enabled)`
        : sql``}
      ${where.search ? sql`and t.title ilike ${likePattern(where.search)}` : sql``}
    order by tv.published_at desc nulls last, t.title, t.id
    limit ${page.limit} offset ${page.offset}
  `;
}

/** The enabled modes of each listed version, with this user's attempt count per mode. */
async function loadModeOptions(sql: Sql, userId: string, rows: readonly CatalogueRow[]): Promise<Map<string, ModeOption[]>> {
  const published = rows.filter((row) => row.version_id !== null);
  if (published.length === 0) {
    return new Map();
  }
  const modes = await sql<(ModeSettingsRow & { test_version_id: string })[]>`
    select test_version_id, mode, enabled, time_limit_seconds, max_attempts, answer_visibility,
           allow_pause, allow_replay, allow_seek, max_plays
    from public.test_version_modes
    where test_version_id in ${sql(published.map((row) => row.version_id ?? ""))} and enabled
  `;
  const used = await sql<{ test_id: string; mode: DbTestMode; count: number }[]>`
    select test_id, mode, count(*)::int as count
    from public.attempts
    where user_id = ${userId} and test_id in ${sql(published.map((row) => row.id))}
    group by test_id, mode
  `;
  const usedCount = new Map(used.map((u) => [`${u.test_id}:${u.mode}`, u.count]));
  return new Map(
    published.map((row) => [
      row.id,
      sortModes(modes.filter((m) => m.test_version_id === row.version_id)).map((m) =>
        toModeOption(m, usedCount.get(`${row.id}:${m.mode}`) ?? 0),
      ),
    ]),
  );
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
  const modes = await loadModeOptions(sql, user.id, rows);
  return paginated(
    rows.map((row) => toSummary(row, modes.get(row.id) ?? [])),
    rows[0]?.total ?? 0,
    query.page,
    query.limit,
  );
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
  if (!row || row.visibility === "archived") {
    throw new ApiError("TEST_NOT_FOUND", "Test not found.");
  }
  if (row.visibility !== "visible" || row.version_id === null) {
    throw new ApiError("TEST_NOT_PUBLISHED", "This test is not published.");
  }
  const modes = await loadModeOptions(sql, user.id, rows);
  const active = await findActiveAttempt(sql, user.id, testId);
  return {
    ...toSummary(row, modes.get(row.id) ?? []),
    latest_version: {
      id: row.version_id,
      version_number: row.version_number,
      published_at: row.published_at ? row.published_at.toISOString() : null,
    },
    section_count: row.section_count,
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
