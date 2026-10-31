import { z } from "zod";

import { apiEnum } from "@/features/test/api-enum-schema";
import { ANSWER_VISIBILITIES, type DbTestMode, type DbTestType, TEST_MODES } from "@/features/test/api-enums";
import { MODE_ORDER, type ModeSettingsRow } from "@/features/test/mode-settings";

/**
 * Settings of a test version: one entry per mode (D-015). The student picks
 * the mode when starting an attempt; the admin sets each mode per test.
 * Stored in public.test_version_modes, one row per mode.
 */
export type VersionSettings = Record<DbTestMode, ModeSettingsRow>;

export const MIN_DURATION_SECONDS = 60;
export const MAX_DURATION_SECONDS = 14_400;

/** Defaults when a version is created (api-contract §2.6 VersionSettings). */
export function defaultSettings(type: DbTestType): VersionSettings {
  return {
    practice: {
      mode: "practice",
      enabled: true,
      time_limit_seconds: null,
      max_attempts: null,
      answer_visibility: "immediately_in_practice",
      allow_pause: true,
      allow_replay: true,
      allow_seek: true,
      max_plays: null,
    },
    mock: {
      mode: "mock",
      enabled: true,
      // Listening: 30 min + 2 min review until the real audio length is known.
      time_limit_seconds: type === "reading" ? 3600 : 1920,
      max_attempts: null,
      answer_visibility: "after_submit",
      allow_pause: false,
      allow_replay: false,
      allow_seek: false,
      max_plays: 1,
    },
  };
}

/** Business rules on complete settings (400 INVALID_SETTINGS); null when valid. */
export function settingsProblem(settings: VersionSettings): string | null {
  if (!MODE_ORDER.some((mode) => settings[mode].enabled)) {
    return "At least one mode (PRACTICE or MOCK) must be enabled.";
  }
  for (const mode of MODE_ORDER) {
    const m = settings[mode];
    const label = TEST_MODES[mode];
    const duration = m.time_limit_seconds;
    if (duration !== null && (duration < MIN_DURATION_SECONDS || duration > MAX_DURATION_SECONDS)) {
      return `${label}: duration_seconds must be between ${MIN_DURATION_SECONDS} and ${MAX_DURATION_SECONDS}.`;
    }
    if (mode === "mock" && duration === null) return "MOCK: duration_seconds is required.";
    if (mode === "mock" && m.answer_visibility === "immediately_in_practice") {
      return "MOCK: answer_visibility cannot be IMMEDIATELY_IN_PRACTICE.";
    }
    if (m.max_attempts !== null && m.max_attempts < 1) return `${label}: max_attempts must be at least 1.`;
    if (m.max_plays !== null && m.max_plays < 1) return `${label}: max_plays must be at least 1.`;
  }
  return null;
}

const modePatchSchema = z.strictObject({
  enabled: z.boolean().optional(),
  duration_seconds: z.number().int().nullable().optional(),
  max_attempts: z.number().int().nullable().optional(),
  answer_visibility: apiEnum(ANSWER_VISIBILITIES).optional(),
  allow_pause: z.boolean().optional(),
  allow_replay: z.boolean().optional(),
  allow_seek: z.boolean().optional(),
  max_plays: z.number().int().nullable().optional(),
});

/**
 * PATCH /api/admin/test-versions/:versionId body: `{ practice?, mock? }`, each
 * any subset of the mode's settings. Enum values are returned as DB values.
 */
export const settingsPatchSchema = z.strictObject({
  practice: modePatchSchema.optional(),
  mock: modePatchSchema.optional(),
});
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
type ModePatch = z.infer<typeof modePatchSchema>;

function applyModePatch(current: ModeSettingsRow, patch: ModePatch | undefined): ModeSettingsRow {
  if (!patch) return current;
  return {
    mode: current.mode,
    enabled: patch.enabled ?? current.enabled,
    time_limit_seconds: patch.duration_seconds === undefined ? current.time_limit_seconds : patch.duration_seconds,
    max_attempts: patch.max_attempts === undefined ? current.max_attempts : patch.max_attempts,
    answer_visibility: patch.answer_visibility ?? current.answer_visibility,
    allow_pause: patch.allow_pause ?? current.allow_pause,
    allow_replay: patch.allow_replay ?? current.allow_replay,
    allow_seek: patch.allow_seek ?? current.allow_seek,
    max_plays: patch.max_plays === undefined ? current.max_plays : patch.max_plays,
  };
}

/** Merges a PATCH into the current settings. An absent field keeps its value; null clears it. */
export function applySettingsPatch(current: VersionSettings, patch: SettingsPatch): VersionSettings {
  return { practice: applyModePatch(current.practice, patch.practice), mock: applyModePatch(current.mock, patch.mock) };
}

/** Builds VersionSettings from the version's test_version_modes rows. */
export function settingsFromRows(rows: readonly ModeSettingsRow[]): VersionSettings {
  const byMode = new Map(rows.map((row) => [row.mode, row]));
  const practice = byMode.get("practice");
  const mock = byMode.get("mock");
  if (!practice || !mock) {
    throw new Error("A test version must have one settings row per mode.");
  }
  return { practice, mock };
}

export function enabledModes(settings: VersionSettings): DbTestMode[] {
  return MODE_ORDER.filter((mode) => settings[mode].enabled);
}

function toModeSettingsView(m: ModeSettingsRow) {
  return {
    enabled: m.enabled,
    duration_seconds: m.time_limit_seconds,
    max_attempts: m.max_attempts,
    answer_visibility: ANSWER_VISIBILITIES[m.answer_visibility],
    allow_pause: m.allow_pause,
    allow_replay: m.allow_replay,
    allow_seek: m.allow_seek,
    max_plays: m.max_plays,
  };
}

/** api-contract §2.6 VersionSettings */
export function toSettingsView(settings: VersionSettings) {
  return { practice: toModeSettingsView(settings.practice), mock: toModeSettingsView(settings.mock) };
}
