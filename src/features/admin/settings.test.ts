import { describe, expect, it } from "vitest";

import {
  applySettingsPatch,
  defaultSettings,
  enabledModes,
  settingsFromRows,
  settingsPatchSchema,
  settingsProblem,
  toSettingsView,
} from "./settings";

describe("version settings per mode (api-contract §2.6, D-015)", () => {
  it("uses the documented defaults: both modes enabled", () => {
    const reading = defaultSettings("reading");
    expect(reading.practice).toMatchObject({ enabled: true, time_limit_seconds: null, answer_visibility: "immediately_in_practice", allow_pause: true, max_plays: null });
    expect(reading.mock).toMatchObject({ enabled: true, time_limit_seconds: 3600, answer_visibility: "after_submit", allow_pause: false, max_plays: 1, max_attempts: null });
    expect(defaultSettings("listening").mock.time_limit_seconds).toBe(1920);
    expect(settingsProblem(reading)).toBeNull();
    expect(enabledModes(reading)).toEqual(["practice", "mock"]);
  });

  it("enforces the rules", () => {
    const s = defaultSettings("reading");
    expect(settingsProblem({ ...s, practice: { ...s.practice, enabled: false }, mock: { ...s.mock, enabled: false } })).toMatch(/At least one mode/);
    expect(settingsProblem({ ...s, mock: { ...s.mock, time_limit_seconds: null } })).toBe("MOCK: duration_seconds is required.");
    expect(settingsProblem({ ...s, mock: { ...s.mock, answer_visibility: "immediately_in_practice" } })).toMatch(/IMMEDIATELY/);
    expect(settingsProblem({ ...s, practice: { ...s.practice, time_limit_seconds: 30 } })).toMatch(/^PRACTICE: duration_seconds must be between/);
    expect(settingsProblem({ ...s, mock: { ...s.mock, max_attempts: 0 } })).toMatch(/MOCK: max_attempts/);
  });

  it("merges a PATCH per mode: absent keeps, null clears, API enums become DB values", () => {
    const s = defaultSettings("reading");
    const patch = settingsPatchSchema.parse({ mock: { max_attempts: 3, answer_visibility: "NEVER" }, practice: { duration_seconds: 1800 } });
    const merged = applySettingsPatch(s, patch);
    expect(merged.mock).toMatchObject({ max_attempts: 3, answer_visibility: "never", time_limit_seconds: 3600 });
    expect(merged.practice.time_limit_seconds).toBe(1800);
    expect(applySettingsPatch(merged, { practice: { duration_seconds: null } }).practice.time_limit_seconds).toBeNull();
    expect(toSettingsView(merged).mock).toEqual({
      enabled: true, duration_seconds: 3600, max_attempts: 3, answer_visibility: "NEVER",
      allow_pause: false, allow_replay: false, allow_seek: false, max_plays: 1,
    });
    expect(settingsPatchSchema.safeParse({ exam: {} }).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ mock: { colour: "red" } }).success).toBe(false);
  });

  it("needs one row per mode", () => {
    const s = defaultSettings("reading");
    expect(settingsFromRows([s.mock, s.practice])).toEqual(s);
    expect(() => settingsFromRows([s.mock])).toThrow();
  });
});
