-- =============================================================================
-- Prototype 1 schema changes (CR-01 … CR-13)
--
-- Spec:    docs/backend/database-schema.md (BE requirements + change requests)
-- Author:  Backend (Khiêm). Written by BE while the DB owner (Cong) is away,
--          per decision D-008 — to be reviewed by Cong (schema) and Bùi (RLS)
--          before merge.
-- Assumes: the tables from 20260921102339_initial_schema.sql are still EMPTY
--          (prototype). Several NOT NULL columns are added without defaults on
--          purpose: if a table already has rows the migration fails loudly
--          instead of inventing values.
--
-- Custom SQLSTATEs raised by triggers (the backend maps them to API errors):
--   IE001  content/settings of a non-draft test version are read-only → 409 NOT_DRAFT
--   IE002  append-only table (audit_logs, results)                   → 500 INTERNAL_ERROR
--   IE003  invalid test version status transition                     → 409 INVALID_STATUS_TRANSITION
-- =============================================================================


-- -----------------------------------------------------------------------------
-- CR-01  profiles: role + disabled flag for every auth user
-- -----------------------------------------------------------------------------
create table public.profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    role text not null default 'student'
        check (role in ('student', 'admin')),
    display_name text
        check (display_name is null or char_length(display_name) between 1 and 50),
    disabled_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Every new auth user gets a profile (role = student).
-- security definer: runs with the owner's rights because the auth service
-- inserts into auth.users with its own role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (user_id) values (new.id)
    on conflict (user_id) do nothing;
    return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill users created before this migration (local dev databases).
insert into public.profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;


-- -----------------------------------------------------------------------------
-- CR-09  band conversion tables (created first: test_versions references them)
-- -----------------------------------------------------------------------------
create table public.band_tables (
    id uuid primary key default gen_random_uuid(),
    skill text not null check (skill in ('reading', 'listening')),
    name text not null check (char_length(name) between 1 and 100),
    is_default boolean not null default false,
    created_at timestamptz not null default now()
);

-- At most one default table per skill.
create unique index band_tables_one_default_per_skill
    on public.band_tables (skill) where is_default;

create table public.band_table_ranges (
    id uuid primary key default gen_random_uuid(),
    band_table_id uuid not null references public.band_tables(id) on delete cascade,
    min_raw integer not null check (min_raw >= 0),
    max_raw integer not null,
    band numeric(2,1) not null
        check (band between 0 and 9 and band * 2 = trunc(band * 2)),  -- 0.5 steps
    check (max_raw >= min_raw),
    unique (band_table_id, min_raw)
);
-- Gaps/overlaps between ranges are validated by the backend (an exclusion
-- constraint would need btree_gist).

-- Default tables (reference data, needed in every environment).
-- Official anchor points (British Council "IELTS scoring in detail"):
--   Listening 16→5, 23→6, 30→7, 35→8; Academic Reading 15→5, 23→6, 30→7, 35→8.
-- Half bands: commonly published tables. Reading rows below 6 copy Listening.
-- Source list: docs/backend/database-schema.md §5.1.
with t as (
    insert into public.band_tables (skill, name, is_default)
    values ('listening', 'IELTS Listening (default)', true)
    returning id
)
insert into public.band_table_ranges (band_table_id, min_raw, max_raw, band)
select t.id, r.min_raw, r.max_raw, r.band
from t, (values
    (39, 40, 9.0), (37, 38, 8.5), (35, 36, 8.0), (32, 34, 7.5), (30, 31, 7.0),
    (26, 29, 6.5), (23, 25, 6.0), (18, 22, 5.5), (16, 17, 5.0), (13, 15, 4.5),
    (10, 12, 4.0), (8, 9, 3.5), (6, 7, 3.0), (4, 5, 2.5), (2, 3, 2.0),
    (1, 1, 1.0), (0, 0, 0.0)
) as r(min_raw, max_raw, band);

