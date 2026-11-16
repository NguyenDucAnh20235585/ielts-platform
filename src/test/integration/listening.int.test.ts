import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  answerKeyBody,
  createGroupBody,
  createQuestionBody,
  createSectionBody,
  createTestBody,
} from "@/features/admin/request-schemas";
import { settingsPatchSchema } from "@/features/admin/settings";
import { createGroup, createQuestion, createSection, putAnswerKey } from "@/server/services/admin-content";
import { createAdminTest } from "@/server/services/admin-tests";
import { publishVersion, updateVersionSettings, validateVersion } from "@/server/services/admin-versions";
import { beginAttempt, getAttempt, startAttempt } from "@/server/services/attempt-lifecycle";
import { submitAttempt } from "@/server/services/attempt-submit";

import { allKeys, apiError, createUser, secondsAfter, testSql } from "./helpers";

/**
 * A Listening test from the admin editor to a student's result, on a real
 * database, and what the server does and does not enforce about the audio.
 *
 * Enforced today: the audio URL only reaches the owner of an attempt, the
 * transcript is never sent, and the audio policy of the picked mode is sent
 * with the content.
 *
 * NOT enforced today (see the `todo` tests at the end): "listen once". The
 * URL is a plain bucket URL that does not expire, and the server does not
 * count plays, so the policy is applied by the FE player only.
 */

const sql = testSql();
const MEDIA_BASE = "https://media.example.test";
let previousBase: string | undefined;
beforeAll(() => {
  previousBase = process.env.R2_PUBLIC_BASE_URL;
  process.env.R2_PUBLIC_BASE_URL = MEDIA_BASE;
});
afterAll(async () => {
  if (previousBase === undefined) delete process.env.R2_PUBLIC_BASE_URL;
  else process.env.R2_PUBLIC_BASE_URL = previousBase;
  await sql.end();
});

const T0 = new Date("2026-11-16T08:00:00.000Z");
const AUDIO_KEY = "tests/it-listening/v1/section-1.mp3";

/** Admin flow: a one-part Listening test (form completion, two questions), published with MOCK = play once. */
async function publishListeningTest() {
  const admin = await createUser(sql, "admin");
  const created = await createAdminTest(sql, admin, createTestBody.parse({ title: "IT Listening", type: "LISTENING" }));
  const versionId = created.test_version.id;

  const section = await createSection(sql, versionId, createSectionBody.parse({ title: "Part 1" }));
  const group = await createGroup(sql, section.id, createGroupBody.parse({
    instruction: "Complete the form. Write ONE WORD AND/OR A NUMBER for each answer.",
    rules: { max_words: 1, allow_number: true },
  }));
  const q1 = await createQuestion(sql, group.id, createQuestionBody.parse({ type: "FORM_COMPLETION", content: "Surname" }));
  const q2 = await createQuestion(sql, group.id, createQuestionBody.parse({ type: "FORM_COMPLETION", content: "Room number" }));
  await putAnswerKey(sql, admin, q1.id, answerKeyBody.parse({ correct_answer: { accepted: ["Marlow"] } }));
  await putAnswerKey(sql, admin, q2.id, answerKeyBody.parse({ correct_answer: { accepted: ["14"] } }));

  return { admin, testId: created.test.id, versionId, sectionId: section.id, q1: q1.id, q2: q2.id };
}

describe("Listening: admin side", () => {
  it("cannot be published without audio; with audio it publishes with the 'not verified' warning", async () => {
    const t = await publishListeningTest();
    const missing = await validateVersion(sql, t.versionId);
    expect(missing.errors.map((e) => e.code)).toEqual(["MISSING_AUDIO"]);
    expect((await apiError(publishVersion(sql, t.admin, t.versionId, T0))).code).toBe("VALIDATION_FAILED");

    // A transcript is not accepted for Listening in Prototype 1; the audio key is.
    const transcript = createSectionBody.parse({ content: "Transcript" });
    expect((await apiError(createSection(sql, t.versionId, transcript))).code).toBe("VALIDATION_ERROR");
    await sql`update public.sections set audio_object_key = ${AUDIO_KEY} where id = ${t.sectionId}`;

    const report = await validateVersion(sql, t.versionId);
    expect(report.valid).toBe(true);
    expect(report.warnings.map((w) => w.code)).toEqual(["AUDIO_NOT_VERIFIED", "BAND_NOT_AVAILABLE"]);
    await expect(publishVersion(sql, t.admin, t.versionId, T0)).resolves.toMatchObject({ status: "PUBLISHED" });
  });
});

