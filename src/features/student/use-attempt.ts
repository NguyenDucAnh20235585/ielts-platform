"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentApiError, errorText, jsonBody, studentApi } from "./api";
import { useStudent } from "./student-context";
import { isFinished } from "./format";
import type { Answers, AnswerValue, AttemptPayload, ResultPayload, SavePayload, TimerStatus } from "./types";

type SaveState = "saved" | "saving" | "pending" | "offline" | "error";
type Draft = { version: string; owner?: string; answers: Answers; flags: Record<string, boolean> };
const sameAnswer = (a: AnswerValue | undefined, b: AnswerValue | undefined) => JSON.stringify(a) === JSON.stringify(b);
function validAnswer(value: unknown): value is AnswerValue {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.text === "string" || typeof row.choice === "string" || (Array.isArray(row.choices) && row.choices.every((v) => typeof v === "string"));
}
export function useAttempt(attemptId: string) {
  const { user } = useStudent();
  const router = useRouter();
  const storageKey = "ielts:pending:" + user.id + ":" + attemptId;
  const [payload, setPayload] = useState<AttemptPayload | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cacheWarning, setCacheWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [revision, setRevision] = useState(0);
  const mounted = useRef(false);
  const owner = useRef("");
  const dataRef = useRef<AttemptPayload | null>(null);
  const answersRef = useRef<Answers>({});
  const pendingRef = useRef<Answers>({});
  const flagRef = useRef<Record<string, boolean>>({});
  const pendingFlags = useRef<Record<string, boolean>>({});
  const remainingRef = useRef<number | null>(null);
  const clock = useRef<{ expires: number | null; server: number; monotonic: number } | null>(null);
  const savePromise = useRef<Promise<void> | null>(null);
  const submittingRef = useRef(false);
  const autoSubmitted = useRef(false);
  const retryAfter = useRef(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitRef = useRef<(automatic?: boolean) => Promise<void>>(async () => {});
  const persist = useCallback((claim = false) => {
    const current = dataRef.current;
    if (!current) return;
    try {
      const existing = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Draft | null;
      if (!claim && existing?.owner && existing.owner !== owner.current) return;
      if (!mounted.current && !existing) return;
      localStorage.setItem(storageKey, JSON.stringify({ version: current.test_version.id, owner: owner.current, answers: pendingRef.current, flags: pendingFlags.current } satisfies Draft));
    } catch {
      if (mounted.current) setCacheWarning("Trình duyệt chưa thể lưu trên thiết bị. Giữ trang mở để đồng bộ đáp án với hệ thống.");
    }
  }, [storageKey]);
  const updateClock = useCallback((status: TimerStatus) => {
    clock.current = {
      expires: status.expires_at ? new Date(status.expires_at).getTime() : null,
      server: new Date(status.server_time).getTime(),
      monotonic: performance.now(),
    };
    const seconds = status.expires_at === null ? null : Math.max(0, Math.ceil((new Date(status.expires_at).getTime() - new Date(status.server_time).getTime()) / 1000));
    remainingRef.current = seconds;
    if (mounted.current) setRemaining(seconds);
  }, []);
  const finish = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch {}
    pendingRef.current = {};
    pendingFlags.current = {};
    router.replace("/student/attempts/" + attemptId + "/result");
  }, [attemptId, router, storageKey]);
  const flush = useCallback((): Promise<void> => {
    if (savePromise.current) return savePromise.current;
    if (!dataRef.current || isFinished(dataRef.current.attempt.status)) return Promise.resolve();
    if (!Object.keys(pendingRef.current).length && !Object.keys(pendingFlags.current).length) return Promise.resolve();
    if (!navigator.onLine) {
      if (mounted.current) setSaveState("offline");
      return Promise.reject(new StudentApiError("NETWORK_ERROR", 0));
    }
    const work = async () => {
      if (mounted.current) setSaveState("saving");
      try {
        while (Object.keys(pendingRef.current).length) {
          const sent = Object.entries(pendingRef.current).slice(0, 100);
          const saved = await studentApi<SavePayload>("/api/attempts/" + attemptId + "/answers", {
            method: "PATCH", body: jsonBody({ answers: sent.map(([question_id, answer]) => ({ question_id, answer })) }), keepalive: true,
          });
          for (const [id, answer] of sent) {
            if (sameAnswer(pendingRef.current[id], answer)) delete pendingRef.current[id];
          }
          persist();
          if (mounted.current) setSavedAt(saved.saved_at);
        }
        while (Object.keys(pendingFlags.current).length) {
          const [id, flagged] = Object.entries(pendingFlags.current)[0];
          await studentApi<{ question_id: string; flagged: boolean }>("/api/attempts/" + attemptId + "/questions/" + id + "/flag", {
            method: "PATCH", body: jsonBody({ flagged }), keepalive: true,
          });
          if (pendingFlags.current[id] === flagged) delete pendingFlags.current[id];
          persist();
        }
        if (mounted.current) { setSaveState("saved"); setError(null); }
      } catch (err) {
        persist();
        if (mounted.current) {
          setSaveState(navigator.onLine ? "error" : "offline");
          setError(errorText(err));
        }
        throw err;
      }
    };
    savePromise.current = work().finally(() => { savePromise.current = null; });
    return savePromise.current;
  }, [attemptId, persist]);
  const submit = useCallback(async (automatic = false) => {
    if (!dataRef.current || submittingRef.current) return;
    submittingRef.current = true;
    if (mounted.current) { setSubmitting(true); setError(null); }
    try {
      if (!automatic && (remainingRef.current === null || remainingRef.current > 0)) {
        try { await flush(); }
        catch (err) {
          if (!(err instanceof StudentApiError && (err.code === "ATTEMPT_LOCKED" || err.code === "ATTEMPT_EXPIRED"))) throw err;
        }
      }
      const all = Object.entries(answersRef.current);
      const pending = Object.entries(pendingRef.current);
      const final = all.length <= 100 ? all : pending;
      if (final.length > 100) throw new Error("Có quá nhiều đáp án chưa đồng bộ. Vui lòng đồng bộ lại trước khi nộp.");
      await studentApi<ResultPayload>("/api/attempts/" + attemptId + "/submit", {
        method: "POST", body: jsonBody({ answers: final.map(([question_id, answer]) => ({ question_id, answer })) }),
      });
      finish();
    } catch (err) {
      if (mounted.current) { setError(errorText(err)); setSubmitting(false); }
      autoSubmitted.current = false;
      retryAfter.current = Date.now() + 5000;
    } finally { submittingRef.current = false; }
  }, [attemptId, finish, flush]);
  useEffect(() => { submitRef.current = submit; }, [submit]);
  useEffect(() => {
    let active = true;
    mounted.current = true;
    owner.current = globalThis.crypto?.randomUUID?.() ?? Date.now() + "-" + Math.random();
    const controller = new AbortController();
    void studentApi<AttemptPayload>("/api/attempts/" + attemptId, { signal: controller.signal }).then((data) => {
      if (!active) return;
      if (isFinished(data.attempt.status)) { finish(); return; }
      if (data.attempt.status === "CREATED") { router.replace("/student/attempts/" + attemptId + "/prepare"); return; }
      dataRef.current = data;
      const loaded: Answers = {};
      data.answers.forEach((row) => { loaded[row.question_id] = row.answer; });
      const loadedFlags: Record<string, boolean> = {};
      data.flags.forEach((id) => { loadedFlags[id] = true; });
      const ids = new Set(data.sections?.flatMap((section) => section.question_groups.flatMap((group) => group.questions.map((q) => q.id))) ?? []);
      pendingRef.current = {};
      pendingFlags.current = {};
      try {
        const draft = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Draft | null;
        if (draft?.version === data.test_version.id) {
          for (const [id, value] of Object.entries(draft.answers ?? {})) {
            if (ids.has(id) && validAnswer(value)) { loaded[id] = value; pendingRef.current[id] = value; }
          }
          for (const [id, value] of Object.entries(draft.flags ?? {})) {
            if (ids.has(id) && typeof value === "boolean") { loadedFlags[id] = value; pendingFlags.current[id] = value; }
          }
        }
      } catch { setCacheWarning("Không thể khôi phục bản lưu trên thiết bị. Đáp án đã lưu trên hệ thống vẫn được giữ."); }
      answersRef.current = loaded;
      flagRef.current = loadedFlags;
      setAnswers(loaded);
      setFlags(loadedFlags);
      setPayload(data);
      updateClock(data.attempt);
      setSavedAt(data.answers.map((answer) => answer.saved_at).sort().at(-1) ?? null);
      setLoading(false);
      setError(null);
      const dirty = Object.keys(pendingRef.current).length || Object.keys(pendingFlags.current).length;
      persist(true);
      setSaveState(dirty ? navigator.onLine ? "pending" : "offline" : "saved");
      if (remainingRef.current === 0) {
        autoSubmitted.current = true;
        void submitRef.current(true);
      } else if (dirty) void flush().catch(() => {});
    }).catch((err: unknown) => {
      if (active && !(err instanceof DOMException && err.name === "AbortError")) { setError(errorText(err)); setLoading(false); }
    });
    return () => {
      active = false; mounted.current = false; controller.abort();
      if (debounce.current) clearTimeout(debounce.current);
      persist();
    };
  }, [attemptId, storageKey, router, finish, flush, updateClock, persist, revision]);
  useEffect(() => {
    if (!payload) return;
    const tick = window.setInterval(() => {
      const anchor = clock.current;
      if (!anchor || anchor.expires === null) return;
      const seconds = Math.max(0, Math.ceil((anchor.expires - (anchor.server + performance.now() - anchor.monotonic)) / 1000));
      remainingRef.current = seconds;
      setRemaining(seconds);
      if (seconds === 0 && !autoSubmitted.current && !submittingRef.current && navigator.onLine && Date.now() >= retryAfter.current) {
        autoSubmitted.current = true;
        void submitRef.current(true);
      }
    }, 1000);
    const syncStatus = async () => {
      if (submittingRef.current || !navigator.onLine) return;
      if (remainingRef.current === 0) {
        if (!autoSubmitted.current && Date.now() >= retryAfter.current) { autoSubmitted.current = true; void submitRef.current(true); }
        return;
      }
      try {
        const status = await studentApi<TimerStatus>("/api/attempts/" + attemptId + "/status");
        if (!mounted.current) return;
        if (isFinished(status.status)) { finish(); return; }
        updateClock(status);
      } catch {}
    };
    const sync = window.setInterval(() => void syncStatus(), 15000);
    const retry = window.setInterval(() => {
      if (remainingRef.current !== 0 && navigator.onLine && (Object.keys(pendingRef.current).length || Object.keys(pendingFlags.current).length)) void flush().catch(() => {});
    }, 5000);
    const online = () => {
      if (remainingRef.current === 0) { autoSubmitted.current = true; void submitRef.current(true); }
      else { void flush().catch(() => {}); void syncStatus(); }
    };
    const offline = () => setSaveState("offline");
    const visibility = () => {
      if (document.visibilityState === "visible") {
        const anchor = clock.current;
        if (anchor?.expires !== null && anchor?.expires !== undefined) {
          const seconds = Math.max(0, Math.ceil((anchor.expires - (anchor.server + performance.now() - anchor.monotonic)) / 1000));
          remainingRef.current = seconds; setRemaining(seconds);
        }
        online();
      }
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (Object.keys(pendingRef.current).length || Object.keys(pendingFlags.current).length) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(tick); clearInterval(sync); clearInterval(retry);
      window.removeEventListener("online", online); window.removeEventListener("offline", offline);
      window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("visibilitychange", visibility);
    };
  }, [payload, attemptId, finish, flush, updateClock]);
  function scheduleSave() {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void flush().catch(() => {}), 500);
  }
  function changeAnswer(id: string, value: AnswerValue) {
    if (submittingRef.current || remainingRef.current === 0) return;
    answersRef.current = { ...answersRef.current, [id]: value };
    pendingRef.current[id] = value;
    setAnswers(answersRef.current);
    setSaveState(navigator.onLine ? "pending" : "offline");
    setError(null); persist(); scheduleSave();
  }
  function toggleFlag(id: string) {
    if (submittingRef.current || remainingRef.current === 0) return;
    const value = !flagRef.current[id];
    flagRef.current = { ...flagRef.current, [id]: value };
    pendingFlags.current[id] = value;
    setFlags(flagRef.current);
    setSaveState(navigator.onLine ? "pending" : "offline");
    persist(); scheduleSave();
  }
  async function leave() {
    try { await flush(); router.push("/student/history"); }
    catch {
      if (window.confirm("Có đáp án đang chờ đồng bộ trên thiết bị này. Bạn có muốn rời bài và quay lại sau không?")) router.push("/student/history");
    }
  }
  return { payload, answers, flags, remaining, savedAt, saveState, error, cacheWarning, loading, submitting,
    expired: remaining === 0, changeAnswer, toggleFlag, flush, submit, leave, reload: () => setRevision((n) => n + 1) };
}
