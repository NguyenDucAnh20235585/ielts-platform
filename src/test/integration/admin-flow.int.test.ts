import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import {
  answerKeyBody,
  createGroupBody,
  createQuestionBody,
  createSectionBody,
  createTestBody,
  updateGroupBody,
  updateQuestionBody,
  updateSectionBody,
  updateTestBody,
} from "@/features/admin/request-schemas";
import { settingsPatchSchema } from "@/features/admin/settings";
import type { CurrentUser } from "@/server/auth/current-user";
import {
  createGroup,
  createQuestion,
  createSection,
  deleteGroup,
  deleteQuestion,
  deleteSection,
  putAnswerKey,
  updateGroup,
  updateQuestion,
  updateSection,
} from "@/server/services/admin-content";
import { archiveTest, createAdminTest, getAdminTest, listAdminTests, updateAdminTest } from "@/server/services/admin-tests";
import {
  getVersionEditor,
  previewVersion,
  publishVersion,
  updateVersionSettings,
  validateVersion,
} from "@/server/services/admin-versions";
import { startAttempt } from "@/server/services/attempt-lifecycle";

import { allKeys, apiError, createUser, testSql } from "./helpers";

const sql = testSql();
afterAll(() => sql.end());

const NOW = new Date();
const READING_MOCK_1_VERSION = "a0000000-0000-4000-8000-000000000011";
const KEY_FIELDS = ["answer_key", "correct_answer", "accepted", "grading_config", "explanation"];

async function newDraft(admin: CurrentUser, mode: "PRACTICE" | "MOCK" = "PRACTICE") {
  const title = `IT admin ${randomUUID()}`;
  const created = await createAdminTest(sql, admin, createTestBody.parse({ title, type: "READING", mode }));
  return { title, testId: created.test.id, versionId: created.test_version.id, created };
}

/** One section, one TFNG question with its key: the smallest publishable Reading version. */
async function addMinimalContent(admin: CurrentUser, versionId: string) {
  const section = await createSection(sql, versionId, createSectionBody.parse({ content: "Passage" }));
  const group = await createGroup(sql, section.id, createGroupBody.parse({ instruction: "TFNG" }));
  const question = await createQuestion(sql, group.id, createQuestionBody.parse({ type: "TRUE_FALSE_NOT_GIVEN", content: "Statement" }));
  await putAnswerKey(sql, admin, question.id, answerKeyBody.parse({ correct_answer: { choice: "TRUE" } }));
  return { sectionId: section.id, groupId: group.id, questionId: question.id };
}

async function auditActions(resourceId: string): Promise<string[]> {
  const rows = await sql<{ action: string }[]>`
    select action from public.audit_logs where resource_id = ${resourceId} order by created_at, id
  `;
  return rows.map((row) => row.action);
}

const errorCodes = (report: { errors: { code: string }[] }) => report.errors.map((e) => e.code);

