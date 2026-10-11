-- Migration 022: Pact v2. Private votes, relationship status as a setting, microaggression counters,
-- and an estimated time of pact enactment (ETE). Run AFTER 021.
--
-- WHAT IT DOES TO EXISTING DATA
--   pact_votes from 021 (one shared row per month holding both people's answers) is RENAMED to
--   pact_votes_legacy, not dropped, and its policy is removed so signed-in users can no longer read it
--   (it holds both people's ratings). Nothing in it is deleted. A new pact_votes takes the name.
--   Every other table is untouched. Safe to re-run.
--
-- PRIVACY MODEL
--   Votes and statuses are readable ONLY by the person who wrote them (row level security), and clients
--   cannot write to those tables directly. All writes go through the functions below, which check the rules.
--   The two people never see each other's rating or the combined score. They get back only the result
--   category and the estimate, worked out inside the database (security definer functions).
--
-- TABLES
--   pact_votes       one row per person per month: that person's interest rating (0-100).
--   pact_status_log  each person's relationship status, effective from a month onward. A month is scored with
--                    the latest status at or before it, so changing a status never rewrites past months.
--   pact_counters    one counter per person. Everyone can read both; only the owner can add to their own.
--
-- RULES (the scoring from the spec, now enforced here)
--   combined score = sum of the two ratings
--   moderate threshold = 75 + adjustments, strong threshold = 100 + adjustments
--   adjustment per person: Single +0, In a relationship +10, Married +25 (added once per person, to both thresholds)
--   strong if score >= strong; moderate ("Sex to decide") if >= moderate; otherwise below.
--
-- ESTIMATED TIME OF ENACTMENT (ETE)
--   "Enactment" = reaching the STRONG threshold.
--   1. Each month's progress = combined score / that month's strong threshold. Dividing by the threshold means
--      a status change (which moves the target) doesn't distort the trend.
--   2. For each month, fit a straight line (least squares) through the progress of every month up to and including
--      it, so the estimate is cumulative and each new month refines it.
--   3. Months to go = (1 - latest progress) / slope. ETE = that month's start + months to go.
--   Needs two months of data; no estimate when the trend is flat or falling (slope <= 0.005 a month), or when
--   it lands more than 60 months out. If progress is already >= 1 the status is 'reached'.
--
-- LOCKS: once both people have voted for a month the result exists, so that month's votes lock, and a status
--   change from then on applies from next month. (Otherwise someone could nudge their own answer and watch the
--   result flip to work out the other person's rating.)

-- 1. Retire the shared-ballot table from 021 (keep the data, close the access).
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'pact_votes' and column_name = 'ballots') then
    begin
      alter publication supabase_realtime drop table pact_votes;
    exception when others then null;
    end;
    alter table pact_votes rename to pact_votes_legacy;
    alter index if exists pact_votes_pkey rename to pact_votes_legacy_pkey;
    alter index if exists pact_votes_month_key rename to pact_votes_legacy_month_key;
    drop policy if exists "authenticated read/write pact_votes" on pact_votes_legacy;
    alter table pact_votes_legacy enable row level security; -- no policies = no app access
  end if;
end $$;

-- 2. Tables
create table if not exists pact_votes (
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  user_id uuid not null,
  interest integer not null check (interest between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (month, user_id)
);

create table if not exists pact_status_log (
  user_id uuid not null,
  effective_month text not null check (effective_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  status text not null check (status in ('Single', 'In a relationship', 'Married')),
  updated_at timestamptz not null default now(),
  primary key (user_id, effective_month)
);

create table if not exists pact_counters (
  person text primary key check (length(person) between 1 and 40),
  owner_id uuid not null unique,
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now()
);

-- 3. Row level security: read your own votes/statuses; read both counters; no direct writes.
alter table pact_votes enable row level security;
alter table pact_status_log enable row level security;
alter table pact_counters enable row level security;

drop policy if exists "read own pact_votes" on pact_votes;
create policy "read own pact_votes" on pact_votes for select using (user_id = auth.uid());
drop policy if exists "read own pact_status_log" on pact_status_log;
create policy "read own pact_status_log" on pact_status_log for select using (user_id = auth.uid());
drop policy if exists "read pact_counters" on pact_counters;
create policy "read pact_counters" on pact_counters for select using (auth.role() = 'authenticated');

revoke all on pact_votes, pact_status_log, pact_counters from anon;
revoke insert, update, delete, truncate on pact_votes, pact_status_log, pact_counters from authenticated;

-- 4. Functions
create or replace function pact_current_month() returns text
language sql stable as $$ select to_char(now() at time zone 'America/New_York', 'YYYY-MM') $$;

-- Save or change my interest rating for the current month.
create or replace function pact_submit_vote(p_interest integer) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  cur text := pact_current_month();
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  if p_interest is null or p_interest < 0 or p_interest > 100 then
    raise exception 'The interest rating must be a whole number from 0 to 100.';
  end if;
  if not exists (select 1 from pact_status_log where user_id = uid and effective_month <= cur) then
    raise exception 'Set your relationship status (gear icon) before voting.';
  end if;
  if (select count(*) from pact_votes where month = cur) >= 2 then
    raise exception 'This month''s result is already in, so the votes are locked.';
  end if;
  insert into pact_votes (month, user_id, interest) values (cur, uid, p_interest)
  on conflict (month, user_id) do update set interest = excluded.interest, updated_at = now();
end $$;

-- Set my relationship status. Applies to this month, unless this month's result already exists (then next month).
create or replace function pact_set_status(p_status text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  cur text := pact_current_month();
  eff text;
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  if p_status is null or p_status not in ('Single', 'In a relationship', 'Married') then
    raise exception 'Choose Single, In a relationship, or Married.';
  end if;
  if (select count(*) from pact_votes where month = cur) >= 2 then
    eff := to_char(to_date(cur || '-01', 'YYYY-MM-DD') + interval '1 month', 'YYYY-MM');
  else
    eff := cur;
  end if;
  insert into pact_status_log (user_id, effective_month, status) values (uid, eff, p_status)
  on conflict (user_id, effective_month) do update set status = excluded.status, updated_at = now();
  return eff;
end $$;

-- How many people have voted this month (0, 1 or 2). Reveals who is waiting, never any values.
create or replace function pact_votes_in(p_month text) returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int from pact_votes where month = p_month and auth.uid() is not null
$$;

-- Add 1 to my counter. The first click claims the name for that account; after that only its owner can add.
create or replace function pact_bump_counter(p_person text) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  who text := btrim(p_person);
  n integer;
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  if who is null or length(who) < 1 or length(who) > 40 then raise exception 'Missing name.'; end if;
  begin
    insert into pact_counters (person, owner_id, count) values (who, uid, 1)
    on conflict (person) do update set count = pact_counters.count + 1, updated_at = now()
      where pact_counters.owner_id = uid
    returning count into n;
  exception when unique_violation then
    raise exception 'That counter belongs to someone else.';
  end;
  if n is null then raise exception 'That counter belongs to someone else.'; end if;
  return n;
end $$;

-- Result and ETE for every month where both people have voted. Returns no ratings and no scores.
create or replace function pact_history()
returns table (month_key text, level text, ete_status text, ete_date date, months_to_go numeric)
language sql stable security definer set search_path = public, pg_temp as $$
  with resolved as (
    select v.month, v.user_id, v.interest,
           (select s.status from pact_status_log s
             where s.user_id = v.user_id and s.effective_month <= v.month
             order by s.effective_month desc limit 1) as status
    from pact_votes v
  ),
  per_month as (
    select month,
           sum(interest) as total,
           sum(case status when 'Married' then 25 when 'In a relationship' then 10 else 0 end) as adjustment
    from resolved
    group by month
    having count(*) = 2 and count(status) = 2
  ),
  scored as (
    select month, total, 75 + adjustment as moderate, 100 + adjustment as strong,
           total::numeric / (100 + adjustment) as r,
           substr(month, 1, 4)::int * 12 + substr(month, 6, 2)::int as x
    from per_month
  ),
  trended as (
    select *, count(*) over w as n, regr_slope(r, x) over w as slope
    from scored
    window w as (order by x rows between unbounded preceding and current row)
  )
  select month,
         case when total >= strong then 'strong' when total >= moderate then 'moderate' else 'below' end,
         case when r >= 1 then 'reached'
              when n < 2 then 'need_more_data'
              when slope is null or slope <= 0.005 then 'no_trend'
              when (1 - r) / slope > 60 then 'too_far'
              else 'estimated' end,
         case when r >= 1 then to_date(month || '-01', 'YYYY-MM-DD')
              when n >= 2 and slope > 0.005 and (1 - r) / slope <= 60
                then to_date(month || '-01', 'YYYY-MM-DD') + round(((1 - r) / slope * 30.4375)::numeric)::int
         end,
         case when r < 1 and n >= 2 and slope > 0.005 and (1 - r) / slope <= 60
                then round(((1 - r) / slope)::numeric, 1)
         end
  from trended
  where auth.uid() is not null
  order by x
$$;

revoke all on function pact_current_month(), pact_submit_vote(integer), pact_set_status(text),
  pact_votes_in(text), pact_bump_counter(text), pact_history() from public, anon;
grant execute on function pact_current_month(), pact_submit_vote(integer), pact_set_status(text),
  pact_votes_in(text), pact_bump_counter(text), pact_history() to authenticated;

-- 5. Realtime (your own votes, and both counters)
do $$
begin
  alter publication supabase_realtime add table pact_votes;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table pact_counters;
exception when duplicate_object then null;
end $$;
