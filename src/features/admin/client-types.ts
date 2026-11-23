import type { toAdminTest, toVersionBrief } from "./admin-views";
import type { getVersionEditor } from "@/server/services/admin-versions";
import type { MeResponse } from "@/features/auth/me-response";
import type { Paginated } from "@/features/student/types";

export type AdminTest = ReturnType<typeof toAdminTest>;
export type VersionBrief = ReturnType<typeof toVersionBrief>;
export type VersionEditor = Awaited<ReturnType<typeof getVersionEditor>>;
export type ModeSettings = VersionEditor["settings"]["practice"];
export type ModeSettingsMap = VersionEditor["settings"];
export type TestList = Paginated<AdminTest>;
export type TestDetail = { test: AdminTest; versions: VersionBrief[] };
export type AdminUser = MeResponse;
export type { AdminSection, AdminGroup, AdminQuestion } from "./admin-tree";
export type { ValidationReport, ValidationIssue } from "./publish-validation";
export type { StudentContent } from "@/features/test/student-content";

export const versionUrl = (id: string) => "/admin/versions/" + encodeURIComponent(id);
export const testUrl = (id: string) => "/admin/tests/" + encodeURIComponent(id);
export const dateLabel = (value: string | null) => value
  ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
  : "Chưa xuất bản";
export const numberLabel = (numbers: readonly number[]) => numbers.length
  ? numbers[0] === numbers[numbers.length - 1] ? String(numbers[0]) : numbers[0] + "–" + numbers[numbers.length - 1]
  : "Chưa có câu";

export const questionLabels: Record<string, string> = {
  MCQ_SINGLE: "Multiple Choice — Một đáp án",
  MCQ_MULTI: "Multiple Choice — Nhiều đáp án",
  TRUE_FALSE_NOT_GIVEN: "True / False / Not Given",
  YES_NO_NOT_GIVEN: "Yes / No / Not Given",
  MATCHING_HEADINGS: "Matching Headings",
  MATCHING_INFORMATION: "Matching Information",
  MATCHING_FEATURES: "Matching Features",
  MATCHING_SENTENCE_ENDINGS: "Matching Sentence Endings",
  SENTENCE_COMPLETION: "Sentence Completion",
  SUMMARY_COMPLETION: "Summary Completion",
  NOTE_COMPLETION: "Note Completion",
  TABLE_COMPLETION: "Table Completion",
  FORM_COMPLETION: "Form Completion",
  FLOW_CHART_COMPLETION: "Flow-chart Completion",
  DIAGRAM_LABEL_COMPLETION: "Diagram Label Completion",
  MAP_PLAN_LABELLING: "Map / Plan Labelling",
  SHORT_ANSWER: "Short Answer",
};
