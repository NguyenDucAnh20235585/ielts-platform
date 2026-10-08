import "server-only";

import { ADMIN_TEST_STATUSES, adminStatusOf, toVersionBrief } from "@/features/admin/admin-views";
import { validateVersionContent, type ValidationReport } from "@/features/admin/publish-validation";
import {
  applySettingsPatch,
  enabledModes,
  type SettingsPatch,
  settingsProblem,
  toSettingsView,
} from "@/features/admin/settings";
import { type DbTestMode, type DbTestVisibility, TEST_STATUSES, TEST_TYPES } from "@/features/test/api-enums";
import type { CurrentUser } from "@/server/auth/current-user";
import type { Queryable, Sql } from "@/server/db/types";
import { ApiError } from "@/server/http/errors";

import { loadAdminTree, loadAnswerKeys, loadModeSettings, loadVersionInfo, writeModeSettings } from "./admin-shared";
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
    test: {
      id: info.test_id,
      title: info.test_title,
      type: TEST_TYPES[info.test_type],
      status: ADMIN_TEST_STATUSES[adminStatusOf(info.test_visibility, info.test_has_published)],
    },
    settings: toSettingsView(await loadModeSettings(sql, versionId)),
    band_conversion: {
      source: info.band_table_id ? "CUSTOM" : "DEFAULT",
      ranges: band.ranges.map((r) => ({ min_raw: r.minRaw, max_raw: r.maxRaw, band: r.band })),
    },
    sections,
  };
}

/** PATCH /api/admin/test-versions/:versionId — settings per mode of a DRAFT version (§6.6). Audited. */
export async function updateVersionSettings(sql: Sql, admin: CurrentUser, versionId: string, patch: SettingsPatch) {
  return sql.begin(async (tx) => {
    const info = await loadVersionInfo(tx, versionId, { lock: true });
    if (!info) {
      throw versionNotFound();
    }
    if (info.status !== "draft") {
      throw new ApiError("NOT_DRAFT", "Settings of a published or archived version cannot change.");
    }
    const before = await loadModeSettings(tx, versionId);
    const after = applySettingsPatch(before, patch);
    const problem = settingsProblem(after);
    if (problem) {
      throw new ApiError("INVALID_SETTINGS", problem);
    }
    await writeModeSettings(tx, versionId, after, "update");
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
  const modes = enabledModes(await loadModeSettings(sql, versionId));
  return validateVersionContent({ ...structure, version: { type: structure.version.type, enabledModes: modes }, keys });
}

/** POST /api/admin/test-versions/:versionId/validate (§6.7, rules §12.6). */
export async function validateVersion(sql: Sql, versionId: string): Promise<ValidationReport> {
  return buildReport(sql, versionId);
}

/**
 * GET /api/admin/test-versions/:versionId/preview — exactly what a student
 * gets, any status (§6.8). `mode` picks the settings shown; default: the
 * first enabled mode, MOCK before PRACTICE.
 */
export async function previewVersion(sql: Sql, versionId: string, mode?: DbTestMode) {
  const content = await loadStudentContent(sql, versionId, mode);
  if (!content) {
    throw versionNotFound();
  }
  return content;
}

/**
 * POST /api/admin/test-versions/:versionId/publish (§6.9). Audited.
 * Validates the DRAFT version, archives the previously published version and
 * publishes this one. The published version IS the test's current version;
 * the test's visibility is not changed (D-015).
 */
export async function publishVersion(sql: Sql, admin: CurrentUser, versionId: string, now: Date) {
  return sql.begin(async (tx) => {
    // Locks the version and its test, and so waits for running content edits.
    const rows = await tx<{
      id: string;
      test_id: string;
      version_number: number;
      status: "draft" | "published" | "archived";
      test_visibility: DbTestVisibility;
    }[]>`
      select tv.id, tv.test_id, tv.version_number, tv.status, t.visibility as test_visibility
      from public.test_versions tv
      join public.tests t on t.id = tv.test_id
      where tv.id = ${versionId}
      for update of tv, t
    `;
    const version = rows[0];
    if (!version) {
      throw versionNotFound();
    }
    if (version.test_visibility === "archived") {
      throw new ApiError("TEST_ARCHIVED", "This test is archived.");
    }
    if (version.status === "archived") {
      throw new ApiError("INVALID_STATUS_TRANSITION", "An archived version cannot be published again.");
    }
    if (version.status === "published") {
      throw new ApiError("ALREADY_PUBLISHED", "This version is already published.");
    }

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
    await tx`update public.test_versions set status = 'published', published_at = ${now} where id = ${versionId}`;

    await writeAuditLog(tx, {
      actorId: admin.id,
      action: "test_version.publish",
      resourceType: "test_version",
      resourceId: versionId,
      metadata: {
        test_id: version.test_id,
        version_number: version.version_number,
        archived_version_id: archived[0]?.id ?? null,
      },
    });
    return {
      status: TEST_STATUSES.published,
      version_id: versionId,
      test_id: version.test_id,
      published_at: now.toISOString(),
    };
  });
}