describe("tests and versions (W2-01)", () => {
  it("creates a DRAFT test with version 1 and the default settings", async () => {
    const admin = await createUser(sql, "admin");
    const { title, testId, versionId, created } = await newDraft(admin);
    expect(created.test).toMatchObject({ title, type: "READING", status: "DRAFT", access_type: "PUBLIC", current_version: null });
    expect(created.test.draft_version).toMatchObject({ id: versionId, version_number: 1, status: "DRAFT", mode: "PRACTICE", attempt_count: 0 });

    const editor = await getVersionEditor(sql, versionId);
    expect(editor).toMatchObject({
      test: { id: testId, type: "READING", status: "DRAFT" },
      settings: { mode: "PRACTICE", duration_seconds: null, answer_visibility: "IMMEDIATELY_IN_PRACTICE", allow_pause: true, max_plays: null },
      band_conversion: { source: "DEFAULT" },
      sections: [],
    });
    expect(editor.band_conversion.ranges).toHaveLength(17);

    const listed = await listAdminTests(sql, { search: title, page: 1, limit: 20 });
    expect(listed.items.map((t) => t.id)).toEqual([testId]);
    expect((await listAdminTests(sql, { search: title, status: "published", page: 1, limit: 20 })).items).toEqual([]);
    expect(await auditActions(testId)).toEqual(["test.create"]);

    const mock = await createAdminTest(sql, admin, createTestBody.parse({ title: "IT mock listening", type: "LISTENING", mode: "MOCK" }));
    expect(mock.test_version).toMatchObject({ mode: "MOCK", duration_seconds: 1920 });
    const tooShort = createTestBody.parse({ title: "x", type: "READING", mode: "MOCK", duration_seconds: 30 });
    expect((await apiError(createAdminTest(sql, admin, tooShort))).code).toBe("INVALID_SETTINGS");
  });

  it("edits metadata at any time, the type only before publishing and while there are no sections", async () => {
    const admin = await createUser(sql, "admin");
    const { testId, versionId } = await newDraft(admin);
    await expect(updateAdminTest(sql, testId, updateTestBody.parse({ title: "Renamed", description: "About glass" })))
      .resolves.toMatchObject({ title: "Renamed", description: "About glass" });
    await expect(updateAdminTest(sql, testId, updateTestBody.parse({ type: "LISTENING" }))).resolves.toMatchObject({ type: "LISTENING" });
    await updateAdminTest(sql, testId, updateTestBody.parse({ type: "READING" }));

    await createSection(sql, versionId, createSectionBody.parse({ content: "Passage" }));
    expect((await apiError(updateAdminTest(sql, testId, updateTestBody.parse({ type: "LISTENING" })))).code).toBe("NOT_EDITABLE");
    expect((await apiError(updateAdminTest(sql, randomUUID(), {}))).code).toBe("TEST_NOT_FOUND");
  });

  it("changes settings of a draft only when the result is valid (audited)", async () => {
    const admin = await createUser(sql, "admin");
    const { versionId } = await newDraft(admin);
    const toMock = await apiError(updateVersionSettings(sql, admin, versionId, settingsPatchSchema.parse({ mode: "MOCK" })));
    expect(toMock.code).toBe("INVALID_SETTINGS");

    const patch = settingsPatchSchema.parse({ mode: "MOCK", duration_seconds: 2400, answer_visibility: "AFTER_SUBMIT", max_attempts: 2 });
    await expect(updateVersionSettings(sql, admin, versionId, patch)).resolves.toEqual({
      id: versionId,
      status: "DRAFT",
      settings: {
        mode: "MOCK", duration_seconds: 2400, max_attempts: 2, answer_visibility: "AFTER_SUBMIT",
        allow_pause: true, allow_replay: true, allow_seek: true, max_plays: null,
      },
    });
    expect(await auditActions(versionId)).toEqual(["test_version.settings_update"]);
    expect((await apiError(updateVersionSettings(sql, admin, randomUUID(), {}))).code).toBe("VERSION_NOT_FOUND");
  });
});

