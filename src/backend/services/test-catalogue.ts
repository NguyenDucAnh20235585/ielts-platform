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
import { canOpenTest, studentAccessTypes } from "@/features/test/access";
import { type ModeSettingsRow, sortModes, toModeOption } from "@/features/test/mode-settings";
import type { CurrentUser } from "@/backend/auth/current-user";
import { likePattern } from "@/backend/db/like";
import type { Sql } from "@/backend/db/types";
import { ApiError } from "@/backend/http/errors";
import { offsetOf, paginated } from "@/backend/http/pagination";

import { readAfterExpiry } from "./attempt-core";

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
  /** Enabled modes of the published version, with this user's attempt count in each. */
  modes: (ModeSettingsRow & { attempts_used: number })[];
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
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: TEST_TYPES[row.type],
    question_count: row.question_count,
    access_type: ACCESS_TYPES[row.access_type],
    modes: sortModes(row.modes).map((m) => toModeOption(m, m.attempts_used)),
    active_attempt_id: row.active_attempt_id,
  };
}

/**
 * Tests with their published version and this user's active attempt.
 * "Published" = visibility VISIBLE and a version with status published (D-015).
 * `accessTypes` limits the list to the tests the caller may open (D-017).
 */
async function queryCatalogue(
  sql: Sql,
  userId: string,
  where: {
    testId?: string;
    publishedOnly: boolean;
    accessTypes?: readonly DbAccessType[];
    type?: DbTestType;
    mode?: DbTestMode;
    search?: string;
  },
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
           coalesce((select json_agg(m) from (
                       select vm.mode, vm.enabled, vm.time_limit_seconds, vm.max_attempts, vm.answer_visibility,
                              vm.allow_pause, vm.allow_replay, vm.allow_seek, vm.max_plays,
                              (select count(*)::int from public.attempts a
                                where a.user_id = ${userId} and a.test_id = t.id and a.mode = vm.mode) as attempts_used
                       from public.test_version_modes vm
                       where vm.test_version_id = tv.id and vm.enabled
                     ) m), '[]') as modes,
           count(*) over ()::int as total
    from public.tests t
    left join public.test_versions tv on tv.test_id = t.id and tv.status = 'published'
    where true
      ${where.testId ? sql`and t.id = ${where.testId}` : sql``}
      ${where.publishedOnly ? sql`and t.visibility = 'visible' and tv.id is not null` : sql``}
      ${where.accessTypes ? sql`and t.access_type in ${sql(where.accessTypes)}` : sql``}
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

/** GET /api/tests */
export async function listTests(sql: Sql, user: CurrentUser, query: CatalogueQuery, now: Date) {
  const rows = await readAfterExpiry(sql, user.id, now, undefined, () =>
    queryCatalogue(
      sql,
      user.id,
      {
        publishedOnly: true,
        accessTypes: studentAccessTypes(user.role),
        type: query.type,
        mode: query.mode,
        search: query.search?.trim() || undefined,
      },
      { limit: query.limit, offset: offsetOf(query.page, query.limit) },
    ),
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
  const [rows, active] = await readAfterExpiry(sql, user.id, now, testId, () =>
    Promise.all([
      queryCatalogue(sql, user.id, { testId, publishedOnly: false }, { limit: 1, offset: 0 }),
      findActiveAttempt(sql, user.id, testId),
    ]),
  );
  const row = rows[0];
  if (!row || row.visibility === "archived") {
    throw new ApiError("TEST_NOT_FOUND", "Test not found.");
  }
  if (row.visibility !== "visible" || row.version_id === null) {
    throw new ApiError("TEST_NOT_PUBLISHED", "This test is not published.");
  }
  if (!canOpenTest(user.role, row.access_type)) {
    throw new ApiError("ACCESS_DENIED", "You do not have access to this test.");
  }
  return {
    ...toSummary(row),
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
  const [exists, active] = await readAfterExpiry(sql, user.id, now, testId, () =>
    Promise.all([
      sql<{ id: string }[]>`select id from public.tests where id = ${testId}`,
      findActiveAttempt(sql, user.id, testId),
    ]),
  );
  if (!exists[0]) {
    throw new ApiError("TEST_NOT_FOUND", "Test not found.");
  }
  return { active_attempt: active ? toActiveAttemptView(active, now) : null };
}
