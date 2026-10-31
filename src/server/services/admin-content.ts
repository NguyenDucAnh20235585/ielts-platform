import "server-only";

import type { AdminSection } from "@/features/admin/admin-tree";
import { type AnswerKeyRow, toAnswerKeyView } from "@/features/admin/answer-key-row";
import { checkAnswerKey, type KeyTarget } from "@/features/admin/answer-key-validation";
import {
  isFormatAllowed,
  parseAnswerFormat,
  parseQuestionType,
  resolveQuestionSpec,
  type QuestionSpec,
  TYPES_WITH_OWN_OPTIONS,
} from "@/features/admin/question-rules";
import type {
  AnswerKeyBody,
  CreateGroupBody,
  CreateQuestionBody,
  CreateSectionBody,
  UpdateGroupBody,
  UpdateQuestionBody,
  UpdateSectionBody,
} from "@/features/admin/request-schemas";
import { resolveRules } from "@/features/grading/rules";
import { type AnswerFormat, rulesInputSchema } from "@/features/grading/schemas";
import type { DbQuestionType, DbTestType } from "@/features/test/api-enums";
import { effectiveOptions, parseOptions } from "@/features/test/question-options";
import type { CurrentUser } from "@/server/auth/current-user";
import { jsonValue } from "@/server/db/json";
import type { Sql, TransactionSql } from "@/server/db/types";
import { ApiError } from "@/server/http/errors";

import { type ContentKind, lockDraftOfNode, lockDraftVersion, loadAdminTree, NOT_FOUND } from "./admin-shared";
import { writeAuditLog } from "./audit-log";

/**
 * Content editing of DRAFT versions (api-contract §7). Every mutation locks
 * the version row first (lockDraftVersion / lockDraftOfNode), so positions
 * are shifted by one request at a time. Create/update responses are the
 * changed object in the editor-tree shape of §6.5.
 */

const SUCCESS = { success: true } as const;

// --- Positions ---------------------------------------------------------------

const SIBLINGS = {
  section: { table: "public.sections", parent: "test_version_id" },
  group: { table: "public.question_groups", parent: "section_id" },
  question: { table: "public.questions", parent: "question_group_id" },
} as const satisfies Record<ContentKind, { table: string; parent: string }>;

/**
 * Makes room at `orderNo` (1-based; omitted or past the end = append) and
 * returns the position to insert at. The (parent, position) unique constraints
 * are DEFERRABLE, so shifting in one statement is fine.
 */
async function openSlot(tx: TransactionSql, kind: ContentKind, parentId: string, orderNo: number | undefined) {
  const { table, parent } = SIBLINGS[kind];
  const rows = await tx<{ count: number }[]>`
    select count(*)::int as count from ${tx(table)} where ${tx(parent)} = ${parentId}
  `;
  const count = rows[0]?.count ?? 0;
  const position = orderNo === undefined ? count + 1 : Math.min(orderNo, count + 1);
  if (position <= count) {
    await tx`
      update ${tx(table)} set position = position + 1
      where ${tx(parent)} = ${parentId} and position >= ${position}
    `;
  }
  return position;
}

/** Deletes a row and closes the gap it leaves. */
async function deleteAndRenumber(tx: TransactionSql, kind: ContentKind, id: string) {
  const { table, parent } = SIBLINGS[kind];
  const deleted = await tx<{ parent_id: string; position: number }[]>`
    delete from ${tx(table)} where id = ${id}
    returning ${tx(parent)} as parent_id, position
  `;
  const row = deleted[0];
  if (!row) {
    throw NOT_FOUND[kind]();
  }
  await tx`
    update ${tx(table)} set position = position - 1
    where ${tx(parent)} = ${row.parent_id} and position > ${row.position}
  `;
}

// --- Responses ------------------------------------------------------------------

async function treeOf(tx: TransactionSql, versionId: string): Promise<AdminSection[]> {
  const tree = await loadAdminTree(tx, versionId);
  if (!tree) throw new Error("Version disappeared inside its own transaction.");
  return tree;
}

function pick<Node extends { id: string }>(nodes: readonly Node[], id: string): Node {
  const node = nodes.find((n) => n.id === id);
  if (!node) throw new Error(`Node ${id} missing from the editor tree.`);
  return node;
}

const groupsOf = (tree: AdminSection[]) => tree.flatMap((s) => s.question_groups);
const questionsOf = (tree: AdminSection[]) => groupsOf(tree).flatMap((g) => g.questions);

