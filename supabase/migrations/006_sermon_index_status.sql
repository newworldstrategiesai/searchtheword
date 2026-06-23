-- Per-sermon embedding-index status, used by the admin "Index new/changed only"
-- preview so we can estimate work and cost WITHOUT downloading every full_text.
--
-- Returns one row per sermon with: the length of full_text (for cost estimates),
-- how many embedding chunks currently exist, and when the newest chunk was
-- written (to detect sermons edited after they were last indexed).
--
-- Deterministic ordering (updated_at desc, id) so the targeted reindexer can
-- page over the same id list across multiple batched requests.

create or replace function public.admin_sermon_index_status()
returns table (
  id uuid,
  title text,
  updated_at timestamptz,
  full_text_len int,
  chunk_count int,
  last_indexed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.title,
    s.updated_at,
    coalesce(length(s.full_text), 0)::int as full_text_len,
    coalesce(c.chunk_count, 0)::int as chunk_count,
    c.last_indexed_at
  from public.sermons s
  left join (
    select sermon_id,
           count(*) as chunk_count,
           max(created_at) as last_indexed_at
    from public.sermon_chunks
    group by sermon_id
  ) c on c.sermon_id = s.id
  order by s.updated_at desc nulls last, s.id;
$$;

revoke all on function public.admin_sermon_index_status() from public;
grant execute on function public.admin_sermon_index_status() to authenticated, service_role;
