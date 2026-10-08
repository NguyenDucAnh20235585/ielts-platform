import { ANSWER_VISIBILITIES, type DbAnswerVisibility, type DbTestMode, TEST_MODES } from "./api-enums";

/**
 * A row of public.test_version_modes: the settings of one mode of a test
 * version (D-015). Every version has one row per mode; `enabled` says
 * whether students may pick it.
 */
export type ModeSettingsRow = {
  mode: DbTestMode;
  enabled: boolean;
  time_limit_seconds: number | null;
  max_attempts: number | null;
  answer_visibility: DbAnswerVisibility;
  allow_pause: boolean;
  allow_replay: boolean;
  allow_seek: boolean;
  max_plays: number | null;
};

/** Order in which modes are listed in API responses. */
export const MODE_ORDER: readonly DbTestMode[] = ["practice", "mock"];

export function sortModes<Row extends { mode: DbTestMode }>(rows: readonly Row[]): Row[] {
  return [...rows].sort((a, b) => MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode));
}

/** api-contract §2.6 ModeOption: one mode a student can pick, with this user's attempt count. */
export function toModeOption(row: ModeSettingsRow, attemptsUsed: number) {
  return {
    mode: TEST_MODES[row.mode],
    duration_seconds: row.time_limit_seconds,
    max_attempts: row.max_attempts,
    attempts_used: attemptsUsed,
    attempts_remaining: row.max_attempts === null ? null : Math.max(0, row.max_attempts - attemptsUsed),
    answer_visibility: ANSWER_VISIBILITIES[row.answer_visibility],
    allow_pause: row.allow_pause,
    allow_replay: row.allow_replay,
    allow_seek: row.allow_seek,
    max_plays: row.max_plays,
  };
}

export type ModeOption = ReturnType<typeof toModeOption>;
