import { describe, expect, it } from "vitest";

import { applySettingsPatch, defaultSettings, settingsPatchSchema, settingsProblem, toSettingsView } from "./settings";

describe("version settings (api-contract §2.6)", () => {
  it("uses the documented defaults", () => {
    expect(defaultSettings("mock", "reading", undefined)).toMatchObject({ time_limit_seconds: 3600, answer_visibility: "after_submit", max_plays: 1, allow_pause: false });
    expect(defaultSettings("mock", "listening", null).time_limit_seconds).toBe(1920);
    expect(defaultSettings("practice", "reading", undefined)).toMatchObject({
      time_limit_seconds: null,
      answer_visibility: "immediately_in_practice",
      allow_seek: true,
      max_plays: null,
    });
    expect(defaultSettings("practice", "reading", 1200).time_limit_seconds).toBe(1200);
  });

  it("enforces the MOCK rules", () => {
    const mock = defaultSettings("mock", "reading", undefined);
    expect(settingsProblem(mock)).toBeNull();
    expect(settingsProblem({ ...mock, time_limit_seconds: null })).toMatch(/MOCK/);
    expect(settingsProblem({ ...mock, answer_visibility: "immediately_in_practice" })).toMatch(/IMMEDIATELY/);
    expect(settingsProblem({ ...mock, time_limit_seconds: 59 })).toMatch(/between/);
    expect(settingsProblem({ ...mock, max_plays: 0 })).toMatch(/max_plays/);
  });

  it("merges a PATCH: absent keeps, null clears, API enums become DB values", () => {
    const practice = defaultSettings("practice", "reading", 1800);
    const patch = settingsPatchSchema.parse({ mode: "MOCK", answer_visibility: "NEVER", max_attempts: 2 });
    const merged = applySettingsPatch(practice, patch);
    expect(merged).toMatchObject({ mode: "mock", answer_visibility: "never", max_attempts: 2, time_limit_seconds: 1800 });
    expect(applySettingsPatch(practice, { duration_seconds: null }).time_limit_seconds).toBeNull();
    expect(toSettingsView(merged)).toMatchObject({ mode: "MOCK", answer_visibility: "NEVER", duration_seconds: 1800 });
    expect(settingsPatchSchema.safeParse({ mode: "EXAM" }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ colour: "red" }).success).toBe(false);
  });
});
