import type { AnswerValue, HistoryItem, StudentQuestion } from "./types";

export const modeLabel = (mode: string) => mode === "MOCK" ? "Thi thử" : "Luyện tập";
export const skillLabel = (type: string) => type === "LISTENING" ? "Listening" : "Reading";
export function durationLabel(seconds: number | null) {
  if (seconds === null) return "Không giới hạn";
  if (seconds < 60) return seconds + " giây";
  return Math.ceil(seconds / 60) + " phút";
}
export function clockLabel(seconds: number | null) {
  if (seconds === null) return "Không giới hạn";
  const value = Math.max(0, Math.floor(seconds));
  return String(Math.floor(value / 60)).padStart(2, "0") + ":" + String(value % 60).padStart(2, "0");
}
export function dateLabel(value: string | null, timeOnly = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  const time = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", ...(timeOnly ? { second: "2-digit" as const } : {}) }).format(date);
  if (timeOnly) return time;
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date) + " · " + time;
}
export function statusLabel(status: HistoryItem["status"]) {
  return { CREATED: "Đang chuẩn bị", IN_PROGRESS: "Đang làm", SUBMITTED: "Đã nộp", AUTO_SUBMITTED: "Tự động nộp" }[status];
}
export const isFinished = (status: string) => status === "SUBMITTED" || status === "AUTO_SUBMITTED";
export function answeredSlots(question: StudentQuestion, value: AnswerValue | undefined) {
  if (!value) return 0;
  if ("choices" in value) return Math.min(question.marks, value.choices.length);
  if ("text" in value) return value.text.trim() ? question.marks : 0;
  return value.choice ? question.marks : 0;
}
export function answerLabel(value: unknown): string {
  if (!value || typeof value !== "object") return "Chưa trả lời";
  const record = value as Record<string, unknown>;
  if (typeof record.text === "string") return record.text || "Chưa trả lời";
  if (typeof record.choice === "string") return record.choice.replaceAll("_", " ");
  if (Array.isArray(record.choices)) return record.choices.join(", ");
  if (Array.isArray(record.accepted)) return record.accepted.join(" / ");
  return "—";
}