describe("content editing → validate → publish (W2-02, W2-03)", () => {
  it("builds a Reading test, keys it, validates it and publishes it", async () => {
    const admin = await createUser(sql, "admin");
    const { testId, versionId } = await newDraft(admin);

    // An empty version cannot be published.
    expect(errorCodes(await validateVersion(sql, versionId))).toEqual(["NO_SECTIONS"]);
    const blocked = await apiError(publishVersion(sql, admin, versionId, NOW));
    expect(blocked.code).toBe("VALIDATION_FAILED");
    expect(blocked.details).toMatchObject({ valid: false, errors: [{ code: "NO_SECTIONS" }] });

    // Section and groups
    const section = await createSection(
      sql, versionId, createSectionBody.parse({ title: "Passage 1", instruction: "Spend 20 minutes", content: "**A** Glass…" }),
    );
    expect(section).toMatchObject({ order_no: 1, title: "Passage 1", instruction: "Spend 20 minutes", audio_object_key: null, question_groups: [] });
    expect((await apiError(createSection(sql, versionId, createSectionBody.parse({ audio_object_key: "tests/x.mp3" })))).code).toBe("VALIDATION_ERROR");

    const tfng = await createGroup(sql, section.id, createGroupBody.parse({ instruction: "TRUE / FALSE / NOT GIVEN" }));
    const q1 = await createQuestion(sql, tfng.id, createQuestionBody.parse({ type: "TRUE_FALSE_NOT_GIVEN", content: "Glass is old." }));
    expect(q1).toMatchObject({ numbers: [1], marks: 1, answer_format: "CHOICE", display_number: null, answer_key: null });
    expect(q1.options?.map((o) => o.key)).toEqual(["TRUE", "FALSE", "NOT_GIVEN"]);
    const q2 = await createQuestion(sql, tfng.id, createQuestionBody.parse({ type: "TRUE_FALSE_NOT_GIVEN", content: "Glass is new." }));

    const notes = await createGroup(sql, section.id, createGroupBody.parse({
      instruction: "Complete the notes. Write NO MORE THAN TWO WORDS AND/OR A NUMBER.",
      content: "Glass was first made in {{gap:3}}.",
      rules: { max_words: 2, allow_number: true },
    }));
    const q3 = await createQuestion(sql, notes.id, createQuestionBody.parse({ type: "NOTE_COMPLETION", content: "Place" }));
    expect(q3).toMatchObject({ numbers: [3], answer_format: "TEXT", options: null, config: { max_words: 2, allow_number: true } });

    const mcq = await createGroup(sql, section.id, createGroupBody.parse({ instruction: "Choose TWO letters, A–E." }));
    const letters = ["A", "B", "C", "D", "E"].map((key) => ({ key, text: `Option ${key}` }));
    const q4 = await createQuestion(sql, mcq.id, createQuestionBody.parse({
      type: "MCQ_MULTI", content: "Which TWO are true?", options: letters, config: { select_count: 2 },
    }));
    expect(q4).toMatchObject({ numbers: [4, 5], marks: 2, answer_format: "MULTI_CHOICE" });

    // Invalid questions
    const bad = async (body: unknown) => (await apiError(createQuestion(sql, mcq.id, createQuestionBody.parse(body)))).code;
    expect(await bad({ type: "ESSAY", content: "x" })).toBe("INVALID_QUESTION_TYPE");
    expect(await bad({ type: "NOTE_COMPLETION", answer_format: "CHOICE", content: "x" })).toBe("INVALID_QUESTION_TYPE");
    expect(await bad({ type: "MCQ_MULTI", content: "x", options: letters })).toBe("VALIDATION_ERROR");
    expect(await bad({ type: "MATCHING_HEADINGS", content: "x", options: letters })).toBe("VALIDATION_ERROR");
    expect(createGroupBody.safeParse({ instruction: "x", options: [{ key: "A", text: "a" }, { key: "A", text: "b" }] }).success).toBe(false);

    // Inserting at the top shifts the others; deleting closes the gap.
    const q0 = await createQuestion(sql, tfng.id, createQuestionBody.parse({ type: "TRUE_FALSE_NOT_GIVEN", content: "First", order_no: 1 }));
    const numbering = async () => {
      const editor = await getVersionEditor(sql, versionId);
      return editor.sections.flatMap((s) => s.question_groups.flatMap((g) => g.questions.map((q) => [q.order_no, q.numbers])));
    };
    expect(q0).toMatchObject({ order_no: 1, numbers: [1] });
    expect(await numbering()).toEqual([[1, [1]], [2, [2]], [3, [3]], [1, [4]], [1, [5, 6]]]);
    await expect(deleteQuestion(sql, q0.id)).resolves.toEqual({ success: true });
    expect(await numbering()).toEqual([[1, [1]], [2, [2]], [1, [3]], [1, [4, 5]]]);

    // Answer keys
    const key = (questionId: string, body: unknown) => putAnswerKey(sql, admin, questionId, answerKeyBody.parse(body));
    expect((await apiError(key(q1.id, { correct_answer: { choice: "MAYBE" } }))).code).toBe("INVALID_ANSWER_KEY");
    expect((await apiError(key(q3.id, { correct_answer: { accepted: ["three whole words"] } }))).code).toBe("INVALID_ANSWER_KEY");
    expect((await apiError(key(q4.id, { correct_answer: { choices: ["A"] } }))).code).toBe("INVALID_ANSWER_KEY");
    await expect(key(q1.id, { correct_answer: { choice: "TRUE" }, explanation: "Paragraph A." })).resolves.toMatchObject({
      question_id: q1.id, correct_answer: { choice: "TRUE" }, grading_config: {}, explanation: "Paragraph A.",
    });
    await key(q2.id, { correct_answer: { choice: "FALSE" } });
    await expect(key(q3.id, { correct_answer: { accepted: ["Syria", "1,500 BC"] }, grading_config: { case_sensitive: false } }))
      .resolves.toMatchObject({ grading_config: { case_sensitive: false, strip_punctuation: true } });
    await key(q4.id, { correct_answer: { choices: ["B", "D"] } });
    await key(q2.id, { correct_answer: { choice: "NOT_GIVEN" } }); // replace
    expect(await auditActions(q2.id)).toEqual(["answer_key.update", "answer_key.update"]);
    const replaced = await sql<{ metadata: { before: { correct_answer: unknown } | null } }[]>`
      select metadata from public.audit_logs where resource_id = ${q2.id} order by created_at desc, id limit 1
    `;
    expect(replaced[0]?.metadata.before?.correct_answer).toEqual({ choice: "FALSE" });

    let report = await validateVersion(sql, versionId);
    expect(report).toMatchObject({ valid: true, errors: [] });
    expect(report.warnings.map((w) => w.code)).toEqual(["BAND_NOT_AVAILABLE"]);

    // Editing a question keeps a key that still fits, drops one that does not.
    await expect(updateQuestion(sql, admin, q1.id, updateQuestionBody.parse({ content: "Glass is ancient." })))
      .resolves.toMatchObject({ content: "Glass is ancient.", answer_key: { correct_answer: { choice: "TRUE" } } });
    const retyped = await updateQuestion(sql, admin, q2.id, updateQuestionBody.parse({ type: "MATCHING_HEADINGS" }));
    expect(retyped).toMatchObject({ type: "MATCHING_HEADINGS", answer_format: "CHOICE", options: null, answer_key: null });
    expect(await auditActions(q2.id)).toEqual(["answer_key.update", "answer_key.update", "answer_key.delete"]);
    report = await validateVersion(sql, versionId);
    expect(errorCodes(report)).toEqual(["MISSING_OPTIONS", "MISSING_ANSWER_KEY"]);
    expect(report.errors[0]).toMatchObject({ question_id: q2.id, numbers: [2], message: "Question 2 has no options to choose from." });
    await updateGroup(sql, tfng.id, updateGroupBody.parse({ options: [{ key: "i", text: "Heading i" }, { key: "ii", text: "Heading ii" }] }));
    await updateQuestion(sql, admin, q1.id, updateQuestionBody.parse({ type: "MATCHING_HEADINGS" }));
    await key(q1.id, { correct_answer: { choice: "ii" } });
    await key(q2.id, { correct_answer: { choice: "i" } });
    await updateSection(sql, section.id, updateSectionBody.parse({ title: "Reading Passage 1" }));
    expect((await validateVersion(sql, versionId)).valid).toBe(true);

    // The preview is the student view: no answer keys anywhere.
    const preview = await previewVersion(sql, versionId);
    expect(preview.test_version.question_count).toBe(5);
    for (const field of KEY_FIELDS) expect(allKeys(preview).has(field)).toBe(false);

    // Publish
    const published = await publishVersion(sql, admin, versionId, NOW);
    expect(published).toEqual({ status: "PUBLISHED", version_id: versionId, test_id: testId, published_at: NOW.toISOString() });
    const detail = await getAdminTest(sql, testId);
    expect(detail.test).toMatchObject({ status: "PUBLISHED", current_version: { id: versionId, status: "PUBLISHED" }, draft_version: null });
    expect(await auditActions(versionId)).toEqual(["test_version.publish"]);
    expect((await apiError(publishVersion(sql, admin, versionId, NOW))).code).toBe("ALREADY_PUBLISHED");

    // A published version is read-only.
    for (const call of [
      () => createSection(sql, versionId, {}),
      () => updateSection(sql, section.id, { title: "x" }),
      () => deleteGroup(sql, mcq.id),
      () => key(q1.id, { correct_answer: { choice: "i" } }),
      () => updateVersionSettings(sql, admin, versionId, { allow_pause: false }),
    ]) {
      expect((await apiError(call())).code).toBe("NOT_DRAFT");
    }
    expect((await apiError(updateAdminTest(sql, testId, updateTestBody.parse({ type: "LISTENING" })))).code).toBe("NOT_EDITABLE");

    // Students can take it now.
    const student = await createUser(sql);
    await expect(startAttempt(sql, student, testId, NOW)).resolves.toMatchObject({ attempt: { status: "CREATED", test_version_id: versionId } });
  });

  it("publishing a new draft archives the previous version; archiving the test is terminal", async () => {
    const admin = await createUser(sql, "admin");
    const { testId, versionId: v1 } = await newDraft(admin);
    await addMinimalContent(admin, v1);
    await publishVersion(sql, admin, v1, NOW);

    // POST …/versions is P2, so version 2 is created directly in the database here.
    const inserted = await sql<{ id: string }[]>`
      insert into public.test_versions (test_id, version_number, mode, answer_visibility)
      values (${testId}, 2, 'practice', 'immediately_in_practice')
      returning id
    `;
    const v2 = inserted[0]?.id ?? "";
    await addMinimalContent(admin, v2);
    await publishVersion(sql, admin, v2, NOW);

    const detail = await getAdminTest(sql, testId);
    expect(detail.versions.map((v) => [v.version_number, v.status])).toEqual([[2, "PUBLISHED"], [1, "ARCHIVED"]]);
    expect(detail.test.current_version?.id).toBe(v2);
    expect((await apiError(publishVersion(sql, admin, v1, NOW))).code).toBe("INVALID_STATUS_TRANSITION");

    // Re-publishing after an unpublish (P2 endpoint, simulated here) keeps the original published_at.
    await sql`update public.tests set status = 'draft' where id = ${testId}`;
    const republished = await publishVersion(sql, admin, v2, new Date(NOW.getTime() + 60_000));
    expect(republished.published_at).toBe(NOW.toISOString());

    await expect(archiveTest(sql, admin, testId)).resolves.toEqual({ status: "ARCHIVED" });
    expect((await apiError(archiveTest(sql, admin, testId))).code).toBe("ALREADY_ARCHIVED");
    expect((await apiError(publishVersion(sql, admin, v2, NOW))).code).toBe("TEST_ARCHIVED");
    await expect(updateAdminTest(sql, testId, { title: "Archived test" })).resolves.toMatchObject({ status: "ARCHIVED", title: "Archived test" });
    expect(await auditActions(testId)).toEqual(["test.create", "test.archive"]);
  });

  it("keeps positions contiguous when sections and groups are inserted or deleted", async () => {
    const admin = await createUser(sql, "admin");
    const { versionId } = await newDraft(admin);
    const a = await createSection(sql, versionId, createSectionBody.parse({ title: "A", content: "a" }));
    await createSection(sql, versionId, createSectionBody.parse({ title: "B", content: "b" }));
    await createSection(sql, versionId, createSectionBody.parse({ title: "C", content: "c", order_no: 1 }));
    await createSection(sql, versionId, createSectionBody.parse({ title: "D", content: "d", order_no: 99 }));
    const order = async () => (await getVersionEditor(sql, versionId)).sections.map((s) => [s.order_no, s.title]);
    expect(await order()).toEqual([[1, "C"], [2, "A"], [3, "B"], [4, "D"]]);

    const g = await createGroup(sql, a.id, createGroupBody.parse({ instruction: "TFNG" }));
    await createQuestion(sql, g.id, createQuestionBody.parse({ type: "TRUE_FALSE_NOT_GIVEN", content: "S" }));
    await deleteSection(sql, a.id);
    expect(await order()).toEqual([[1, "C"], [2, "B"], [3, "D"]]);
    const left = await sql<{ count: number }[]>`select count(*)::int as count from public.question_groups where id = ${g.id}`;
    expect(left[0]?.count).toBe(0);

    expect((await apiError(deleteSection(sql, a.id))).code).toBe("SECTION_NOT_FOUND");
    expect((await apiError(createGroup(sql, randomUUID(), createGroupBody.parse({ instruction: "x" })))).code).toBe("SECTION_NOT_FOUND");
    expect((await apiError(createQuestion(sql, randomUUID(), createQuestionBody.parse({ type: "SHORT_ANSWER", content: "x" })))).code).toBe("GROUP_NOT_FOUND");
    expect((await apiError(putAnswerKey(sql, admin, randomUUID(), answerKeyBody.parse({ correct_answer: {} })))).code).toBe("QUESTION_NOT_FOUND");
    expect((await apiError(createSection(sql, randomUUID(), {}))).code).toBe("VERSION_NOT_FOUND");
    expect((await apiError(getVersionEditor(sql, randomUUID()))).code).toBe("VERSION_NOT_FOUND");
    expect((await apiError(previewVersion(sql, randomUUID()))).code).toBe("VERSION_NOT_FOUND");
  });
});

describe("seed data", () => {
  it("Reading Mock 1 passes publish validation without warnings", async () => {
    await expect(validateVersion(sql, READING_MOCK_1_VERSION)).resolves.toEqual({ valid: true, errors: [], warnings: [] });
  });
});
