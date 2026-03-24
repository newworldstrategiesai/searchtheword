-- =============================================================================
-- SearchTheWord — full Supabase schema + search RPC (run once in SQL Editor)
-- =============================================================================
-- Before running:
--   1. Project → Settings → API: copy Project URL + anon key into .env.local
--   2. Authentication → Users: create your user, then set app_metadata:
--        { "role": "admin" }  (Dashboard → user → Raw App Meta Data) for ingest/admin
--   3. Paste this entire file into Supabase → SQL Editor → Run
--
-- Order: 001 base → 003 FHMI extensions → 004 search_sermons v2
-- (002 is superseded by 004; do not run 002 separately after this.)
-- =============================================================================

-- ###########################################################################
-- 001_initial_schema.sql
-- ###########################################################################

create extension if not exists "pg_trgm";
create extension if not exists "unaccent";

create table public.sermons (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  preacher      text not null,
  date          date,
  scripture_ref text,
  summary       text,
  full_text     text,
  media_url     text,
  fts           tsvector generated always as (
                  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                  setweight(to_tsvector('english', coalesce(scripture_ref, '')), 'A') ||
                  setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
                  setweight(to_tsvector('english', coalesce(full_text, '')), 'C')
                ) stored,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.keywords (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.sermon_keywords (
  sermon_id  uuid not null references public.sermons(id) on delete cascade,
  keyword_id uuid not null references public.keywords(id) on delete cascade,
  primary key (sermon_id, keyword_id)
);

create index idx_sermons_fts on public.sermons using gin (fts);
create index idx_sermons_scripture on public.sermons using gin (scripture_ref gin_trgm_ops);
create index idx_sermons_date on public.sermons (date desc nulls last);
create index idx_sermons_preacher on public.sermons using gin (preacher gin_trgm_ops);
create index idx_keywords_name on public.keywords using gin (name gin_trgm_ops);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sermons_updated_at
  before update on public.sermons
  for each row execute function public.set_updated_at();

alter table public.sermons enable row level security;
alter table public.keywords enable row level security;
alter table public.sermon_keywords enable row level security;

create policy "Anyone can read sermons"
  on public.sermons for select
  using (true);

create policy "Anyone can read keywords"
  on public.keywords for select
  using (true);

create policy "Anyone can read sermon_keywords"
  on public.sermon_keywords for select
  using (true);

create policy "Admin can insert sermons"
  on public.sermons for insert
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admin can update sermons"
  on public.sermons for update
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admin can delete sermons"
  on public.sermons for delete
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admin can insert keywords"
  on public.keywords for insert
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admin can update keywords"
  on public.keywords for update
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admin can delete keywords"
  on public.keywords for delete
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admin can insert sermon_keywords"
  on public.sermon_keywords for insert
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admin can delete sermon_keywords"
  on public.sermon_keywords for delete
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ###########################################################################
-- 003_fhmi_schema.sql
-- ###########################################################################

alter table public.keywords
  add column if not exists kind text not null default 'legacy';

alter table public.keywords
  drop constraint if exists keywords_kind_check;

alter table public.keywords
  add constraint keywords_kind_check
  check (kind in ('topic', 'keyword', 'doctrine', 'legacy'));

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

-- ###########################################################################
-- 004_search_sermons_v2.sql
-- ###########################################################################

drop function if exists public.search_sermons(text, int, int);
drop function if exists public.search_sermons(text, int, int, text);

create or replace function public.search_sermons(
  search_query text,
  page_offset int default 0,
  page_limit int default 20,
  search_mode text default 'all',
  filter_series text default null,
  filter_document_type text default null,
  filter_preacher text default null
)
returns table (
  id uuid,
  title text,
  preacher text,
  date date,
  scripture_ref text,
  summary text,
  full_text text,
  media_url text,
  created_at timestamptz,
  updated_at timestamptz,
  external_id text,
  series text,
  document_type text,
  core_doctrine text,
  google_drive_url text,
  folder text,
  rank double precision,
  total_count bigint,
  highlight_summary text,
  highlight_body text
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  q text := trim(coalesce(search_query, ''));
  mode text := lower(trim(coalesce(search_mode, 'all')));
  tsq tsquery;
  hl_opts text := 'MaxWords=40, MinWords=12, MaxFragments=2, StartSel=<mark>, StopSel=</mark>';
  q_lower text := lower(q);
  fs text := nullif(trim(coalesce(filter_series, '')), '');
  fd text := nullif(trim(coalesce(filter_document_type, '')), '');
  fp text := nullif(trim(coalesce(filter_preacher, '')), '');
begin
  if mode not in ('all', 'scripture', 'topic', 'fulltext') then
    mode := 'all';
  end if;

  if length(q) = 0 then
    return query
    with counted as (
      select
        s.id,
        s.title,
        s.preacher,
        s.date,
        s.scripture_ref,
        s.summary,
        s.full_text,
        s.media_url,
        s.created_at,
        s.updated_at,
        s.external_id,
        s.series,
        s.document_type,
        s.core_doctrine,
        s.google_drive_url,
        s.folder,
        0::double precision as combined_rank,
        count(*) over ()::bigint as tc,
        ''::text as hl_sum,
        ''::text as hl_body
      from public.sermons s
      where
        (fs is null or s.series ilike '%' || fs || '%')
        and (fd is null or coalesce(s.document_type, '') ilike '%' || fd || '%')
        and (fp is null or s.preacher ilike '%' || fp || '%')
    )
    select
      c.id,
      c.title,
      c.preacher,
      c.date,
      c.scripture_ref,
      c.summary,
      c.full_text,
      c.media_url,
      c.created_at,
      c.updated_at,
      c.external_id,
      c.series,
      c.document_type,
      c.core_doctrine,
      c.google_drive_url,
      c.folder,
      c.combined_rank as rank,
      c.tc as total_count,
      c.hl_sum as highlight_summary,
      c.hl_body as highlight_body
    from counted c
    order by c.date desc nulls last
    limit page_limit offset page_offset;
    return;
  end if;

  tsq := websearch_to_tsquery('english', q);
  if tsq is null or tsq = ''::tsquery then
    tsq := plainto_tsquery('english', q);
  end if;

  return query
  with base as (
    select
      s.id,
      s.title,
      s.preacher,
      s.date,
      s.scripture_ref,
      s.summary,
      s.full_text,
      s.media_url,
      s.created_at,
      s.updated_at,
      s.external_id,
      s.series,
      s.document_type,
      s.core_doctrine,
      s.google_drive_url,
      s.folder,
      case mode
        when 'scripture' then
          greatest(
            0.01::double precision,
            coalesce(
              (
                select max(similarity(ssr.search_text, q_lower))
                from public.sermon_scripture_refs ssr
                where ssr.sermon_id = s.id
              ),
              0::double precision
            ),
            case
              when s.scripture_ref is not null and similarity(s.scripture_ref, q) > 0.05
              then similarity(s.scripture_ref, q)::double precision
              else 0::double precision
            end,
            case
              when s.primary_scripture_raw is not null and similarity(s.primary_scripture_raw, q) > 0.05
              then similarity(s.primary_scripture_raw, q)::double precision * 0.9
              else 0::double precision
            end
          )
        when 'topic' then
          coalesce(
            (
              select max(0.5::double precision)
              from public.sermon_keywords sk
              join public.keywords kw on kw.id = sk.keyword_id
              where sk.sermon_id = s.id
                and kw.kind in ('topic', 'keyword', 'doctrine', 'legacy')
                and kw.name ilike '%' || q || '%'
            ),
            0::double precision
          )
        when 'fulltext' then
          case
            when tsq is not null and tsq <> ''::tsquery and s.fts @@ tsq
            then ts_rank_cd(s.fts, tsq)
            else 0::double precision
          end
        else
          greatest(
            case
              when tsq is not null and tsq <> ''::tsquery and s.fts @@ tsq
              then ts_rank_cd(s.fts, tsq)
              else 0::double precision
            end,
            coalesce(
              (
                select max(0.35::double precision)
                from public.sermon_keywords sk
                join public.keywords kw on kw.id = sk.keyword_id
                where sk.sermon_id = s.id and kw.name ilike '%' || q || '%'
              ),
              0::double precision
            ),
            coalesce(
              (
                select max(similarity(ssr.search_text, q_lower) * 0.8)
                from public.sermon_scripture_refs ssr
                where ssr.sermon_id = s.id
              ),
              0::double precision
            ),
            case
              when s.scripture_ref is not null and similarity(s.scripture_ref, q) > 0.05
              then similarity(s.scripture_ref, q)::double precision * 0.6
              else 0::double precision
            end
          )
      end as combined_rank,
      case
        when mode = 'scripture' then left(coalesce(s.summary, ''), 320)
        when tsq is not null and tsq <> ''::tsquery
        then ts_headline('english', coalesce(s.summary, ''), tsq, hl_opts)
        else left(coalesce(s.summary, ''), 320)
      end as hl_sum,
      case
        when mode = 'scripture' then left(coalesce(s.full_text, ''), 400)
        when tsq is not null and tsq <> ''::tsquery
        then ts_headline('english', coalesce(s.full_text, ''), tsq, hl_opts)
        else left(coalesce(s.full_text, ''), 400)
      end as hl_body
    from public.sermons s
    where
      (fs is null or s.series ilike '%' || fs || '%')
      and (fd is null or coalesce(s.document_type, '') ilike '%' || fd || '%')
      and (fp is null or s.preacher ilike '%' || fp || '%')
      and (
        case mode
          when 'scripture' then
            exists (
              select 1
              from public.sermon_scripture_refs ssr
              where ssr.sermon_id = s.id
                and (
                  ssr.search_text % q_lower
                  or q_lower % ssr.search_text
                  or similarity(ssr.search_text, q_lower) > 0.12
                )
            )
            or (s.scripture_ref is not null and s.scripture_ref % q)
            or (s.primary_scripture_raw is not null and s.primary_scripture_raw % q)
          when 'topic' then
            exists (
              select 1
              from public.sermon_keywords sk
              join public.keywords kw on kw.id = sk.keyword_id
              where sk.sermon_id = s.id
                and kw.kind in ('topic', 'keyword', 'doctrine', 'legacy')
                and kw.name ilike '%' || q || '%'
            )
          when 'fulltext' then
            tsq is not null and tsq <> ''::tsquery and s.fts @@ tsq
          else
            (tsq is not null and tsq <> ''::tsquery and s.fts @@ tsq)
            or exists (
              select 1
              from public.sermon_keywords sk
              join public.keywords kw on kw.id = sk.keyword_id
              where sk.sermon_id = s.id and kw.name ilike '%' || q || '%'
            )
            or exists (
              select 1
              from public.sermon_scripture_refs ssr
              where ssr.sermon_id = s.id
                and (
                  ssr.search_text % q_lower
                  or similarity(ssr.search_text, q_lower) > 0.12
                )
            )
            or (s.scripture_ref is not null and s.scripture_ref % q)
        end
      )
  ),
  ranked as (
    select
      b.*,
      count(*) over ()::bigint as total_count
    from base b
  )
  select
    r.id,
    r.title,
    r.preacher,
    r.date,
    r.scripture_ref,
    r.summary,
    r.full_text,
    r.media_url,
    r.created_at,
    r.updated_at,
    r.external_id,
    r.series,
    r.document_type,
    r.core_doctrine,
    r.google_drive_url,
    r.folder,
    r.combined_rank as rank,
    r.total_count,
    r.hl_sum as highlight_summary,
    r.hl_body as highlight_body
  from ranked r
  order by r.combined_rank desc, r.date desc nulls last
  limit page_limit offset page_offset;
end;
$$;

grant execute on function public.search_sermons(text, int, int, text, text, text, text) to anon, authenticated, service_role;

-- =============================================================================
-- Optional: sample rows (remove or skip if you import real data)
-- =============================================================================
/*
insert into public.sermons (title, preacher, date, scripture_ref, summary, full_text, media_url)
values
  (
    'Peace in Anxious Times',
    'Pastor Smith',
    '2024-01-14',
    'Philippians 4:6-7',
    'How prayer and thanksgiving replace anxiety with God''s peace.',
    null,
    'https://example.com/sermon1.mp3'
  ),
  (
    'Faith That Moves Mountains',
    'Pastor Smith',
    '2024-01-21',
    'Matthew 17:20',
    'Jesus teaches that faith as small as a mustard seed can accomplish great things.',
    null,
    null
  );

insert into public.keywords (name, kind)
values
  ('anxiety', 'topic'),
  ('faith', 'topic'),
  ('prayer', 'topic'),
  ('forgiveness', 'topic')
on conflict (name, kind) do nothing;

insert into public.sermon_keywords (sermon_id, keyword_id)
select s.id, k.id
from public.sermons s
cross join public.keywords k
where s.title = 'Peace in Anxious Times' and k.name in ('anxiety', 'prayer')
union all
select s.id, k.id
from public.sermons s
cross join public.keywords k
where s.title = 'Faith That Moves Mountains' and k.name = 'faith';
*/