with t as (
    insert into public.band_tables (skill, name, is_default)
    values ('reading', 'IELTS Academic Reading (default)', true)
    returning id
)
insert into public.band_table_ranges (band_table_id, min_raw, max_raw, band)
select t.id, r.min_raw, r.max_raw, r.band
from t, (values
    (39, 40, 9.0), (37, 38, 8.5), (35, 36, 8.0), (33, 34, 7.5), (30, 32, 7.0),
    (27, 29, 6.5), (23, 26, 6.0), (19, 22, 5.5), (15, 18, 5.0), (13, 14, 4.5),
    (10, 12, 4.0), (8, 9, 3.5), (6, 7, 3.0), (4, 5, 2.5), (2, 3, 2.0),
    (1, 1, 1.0), (0, 0, 0.0)
) as r(min_raw, max_raw, band);


-- -----------------------------------------------------------------------------
-- CR-03  test_versions: mode, settings as typed columns, band table
-- -----------------------------------------------------------------------------
alter table public.test_versions
    add column mode text not null check (mode in ('practice', 'mock')),
    -- Practice tests may have no time limit (D-005).
    alter column time_limit_seconds drop not null,
    drop constraint test_versions_time_limit_seconds_check,
    add constraint test_versions_time_limit_seconds_check
        check (time_limit_seconds between 60 and 14400),
    add column max_attempts integer check (max_attempts > 0),           -- null = unlimited
    add column answer_visibility text not null default 'after_submit'
        check (answer_visibility in ('never', 'after_submit', 'immediately_in_practice')),
    add column allow_pause boolean not null default false,
    add column allow_replay boolean not null default false,
    add column allow_seek boolean not null default false,
    add column max_plays integer check (max_plays > 0),                 -- null = unlimited
    add column band_table_id uuid references public.band_tables(id) on delete restrict,  -- null = default for the skill
    add column created_by uuid references auth.users(id) on delete set null,
    add constraint test_versions_mock_requires_time_limit
        check (mode <> 'mock' or time_limit_seconds is not null),
    add constraint test_versions_mock_visibility
        check (mode <> 'mock' or answer_visibility <> 'immediately_in_practice'),
    -- A version leaves 'draft' only by being published.
    add constraint test_versions_published_at_check
        check (status = 'draft' or published_at is not null),
    -- Lets other tables reference (version id, test id) as a pair.
    add constraint test_versions_id_test_id_key unique (id, test_id);

-- One draft and one current (published) version per test.
create unique index test_versions_one_draft_per_test
    on public.test_versions (test_id) where status = 'draft';
create unique index test_versions_one_published_per_test
    on public.test_versions (test_id) where status = 'published';


-- -----------------------------------------------------------------------------
-- CR-02  tests: type, visibility status, current version, access
-- -----------------------------------------------------------------------------
alter table public.tests
    add column type text not null check (type in ('reading', 'listening')),
    add column status text not null default 'draft'
        check (status in ('draft', 'published', 'archived')),
    add column current_version_id uuid,
    add column access_type text not null default 'public'
        check (access_type in ('public', 'private', 'assigned')),
    add column created_by uuid references auth.users(id) on delete set null,
    add constraint tests_title_length check (char_length(title) between 1 and 200),
    -- The current version must belong to this test.
    add constraint tests_current_version_fkey
        foreign key (current_version_id, id)
        references public.test_versions (id, test_id) on delete restrict,
    add constraint tests_published_has_version
        check (status <> 'published' or current_version_id is not null);

create index tests_status_type_idx on public.tests (status, type);


-- -----------------------------------------------------------------------------
-- CR-04 + CR-12  sections: passage + audio; deferrable ordering
-- -----------------------------------------------------------------------------
alter table public.sections
    add column content text,              -- Reading passage (Markdown)
    add column audio_object_key text,     -- Listening audio (R2 object key)
    add constraint sections_audio_only_for_listening
        check (section_type = 'listening' or audio_object_key is null),
    drop constraint sections_test_version_id_position_key,
    add constraint sections_test_version_id_position_key
        unique (test_version_id, position) deferrable initially deferred;


