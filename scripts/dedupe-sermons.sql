-- Emergency duplicate cleanup (run in Supabase Dashboard → SQL Editor).
-- Keeps one row per title + speaker + date (prefers external_id, then longest text, then oldest).
-- Related rows (keywords, scripture refs, chunks) cascade on delete.

-- 1) Preview counts
select count(*) as total_sermons from public.sermons;

select count(*) as rows_to_delete
from (
  select id,
    row_number() over (
      partition by lower(trim(title)), lower(trim(preacher)), coalesce(date::text, '')
      order by
        case when external_id is not null and trim(external_id) <> '' then 0 else 1 end,
        length(coalesce(full_text, '')) + length(coalesce(summary, '')) desc,
        created_at asc
    ) as rn
  from public.sermons
) ranked
where rn > 1;

-- 2) Uncomment to delete (run preview first)
/*
with ranked as (
  select id,
    row_number() over (
      partition by lower(trim(title)), lower(trim(preacher)), coalesce(date::text, '')
      order by
        case when external_id is not null and trim(external_id) <> '' then 0 else 1 end,
        length(coalesce(full_text, '')) + length(coalesce(summary, '')) desc,
        created_at asc
    ) as rn
  from public.sermons
)
delete from public.sermons s
using ranked r
where s.id = r.id and r.rn > 1;
*/
