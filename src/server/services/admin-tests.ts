import "server-only";

import {
  type AdminTestRow,
  type AdminTestStatus,
  toAdminTest,
  toVersionBrief,
  type VersionBriefRow,
} from "@/features/admin/admin-views";
import type { AdminTestsQuery, CreateTestBody, UpdateTestBody } from "@/features/admin/request-schemas";
import { applySettingsPatch, defaultSettings, enabledModes, settingsProblem } from "@/features/admin/settings";
import { TEST_MODES, TEST_TYPES, TEST_VISIBILITIES } from "@/features/test/api-enums";
import type { CurrentUser } from "@/server/auth/current-user";
import { likePattern } from "@/server/db/like";
import type { Sql } from "@/server/db/types";
import { ApiError } from "@/server/http/errors";
import { offsetOf, paginated } from "@/server/http/pagination";

import { loadAdminTestRow, loadVersionBriefs, writeModeSettings } from "./admin-shared";
import { writeAuditLog } from "./audit-log";

function testNotFound(): ApiError {
  return new ApiError("TEST_NOT_FOUND", "Test not found.");
}

/** SQL condition for a computed admin status (D-015: not stored). */
function statusCondition(sql: Sql, status: AdminTestStatus) {
  const published = sql`exists (select 1 from public.test_versions p where p.test_id = t.id and p.status = 'published')`;
  switch (status) {
    case "archived":
      return sql`and t.visibility = 'archived'`;
    case "hidden":
      return sql`and t.visibility = 'hidden'`;
    case "published":
      return sql`and t.visibility = 'visible' and ${published}`;
    case "draft":
      return sql`and t.visibility = 'visible' and not ${published}`;
  }
}

/** GET /api/admin/tests — every test, any status (api-contract §6.1). */
export async function listAdminTests(sql: Sql, query: AdminTestsQuery) {
  const search = query.search?.trim();
  const rows = await sql<(AdminTestRow & { total: number })[]>`
    select t.id, t.title, t.description, t.type, t.visibility, t.access_type, t.created_at, t.updated_at,
           count(*) over ()::int as total
    from public.tests t
    where true
      ${query.status ? statusCondition(sql, query.status) : sql``}
      ${query.type ? sql`and t.type = ${query.type}` : sql``}
      ${search ? sql`and t.title ilike ${likePattern(search)}` : sql``}
    order by t.updated_at desc, t.id
    limit ${query.limit} offset ${offsetOf(query.page, query.limit)}
  `;
  const versions = await loadVersionBriefs(sql, rows.map((row) => row.id));
  return paginated(
    rows.map((row) => toAdminTest(row, versions)),
    rows[0]?.total ?? 0,
    query.page,
    query.limit,
  );
}

/**
 * POST /api/admin/tests — the test (VISIBLE, nothing published yet) and
 * version 1 (DRAFT) with both modes at their defaults, unless `settings`
 * overrides them (§6.2).
 */
export async function createAdminTest(sql: Sql, admin: CurrentUser, body: CreateTestBody) {
  const settings = applySettingsPatch(defaultSettings(body.type), body.settings ?? {});
  const problem = settingsProblem(settings);
  if (problem) {
    throw new ApiError("INVALID_SETTINGS", problem);
  }

  return sql.begin(async (tx) => {
    const tests = await tx<AdminTestRow[]>`
      insert into public.tests (title, description, type, created_by)
      values (${body.title}, ${body.description ?? null}, ${body.type}, ${admin.id})
      returning id, title, description, type, visibility, access_type, created_at, updated_at
    `;
    const test = tests[0];
    if (!test) throw new Error("Test insert returned no row.");

    const versions = await tx<Omit<VersionBriefRow, "modes">[]>`
      insert into public.test_versions (test_id, version_number, created_by)
      values (${test.id}, 1, ${admin.id})
      returning id, test_id, version_number, status, published_at, created_at, updated_at, 0 as attempt_count
    `;
    const inserted = versions[0];
    if (!inserted) throw new Error("Version insert returned no row.");
    await writeModeSettings(tx, inserted.id, settings, "insert");
    const version: VersionBriefRow = { ...inserted, modes: enabledModes(settings) };

    await writeAuditLog(tx, {
      actorId: admin.id,
      action: "test.create",
      resourceType: "test",
      resourceId: test.id,
      metadata: {
        title: test.title,
        type: TEST_TYPES[test.type],
        version_id: version.id,
        modes: version.modes.map((mode) => TEST_MODES[mode]),
      },
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
        returning id, title, description, type, visibility, access_type, created_at, updated_at
      `;
      updated = rows[0] ?? test;
    }
    return toAdminTest(updated, await loadVersionBriefs(tx, [testId]));
  });
}

/**
 * POST /api/admin/tests/:testId/archive — the whole test, terminal (§6.11).
 * Versions are kept; old attempts and results stay visible to their owners;
 * attempts in progress may finish.
 */
export async function archiveTest(sql: Sql, admin: CurrentUser, testId: string) {
  return sql.begin(async (tx) => {
    const test = await loadAdminTestRow(tx, testId, { lock: true });
    if (!test) {
      throw testNotFound();
    }
    if (test.visibility === "archived") {
      throw new ApiError("ALREADY_ARCHIVED", "This test is already archived.");
    }
    const rows = await tx<AdminTestRow[]>`
      update public.tests set visibility = 'archived' where id = ${testId}
      returning id, title, description, type, visibility, access_type, created_at, updated_at
    `;
    await writeAuditLog(tx, {
      actorId: admin.id,
      action: "test.archive",
      resourceType: "test",
      resourceId: testId,
      metadata: { from: TEST_VISIBILITIES[test.visibility] },
    });
    return toAdminTest(rows[0] ?? test, await loadVersionBriefs(tx, [testId]));
  });
}

/**
 * POST /api/admin/tests/:testId/hide and /unhide (§6.10, D-015). Hidden tests
 * disappear from the catalogue and cannot be started; attempts in progress
 * may finish. Idempotent: hiding a hidden test changes nothing.
 */
export async function setTestHidden(sql: Sql, admin: CurrentUser, testId: string, hidden: boolean) {
  return sql.begin(async (tx) => {
    const test = await loadAdminTestRow(tx, testId, { lock: true });
    if (!test) {
      throw testNotFound();
    }
    if (test.visibility === "archived") {
      throw new ApiError("TEST_ARCHIVED", "This test is archived.");
    }
    const target = hidden ? "hidden" : "visible";
    let updated = test;
    if (test.visibility !== target) {
      const rows = await tx<AdminTestRow[]>`
        update public.tests set visibility = ${target} where id = ${testId}
        returning id, title, description, type, visibility, access_type, created_at, updated_at
      `;
      updated = rows[0] ?? test;
      await writeAuditLog(tx, {
        actorId: admin.id,
        action: hidden ? "test.hide" : "test.unhide",
        resourceType: "test",
        resourceId: testId,
      });
    }
    return toAdminTest(updated, await loadVersionBriefs(tx, [testId]));
  });
}
