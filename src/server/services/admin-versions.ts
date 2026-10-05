import "server-only";

import { toVersionBrief } from "@/features/admin/admin-views";
import { validateVersionContent, type ValidationReport } from "@/features/admin/publish-validation";
import {
  applySettingsPatch,
  type SettingsPatch,
  settingsProblem,
  toSettingsView,
} from "@/features/admin/settings";
import { TEST_STATUSES, TEST_TYPES } from "@/features/test/api-enums";
import type { CurrentUser } from "@/server/auth/current-user";
import type { Queryable, Sql } from "@/server/db/types";
import { ApiError } from "@/server/http/errors";

import { loadAdminTree, loadAnswerKeys, loadVersionInfo, settingsOf } from "./admin-shared";
import { loadBandTable } from "./attempt-core";
import { writeAuditLog } from "./audit-log";
import { loadStudentContent, loadVersionStructure } from "./test-structure";

function versionNotFound(): ApiError {
  return new ApiError("VERSION_NOT_FOUND", "Test version not found.");
}

/** GET /api/admin/test-versions/:versionId — the editor view (api-contract §6.5). */
export async function getVersionEditor(sql: Sql, versionId: string) {
  const info = await loadVersionInfo(sql, versionId);
  const sections = await loadAdminTree(sql, versionId);
  if (!info || !sections) {
    throw versionNotFound();
  }
  const band = await loadBandTable(sql, versionId);
  return {
    ...toVersionBrief(info),
    test: { id: info.test_id, title: info.test_title, type: TEST_TYPES[info.test_type], status: TEST_STATUSES[info.test_status] },
    settings: toSettingsView(settingsOf(info)),
    band_conversion: {
      source: info.band_table_id ? "CUSTOM" : "DEFAULT",
      ranges: band.ranges.map((r) => ({ min_raw: r.minRaw, max_raw: r.maxRaw, band: r.band })),
    },
    sections,
  };
}

/** PATCH /api/admin/test-versions/:versionId — settings of a DRAFT version (§6.6). Audited. */
export async function updateVersionSettings(sql: Sql, admin: CurrentUser, versionId: string, patch: SettingsPatch) {
  return sql.begin(async (tx) => {
    const info = await loadVersionInfo(tx, versionId, { lock: true });
    if (!info) {
      throw versionNotFound();
    }
    if (info.status !== "draft") {
      throw new ApiError("NOT_DRAFT", "Settings of a published or archived version cannot change.");
    }
    const before = settingsOf(info);
    const after = applySettingsPatch(before, patch);
    const problem = settingsProblem(after);
    if (problem) {
      throw new ApiError("INVALID_SETTINGS", problem);
    }
    await tx`
      update public.test_versions
      set mode = ${after.mode}, time_limit_seconds = ${after.time_limit_seconds}, max_attempts = ${after.max_attempts},
          answer_visibility = ${after.answer_visibility}, allow_pause = ${after.allow_pause},
          allow_replay = ${after.allow_replay}, allow_seek = ${after.allow_seek}, max_plays = ${after.max_plays}
      where id = ${versionId}
    `;
    await writeAuditLog(tx, {
      actorId: admin.id,
      action: "test_version.settings_update",
      resourceType: "test_version",
      resourceId: versionId,
      metadata: { before: toSettingsView(before), after: toSettingsView(after) },
    });
    return { id: versionId, status: TEST_STATUSES.draft, settings: toSettingsView(after) };
  });
}

async function buildReport(sql: Queryable, versionId: string): Promise<ValidationReport> {
  const structure = await loadVersionStructure(sql, versionId);
  if (!structure) {
    throw versionNotFound();
  }
  const keys = await loadAnswerKeys(sql, versionId);
  return validateVersionContent({ ...structure, keys });
}

/** POST /api/admin/test-versions/:versionId/validate (§6.7, rules §12.6). */
export async function validateVersion(sql: Sql, versionId: string): Promise<ValidationReport> {
  return buildReport(sql, versionId);
}

/** GET /api/admin/test-versions/:versionId/preview — exactly what a student gets, any status (§6.8). */
export async function previewVersion(sql: Sql, versionId: string) {
  const content = await loadStudentContent(sql, versionId);
  if (!content) {
    throw versionNotFound();
  }
  return content;
}

/**
 * POST /api/admin/test-versions/:versionId/publish (§6.9). Audited.
 * - DRAFT version: validate; archive the previously published version; publish this one.
 * - PUBLISHED version of a test that was unpublished: re-publish the test.
 */
export async function publishVersion(sql: Sql, admin: CurrentUser, versionId: string, now: Date) {
  return sql.begin(async (tx) => {
    // Locks the version and its test, and so waits for running content edits.
    const rows = await tx<{
      id: string;
      test_id: string;
      version_number: number;
      status: "draft" | "published" | "archived";
      published_at: Date | null;
      test_status: "draft" | "published" | "archived";
      current_version_id: string | null;
    }[]>`
      select tv.id, tv.test_id, tv.version_number, tv.status, tv.published_at,
             t.status as test_status, t.current_version_id
      from public.test_versions tv
      join public.tests t on t.id = tv.test_id
      where tv.id = ${versionId}
      for update of tv, t
    `;
    const version = rows[0];
    if (!version) {
      throw versionNotFound();
    }
    if (version.test_status === "archived") {
      throw new ApiError("TEST_ARCHIVED", "This test is archived.");
    }
    if (version.status === "archived") {
      throw new ApiError("INVALID_STATUS_TRANSITION", "An archived version cannot be published again.");
    }

    let publishedAt: Date;
    let previousVersionId: string | null = null;
    if (version.status === "published") {
      if (version.test_status === "published" && version.current_version_id === version.id) {
        throw new ApiError("ALREADY_PUBLISHED", "This version is already published.");
      }
      publishedAt = version.published_at ?? now;
    } else {
      const report = await buildReport(tx, versionId);
      if (!report.valid) {
        throw new ApiError("VALIDATION_FAILED", "The test version has validation errors.", report);
      }
      // Archive the current published version first: one published version per test.
      const archived = await tx<{ id: string }[]>`
        update public.test_versions set status = 'archived'
        where test_id = ${version.test_id} and status = 'published'
        returning id
      `;
      previousVersionId = archived[0]?.id ?? null;
      await tx`update public.test_versions set status = 'published', published_at = ${now} where id = ${versionId}`;
      publishedAt = now;
    }

    await tx`
      update public.tests set status = 'published', current_version_id = ${versionId}
      where id = ${version.test_id}
    `;
    await writeAuditLog(tx, {
      actorId: admin.id,
      action: "test_version.publish",
      resourceType: "test_version",
      resourceId: versionId,
      metadata: {
        test_id: version.test_id,
        version_number: version.version_number,
        republish: version.status === "published",
        archived_version_id: previousVersionId,
      },
    });
    return {
      status: TEST_STATUSES.published,
      version_id: versionId,
      test_id: version.test_id,
      published_at: publishedAt.toISOString(),
    };
  });
}
