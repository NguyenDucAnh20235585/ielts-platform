import { iso } from "@/features/attempt/attempt-view";
import {
  ACCESS_TYPES,
  type DbAccessType,
  type DbTestMode,
  type DbTestStatus,
  type DbTestType,
  type DbTestVisibility,
  TEST_MODES,
  TEST_STATUSES,
  TEST_TYPES,
  TEST_VISIBILITIES,
} from "@/features/test/api-enums";
import { sortModes } from "@/features/test/mode-settings";

/**
 * Status of a test as admins see it. Not stored: computed from the test's
 * visibility and whether it has a published version (D-015).
 */
export const ADMIN_TEST_STATUSES = {
  draft: "DRAFT",
  published: "PUBLISHED",
  hidden: "HIDDEN",
  archived: "ARCHIVED",
} as const;
export type AdminTestStatus = keyof typeof ADMIN_TEST_STATUSES;

export function adminStatusOf(visibility: DbTestVisibility, hasPublishedVersion: boolean): AdminTestStatus {
  if (visibility === "archived") return "archived";
  if (visibility === "hidden") return "hidden";
  return hasPublishedVersion ? "published" : "draft";
}

/** Columns of public.tests used by admin responses. */
export type AdminTestRow = {
  id: string;
  title: string;
  description: string | null;
  type: DbTestType;
  visibility: DbTestVisibility;
  access_type: DbAccessType;
  created_at: Date;
  updated_at: Date;
};

/** A test version with its enabled modes and attempt count. */
export type VersionBriefRow = {
  id: string;
  test_id: string;
  version_number: number;
  status: DbTestStatus;
  /** Enabled modes (test_version_modes.enabled). */
  modes: DbTestMode[];
  published_at: Date | null;
  attempt_count: number;
  created_at: Date;
  updated_at: Date;
};

/** api-contract §2.6 VersionBrief */
export function toVersionBrief(row: VersionBriefRow) {
  return {
    id: row.id,
    version_number: row.version_number,
    status: TEST_STATUSES[row.status],
    modes: sortModes(row.modes.map((mode) => ({ mode }))).map(({ mode }) => TEST_MODES[mode]),
    published_at: iso(row.published_at),
    attempt_count: row.attempt_count,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

/** api-contract §2.6 AdminTest. `versions` = the test's versions (any order). */
export function toAdminTest(row: AdminTestRow, versions: readonly VersionBriefRow[]) {
  const own = versions.filter((v) => v.test_id === row.id);
  const current = own.find((v) => v.status === "published");
  const draft = own.find((v) => v.status === "draft");
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: TEST_TYPES[row.type],
    status: ADMIN_TEST_STATUSES[adminStatusOf(row.visibility, current !== undefined)],
    visibility: TEST_VISIBILITIES[row.visibility],
    access_type: ACCESS_TYPES[row.access_type],
    current_version: current ? toVersionBrief(current) : null,
    draft_version: draft ? toVersionBrief(draft) : null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
