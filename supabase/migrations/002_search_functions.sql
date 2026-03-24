-- Full-text + keyword + scripture search RPC

create or replace function public.search_sermons(
  search_query text,
  page_offset int default 0,
  page_limit int default 20
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
  rank double precision,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  q text := trim(coalesce(search_query, ''));
  tsq tsquery;
begin
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
        0::double precision as combined_rank,
        count(*) over ()::bigint as tc
      from public.sermons s
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
      c.combined_rank,
      c.tc
    from counted c
    order by c.date desc nulls last
    limit page_limit offset page_offset;
    return;
  end if;

  tsq := plainto_tsquery('english', q);

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
      greatest(
        case
          when tsq is not null and tsq <> ''::tsquery and s.fts @@ tsq
          then ts_rank(s.fts, tsq)
          else 0::double precision
        end,
        coalesce(
          (
            select max(0.3::double precision)
            from public.sermon_keywords sk
            join public.keywords kw on kw.id = sk.keyword_id
            where sk.sermon_id = s.id and kw.name ilike '%' || q || '%'
          ),
          0::double precision
        ),
        case
          when s.scripture_ref is not null and similarity(s.scripture_ref, q) > 0.05
          then similarity(s.scripture_ref, q)::double precision
          else 0::double precision
        end
      ) as combined_rank
    from public.sermons s
    where
      (tsq is not null and tsq <> ''::tsquery and s.fts @@ tsq)
      or exists (
        select 1
        from public.sermon_keywords sk
        join public.keywords kw on kw.id = sk.keyword_id
        where sk.sermon_id = s.id and kw.name ilike '%' || q || '%'
      )
      or (s.scripture_ref is not null and s.scripture_ref % q)
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
    r.combined_rank,
    r.total_count
  from ranked r
  order by r.combined_rank desc, r.date desc nulls last
  limit page_limit offset page_offset;
end;
$$;

grant execute on function public.search_sermons(text, int, int) to anon, authenticated, service_role;
