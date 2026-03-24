-- SearchTheWord initial schema
-- Run in Supabase SQL Editor or via supabase db push

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
  for each row execute procedure public.set_updated_at();

-- RLS
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

-- Admin writes via JWT app_metadata.role = 'admin' (set in Supabase Dashboard for admin users)
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

-- Service role bypasses RLS; ingestion script uses service role key
