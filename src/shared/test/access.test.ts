import { describe, expect, it } from "vitest";

import { canOpenTest, studentAccessTypes } from "./access";

describe("test access (D-017)", () => {
  it("students only open PUBLIC tests until grants exist", () => {
    expect(canOpenTest("STUDENT", "public")).toBe(true);
    expect(canOpenTest("STUDENT", "private")).toBe(false);
    expect(canOpenTest("STUDENT", "assigned")).toBe(false);
    expect(studentAccessTypes("STUDENT")).toEqual(["public"]);
  });

  it("admins open every test", () => {
    expect(["public", "private", "assigned"].every((t) => canOpenTest("ADMIN", t as "public"))).toBe(true);
  });
});
