-- FHMI archive: extended metadata, scripture refs table, keyword kinds, expanded FTS

-- ---------------------------------------------------------------------------
-- Keywords: add kind (topic | keyword | doctrine | legacy), unique (name, kind)
-- ---------------------------------------------------------------------------
alter table public.keywords
  add column if not exists kind text not null default 'legacy';

alter table public.keywords
  drop constraint if exists keywords_kind_check;

alter table public.keywords
  add constraint keywords_kind_check
  check (kind in ('topic', 'keyword', 'doctrine', 'legacy'));

-- Replace unique(name) with unique(name, kind)
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'keywords_name_key'
      and conrelid = 'public.keywords'::regclass
  ) then
    alter table public.keywords drop constraint keywords_name_key;
  end if;
end $$;

drop index if exists keywords_name_kind_unique;

create unique index keywords_name_kind_unique
  on public.keywords (name, kind);

-- ---------------------------------------------------------------------------
-- Sermons: FHMI columns + drop/regenerate fts for expanded indexing
-- ---------------------------------------------------------------------------
alter table public.sermons
  add column if not exists external_id text;

alter table public.sermons
  add column if not exists series text;

alter table public.sermons
  add column if not exists part_number integer;

alter table public.sermons
  add column if not exists document_type text;

alter table public.sermons
  add column if not exists primary_scripture_raw text;

alter table public.sermons
  add column if not exists secondary_scriptures_raw text;

alter table public.sermons
  add column if not exists google_drive_url text;

alter table public.sermons
  add column if not exists folder text;

alter table public.sermons
  add column if not exists core_doctrine text;

alter table public.sermons
  add column if not exists doctrinal_position text;

alter table public.sermons
  add column if not exists key_claims text;

alter table public.sermons
  add column if not exists audience text;

alter table public.sermons
  add column if not exists metadata_confidence text;

alter table public.sermons
  add column if not exists ai_training_approved text;

create unique index if not exists sermons_external_id_unique
  on public.sermons (external_id)
  where external_id is not null;

drop index if exists idx_sermons_fts;
alter table public.sermons drop column if exists fts cascade;

alter table public.sermons
  add column fts tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(series, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(preacher, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(scripture_ref, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(primary_scripture_raw, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(secondary_scriptures_raw, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(full_text, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(core_doctrine, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(key_claims, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(doctrinal_position, '')), 'B')
  ) stored;

create index idx_sermons_fts on public.sermons using gin (fts);

-- ---------------------------------------------------------------------------
-- Normalized scripture references (scripture search layer)
-- ---------------------------------------------------------------------------
create table public.sermon_scripture_refs (
  id uuid primary key default gen_random_uuid(),
  sermon_id uuid not null references public.sermons(id) on delete cascade,
  ref_kind text not null,
  book text not null,
  chapter integer not null,
  verse_start integer,
  verse_end integer,
  raw text,
  search_text text not null,
  constraint sermon_scripture_refs_ref_kind_check
    check (ref_kind in ('primary', 'secondary'))
);

create index idx_ssr_sermon_id on public.sermon_scripture_refs (sermon_id);
create index idx_ssr_search_text on public.sermon_scripture_refs using gin (search_text gin_trgm_ops);
create index idx_ssr_book_chapter on public.sermon_scripture_refs (book, chapter);

alter table public.sermon_scripture_refs enable row level security;

create policy "Anyone can read sermon_scripture_refs"
  on public.sermon_scripture_refs for select
  using (true);

create policy "Admin can insert sermon_scripture_refs"
  on public.sermon_scripture_refs for insert
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admin can update sermon_scripture_refs"
  on public.sermon_scripture_refs for update
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admin can delete sermon_scripture_refs"
  on public.sermon_scripture_refs for delete
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