function fieldError(path: string, message: string): ApiError {
  return new ApiError("VALIDATION_ERROR", message, { fields: [{ path, message }] });
}

// --- Sections (§7.1) ------------------------------------------------------------

/** READING sections have no audio; LISTENING sections have no transcript in Prototype 1. */
function checkSectionFields(type: DbTestType, fields: { content?: string | null; audio_object_key?: string | null }) {
  if (type === "reading" && fields.audio_object_key) {
    throw fieldError("audio_object_key", "READING sections cannot have audio.");
  }
  if (type === "listening" && fields.content) {
    throw fieldError("content", "LISTENING sections have no transcript in Prototype 1; content must be null.");
  }
}

export async function createSection(sql: Sql, versionId: string, body: CreateSectionBody) {
  return sql.begin(async (tx) => {
    const version = await lockDraftVersion(tx, versionId);
    if (!version) {
      throw new ApiError("VERSION_NOT_FOUND", "Test version not found.");
    }
    checkSectionFields(version.type, body);
    const position = await openSlot(tx, "section", versionId, body.order_no);
    const rows = await tx<{ id: string }[]>`
      insert into public.sections (test_version_id, section_type, position, title, instructions, content, audio_object_key)
      values (${versionId}, ${version.type}, ${position}, ${body.title ?? null}, ${body.instruction ?? null},
              ${body.content ?? null}, ${body.audio_object_key ?? null})
      returning id
    `;
    return pick(await treeOf(tx, versionId), rows[0]?.id ?? "");
  });
}

export async function updateSection(sql: Sql, sectionId: string, body: UpdateSectionBody) {
  return sql.begin(async (tx) => {
    const version = await lockDraftOfNode(tx, "section", sectionId);
    checkSectionFields(version.type, body);
    const changes: Record<string, string | null> = {};
    if (body.title !== undefined) changes.title = body.title;
    if (body.instruction !== undefined) changes.instructions = body.instruction;
    if (body.content !== undefined) changes.content = body.content;
    if (body.audio_object_key !== undefined) changes.audio_object_key = body.audio_object_key;
    if (Object.keys(changes).length > 0) {
      await tx`update public.sections set ${tx(changes)} where id = ${sectionId}`;
    }
    return pick(await treeOf(tx, version.id), sectionId);
  });
}

/** Deletes the section with its groups, questions and answer keys; later sections move up. */
export async function deleteSection(sql: Sql, sectionId: string) {
  return sql.begin(async (tx) => {
    await lockDraftOfNode(tx, "section", sectionId);
    await deleteAndRenumber(tx, "section", sectionId);
    return SUCCESS;
  });
}

// --- Question groups (§7.2) -----------------------------------------------------

export async function createGroup(sql: Sql, sectionId: string, body: CreateGroupBody) {
  return sql.begin(async (tx) => {
    const version = await lockDraftOfNode(tx, "section", sectionId);
    const position = await openSlot(tx, "group", sectionId, body.order_no);
    const rows = await tx<{ id: string }[]>`
      insert into public.question_groups (section_id, position, instructions, content, options, rules, image_object_key)
      values (${sectionId}, ${position}, ${body.instruction}, ${body.content ?? null},
              ${body.options ? tx.json(body.options) : null}, ${tx.json(jsonValue(body.rules ?? {}))},
              ${body.image_object_key ?? null})
      returning id
    `;
    return pick(groupsOf(await treeOf(tx, version.id)), rows[0]?.id ?? "");
  });
}

export async function updateGroup(sql: Sql, groupId: string, body: UpdateGroupBody) {
  return sql.begin(async (tx) => {
    const version = await lockDraftOfNode(tx, "group", groupId);
    const changes: Record<string, unknown> = {};
    if (body.instruction !== undefined) changes.instructions = body.instruction;
    if (body.content !== undefined) changes.content = body.content;
    if (body.options !== undefined) changes.options = body.options === null ? null : tx.json(body.options);
    if (body.rules !== undefined) changes.rules = tx.json(jsonValue(body.rules ?? {}));
    if (body.image_object_key !== undefined) changes.image_object_key = body.image_object_key;
    if (Object.keys(changes).length > 0) {
      await tx`update public.question_groups set ${tx(changes)} where id = ${groupId}`;
    }
    return pick(groupsOf(await treeOf(tx, version.id)), groupId);
  });
}

