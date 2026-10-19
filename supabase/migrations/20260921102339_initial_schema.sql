create table public.tests (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.test_versions (
    id uuid primary key default gen_random_uuid(),
    test_id uuid not null references public.tests(id) on delete restrict,
    version_number integer not null check (version_number > 0),
    status text not null default 'draft'
        check (status in ('draft', 'published', 'archived')),
    time_limit_seconds integer not null check (time_limit_seconds > 0),
    published_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (test_id, version_number)
);

create table public.sections (
    id uuid primary key default gen_random_uuid(),
    test_version_id uuid not null
        references public.test_versions(id) on delete cascade,
    section_type text not null
        check (section_type in ('reading', 'listening')),
    title text,
    instructions text,
    position integer not null check (position > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (test_version_id, position)
);

create table public.question_groups (
    id uuid primary key default gen_random_uuid(),
    section_id uuid not null
        references public.sections(id) on delete cascade,
    title text,
    instructions text,
    passage_text text,
    audio_object_key text,
    position integer not null check (position > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (section_id, position)
);

create table public.questions (
    id uuid primary key default gen_random_uuid(),
    question_group_id uuid not null
        references public.question_groups(id) on delete cascade,
    question_type text not null,
    prompt text not null,
    config jsonb not null default '{}'::jsonb,
    position integer not null check (position > 0),
    max_score numeric(6,2) not null default 1 check (max_score > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (question_group_id, position)
);

create table public.answer_keys (
    question_id uuid primary key
        references public.questions(id) on delete cascade,
    correct_answer jsonb not null,
    grading_config jsonb not null default '{}'::jsonb,
    explanation text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.attempts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete restrict,
    test_version_id uuid not null
        references public.test_versions(id) on delete restrict,
    mode text not null check (mode in ('practice', 'mock')),
    status text not null default 'in_progress'
        check (status in ('in_progress', 'submitted', 'expired')),
    started_at timestamptz not null default now(),
    expires_at timestamptz not null,
    submitted_at timestamptz,
    last_saved_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (expires_at > started_at),
    check (submitted_at is null or submitted_at >= started_at)
);

create table public.attempt_answers (
    id uuid primary key default gen_random_uuid(),
    attempt_id uuid not null
        references public.attempts(id) on delete cascade,
    question_id uuid not null
        references public.questions(id) on delete restrict,
    answer jsonb,
    saved_at timestamptz not null default now(),
    unique (attempt_id, question_id)
);

create table public.results (
    id uuid primary key default gen_random_uuid(),
    attempt_id uuid not null
        references public.attempts(id) on delete restrict,
    raw_score numeric(8,2) not null check (raw_score >= 0),
    max_score numeric(8,2) not null check (max_score >= 0),
    band_score numeric(3,1)
        check (band_score is null or band_score between 0 and 9),
    grading_snapshot jsonb not null,
    created_at timestamptz not null default now(),
    unique (attempt_id),
    check (raw_score <= max_score)
);

create index idx_attempts_user_created_at
    on public.attempts(user_id, created_at desc);

create index idx_attempts_test_version_id
    on public.attempts(test_version_id);

create index idx_attempts_status
    on public.attempts(status);

create index idx_attempt_answers_question_id
    on public.attempt_answers(question_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger tests_updated_at
before update on public.tests
for each row execute function public.set_updated_at();

create trigger test_versions_updated_at
before update on public.test_versions
for each row execute function public.set_updated_at();

create trigger sections_updated_at
before update on public.sections
for each row execute function public.set_updated_at();

create trigger question_groups_updated_at
before update on public.question_groups
for each row execute function public.set_updated_at();

create trigger questions_updated_at
before update on public.questions
for each row execute function public.set_updated_at();

create trigger answer_keys_updated_at
before update on public.answer_keys
for each row execute function public.set_updated_at();

create trigger attempts_updated_at
before update on public.attempts
for each row execute function public.set_updated_at();

alter table public.tests enable row level security;
alter table public.test_versions enable row level security;
alter table public.sections enable row level security;
alter table public.question_groups enable row level security;
alter table public.questions enable row level security;
alter table public.answer_keys enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table public.results enable row level security;