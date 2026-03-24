-- Optional seed data for local development (run after migrations)

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

insert into public.keywords (name)
values ('anxiety'), ('faith'), ('prayer'), ('forgiveness')
on conflict (name) do nothing;

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
