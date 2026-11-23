import { afterAll, describe, expect, it } from "vitest";

import { saveAnswers, setFlag } from "@/backend/services/attempt-answers";
import { beginAttempt, getAttempt, getAttemptStatus, startAttempt } from "@/backend/services/attempt-lifecycle";
import { getResult, listHistory } from "@/backend/services/attempt-results";
import { submitAttempt } from "@/backend/services/attempt-submit";
import { getActiveAttemptForTest, getTestDetail, listTests } from "@/backend/services/test-catalogue";

import { apiError, createPublishedTest, createUser, testSql } from "./helpers";

/**
 * Who may open a test and whose attempt is whose, called the way a user
 * calling the API directly would (no FE), on a real database (D-011, D-017).
 */

const sql = testSql();
afterAll(() => sql.end());

const T0 = new Date("2026-11-16T09:00:00.000Z");
const page = { page: 1, limit: 100 };

async function publishedWithAccess(accessType: "public" | "private" | "assigned") {
  const test = await createPublishedTest(sql, { mode: "practice", timeLimit: null, maxAttempts: null, visibility: "after_submit" });
  await sql`update public.tests set access_type = ${accessType} where id = ${test.testId}`;
  return test;
}

async function attemptCount(testId: string) {
  const rows = await sql<{ count: number }[]>`select count(*)::int as count from public.attempts where test_id = ${testId}`;
  return rows[0]?.count ?? 0;
}

describe("test access: PUBLIC / PRIVATE / ASSIGNED (D-017)", () => {
  for (const accessType of ["private", "assigned"] as const) {
    it(`a student cannot list, open or start a ${accessType.toUpperCase()} test by calling the API directly`, async () => {
      const test = await publishedWithAccess(accessType);
      const student = await createUser(sql);

      const list = await listTests(sql, student, page, T0);
      expect(list.items.map((t) => t.id)).not.toContain(test.testId);
      expect((await apiError(getTestDetail(sql, student, test.testId, T0))).code).toBe("ACCESS_DENIED");
      expect((await apiError(startAttempt(sql, student, test.testId, "practice", T0))).code).toBe("ACCESS_DENIED");
      expect(await attemptCount(test.testId)).toBe(0);
    });
  }

  it("access is checked before the mode, so a closed test reveals nothing about its settings", async () => {
    const test = await publishedWithAccess("private");
    const student = await createUser(sql);
    // MOCK is disabled on this test: an open test would answer MODE_NOT_AVAILABLE.
    expect((await apiError(startAttempt(sql, student, test.testId, "mock", T0))).code).toBe("ACCESS_DENIED");
  });

  it("admins can open and start any test (to check what students get)", async () => {
    const test = await publishedWithAccess("private");
    const admin = await createUser(sql, "admin");
    expect((await listTests(sql, admin, page, T0)).items.map((t) => t.id)).toContain(test.testId);
    await expect(getTestDetail(sql, admin, test.testId, T0)).resolves.toMatchObject({ id: test.testId, access_type: "PRIVATE" });
    await expect(startAttempt(sql, admin, test.testId, "practice", T0)).resolves.toMatchObject({ attempt: { status: "CREATED" } });
  });

  it("a PUBLIC test is open to every student", async () => {
    const test = await publishedWithAccess("public");
    const student = await createUser(sql);
    expect((await listTests(sql, student, page, T0)).items.map((t) => t.id)).toContain(test.testId);
    await expect(startAttempt(sql, student, test.testId, "practice", T0)).resolves.toMatchObject({ attempt: { status: "CREATED" } });
  });

  it("an attempt started before the test was closed can still be finished by its owner", async () => {
    const test = await publishedWithAccess("public");
    const student = await createUser(sql);
    const { attempt } = await startAttempt(sql, student, test.testId, "practice", T0);
    await beginAttempt(sql, student, attempt.id, T0);
    await sql`update public.tests set access_type = 'private' where id = ${test.testId}`;

    await saveAnswers(sql, student, attempt.id, [{ question_id: test.questionId, answer: { choice: "TRUE" } }], T0);
    await expect(submitAttempt(sql, student, attempt.id, undefined, T0)).resolves.toMatchObject({ result: { correct_count: 1 } });
    // …but no new attempt.
    expect((await apiError(startAttempt(sql, student, test.testId, "practice", T0))).code).toBe("ACCESS_DENIED");
  });
});

describe("ownership: another user's attempt is invisible (D-011)", () => {
  it("every attempt endpoint answers 404 to another user and changes nothing", async () => {
    const test = await publishedWithAccess("public");
    const owner = await createUser(sql);
    const intruder = await createUser(sql);
    const { attempt } = await startAttempt(sql, owner, test.testId, "practice", T0);
    const answer = [{ question_id: test.questionId, answer: { choice: "FALSE" } }];

    const calls: [string, () => Promise<unknown>][] = [
      ["begin", () => beginAttempt(sql, intruder, attempt.id, T0)],
      ["get", () => getAttempt(sql, intruder, attempt.id, T0)],
      ["status", () => getAttemptStatus(sql, intruder, attempt.id, T0)],
      ["autosave", () => saveAnswers(sql, intruder, attempt.id, answer, T0)],
      ["flag", () => setFlag(sql, intruder, attempt.id, test.questionId, true, T0)],
      ["submit", () => submitAttempt(sql, intruder, attempt.id, answer, T0)],
      ["result", () => getResult(sql, intruder, attempt.id, T0)],
    ];
    for (const [name, call] of calls) {
      expect([name, (await apiError(call())).code]).toEqual([name, "ATTEMPT_NOT_FOUND"]);
    }

    // Still CREATED, nothing written, nothing graded.
    const rows = await sql<{ status: string; answers: number; results: number }[]>`
      select a.status,
             (select count(*)::int from public.attempt_answers x where x.attempt_id = a.id) as answers,
             (select count(*)::int from public.results r where r.attempt_id = a.id) as results
      from public.attempts a where a.id = ${attempt.id}
    `;
    expect(rows[0]).toEqual({ status: "created", answers: 0, results: 0 });

    expect((await listHistory(sql, intruder, page, T0)).items).toEqual([]);
    expect((await getActiveAttemptForTest(sql, intruder, test.testId, T0)).active_attempt).toBeNull();
  });
});
