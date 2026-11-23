import { describe, expect, it } from "vitest";

import { type ModeSettingsRow, sortModes, toModeOption } from "./mode-settings";

const mock: ModeSettingsRow = {
  mode: "mock", enabled: true, time_limit_seconds: 3600, max_attempts: 3, answer_visibility: "after_submit",
  allow_pause: false, allow_replay: false, allow_seek: false, max_plays: 1,
};
const practice: ModeSettingsRow = {
  mode: "practice", enabled: true, time_limit_seconds: null, max_attempts: null,
  answer_visibility: "immediately_in_practice", allow_pause: true, allow_replay: true, allow_seek: true, max_plays: null,
};

describe("mode options (D-015)", () => {
  it("lists PRACTICE before MOCK", () => {
    expect(sortModes([mock, practice]).map((m) => m.mode)).toEqual(["practice", "mock"]);
  });

  it("counts remaining attempts per mode", () => {
    expect(toModeOption(mock, 1)).toEqual({
      mode: "MOCK", duration_seconds: 3600, max_attempts: 3, attempts_used: 1, attempts_remaining: 2,
      answer_visibility: "AFTER_SUBMIT", allow_pause: false, allow_replay: false, allow_seek: false, max_plays: 1,
    });
    expect(toModeOption(mock, 5).attempts_remaining).toBe(0);
    expect(toModeOption(practice, 7)).toMatchObject({ mode: "PRACTICE", max_attempts: null, attempts_remaining: null });
  });
});
