import { iso } from "@/features/attempt/attempt-view";
import {
  ACCESS_TYPES,
  type DbAccessType,
  type DbTestMode,
  type DbTestStatus,
  type DbTestType,
  TEST_MODES,
  TEST_STATUSES,
  TEST_TYPES,
} from "@/features/test/api-enums";

/** Columns of public.tests used by admin responses. */
export type AdminTestRow = {
  id: string;
  title: string;
  description: string | null;
  type: DbTestType;
  status: DbTestStatus;
  access_type: DbAccessType;
  current_version_id: string | null;
  created_at: Date;
  updated_at: Date;
};

/** A test version with its attempt count. Version statuses use the same values as test statuses. */
export type VersionBriefRow = {
  id: string;
  test_id: string;
  version_number: number;
  status: DbTestStatus;
  mode: DbTestMode;
  time_limit_seconds: number | null;
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
    mode: TEST_MODES[row.mode],
    duration_seconds: row.time_limit_seconds,
    published_at: iso(row.published_at),
    attempt_count: row.attempt_count,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

/** api-contract §2.6 AdminTest. `versions` = the test's versions (any order). */
export function toAdminTest(row: AdminTestRow, versions: readonly VersionBriefRow[]) {
  const current = versions.find((v) => v.id === row.current_version_id);
  const draft = versions.find((v) => v.test_id === row.id && v.status === "draft");
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: TEST_TYPES[row.type],
    status: TEST_STATUSES[row.status],
    access_type: ACCESS_TYPES[row.access_type],
    current_version: current ? toVersionBrief(current) : null,
    draft_version: draft ? toVersionBrief(draft) : null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
