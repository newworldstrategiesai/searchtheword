-- Run in Supabase SQL editor after migrations (sanity checks; empty DB returns 0 rows)
-- EXPLAIN for performance review:
-- explain analyze select * from search_sermons('faith', 0, 20, 'all', null, null, null);
-- explain analyze select * from search_sermons('Exodus 16', 0, 20, 'scripture', null, null, null);

select count(*) as sermon_count from public.sermons;
select count(*) as ref_count from public.sermon_scripture_refs;
select count(*) as keyword_count from public.keywords;
