-- search_sermons v2: mode (all|scripture|topic|fulltext), ts_headline snippets, optional filters

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