/** Deletes the group with its questions and answer keys; later groups move up. */
export async function deleteGroup(sql: Sql, groupId: string) {
  return sql.begin(async (tx) => {
    await lockDraftOfNode(tx, "group", groupId);
    await deleteAndRenumber(tx, "group", groupId);
    return SUCCESS;
  });
}

// --- Questions (§7.3) -----------------------------------------------------------

function requireQuestionType(value: string): DbQuestionType {
  const type = parseQuestionType(value);
  if (!type) {
    throw new ApiError("INVALID_QUESTION_TYPE", `Unknown question type "${value}".`);
  }
  return type;
}

function requireAnswerFormat(value: string): AnswerFormat {
  const format = parseAnswerFormat(value);
  if (!format) {
    throw new ApiError("INVALID_QUESTION_TYPE", `Unknown answer_format "${value}".`);
  }
  return format;
}

function resolveOrThrow(input: Parameters<typeof resolveQuestionSpec>[0]): QuestionSpec {
  const result = resolveQuestionSpec(input);
  if (result.ok) {
    return result.spec;
  }
  if (result.code === "INVALID_QUESTION_TYPE") {
    throw new ApiError("INVALID_QUESTION_TYPE", result.message);
  }
  throw fieldError(result.path ?? "", result.message);
}

type GroupContext = { options: unknown; rules: unknown };

async function loadGroupContext(tx: TransactionSql, groupId: string): Promise<GroupContext> {
  const rows = await tx<GroupContext[]>`select options, rules from public.question_groups where id = ${groupId}`;
  const group = rows[0];
  if (!group) throw NOT_FOUND.group();
  return group;
}

export async function createQuestion(sql: Sql, groupId: string, body: CreateQuestionBody) {
  const type = requireQuestionType(body.type);
  const answerFormat = body.answer_format === undefined ? undefined : requireAnswerFormat(body.answer_format);

  return sql.begin(async (tx) => {
    const version = await lockDraftOfNode(tx, "group", groupId);
    const group = await loadGroupContext(tx, groupId);
    const spec = resolveOrThrow({
      type,
      answerFormat,
      options: body.options ?? null,
      config: body.config ?? {},
      groupHasOptions: (parseOptions(group.options)?.length ?? 0) > 0,
    });
    const position = await openSlot(tx, "question", groupId, body.order_no);
    const rows = await tx<{ id: string }[]>`
      insert into public.questions
        (question_group_id, position, question_type, answer_format, prompt, options, config, max_score, display_number)
      values
        (${groupId}, ${position}, ${type}, ${spec.answerFormat}, ${body.content},
         ${spec.options ? tx.json(spec.options) : null}, ${tx.json(jsonValue(spec.config))}, ${spec.marks},
         ${body.display_number ?? null})
      returning id
    `;
    return pick(questionsOf(await treeOf(tx, version.id)), rows[0]?.id ?? "");
  });
}

type QuestionContext = {
  question_group_id: string;
  question_type: DbQuestionType;
  answer_format: AnswerFormat;
  options: unknown;
  config: unknown;
  max_score: string | number;
  group_options: unknown;
  group_rules: unknown;
};

async function loadQuestionContext(tx: TransactionSql, questionId: string): Promise<QuestionContext> {
  const rows = await tx<QuestionContext[]>`
    select q.question_group_id, q.question_type, q.answer_format, q.options, q.config, q.max_score,
           g.options as group_options, g.rules as group_rules
    from public.questions q
    join public.question_groups g on g.id = q.question_group_id
    where q.id = ${questionId}
  `;
  const row = rows[0];
  if (!row) throw NOT_FOUND.question();
  return row;
}

function keyTargetOf(q: QuestionContext): KeyTarget {
  return {
    answerFormat: q.answer_format,
    marks: Number(q.max_score),
    rules: resolveRules(q.group_rules, q.config),
    options: effectiveOptions(q.question_type, q.answer_format, q.options, q.group_options),
  };
}

async function loadKey(tx: TransactionSql, questionId: string): Promise<AnswerKeyRow | null> {
  const rows = await tx<AnswerKeyRow[]>`
    select question_id, correct_answer, grading_config, explanation, updated_at
    from public.answer_keys where question_id = ${questionId}
  `;
  return rows[0] ?? null;
}

/**
 * PATCH /api/admin/questions/:questionId. When the type, answer_format,
 * select_count (marks) or own options change and the existing answer key no
 * longer fits, the key is deleted (audited) and `answer_key` is null.
 */
