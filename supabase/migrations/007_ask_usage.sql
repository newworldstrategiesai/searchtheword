-- Per-account daily usage cap for the Ask assistant, to bound OpenAI spend.
-- One row per (account, day) holding that day's question count. The Ask route
-- calls record_ask_question() which atomically checks the cap and increments.

create table if not exists public.ask_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null default current_date,
  count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.ask_usage enable row level security;

-- Accounts may read their own usage (e.g. to show "X of N used today").
drop policy if exists "Users read own ask usage" on public.ask_usage;
create policy "Users read own ask usage"
  on public.ask_usage for select
  to authenticated
  using (user_id = auth.uid());

-- Writes go only through record_ask_question() (security definer); no direct
-- insert/update/delete policies, so accounts cannot tamper with their counts.

/**
 * Atomically enforce a per-account daily cap.
 * Returns one row: allowed (was this question permitted), used (count including
 * this question if allowed), day_limit (the cap that was applied).
 */
create or replace function public.record_ask_question(daily_limit int)
returns table (allowed boolean, used int, day_limit int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    return query select false, 0, daily_limit;
    return;
  end if;

  select coalesce(count, 0) into v_count
  from public.ask_usage
  where user_id = v_uid and usage_date = current_date;

  v_count := coalesce(v_count, 0);

  if v_count >= daily_limit then
    return query select false, v_count, daily_limit;
    return;
  end if;

  insert into public.ask_usage (user_id, usage_date, count, updated_at)
  values (v_uid, current_date, 1, now())
  on conflict (user_id, usage_date)
  do update set count = public.ask_usage.count + 1, updated_at = now();

  return query select true, v_count + 1, daily_limit;
end;
$$;

revoke all on function public.record_ask_question(int) from public;
grant execute on function public.record_ask_question(int) to authenticated, service_role;
