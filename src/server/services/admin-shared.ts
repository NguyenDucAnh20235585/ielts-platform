import "server-only";

import { buildAdminSections } from "@/features/admin/admin-tree";
import type { AnswerKeyRow } from "@/features/admin/answer-key-row";
import type { AdminTestRow, VersionBriefRow } from "@/features/admin/admin-views";
import { settingsFromRows, type VersionSettings } from "@/features/admin/settings";
import type { DbTestStatus, DbTestType, DbTestVisibility } from "@/features/test/api-enums";
import { MODE_ORDER, type ModeSettingsRow } from "@/features/test/mode-settings";
import type { Queryable, TransactionSql } from "@/server/db/types";
import { ApiError } from "@/server/http/errors";
import { resolveMediaUrl } from "@/server/media/urls";

import { loadVersionStructure } from "./test-structure";

/** Loaders and locks shared by the admin services. */

export async function loadAdminTestRow(sql: Queryable, testId: string, options: { lock?: boolean } = {}) {
  const rows = await sql<AdminTestRow[]>`
    select id, title, description, type, visibility, access_type, created_at, updated_at
    from public.tests
    where id = ${testId}
    ${options.lock ? sql`for update` : sql``}
  `;
  return rows[0] ?? null;
}

/** All versions of the given tests, newest first, with enabled modes and attempt counts. */
export async function loadVersionBriefs(sql: Queryable, testIds: readonly string[]): Promise<VersionBriefRow[]> {
  if (testIds.length === 0) {
    return [];
  }
  const rows = await sql<VersionBriefRow[]>`
    select tv.id, tv.test_id, tv.version_number, tv.status, tv.published_at, tv.created_at, tv.updated_at,
           coalesce((select array_agg(m.mode order by m.mode)
                     from public.test_version_modes m
                     where m.test_version_id = tv.id and m.enabled), '{}') as modes,
           (select count(*)::int from public.attempts a where a.test_version_id = tv.id) as attempt_count
    from public.test_versions tv
    where tv.test_id in ${sql(testIds)}
    order by tv.version_number desc
  `;
  return [...rows];
}

/** A version with its test and attempt count (admin views). */
export type VersionInfoRow = VersionBriefRow & {
  band_table_id: string | null;
  test_title: string;
  test_type: DbTestType;
  test_visibility: DbTestVisibility;
  test_has_published: boolean;
};

export async function loadVersionInfo(sql: Queryable, versionId: string, options: { lock?: boolean } = {}) {
  const rows = await sql<VersionInfoRow[]>`
    select tv.id, tv.test_id, tv.version_number, tv.status, tv.published_at, tv.created_at, tv.updated_at,
           tv.band_table_id,
           coalesce((select array_agg(m.mode order by m.mode)
                     from public.test_version_modes m
                     where m.test_version_id = tv.id and m.enabled), '{}') as modes,
           t.title as test_title, t.type as test_type, t.visibility as test_visibility,
           exists (select 1 from public.test_versions p
                   where p.test_id = tv.test_id and p.status = 'published') as test_has_published,
           (select count(*)::int from public.attempts a where a.test_version_id = tv.id) as attempt_count
    from public.test_versions tv
    join public.tests t on t.id = tv.test_id
    where tv.id = ${versionId}
    ${options.lock ? sql`for update of tv` : sql``}
  `;
  return rows[0] ?? null;
}

/** The settings of a version, one entry per mode (test_version_modes). */
export async function loadModeSettings(sql: Queryable, versionId: string): Promise<VersionSettings> {
  const rows = await sql<ModeSettingsRow[]>`
    select mode, enabled, time_limit_seconds, max_attempts, answer_visibility,
           allow_pause, allow_replay, allow_seek, max_plays
    from public.test_version_modes
    where test_version_id = ${versionId}
  `;
  return settingsFromRows(rows);
}

/** Inserts (new version) or updates the version's two mode rows. */
export async function writeModeSettings(
  tx: Queryable,
  versionId: string,
  settings: VersionSettings,
  action: "insert" | "update",
): Promise<void> {
  for (const mode of MODE_ORDER) {
    const m = settings[mode];
    if (action === "insert") {
      await tx`
        insert into public.test_version_modes
          (test_version_id, mode, enabled, time_limit_seconds, max_attempts, answer_visibility,
           allow_pause, allow_replay, allow_seek, max_plays)
        values (${versionId}, ${mode}, ${m.enabled}, ${m.time_limit_seconds}, ${m.max_attempts},
                ${m.answer_visibility}, ${m.allow_pause}, ${m.allow_replay}, ${m.allow_seek}, ${m.max_plays})
      `;
    } else {
      await tx`
        update public.test_version_modes
        set enabled = ${m.enabled}, time_limit_seconds = ${m.time_limit_seconds}, max_attempts = ${m.max_attempts},
            answer_visibility = ${m.answer_visibility}, allow_pause = ${m.allow_pause},
            allow_replay = ${m.allow_replay}, allow_seek = ${m.allow_seek}, max_plays = ${m.max_plays}
        where test_version_id = ${versionId} and mode = ${mode}
      `;
    }
  }
}