export async function updateQuestion(sql: Sql, admin: CurrentUser, questionId: string, body: UpdateQuestionBody) {
  const requestedType = body.type === undefined ? undefined : requireQuestionType(body.type);
  const requestedFormat = body.answer_format === undefined ? undefined : requireAnswerFormat(body.answer_format);

  return sql.begin(async (tx) => {
    const version = await lockDraftOfNode(tx, "question", questionId);
    const current = await loadQuestionContext(tx, questionId);

    const type = requestedType ?? current.question_type;
    // Keep the current format while the (new) type allows it; otherwise use the type's default.
    const answerFormat =
      requestedFormat ?? (isFormatAllowed(type, current.answer_format) ? current.answer_format : undefined);
    const currentOptions = parseOptions(current.options);
    const spec = resolveOrThrow({
      type,
      answerFormat,
      options:
        body.options !== undefined ? body.options : TYPES_WITH_OWN_OPTIONS.has(type) ? currentOptions : null,
      config: body.config !== undefined ? (body.config ?? {}) : rulesInputSchema.parse(current.config ?? {}),
      groupHasOptions: (parseOptions(current.group_options)?.length ?? 0) > 0,
    });

    const changes: Record<string, unknown> = {
      question_type: type,
      answer_format: spec.answerFormat,
      options: spec.options ? tx.json(spec.options) : null,
      config: tx.json(jsonValue(spec.config)),
      max_score: spec.marks,
    };
    if (body.content !== undefined) changes.prompt = body.content;
    if (body.display_number !== undefined) changes.display_number = body.display_number;
    await tx`update public.questions set ${tx(changes)} where id = ${questionId}`;

    const structural =
      type !== current.question_type ||
      spec.answerFormat !== current.answer_format ||
      spec.marks !== Number(current.max_score) ||
      JSON.stringify(spec.options) !== JSON.stringify(currentOptions);
    const key = structural ? await loadKey(tx, questionId) : null;
    if (key) {
      const updated = await loadQuestionContext(tx, questionId);
      const check = checkAnswerKey(keyTargetOf(updated), key.correct_answer, key.grading_config);
      if (!check.ok) {
        await tx`delete from public.answer_keys where question_id = ${questionId}`;
        await writeAuditLog(tx, {
          actorId: admin.id,
          action: "answer_key.delete",
          resourceType: "question",
          resourceId: questionId,
          metadata: { reason: "question_changed", detail: check.reason, before: toAnswerKeyView(key) },
        });
      }
    }
    return pick(questionsOf(await treeOf(tx, version.id)), questionId);
  });
}

/** Deletes the question and its answer key; later questions in the group move up. */
export async function deleteQuestion(sql: Sql, questionId: string) {
  return sql.begin(async (tx) => {
    await lockDraftOfNode(tx, "question", questionId);
    await deleteAndRenumber(tx, "question", questionId);
    return SUCCESS;
  });
}

// --- Answer keys (§7.4) ---------------------------------------------------------

/** PUT /api/admin/questions/:questionId/answer-key — create or replace. Audited with before/after. */
export async function putAnswerKey(sql: Sql, admin: CurrentUser, questionId: string, body: AnswerKeyBody) {
  return sql.begin(async (tx) => {
    await lockDraftOfNode(tx, "question", questionId);
    const question = await loadQuestionContext(tx, questionId);
    const check = checkAnswerKey(keyTargetOf(question), body.correct_answer, body.grading_config);
    if (!check.ok) {
      throw new ApiError("INVALID_ANSWER_KEY", check.reason, { reason: check.reason });
    }
    const before = await loadKey(tx, questionId);
    const rows = await tx<AnswerKeyRow[]>`
      insert into public.answer_keys (question_id, correct_answer, grading_config, explanation)
      values (${questionId}, ${tx.json(jsonValue(check.key.correct_answer))}, ${tx.json(check.key.grading_config)},
              ${body.explanation ?? null})
      on conflict (question_id) do update
        set correct_answer = excluded.correct_answer,
            grading_config = excluded.grading_config,
            explanation = excluded.explanation
      returning question_id, correct_answer, grading_config, explanation, updated_at
    `;
    const saved = rows[0];
    if (!saved) throw new Error("Answer key upsert returned no row.");
    await writeAuditLog(tx, {
      actorId: admin.id,
      action: "answer_key.update",
      resourceType: "question",
      resourceId: questionId,
      metadata: { before: before ? toAnswerKeyView(before) : null, after: toAnswerKeyView(saved) },
    });
    return { question_id: questionId, ...toAnswerKeyView(saved) };
  });
}
