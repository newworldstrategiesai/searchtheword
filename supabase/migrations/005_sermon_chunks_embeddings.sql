-- Chunk embeddings for semantic search + RAG (pgvector). Dimension matches OpenAI text-embedding-3-small default (1536).

create extension if not exists vector;

create table if not exists public.sermon_chunks (
  id uuid primary key default gen_random_uuid(),
  sermon_id uuid not null references public.sermons (id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536) not null,
  embedding_model text not null default 'text-embedding-3-small',
  created_at timestamptz not null default now(),
  unique (sermon_id, chunk_index)
);

create index if not exists idx_sermon_chunks_sermon_id on public.sermon_chunks (sermon_id);

create index if not exists sermon_chunks_embedding_hnsw
  on public.sermon_chunks
  using hnsw (embedding vector_cosine_ops);

alter table public.sermon_chunks enable row level security;

create policy "Anyone can read sermon_chunks"
  on public.sermon_chunks for select
  using (true);

create policy "Admin can insert sermon_chunks"
  on public.sermon_chunks for insert
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admin can update sermon_chunks"
  on public.sermon_chunks for update
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admin can delete sermon_chunks"
  on public.sermon_chunks for delete
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create or replace function public.semantic_top_sermons(
  query_embedding vector(1536),
  result_limit int default 80,
  filter_series text default null,
  filter_document_type text default null,
  filter_preacher text default null
)
returns table (
  sermon_id uuid,
  similarity double precision
)
language plpgsql
stable
parallel safe
security invoker
set search_path = public
as $$
declare
  fs text := nullif(trim(coalesce(filter_series, '')), '');
  fd text := nullif(trim(coalesce(filter_document_type, '')), '');
  fp text := nullif(trim(coalesce(filter_preacher, '')), '');
begin
  return query
  select x.sermon_id, x.sim::double precision as similarity
  from (
    select
      sc.sermon_id,
      max(1::double precision - (sc.embedding <=> query_embedding)) as sim
    from public.sermon_chunks sc
    inner join public.sermons s on s.id = sc.sermon_id
    where
      (fs is null or s.series ilike '%' || fs || '%')
      and (fd is null or coalesce(s.document_type, '') ilike '%' || fd || '%')
      and (fp is null or s.preacher ilike '%' || fp || '%')
    group by sc.sermon_id
  ) x
  where x.sim > 0.08
  order by x.sim desc
  limit result_limit;
end;
$$;

grant execute on function public.semantic_top_sermons(vector, int, text, text, text) to anon, authenticated, service_role;

create or replace function public.match_sermon_chunks(
  query_embedding vector(1536),
  match_count int default 12
)
returns table (
  sermon_id uuid,
  sermon_title text,
  sermon_date date,
  chunk_index int,
  content text,
  similarity double precision
)
language sql
stable
parallel safe
security invoker
set search_path = public
as $$
  select
    sc.sermon_id,
    s.title,
    s.date,
    sc.chunk_index,
    sc.content,
    (1::double precision - (sc.embedding <=> query_embedding))::double precision as similarity
  from public.sermon_chunks sc
  inner join public.sermons s on s.id = sc.sermon_id
  order by sc.embedding <=> query_embedding
  limit greatest(1, least(match_count, 32));
$$;

grant execute on function public.match_sermon_chunks(vector, int) to anon, authenticated, service_role;