-- -----------------------------------------------------------------------------
-- CR-04 + CR-12  question_groups: shared content/options/rules; passage+audio
-- moved to sections
-- -----------------------------------------------------------------------------
alter table public.question_groups
    drop column passage_text,
    drop column audio_object_key,
    add column content text,              -- Markdown with {{gap:N}} tokens
    add column options jsonb
        check (options is null or jsonb_typeof(options) = 'array'),
    add column rules jsonb not null default '{}'::jsonb
        check (jsonb_typeof(rules) = 'object'),
    add column image_object_key text,     -- map / diagram image (R2 object key)
    drop constraint question_groups_section_id_position_key,
    add constraint question_groups_section_id_position_key
        unique (section_id, position) deferrable initially deferred;


-- -----------------------------------------------------------------------------
-- CR-05 + CR-12  questions: answer format, options, numbering
-- -----------------------------------------------------------------------------
alter table public.questions
    add column answer_format text not null
        check (answer_format in ('choice', 'multi_choice', 'text')),
    add column options jsonb
        check (options is null or jsonb_typeof(options) = 'array'),
    add column display_number integer check (display_number > 0),  -- null = auto numbering
    add constraint questions_question_type_check check (question_type in (
        'mcq_single', 'mcq_multi',
        'true_false_not_given', 'yes_no_not_given',
        'matching_headings', 'matching_information', 'matching_features', 'matching_sentence_endings',
        'sentence_completion', 'summary_completion', 'note_completion', 'table_completion',
        'form_completion', 'flow_chart_completion', 'diagram_label_completion',
        'map_plan_labelling', 'short_answer'
    )),
    add constraint questions_config_is_object check (jsonb_typeof(config) = 'object'),
    -- max_score is used as "marks": whole numbers, 1 per question number
    -- (MCQ_MULTI "choose TWO/THREE" = 2-3 marks).
    add constraint questions_max_score_whole_marks
        check (max_score = trunc(max_score) and max_score between 1 and 5),
    drop constraint questions_question_group_id_position_key,
    add constraint questions_question_group_id_position_key
        unique (question_group_id, position) deferrable initially deferred;


-- -----------------------------------------------------------------------------
-- answer_keys: shape checks only (table unchanged)
-- -----------------------------------------------------------------------------
alter table public.answer_keys
    add constraint answer_keys_correct_answer_is_object
        check (jsonb_typeof(correct_answer) = 'object'),
    add constraint answer_keys_grading_config_is_object
        check (jsonb_typeof(grading_config) = 'object');


-- -----------------------------------------------------------------------------
-- CR-06  attempts: two-step start (created → in_progress), optional time limit,
-- one active attempt per user per test
-- -----------------------------------------------------------------------------
alter table public.attempts
    add column test_id uuid not null references public.tests(id) on delete restrict,
    -- Snapshot of the version's time limit at start (D-005). null = no limit.
    add column time_limit_seconds integer check (time_limit_seconds between 60 and 14400),
    drop constraint attempts_status_check,
    add constraint attempts_status_check
        check (status in ('created', 'in_progress', 'submitted', 'auto_submitted')),
    alter column status set default 'created',
    drop constraint attempts_check,   -- was: expires_at > started_at
    drop constraint attempts_check1,  -- was: submitted_at >= started_at
    alter column started_at drop not null,
    alter column started_at drop default,   -- set by POST /api/attempts/:id/begin
    alter column expires_at drop not null,
    add constraint attempts_version_belongs_to_test
        foreign key (test_version_id, test_id)
        references public.test_versions (id, test_id) on delete restrict,
    add constraint attempts_started_at_matches_status
        check ((status = 'created') = (started_at is null)),
    add constraint attempts_expires_after_start
        check (expires_at is null or (started_at is not null and expires_at > started_at)),
    add constraint attempts_expiry_matches_time_limit
        check (started_at is null or ((time_limit_seconds is null) = (expires_at is null))),
    add constraint attempts_submitted_at_matches_status
        check ((status in ('submitted', 'auto_submitted')) = (submitted_at is not null)),
    add constraint attempts_submitted_after_start
        check (submitted_at is null or submitted_at >= started_at);

