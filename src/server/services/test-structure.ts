import "server-only";

import type { AnswerFormat } from "@/features/grading/schemas";
import type { DbTestMode } from "@/features/test/api-enums";
import {
  buildStudentContent,
  type GroupRow,
  type QuestionRow,
  type SectionRow,
  type StudentContent,
  type VersionRow,
} from "@/features/test/student-content";
import type { Queryable } from "@/server/db/types";
import { resolveMediaUrl } from "@/server/media/urls";

export type VersionStructure = {
  version: VersionRow;
  sections: SectionRow[];
  groups: GroupRow[];
  questions: QuestionRow[];
};

/**
 * Loads a test version's content WITHOUT answer keys (they are only loaded by
 * the grading path in attempt-core.ts). Returns null if the version does not
 * exist.
 *
 * `mode` picks the settings shown in `version` (an attempt's mode, D-015).
 * Without it: the first enabled mode, MOCK before PRACTICE ('mock' < 'practice').
 */
export async function loadVersionStructure(
  sql: Queryable,
  versionId: string,
  mode?: DbTestMode,
): Promise<VersionStructure | null> {
  const versions = await sql<VersionRow[]>`
    select tv.id, tv.test_id, tv.version_number, t.title, t.type, m.mode, m.time_limit_seconds,
           m.answer_visibility, m.allow_pause, m.allow_replay, m.allow_seek, m.max_plays
    from public.test_versions tv
    join public.tests t on t.id = tv.test_id
    join public.test_version_modes m on m.test_version_id = tv.id
    where tv.id = ${versionId}
      ${mode ? sql`and m.mode = ${mode}` : sql``}
    order by m.enabled desc, m.mode
    limit 1
  `;
  const version = versions[0];
  if (!version) {
    return null;
  }

  const sections = await sql<SectionRow[]>`
    select id, position, title, instructions, content, audio_object_key
    from public.sections
    where test_version_id = ${versionId}
    order by position
  `;
  const groups = await sql<GroupRow[]>`
    select g.id, g.section_id, g.position, g.instructions, g.content, g.options, g.rules, g.image_object_key
    from public.question_groups g
    join public.sections s on s.id = g.section_id
    where s.test_version_id = ${versionId}
    order by s.position, g.position
  `;
  const questions = await sql<(QuestionRow & { answer_format: AnswerFormat })[]>`
    select q.id, q.question_group_id, q.position, q.question_type, q.answer_format, q.prompt,
           q.options, q.config, q.max_score, q.display_number
    from public.questions q
    join public.question_groups g on g.id = q.question_group_id
    join public.sections s on s.id = g.section_id
    where s.test_version_id = ${versionId}
    order by s.position, g.position, q.position
  `;
  return { version, sections: [...sections], groups: [...groups], questions: [...questions] };
}

/** Student view of a version in one mode (api-contract §2.6 StudentContent). */
export async function loadStudentContent(
  sql: Queryable,
  versionId: string,
  mode?: DbTestMode,
): Promise<StudentContent | null> {
  const structure = await loadVersionStructure(sql, versionId, mode);
  if (!structure) {
    return null;
  }
  return buildStudentContent(
    structure.version,
    structure.sections,
    structure.groups,
    structure.questions,
    resolveMediaUrl,
  );
}

export type Preload = { audio: { section_id: string; url: string; expires_at: string | null }[] };

/** Audio the FE should buffer before calling `begin` (api-contract §5, D-013). */
export async function loadPreload(sql: Queryable, versionId: string): Promise<Preload> {
  const rows = await sql<{ id: string; audio_object_key: string }[]>`
    select id, audio_object_key
    from public.sections
    where test_version_id = ${versionId} and audio_object_key is not null
    order by position
  `;
  const audio = rows.flatMap((row) => {
    const media = resolveMediaUrl(row.audio_object_key);
    return media ? [{ section_id: row.id, url: media.url, expires_at: media.expires_at }] : [];
  });
  return { audio };
}
