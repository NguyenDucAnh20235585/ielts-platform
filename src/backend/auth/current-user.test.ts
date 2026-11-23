import { describe, expect, it } from "vitest";

import { type ProfileRow, assertAdmin, resolveCurrentUser } from "./current-user";

const profile = (overrides: Partial<ProfileRow> = {}): ProfileRow => ({
  role: "student",
  display_name: null,
  disabled_at: null,
  created_at: new Date("2026-10-01T00:00:00Z"),
  ...overrides,
});

const deps = (authUser: { id: string; email: string | null } | null, row: ProfileRow = profile()) => ({
  getAuthUser: async () => authUser,
  loadProfile: async () => row,
});

describe("resolveCurrentUser", () => {
  it("401 UNAUTHORIZED without a session", async () => {
    await expect(resolveCurrentUser(deps(null))).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  });

  it("403 ACCOUNT_DISABLED for a disabled account", async () => {
    const disabled = profile({ disabled_at: new Date() });
    await expect(resolveCurrentUser(deps({ id: "u1", email: "a@x" }, disabled))).rejects.toMatchObject({
      code: "ACCOUNT_DISABLED",
      status: 403,
    });
  });

  it("maps the profile to the API role", async () => {
    await expect(resolveCurrentUser(deps({ id: "u1", email: "a@x" }))).resolves.toMatchObject({ id: "u1", role: "STUDENT" });
    await expect(resolveCurrentUser(deps({ id: "u2", email: null }, profile({ role: "admin" })))).resolves.toMatchObject({
      role: "ADMIN",
    });
  });
});

describe("assertAdmin", () => {
  const base = { id: "u1", email: null, displayName: null, createdAt: new Date() };
  it("403 FORBIDDEN for students, passes admins", () => {
    expect(() => assertAdmin({ ...base, role: "STUDENT" })).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(() => assertAdmin({ ...base, role: "ADMIN" })).not.toThrow();
  });
});