-- At most one active attempt per user per test (also stops parallel "start" calls).
create unique index attempts_one_active_per_user_test
    on public.attempts (user_id, test_id) where status in ('created', 'in_progress');

-- Counting attempts per user per test (max_attempts).
create index attempts_user_test_idx on public.attempts (user_id, test_id);


-- -----------------------------------------------------------------------------
-- CR-07  attempt_answers: flags
-- -----------------------------------------------------------------------------
alter table public.attempt_answers
    add column is_flagged boolean not null default false,
    add constraint attempt_answers_answer_is_object
        check (answer is null or jsonb_typeof(answer) = 'object');


-- -----------------------------------------------------------------------------
-- CR-08  results: counts for history lists
-- -----------------------------------------------------------------------------
alter table public.results
    add column correct_count integer not null check (correct_count >= 0),
    add column incorrect_count integer not null check (incorrect_count >= 0),
    add column unanswered_count integer not null check (unanswered_count >= 0),
    add column time_taken_seconds integer not null check (time_taken_seconds >= 0),
    add constraint results_counts_match_max_score
        check (correct_count + incorrect_count + unanswered_count = max_score),
    add constraint results_grading_snapshot_is_object
        check (jsonb_typeof(grading_snapshot) = 'object');


-- -----------------------------------------------------------------------------
-- CR-10  audit_logs
-- -----------------------------------------------------------------------------
create table public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid references auth.users(id) on delete set null,
    action text not null check (char_length(action) between 1 and 100),          -- e.g. 'test_version.publish'
    resource_type text not null check (char_length(resource_type) between 1 and 50),
    resource_id uuid,
    metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),  -- never passwords/tokens
    created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_resource_idx on public.audit_logs (resource_type, resource_id);


-- -----------------------------------------------------------------------------
-- CR-11  integrity triggers
-- -----------------------------------------------------------------------------

