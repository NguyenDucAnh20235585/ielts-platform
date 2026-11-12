import { describe, expect, it } from "vitest";

import { toMeResponse } from "./me-response";

describe("toMeResponse", () => {
  it("matches api-contract §3 (snake_case, ISO dates, profile object)", () => {
    expect(
      toMeResponse({
        id: "u1",
        email: "a@test",
        role: "STUDENT",
        displayName: "Khiem",
        createdAt: new Date("2026-10-01T08:30:00Z"),
      }),
    ).toEqual({
      id: "u1",
      email: "a@test",
      role: "STUDENT",
      profile: { display_name: "Khiem" },
      created_at: "2026-10-01T08:30:00.000Z",
    });
  });
});
