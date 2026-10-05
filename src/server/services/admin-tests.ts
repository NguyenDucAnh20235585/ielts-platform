import "server-only";

import { type AdminTestRow, toAdminTest, toVersionBrief, type VersionBriefRow } from "@/features/admin/admin-views";
import type { AdminTestsQuery, CreateTestBody, UpdateTestBody } from "@/features/admin/request-schemas";
import { defaultSettings, settingsProblem } from "@/features/admin/settings";
import { TEST_MODES, TEST_STATUSES, TEST_TYPES } from "@/features/test/api-enums";
import type { CurrentUser } from "@/server/auth/current-user";
import { likePattern } from "@/server/db/like";
import type { Sql } from "@/server/db/types";
import { ApiError } from "@/server/http/errors";
import { offsetOf, paginated } from "@/server/http/pagination";

import { loadAdminTestRow, loadVersionBriefs } from "./admin-shared";
import { writeAuditLog } from "./audit-log";

function testNotFound(): ApiError {
  return new ApiError("TEST_NOT_FOUND", "Test not found.");
}

/** GET /api/admin/tests — every test, any status (api-contract §6.1). */
export async function listAdminTests(sql: Sql, query: AdminTestsQuery) {
  const search = query.search?.trim();
  const rows = await sql<(AdminTestRow & { total: number })[]>`
    select id, title, description, type, status, access_type, current_version_id, created_at, updated_at,
           count(*) over ()::int as total
    from public.tests
    where true
      ${query.status ? sql`and status = ${query.status}` : sql``}
      ${query.type ? sql`and type = ${query.type}` : sql``}
      ${search ? sql`and title ilike ${likePattern(search)}` : sql``}
    order by updated_at desc, id
    limit ${query.limit} offset ${offsetOf(query.page, query.limit)}
  `;
  const versions = await loadVersionBriefs(sql, rows.map((row) => row.id));
  return paginated(
    rows.map((row) => toAdminTest(row, versions.filter((v) => v.test_id === row.id))),
    rows[0]?.total ?? 0,
    query.page,
    query.limit,
  );
}

/** POST /api/admin/tests — the test and version 1, both DRAFT, with default settings (§6.2). */
export async function createAdminTest(sql: Sql, admin: CurrentUser, body: CreateTestBody) {
  const settings = defaultSettings(body.mode, body.type, body.duration_seconds);
  const problem = settingsProblem(settings);
  if (problem) {
    throw new ApiError("INVALID_SETTINGS", problem);
  }

  return sql.begin(async (tx) => {
    const tests = await tx<AdminTestRow[]>`
      insert into public.tests (title, description, type, created_by)
      values (${body.title}, ${body.description ?? null}, ${body.type}, ${admin.id})
      returning id, title, description, type, status, access_type, current_version_id, created_at, updated_at
    `;
    const test = tests[0];
    if (!test) throw new Error("Test insert returned no row.");

    const versions = await tx<VersionBriefRow[]>`
      insert into public.test_versions
        (test_id, version_number, mode, time_limit_seconds, max_attempts, answer_visibility,
         allow_pause, allow_replay, allow_seek, max_plays, created_by)
      values
        (${test.id}, 1, ${settings.mode}, ${settings.time_limit_seconds}, ${settings.max_attempts},
         ${settings.answer_visibility}, ${settings.allow_pause}, ${settings.allow_replay}, ${settings.allow_seek},
         ${settings.max_plays}, ${admin.id})
      returning id, test_id, version_number, status, mode, time_limit_seconds, published_at, created_at, updated_at,
                0 as attempt_count
    `;
    const version = versions[0];
    if (!version) throw new Error("Version insert returned no row.");

    await writeAuditLog(tx, {
      actorId: admin.id,
      action: "test.create",
      resourceType: "test",
      resourceId: test.id,
      metadata: { title: test.title, type: TEST_TYPES[test.type], mode: TEST_MODES[version.mode], version_id: version.id },
    });
    return { test: toAdminTest(test, [version]), test_version: toVersionBrief(version) };
  });
}

/** GET /api/admin/tests/:testId — the test and all its versions, newest first (§6.3). */
export async function getAdminTest(sql: Sql, testId: string) {
  const test = await loadAdminTestRow(sql, testId);
  if (!test) {
    throw testNotFound();
  }
  const versions = await loadVersionBriefs(sql, [testId]);
  return { test: toAdminTest(test, versions), versions: versions.map(toVersionBrief) };
}

/**
 * PATCH /api/admin/tests/:testId (§6.4). Title and description can change at
 * any time. The type only while the test has never been published and its
 * draft has no sections yet (sections are typed READING/LISTENING).
 */
export async function updateAdminTest(sql: Sql, testId: string, body: UpdateTestBody) {
  return sql.begin(async (tx) => {
    const test = await loadAdminTestRow(tx, testId, { lock: true });
    if (!test) {
      throw testNotFound();
    }

    if (body.type !== undefined && body.type !== test.type) {
      const states = await tx<{ ever_published: boolean; section_count: number }[]>`
        select exists (select 1 from public.test_versions where test_id = ${testId} and status <> 'draft') as ever_published,
               (select count(*)::int from public.sections s
                  join public.test_versions tv on tv.id = s.test_version_id
                 where tv.test_id = ${testId}) as section_count
      `;
      const state = states[0];
      if (state?.ever_published) {
        throw new ApiError("NOT_EDITABLE", "The type of a test that has been published cannot change.");
      }
      if (state && state.section_count > 0) {
        throw new ApiError("NOT_EDITABLE", "Delete the sections of the draft before changing the type.");
      }
    }

    const changes: Record<string, string | null> = {};
    if (body.title !== undefined) changes.title = body.title;
    if (body.description !== undefined) changes.description = body.description;
    if (body.type !== undefined) changes.type = body.type;

    let updated = test;
    if (Object.keys(changes).length > 0) {
      const rows = await tx<AdminTestRow[]>`
        update public.tests set ${tx(changes)}
        where id = ${testId}
        returning id, title, description, type, status, access_type, current_version_id, created_at, updated_at
      `;
      updated = rows[0] ?? test;
    }
    return toAdminTest(updated, await loadVersionBriefs(tx, [testId]));
  });
}

/** POST /api/admin/tests/:testId/archive — any status → ARCHIVED, terminal in Prototype 1 (§6.11). */
export async function archiveTest(sql: Sql, admin: CurrentUser, testId: string) {
  return sql.begin(async (tx) => {
    const test = await loadAdminTestRow(tx, testId, { lock: true });
    if (!test) {
      throw testNotFound();
    }
    if (test.status === "archived") {
      throw new ApiError("ALREADY_ARCHIVED", "This test is already archived.");
    }
    await tx`update public.tests set status = 'archived' where id = ${testId}`;
    await writeAuditLog(tx, {
      actorId: admin.id,
      action: "test.archive",
      resourceType: "test",
      resourceId: testId,
      metadata: { from: TEST_STATUSES[test.status] },
    });
    return { status: TEST_STATUSES.archived };
  });
}