describe("Listening: student side", () => {
  async function published() {
    const t = await publishListeningTest();
    await sql`update public.sections set audio_object_key = ${AUDIO_KEY} where id = ${t.sectionId}`;
    await updateVersionSettings(sql, t.admin, t.versionId, settingsPatchSchema.parse({ mock: { duration_seconds: 600 } }));
    await publishVersion(sql, t.admin, t.versionId, T0);
    return t;
  }
  const audio = { url: `${MEDIA_BASE}/${AUDIO_KEY}`, expires_at: null };

  it("start returns the audio to buffer; the content and the timer wait for begin", async () => {
    const t = await published();
    const student = await createUser(sql);
    const started = await startAttempt(sql, student, t.testId, "mock", T0);
    expect(started.attempt).toMatchObject({ status: "CREATED", started_at: null, expires_at: null });
    expect(started.preload).toEqual({ audio: [{ section_id: t.sectionId, ...audio }] });

    const created = await getAttempt(sql, student, started.attempt.id, T0);
    expect(created).toMatchObject({ sections: null, preload: started.preload });

    const begun = await beginAttempt(sql, student, started.attempt.id, secondsAfter(T0, 30));
    expect(begun.attempt).toMatchObject({ status: "IN_PROGRESS", remaining_seconds: 600 });
    expect(begun.preload).toBeNull();
    // The MOCK audio policy travels with the content; the transcript and the object key do not.
    expect(begun.test_version).toMatchObject({
      type: "LISTENING",
      mode: "MOCK",
      settings: { allow_pause: false, allow_replay: false, allow_seek: false, max_plays: 1 },
    });
    expect(begun.sections?.[0]).toMatchObject({ id: t.sectionId, content: null, audio });
    expect(allKeys(begun).has("audio_object_key")).toBe(false);
    for (const field of ["correct_answer", "accepted", "explanation"]) expect(allKeys(begun).has(field)).toBe(false);
  });

  it("grades the answers and never hands the audio to another user", async () => {
    const t = await published();
    const student = await createUser(sql);
    const other = await createUser(sql);
    const { attempt } = await startAttempt(sql, student, t.testId, "mock", T0);
    await beginAttempt(sql, student, attempt.id, T0);

    for (const call of [
      () => getAttempt(sql, other, attempt.id, T0),
      () => beginAttempt(sql, other, attempt.id, T0),
    ]) {
      expect((await apiError(call())).code).toBe("ATTEMPT_NOT_FOUND");
    }

    const result = await submitAttempt(
      sql, student, attempt.id,
      [{ question_id: t.q1, answer: { text: "marlow" } }, { question_id: t.q2, answer: { text: "41" } }],
      secondsAfter(T0, 300),
    );
    expect(result.result).toMatchObject({ status: "SUBMITTED", raw_score: 1, max_score: 2, band_score: null });
    expect(result.answers.map((a) => a.is_correct)).toEqual([true, false]);
  });

  it("sends no audio URL when media is not configured", async () => {
    const t = await published();
    const student = await createUser(sql);
    delete process.env.R2_PUBLIC_BASE_URL;
    try {
      const started = await startAttempt(sql, student, t.testId, "mock", T0);
      expect(started.preload).toEqual({ audio: [] });
      const begun = await beginAttempt(sql, student, started.attempt.id, T0);
      expect(begun.sections?.[0]?.audio).toBeNull();
    } finally {
      process.env.R2_PUBLIC_BASE_URL = MEDIA_BASE;
    }
  });

  // Not implemented: both need decisions outside the backend code (docs/backend/open-issues.md).
  it.todo("refuses another audio URL once max_plays is used up (needs play tracking in the database, CR-15)");
  it.todo("audio URLs expire with the attempt (needs a private bucket and signed URLs, OI-11)");
});
