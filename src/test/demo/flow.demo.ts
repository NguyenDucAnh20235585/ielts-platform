import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

import postgres from "postgres";
import { afterAll, expect, it } from "vitest";

import type { CurrentUser } from "@/server/auth/current-user";
import { ApiError } from "@/server/http/errors";
import { saveAnswers } from "@/server/services/attempt-answers";
import { beginAttempt, getAttempt, startAttempt } from "@/server/services/attempt-lifecycle";
import { submitAttempt } from "@/server/services/attempt-submit";
import { getTestDetail } from "@/server/services/test-catalogue";

import { createUser, READING_PRACTICE_1 } from "../integration/helpers";

/**
 * Flow demo: start → begin → autosave → submit → result on a real database,
 * printing each request, response and the rows before/after (npm run demo:flow).
 *
 * The services called here are exactly what the Route Handlers call after
 * auth and input parsing; the HTTP status shown is the one the route returns.
 * Prompts and passages are never printed (the remote test may be licensed
 * content); only ids, numbers, types and the answers sent.
 *
 *   DEMO_TEST_ID       test to run (default: seeded Reading Practice 1, 13 questions)
 *   DEMO_MODE          practice | mock (default practice)
 *   DEMO_USER_EMAIL    run as this existing user (required on a remote database)
 *   DEMO_ALLOW_REMOTE  1 = allow a non-local DATABASE_URL. It writes one attempt,
 *                      its answers and one result for DEMO_USER_EMAIL. Ask the lead first.
 *   DEMO_REPORT        also write the report to this Markdown file
 */

const env = process.env;
const url = env.DATABASE_URL ?? "";
const isLocal = /@(127\.0\.0\.1|localhost)[:/]/.test(url);
if (!url) throw new Error("DATABASE_URL is not set (.env.local / .env.test.local).");
if (!isLocal && env.DEMO_ALLOW_REMOTE !== "1") {
  throw new Error("Refusing a non-local database. Set DEMO_ALLOW_REMOTE=1 (with the lead's OK) and DEMO_USER_EMAIL.");
}
const sql = postgres(url, { max: 5, prepare: false, onnotice: () => {}, transform: { undefined: null } });
afterAll(() => sql.end());

const lines: string[] = [];
const out = (line = "") => {
  lines.push(line);
  console.log(line);
};
const block = (value: unknown) => out("```json\n" + JSON.stringify(value, null, 2) + "\n```");
const step = (title: string) => out(`\n## ${title}\n`);

async function call<T>(label: string, okStatus: number, run: () => Promise<T>): Promise<T | ApiError> {
  try {
    const value = await run();
    out(`**${label}** → \`${okStatus}\``);
    return value;
  } catch (error) {
    if (error instanceof ApiError) {
      out(`**${label}** → \`${error.status} ${error.code}\``);
      block(error.toBody());
      return error;
    }
    throw error;
  }
}

async function attemptRow(attemptId: string) {
  const rows = await sql`
    select status, mode, time_limit_seconds, created_at, started_at, expires_at, submitted_at
    from public.attempts where id = ${attemptId}`;
  return rows[0] ?? null;
}

type Plan = "correct" | "correct, other case + full stop" | "wrong" | "blank";