/** Answer keys of a version, by question id. Admin paths only — never used by student endpoints. */
export async function loadAnswerKeys(sql: Queryable, versionId: string): Promise<Map<string, AnswerKeyRow>> {
  const rows = await sql<AnswerKeyRow[]>`
    select k.question_id, k.correct_answer, k.grading_config, k.explanation, k.updated_at
    from public.answer_keys k
    join public.questions q on q.id = k.question_id
    join public.question_groups g on g.id = q.question_group_id
    join public.sections s on s.id = g.section_id
    where s.test_version_id = ${versionId}
  `;
  return new Map(rows.map((row) => [row.question_id, row]));
}

/** The editor tree of a version (api-contract §6.5 `sections`), or null if the version does not exist. */
export async function loadAdminTree(sql: Queryable, versionId: string) {
  const structure = await loadVersionStructure(sql, versionId);
  if (!structure) {
    return null;
  }
  const keys = await loadAnswerKeys(sql, versionId);
  return buildAdminSections(
    structure.version,
    structure.sections,
    structure.groups,
    structure.questions,
    keys,
    resolveMediaUrl,
  );
}

// --- Draft locking for content edits (api-contract §7) -----------------------

export type ContentKind = "section" | "group" | "question";

export const NOT_FOUND: Record<ContentKind, () => ApiError> = {
  section: () => new ApiError("SECTION_NOT_FOUND", "Section not found."),
  group: () => new ApiError("GROUP_NOT_FOUND", "Question group not found."),
  question: () => new ApiError("QUESTION_NOT_FOUND", "Question not found."),
};

export type DraftVersion = { id: string; type: DbTestType };

/**
 * Locks the version row (FOR UPDATE) so content edits of one version run one
 * at a time (positions stay consistent), and checks that it is a draft.
 * The database trigger enforces the same rule (IE001 → NOT_DRAFT).
 */
export async function lockDraftVersion(tx: TransactionSql, versionId: string): Promise<DraftVersion | null> {
  const rows = await tx<{ id: string; status: DbTestStatus; type: DbTestType }[]>`
    select tv.id, tv.status, t.type
    from public.test_versions tv
    join public.tests t on t.id = tv.test_id
    where tv.id = ${versionId}
    for update of tv
  `;
  const row = rows[0];
  if (!row) {
    return null;
  }
  if (row.status !== "draft") {
    throw new ApiError("NOT_DRAFT", "This test version is not a draft and cannot be changed.");
  }
  return { id: row.id, type: row.type };
}

async function versionOfNode(tx: TransactionSql, kind: ContentKind, id: string): Promise<string | null> {
  const rows =
    kind === "section"
      ? await tx<{ version_id: string }[]>`
          select test_version_id as version_id from public.sections where id = ${id}`
      : kind === "group"
        ? await tx<{ version_id: string }[]>`
            select s.test_version_id as version_id
            from public.question_groups g join public.sections s on s.id = g.section_id
            where g.id = ${id}`
        : await tx<{ version_id: string }[]>`
            select s.test_version_id as version_id
            from public.questions q
            join public.question_groups g on g.id = q.question_group_id
            join public.sections s on s.id = g.section_id
            where q.id = ${id}`;
  return rows[0]?.version_id ?? null;
}

/**
 * Finds the draft version that owns a section/group/question and locks it.
 * The node is looked up again after the lock, in case it was deleted meanwhile.
 */
export async function lockDraftOfNode(tx: TransactionSql, kind: ContentKind, id: string): Promise<DraftVersion> {
  const versionId = await versionOfNode(tx, kind, id);
  if (!versionId) {
    throw NOT_FOUND[kind]();
  }
  const version = await lockDraftVersion(tx, versionId);
  if (!version || (await versionOfNode(tx, kind, id)) !== versionId) {
    throw NOT_FOUND[kind]();
  }
  return version;
}
