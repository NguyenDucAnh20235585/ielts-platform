import { z } from "zod";

import { apiEnum } from "@/features/test/api-enum-schema";
import {
  ANSWER_VISIBILITIES,
  type DbAnswerVisibility,
  type DbTestMode,
  type DbTestType,
  TEST_MODES,
} from "@/features/test/api-enums";

/** test_versions settings columns (database-schema §2.3). */
export type VersionSettings = {
  mode: DbTestMode;
  time_limit_seconds: number | null;
  max_attempts: number | null;
  answer_visibility: DbAnswerVisibility;
  allow_pause: boolean;
  allow_replay: boolean;
  allow_seek: boolean;
  max_plays: number | null;
};

export const MIN_DURATION_SECONDS = 60;
export const MAX_DURATION_SECONDS = 14_400;

/** Defaults when a version is created (api-contract §2.6 VersionSettings). */
export function defaultSettings(
  mode: DbTestMode,
  type: DbTestType,
  durationSeconds: number | null | undefined,
): VersionSettings {
  if (mode === "mock") {
    return {
      mode,
      time_limit_seconds: durationSeconds ?? (type === "reading" ? 3600 : 1920),
      max_attempts: null,
      answer_visibility: "after_submit",
      allow_pause: false,
      allow_replay: false,
      allow_seek: false,
      max_plays: 1,
    };
  }
  return {
    mode,
    time_limit_seconds: durationSeconds ?? null,
    max_attempts: null,
    answer_visibility: "immediately_in_practice",
    allow_pause: true,
    allow_replay: true,
    allow_seek: true,
    max_plays: null,
  };
}

/** Business rules on a complete settings object (400 INVALID_SETTINGS); null when valid. */
export function settingsProblem(settings: VersionSettings): string | null {
  const duration = settings.time_limit_seconds;
  if (duration !== null && (duration < MIN_DURATION_SECONDS || duration > MAX_DURATION_SECONDS)) {
    return `duration_seconds must be between ${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS}.`;
  }
  if (settings.mode === "mock" && duration === null) {
    return "MOCK tests need duration_seconds.";
  }
  if (settings.mode === "mock" && settings.answer_visibility === "immediately_in_practice") {
    return "MOCK tests cannot use IMMEDIATELY_IN_PRACTICE.";
  }
  if (settings.max_attempts !== null && settings.max_attempts < 1) return "max_attempts must be at least 1.";
  if (settings.max_plays !== null && settings.max_plays < 1) return "max_plays must be at least 1.";
  return null;
}

/** PATCH /api/admin/test-versions/:versionId body: any subset of VersionSettings. Enum values are returned as DB values. */
export const settingsPatchSchema = z.strictObject({
  mode: apiEnum(TEST_MODES).optional(),
  duration_seconds: z.number().int().nullable().optional(),
  max_attempts: z.number().int().nullable().optional(),
  answer_visibility: apiEnum(ANSWER_VISIBILITIES).optional(),
  allow_pause: z.boolean().optional(),
  allow_replay: z.boolean().optional(),
  allow_seek: z.boolean().optional(),
  max_plays: z.number().int().nullable().optional(),
});
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

/** Merges a PATCH into the current settings. A field that is absent keeps its value; null clears it. */
export function applySettingsPatch(current: VersionSettings, patch: SettingsPatch): VersionSettings {
  return {
    mode: patch.mode ?? current.mode,
    time_limit_seconds: patch.duration_seconds === undefined ? current.time_limit_seconds : patch.duration_seconds,
    max_attempts: patch.max_attempts === undefined ? current.max_attempts : patch.max_attempts,
    answer_visibility: patch.answer_visibility ?? current.answer_visibility,
    allow_pause: patch.allow_pause ?? current.allow_pause,
    allow_replay: patch.allow_replay ?? current.allow_replay,
    allow_seek: patch.allow_seek ?? current.allow_seek,
    max_plays: patch.max_plays === undefined ? current.max_plays : patch.max_plays,
  };
}

/** api-contract §2.6 VersionSettings */
export function toSettingsView(settings: VersionSettings) {
  return {
    mode: TEST_MODES[settings.mode],
    duration_seconds: settings.time_limit_seconds,
    max_attempts: settings.max_attempts,
    answer_visibility: ANSWER_VISIBILITIES[settings.answer_visibility],
    allow_pause: settings.allow_pause,
    allow_replay: settings.allow_replay,
    allow_seek: settings.allow_seek,
    max_plays: settings.max_plays,
  };
}