it("flow demo", async () => {
  const testId = env.DEMO_TEST_ID || READING_PRACTICE_1;
  const mode = env.DEMO_MODE === "mock" ? "mock" : "practice";
  const now = () => new Date();

  // Who runs it: an existing user (remote) or a throwaway student (local).
  let user: CurrentUser;
  if (env.DEMO_USER_EMAIL) {
    const rows = await sql<{ id: string; email: string; role: string; created_at: Date }[]>`
      select u.id, u.email, p.role, p.created_at
      from auth.users u join public.profiles p on p.user_id = u.id
      where lower(u.email) = lower(${env.DEMO_USER_EMAIL})`;
    const row = rows[0];
    if (!row) throw new Error(`No user with email ${env.DEMO_USER_EMAIL}.`);
    user = { id: row.id, email: row.email, role: row.role === "admin" ? "ADMIN" : "STUDENT", displayName: null, createdAt: row.created_at };
  } else {
    if (!isLocal) throw new Error("DEMO_USER_EMAIL is required on a remote database.");
    user = await createUser(sql);
  }
  const intruder: CurrentUser = { id: randomUUID(), email: null, role: "STUDENT", displayName: null, createdAt: new Date() };

  out(`# Backend flow demo — ${now().toISOString()}`);
  out();
  out(`- Database: ${isLocal ? "local" : new URL(url.replace(/^postgres(ql)?:/, "http:")).hostname}`);
  out(`- Test: \`${testId}\`, mode ${mode.toUpperCase()}, student \`${user.id}\``);

  step("1. Test detail — GET /api/tests/:testId");
  const detail = await getTestDetail(sql, user, testId, now());
  out("**GET /api/tests/" + testId + "** → `200`");
  block({ id: detail.id, title: detail.title, type: detail.type, question_count: detail.question_count, modes: detail.modes, active_attempt: detail.active_attempt });
  if (detail.active_attempt) {
    out("An unfinished attempt exists for this user; it is submitted first so the demo can start a new one.");
    await submitAttempt(sql, user, detail.active_attempt.attempt_id, undefined, now());
  }

  step("2. Start — POST /api/tests/:testId/attempts");
  out("Request body:");
  block({ mode: mode.toUpperCase() });
  const started = await call("POST /api/tests/:testId/attempts", 201, () => startAttempt(sql, user, testId, mode, now()));
  if (started instanceof ApiError) throw started;
  block(started);
  const attemptId = started.attempt.id;
  out("Row in `attempts` after (before: none):");
  block(await attemptRow(attemptId));

  step("3. Begin — POST /api/attempts/:attemptId/begin");
  const begun = await beginAttempt(sql, user, attemptId, now());
  out("**POST /api/attempts/" + attemptId + "/begin** → `200` (content shortened: no prompts or passages)");
  const questions = (begun.sections ?? []).flatMap((s) => s.question_groups.flatMap((g) => g.questions));
  block({
    attempt: begun.attempt,
    test_version: begun.test_version,
    sections: (begun.sections ?? []).map((s) => ({ id: s.id, order_no: s.order_no, numbers: s.numbers, groups: s.question_groups.length })),
    questions: questions.map((q) => `${q.numbers.join("–")}: ${q.type} / ${q.answer_format}`),
  });
  out("Row in `attempts` after: timer started");
  block(await attemptRow(attemptId));

  // Answers built from the answer keys: a mix of correct, reformatted-correct, wrong and blank.
  const keys = new Map(
    (await sql<{ question_id: string; correct_answer: Record<string, unknown>; grading_config: Record<string, unknown> }[]>`
      select k.question_id, k.correct_answer, k.grading_config
      from public.answer_keys k
      join public.questions q on q.id = k.question_id
      join public.question_groups g on g.id = q.question_group_id
      join public.sections s on s.id = g.section_id
      where s.test_version_id = ${begun.test_version.id}`).map((k) => [k.question_id, k]),
  );
  const plans: Plan[] = ["correct", "wrong", "correct, other case + full stop", "blank"];
  const planned = questions.map((q, i) => {
    const plan = plans[i % plans.length] ?? "blank";
    const key = keys.get(q.id);
    const options = (q.options ?? []).map((o) => o.key);
    let answer: Record<string, unknown> | null = null;
    let expected = 0;
    if (plan !== "blank" && key) {
      if (q.answer_format === "TEXT") {
        const accepted = (key.correct_answer.accepted as string[] | undefined) ?? [];
        const first = accepted[0] ?? "";
        const reformat = plan === "correct, other case + full stop";
        const caseSensitive = key.grading_config.case_sensitive === true;
        const stripPunctuation = key.grading_config.strip_punctuation !== false;
        if (plan === "wrong") answer = { text: "zzzz" };
        else answer = { text: reformat ? `${caseSensitive ? first : first.toUpperCase()}${stripPunctuation ? "." : ""}` : first };
        expected = plan === "wrong" ? 0 : q.marks;
      } else if (q.answer_format === "CHOICE") {
        const right = key.correct_answer.choice as string;
        const other = options.find((o) => o !== right) ?? right;
        answer = { choice: plan === "wrong" ? other : right };
        expected = plan === "wrong" && other !== right ? 0 : q.marks;
      } else {
        const right = (key.correct_answer.choices as string[] | undefined) ?? [];
        const others = options.filter((o) => !right.includes(o)).slice(0, right.length);
        const picked = plan === "wrong" ? others : right;
        answer = { choices: picked };
        expected = picked.filter((c) => right.includes(c)).length;
      }
    }
    const shown: Plan = plan === "correct, other case + full stop" && q.answer_format !== "TEXT" ? "correct" : plan;
    return { q, plan: shown, answer, expected };
  });
  const sent = planned.filter((p) => p.answer !== null);

  step("4. Autosave — PATCH /api/attempts/:attemptId/answers (twice: last write wins)");
  const first = sent[0];
  if (first && first.q.answer_format !== "MULTI_CHOICE") {
    const wrongFirst = first.q.answer_format === "TEXT" ? { text: "draft" } : { choice: (first.q.options ?? []).find((o) => o.key !== (first.answer as { choice: string }).choice)?.key ?? "A" };
    out("First save: question " + first.q.numbers.join("–") + " answered differently (a draft):");
    block({ answers: [{ question_id: first.q.id, answer: wrongFirst }] });
    await call("PATCH /api/attempts/:attemptId/answers", 200, () =>
      saveAnswers(sql, user, attemptId, [{ question_id: first.q.id, answer: wrongFirst }], now()));
    block(await sql`select question_id, answer, saved_at from public.attempt_answers where attempt_id = ${attemptId}`);
  }
  out(`Second save: ${sent.length} answers in one batch (first 3 shown):`);
  block({ answers: sent.slice(0, 3).map((p) => ({ question_id: p.q.id, answer: p.answer })), "…": `${sent.length} items` });
  const saved = await call("PATCH /api/attempts/:attemptId/answers", 200, () =>
    saveAnswers(sql, user, attemptId, sent.map((p) => ({ question_id: p.q.id, answer: p.answer })), now()));
  if (saved instanceof ApiError) throw saved;
  block({ saved_at: saved.saved_at, remaining_seconds: saved.remaining_seconds, answers: `${saved.answers.length} saved` });
  out("`attempt_answers` after — still one row per question; the first one was overwritten:");
  block(await sql`
    select count(*)::int as rows, count(answer)::int as answered,
           count(distinct question_id)::int as distinct_questions
    from public.attempt_answers where attempt_id = ${attemptId}`);
  if (first) block(await sql`select question_id, answer, saved_at from public.attempt_answers where attempt_id = ${attemptId} and question_id = ${first.q.id}`);

  step("5. Requests that must fail");
  await call("GET /api/attempts/:attemptId as ANOTHER user", 200, () => getAttempt(sql, intruder, attemptId, now()));
  const choiceQ = questions.find((q) => q.type === "TRUE_FALSE_NOT_GIVEN" || q.type === "YES_NO_NOT_GIVEN") ?? questions.find((q) => q.answer_format === "CHOICE");
  if (choiceQ) {
    out("A TFNG / choice answer must use the option key (e.g. NOT_GIVEN), not the label:");
    await call("PATCH /api/attempts/:attemptId/answers", 200, () =>
      saveAnswers(sql, user, attemptId, [{ question_id: choiceQ.id, answer: { choice: "NOT GIVEN" } }], now()));
  }

  step("6. Submit — POST /api/attempts/:attemptId/submit, 3 times at the same moment");
  out("`results` before:");
  block(await sql`select count(*)::int as results from public.results where attempt_id = ${attemptId}`);
  const at = now();
  const responses = await Promise.all([1, 2, 3].map(() => submitAttempt(sql, user, attemptId, undefined, at)));
  out("**POST /api/attempts/" + attemptId + "/submit** ×3 → `200` ×3");
  const identical = responses.every((r) => JSON.stringify(r) === JSON.stringify(responses[0]));
  out(`The 3 responses are identical: **${identical ? "yes" : "NO"}**`);
  const result = responses[0];
  if (!result) throw new Error("no response");
  block(result.result);
  out("`results` after — one row:");
  block(await sql`
    select count(*) over ()::int as rows, correct_count, incorrect_count, unanswered_count,
           raw_score::float, max_score::float, band_score::float, time_taken_seconds
    from public.results where attempt_id = ${attemptId}`);
  out("Row in `attempts` after:");
  block(await attemptRow(attemptId));

  step("7. Per question: what was sent, what was scored, what was expected");
  const byId = new Map(result.answers.map((a) => [a.question_id, a]));
  out("| No. | Type | Format | Plan | Answer sent | Score | Expected | |");
  out("|---|---|---|---|---|---|---|---|");
  let mismatches = 0;
  for (const p of planned) {
    const scored = byId.get(p.q.id);
    const score = scored?.score ?? null;
    const ok = score === p.expected;
    if (!ok) mismatches += 1;
    out(`| ${p.q.numbers.join("–")} | ${p.q.type} | ${p.q.answer_format} | ${p.plan} | ${p.answer ? "`" + JSON.stringify(p.answer) + "`" : "—"} | ${score ?? "hidden"} | ${p.expected} | ${ok ? "✅" : "❌"} |`);
  }

  step("8. After submit");
  await call("PATCH /api/attempts/:attemptId/answers (after submit)", 200, () =>
    saveAnswers(sql, user, attemptId, sent.slice(0, 1).map((p) => ({ question_id: p.q.id, answer: p.answer })), now()));
  const again = await submitAttempt(sql, user, attemptId, undefined, now());
  out(`**POST …/submit again** → \`200\`, same result: **${JSON.stringify(again) === JSON.stringify(result) ? "yes" : "NO"}**`);

  step("Summary");
  const expectedCorrect = planned.reduce((sum, p) => sum + p.expected, 0);
  out(`- Questions: ${planned.length}, marks: ${result.result.max_score}`);
  out(`- Expected raw score: ${expectedCorrect}; stored: ${result.result.raw_score}`);
  out(`- Per-question mismatches: ${mismatches}`);
  out(`- Results rows for the attempt: 1; concurrent submits identical: ${identical ? "yes" : "no"}`);
  out(`- **${mismatches === 0 && identical && result.result.raw_score === expectedCorrect ? "PASS" : "FAIL"}**`);

  if (env.DEMO_REPORT) writeFileSync(env.DEMO_REPORT, lines.join("\n") + "\n");

  expect(mismatches).toBe(0);
  expect(identical).toBe(true);
  expect(result.result.raw_score).toBe(expectedCorrect);
});
