import { describe, expect, it } from "vitest";

import { adminStatusOf, toAdminTest, type AdminTestRow, type VersionBriefRow } from "./admin-views";

const at = new Date("2026-10-08T00:00:00Z");
const test: AdminTestRow = {
  id: "t1", title: "T", description: null, type: "reading", visibility: "visible", access_type: "public",
  created_at: at, updated_at: at,
};
const version = (id: string, status: VersionBriefRow["status"], number: number): VersionBriefRow => ({
  id, test_id: "t1", version_number: number, status, modes: ["mock", "practice"], published_at: status === "draft" ? null : at,
  attempt_count: 0, created_at: at, updated_at: at,
});

describe("admin test status (D-015)", () => {
  it("is computed from visibility and the published version", () => {
    expect(adminStatusOf("visible", false)).toBe("draft");
    expect(adminStatusOf("visible", true)).toBe("published");
    expect(adminStatusOf("hidden", true)).toBe("hidden");
    expect(adminStatusOf("archived", false)).toBe("archived");
  });

  it("picks the current and draft versions and lists modes PRACTICE first", () => {
    const view = toAdminTest(test, [version("v1", "archived", 1), version("v2", "published", 2), version("v3", "draft", 3)]);
    expect(view).toMatchObject({
      status: "PUBLISHED",
      visibility: "VISIBLE",
      current_version: { id: "v2", status: "PUBLISHED", modes: ["PRACTICE", "MOCK"] },
      draft_version: { id: "v3", status: "DRAFT" },
    });
    expect(toAdminTest({ ...test, visibility: "hidden" }, [])).toMatchObject({ status: "HIDDEN", current_version: null });
  });
});