-- Status of the test version that owns a content row, found from the row's
-- parent id. Returns null when the parent no longer exists.
create or replace function public.content_version_status(p_table text, p_parent_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
    select case p_table
        when 'sections' then (
            select tv.status
            from public.test_versions tv
            where tv.id = p_parent_id)
        when 'question_groups' then (
            select tv.status
            from public.sections s
            join public.test_versions tv on tv.id = s.test_version_id
            where s.id = p_parent_id)
        when 'questions' then (
            select tv.status
            from public.question_groups g
            join public.sections s on s.id = g.section_id
            join public.test_versions tv on tv.id = s.test_version_id
            where g.id = p_parent_id)
        when 'answer_keys' then (
            select tv.status
            from public.questions q
            join public.question_groups g on g.id = q.question_group_id
            join public.sections s on s.id = g.section_id
            join public.test_versions tv on tv.id = s.test_version_id
            where q.id = p_parent_id)
    end
$$;

-- Content of a published/archived version is read-only (v1 §6, §45 rule 2).
-- TG_ARGV[0] = name of the column holding the parent id.
create or replace function public.assert_content_version_is_draft()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
    v_parent_column text;
    v_status text;
begin
    v_parent_column := tg_argv[0];

    if tg_op in ('INSERT', 'UPDATE') then
        v_status := public.content_version_status(
            tg_table_name, (to_jsonb(new) ->> v_parent_column)::uuid);
        if v_status is distinct from 'draft' then
            raise exception 'Content of a % test version is read-only (%)',
                coalesce(v_status, 'missing'), tg_table_name
                using errcode = 'IE001';
        end if;
    end if;

    if tg_op in ('UPDATE', 'DELETE') then
        v_status := public.content_version_status(
            tg_table_name, (to_jsonb(old) ->> v_parent_column)::uuid);
        -- On DELETE a null status means the parent was already removed by a
        -- cascade that started from a delete this trigger already checked.
        if v_status is distinct from 'draft'
           and not (tg_op = 'DELETE' and v_status is null) then
            raise exception 'Content of a % test version is read-only (%)',
                coalesce(v_status, 'missing'), tg_table_name
                using errcode = 'IE001';
        end if;
    end if;

    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$$;

create trigger sections_draft_only
before insert or update or delete on public.sections
for each row execute function public.assert_content_version_is_draft('test_version_id');

create trigger question_groups_draft_only
before insert or update or delete on public.question_groups
for each row execute function public.assert_content_version_is_draft('section_id');

create trigger questions_draft_only
before insert or update or delete on public.questions
for each row execute function public.assert_content_version_is_draft('question_group_id');

create trigger answer_keys_draft_only
before insert or update or delete on public.answer_keys
for each row execute function public.assert_content_version_is_draft('question_id');

-- Settings of a non-draft version are frozen; status only moves forward
-- (draft → published → archived); only drafts can be deleted.
create or replace function public.guard_test_version_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if tg_op = 'DELETE' then
        if old.status <> 'draft' then
            raise exception 'Only draft test versions can be deleted (status %)', old.status
                using errcode = 'IE001';
        end if;
        return old;
    end if;

    if old.status <> 'draft' and (
        new.test_id, new.version_number, new.mode, new.time_limit_seconds,
        new.max_attempts, new.answer_visibility, new.allow_pause, new.allow_replay,
        new.allow_seek, new.max_plays, new.band_table_id
    ) is distinct from (
        old.test_id, old.version_number, old.mode, old.time_limit_seconds,
        old.max_attempts, old.answer_visibility, old.allow_pause, old.allow_replay,
        old.allow_seek, old.max_plays, old.band_table_id
    ) then
        raise exception 'Settings of a % test version are read-only', old.status
            using errcode = 'IE001';
    end if;

    if new.status is distinct from old.status and not (
        (old.status = 'draft' and new.status = 'published')
        or (old.status = 'published' and new.status = 'archived')
    ) then
        raise exception 'Invalid test version status transition % -> %', old.status, new.status
            using errcode = 'IE003';
    end if;

    return new;
end;
$$;

create trigger test_versions_guard
before update or delete on public.test_versions
for each row execute function public.guard_test_version_changes();

-- Append-only tables: results never change after submit (BE_and_DATABASE_Agreement
-- §5 "result cũ không đổi"); audit logs are never edited.
create or replace function public.reject_update_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    raise exception '% is append-only', tg_table_name using errcode = 'IE002';
end;
$$;

create trigger results_append_only
before update or delete on public.results
for each row execute function public.reject_update_delete();

create trigger audit_logs_append_only
before update or delete on public.audit_logs
for each row execute function public.reject_update_delete();

create trigger audit_logs_no_truncate
before truncate on public.audit_logs
for each statement execute function public.reject_update_delete();


-- -----------------------------------------------------------------------------
-- CR-13  RLS + grants (D-008 option B: the browser uses Supabase for Auth only;
-- all data access goes through the Next.js server)
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.band_tables enable row level security;
alter table public.band_table_ranges enable row level security;
alter table public.audit_logs enable row level security;

-- RLS is enabled on every public table and no policy exists for anon or
-- authenticated, so the Data API (reachable with the public anon key) returns
-- nothing. Revoking the default grants as well is defense in depth.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges for role postgres in schema public
    revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
    revoke all on sequences from anon, authenticated;
