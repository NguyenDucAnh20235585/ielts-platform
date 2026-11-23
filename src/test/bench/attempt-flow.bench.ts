import postgres from "postgres";
import { afterAll, it } from "vitest";

import { saveAnswers } from "@/backend/services/attempt-answers";
import { beginAttempt, getAttempt, startAttempt } from "@/backend/services/attempt-lifecycle";
import { getResult } from "@/backend/services/attempt-results";
import { submitAttempt } from "@/backend/services/attempt-submit";
import { getTestDetail, listTests } from "@/backend/services/test-catalogue";

import { createUser, perfectAnswers, READING_MOCK_1 } from "../integration/helpers";

/**
 * Wall-clock time and database statements of each student request on the
 * 40-mark Reading Mock 1 (npm run bench:flow). Point DATABASE_URL at a
 * latency proxy to see the effect of a remote database: with prepare:false
 * a statement with parameters costs two network round trips, BEGIN and
 * COMMIT one each, and statements sent in parallel on the pool overlap.
 */

const url = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  throw new Error("The benchmark only runs against a local database (or a local latency proxy).");
}
let statements = 0;
// Same settings as the app (src/server/db/client.ts), plus a statement counter.
const sql = postgres(url, {
  max: 5,
  prepare: false,
  onnotice: () => {},
  transform: { undefined: null },
  debug: () => {
    statements += 1;
  },
});
afterAll(() => sql.end());

const RUNS = Number(process.env.BENCH_RUNS ?? 5);

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

it("attempt flow latency", async () => {
  const timings = new Map<string, number[]>();
  const counts = new Map<string, number>();
  const time = async <T>(label: string, run: () => Promise<T>): Promise<T> => {
    const before = statements;
    const startedAt = performance.now();
    const value = await run();
    const list = timings.get(label) ?? [];
    list.push(performance.now() - startedAt);
    timings.set(label, list);
    counts.set(label, statements - before);
    return value;
  };

  for (let run = 0; run < RUNS; run += 1) {
    const user = await createUser(sql);
    const now = new Date();
    await time("GET /api/tests", () => listTests(sql, user, { page: 1, limit: 20 }, now));
    await time("GET /api/tests/:id", () => getTestDetail(sql, user, READING_MOCK_1, now));
    const { attempt } = await time("POST start", () => startAttempt(sql, user, READING_MOCK_1, "practice", now));
    const begun = await time("POST begin (content)", () => beginAttempt(sql, user, attempt.id, now));
    await time("GET attempt (reload)", () => getAttempt(sql, user, attempt.id, now));
    const answers = await perfectAnswers(sql, begun.test_version.id);
    await time("PATCH answers ×1", () => saveAnswers(sql, user, attempt.id, answers.slice(0, 1), now));
    await time(`PATCH answers ×${answers.length}`, () => saveAnswers(sql, user, attempt.id, answers, now));
    await time("POST submit (grade 40)", () => submitAttempt(sql, user, attempt.id, undefined, now));
    await time("GET result", () => getResult(sql, user, attempt.id, now));
  }

  const rows = [...timings].map(
    ([label, values]) => `| ${label} | ${median(values).toFixed(1)} | ${counts.get(label) ?? 0} |`,
  );
  console.log(["", `| Request (median of ${RUNS}) | ms | statements |`, "|---|---|---|", ...rows, ""].join("\n"));
});
