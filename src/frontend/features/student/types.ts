import type { MeResponse } from "@/features/auth/me-response";
import type { AttemptView, ActiveAttemptView } from "@/features/attempt/attempt-view";
import type { ResultPayload } from "@/features/attempt/result-view";
import type { ModeOption } from "@/features/test/mode-settings";
import type { StudentSection, StudentTestVersion } from "@/features/test/student-content";

export type { StudentSection, StudentQuestion, StudentGroup, StudentTestVersion } from "@/features/test/student-content";
export type { ModeOption, ResultPayload };
export type StudentUser = MeResponse;
export type Mode = "PRACTICE" | "MOCK";
export type Skill = "READING" | "LISTENING";
export type AnswerValue = { choice: string } | { choices: string[] } | { text: string } | null;
export type Answers = Record<string, AnswerValue>;

export type Paginated<T> = {
  items: T[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
};
export type TestSummary = {
  id: string;
  title: string;
  description: string | null;
  type: Skill;
  question_count: number;
  access_type: "PUBLIC" | "PRIVATE" | "ASSIGNED";
  modes: ModeOption[];
  active_attempt_id: string | null;
};
export type TestDetail = TestSummary & {
  section_count: number;
  latest_version: { id: string; version_number: number; published_at: string | null };
  active_attempt: ActiveAttemptView | null;
};
export type Preload = { audio: { section_id: string; url: string; expires_at: string | null }[] };
export type AttemptPayload = {
  attempt: AttemptView;
  test_version: StudentTestVersion;
  sections: StudentSection[] | null;
  answers: { question_id: string; answer: AnswerValue; saved_at: string }[];
  flags: string[];
  preload: Preload | null;
};
export type StartPayload = { attempt: AttemptView; preload: Preload };
export type TimerStatus = Pick<AttemptView, "status" | "server_time" | "started_at" | "expires_at" | "remaining_seconds">;
export type SavePayload = {
  saved_at: string;
  answers: { question_id: string; answer: AnswerValue; saved_at: string }[];
  server_time: string;
  remaining_seconds: number | null;
};
export type HistoryItem = {
  id: string;
  test: { id: string; title: string; type: Skill };
  version_number: number;
  mode: Mode;
  status: AttemptView["status"];
  started_at: string | null;
  submitted_at: string | null;
  time_taken_seconds: number | null;
  raw_score: number | null;
  max_score: number | null;
  band_score: number | null;
};
