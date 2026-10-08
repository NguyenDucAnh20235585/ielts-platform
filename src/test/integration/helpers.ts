import { randomUUID } from "node:crypto";

import postgres from "postgres";

import type { AnswerInput } from "@/server/services/attempt-answers";
import type { CurrentUser } from "@/server/auth/current-user";
import type { Sql } from "@/server/db/types";

/** Seeded tests (supabase/seed.sql). */
export const READING_MOCK_1 = "a0000000-0000-4000-8000-000000000001";
export const READING_PRACTICE_1 = "a0000000-0000-4000-8000-000000000002";

export function testSql(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for integration tests (docs/backend/dev-setup.md).");
  }
  if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    throw new Error("Integration tests only run against a local database.");
  }
  return postgres(url, { max: 4, prepare: false, onnotice: () => {} });
}

/** A fresh auth user; the on_auth_user_created trigger creates its profile. */
export async function createUser(sql: Sql, role: "student" | "admin" = "student"): Promise<CurrentUser> {
  const id = randomUUID();
  const email = `it-${id}@example.test`;
  await sql`insert into auth.users (id, email) values (${id}, ${email})`;
  if (role === "admin") {
    await sql`update public.profiles set role = 'admin' where user_id = ${id}`;
  }
  return { id, email, role: role === "admin" ? "ADMIN" : "STUDENT", displayName: null, createdAt: new Date() };
}

/** Correct answers for every question of a version, built from its answer keys. */
export async function perfectAnswers(sql: Sql, versionId: string): Promise<AnswerInput[]> {
  const rows = await sql<{ question_id: string; answer_format: string; correct_answer: Record<string, unknown> }[]>`
    select q.id as question_id, q.answer_format, k.correct_answer
    from public.questions q
    join public.answer_keys k on k.question_id = q.id
    join public.question_groups g on g.id = q.question_group_id
    join public.sections s on s.id = g.section_id
    where s.test_version_id = ${versionId}
  `;
  return rows.map((row) => {
    if (row.answer_format === "text") {
      const accepted = row.correct_answer.accepted;
      return { question_id: row.question_id, answer: { text: Array.isArray(accepted) ? String(accepted[0]) : "" } };
    }
    return { question_id: row.question_id, answer: row.correct_answer };
  });
}

/** A one-question published Reading test. Only the given mode is enabled. */
export async function createPublishedTest(
  sql: Sql,
  settings: {
    mode: "mock" | "practice";
    timeLimit: number | null;
    maxAttempts: number | null;
    visibility: "never" | "after_submit" | "immediately_in_practice";
  },
): Promise<{ testId: string; versionId: string; questionId: string }> {
  const testId = randomUUID();
  const versionId = randomUUID();
  const sectionId = randomUUID();
  const groupId = randomUUID();
  const questionId = randomUUID();
  const other = settings.mode === "mock" ? "practice" : "mock";
  await sql.begin(async (tx) => {
    await tx`insert into public.tests (id, title, type) values (${testId}, ${`IT test ${testId}`}, 'reading')`;
    await tx`insert into public.test_versions (id, test_id, version_number) values (${versionId}, ${testId}, 1)`;
    await tx`
      insert into public.test_version_modes
        (test_version_id, mode, enabled, time_limit_seconds, max_attempts, answer_visibility, allow_pause, allow_replay, allow_seek)
      values
        (${versionId}, ${settings.mode}, true, ${settings.timeLimit}, ${settings.maxAttempts}, ${settings.visibility}, false, false, false),
        (${versionId}, ${other}, false, 600, null, 'after_submit', false, false, false)
    `;
    await tx`insert into public.sections (id, test_version_id, section_type, position, content) values (${sectionId}, ${versionId}, 'reading', 1, 'Passage')`;
    await tx`insert into public.question_groups (id, section_id, position, instructions) values (${groupId}, ${sectionId}, 1, 'TFNG')`;
    await tx`
      insert into public.questions (id, question_group_id, position, question_type, answer_format, prompt)
      values (${questionId}, ${groupId}, 1, 'true_false_not_given', 'choice', 'Statement')
    `;
    await tx`insert into public.answer_keys (question_id, correct_answer, explanation) values (${questionId}, '{"choice":"TRUE"}', 'Because.')`;
    await tx`update public.test_versions set status = 'published', published_at = now() where id = ${versionId}`;
  });
  return { testId, versionId, questionId };
}

export function secondsAfter(base: Date, seconds: number): Date {
  return new Date(base.getTime() + seconds * 1000);
}

/** All object keys anywhere inside a JSON value. */
export function allKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) allKeys(item, keys);
  } else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      allKeys(child, keys);
    }
  }
  return keys;
}

export async function apiError(promise: Promise<unknown>): Promise<{ code: string; details: unknown }> {
  try {
    await promise;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      return { code: String(error.code), details: "details" in error ? error.details : null };
    }
    throw error;
  }
  throw new Error("Expected the call to fail.");
}
