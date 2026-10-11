-- Migration 023: Pact v3. Microaggression counters become categorized counters with a history.
-- Run AFTER 022.
--
-- WHAT IT DOES TO EXISTING DATA
--   * DROPS pact_votes_legacy (the shared-ballot votes from 021, kept by 022). You said historical voting
--     data doesn't need to be preserved.
--   * DROPS the single-number pact_counters table and pact_bump_counter() from 022 (refuses to if it has any counts).
--   * Nothing else existing is touched. The private pact_votes / pact_status_log tables from 022 are unchanged.
--   Safe to re-run.
--
-- MODEL
--   pact_counter_categories  the categories, in a 'positive' or 'negative' group. Either of you can add, rename
--                            and remove them (shared settings). Removing a category also deletes its counts.
--   pact_counter_events      one row per click: which category, which person, +1 (minor) or +5 (major), when.
--                            Counters only ever go up. Totals and the over-time chart are built from this log.
--                            Both of you can read all of it; you can only add events for yourself (pact_counter_add).
--   pact_people              remembers which sign-in owns which name, so Cathy can't click for Evan. The first
--                            click claims a name for that account.
--   pact_counter_daily       view: per day (Eastern), category and person, the amount added that day.
--   Overall total = (sum of positive counters) - (sum of negative counters). Done in the app.

-- 1. Retire old objects
drop table if exists pact_votes_legacy;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'pact_counters') then
    if exists (select 1 from pact_counters) then
      raise exception 'pact_counters has data; not dropping it.';
    end if;
    drop table pact_counters;
  end if;
end $$;
drop function if exists pact_bump_counter(text);

-- 2. Tables
create table if not exists pact_people (
  person text primary key check (length(person) between 1 and 40),
  owner_id uuid not null unique
);

create table if not exists pact_counter_categories (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('positive', 'negative')),
  name text not null check (length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);
create unique index if not exists pact_counter_categories_name_uq
  on pact_counter_categories (kind, lower(btrim(name)));

create table if not exists pact_counter_events (
  id bigint generated always as identity primary key,
  category_id uuid not null references pact_counter_categories(id) on delete cascade,
  person text not null,
  amount integer not null check (amount in (1, 5)),
  created_at timestamptz not null default now()
);
create index if not exists pact_counter_events_category_idx on pact_counter_events (category_id);
create index if not exists pact_counter_events_created_idx on pact_counter_events (created_at);

-- 3. Starting categories (only when there are none yet)
-- created_at is staggered by a second each so they keep this order on screen.
insert into pact_counter_categories (kind, name, created_at)
select v.kind, v.name, now() + v.ord * interval '1 second'
from (values ('positive', 'IER', 1), ('positive', 'id10t', 2), ('positive', 'teIam', 3), ('positive', 'frigid takes', 4),
             ('negative', 'IER', 5), ('negative', 'LazyDay', 6)) as v(kind, name, ord)
where not exists (select 1 from pact_counter_categories);

-- 4. Row level security
alter table pact_people enable row level security;              -- no policies: only the functions touch it
alter table pact_counter_categories enable row level security;
alter table pact_counter_events enable row level security;

drop policy if exists "authenticated manage pact_counter_categories" on pact_counter_categories;
create policy "authenticated manage pact_counter_categories" on pact_counter_categories
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "authenticated read pact_counter_events" on pact_counter_events;
create policy "authenticated read pact_counter_events" on pact_counter_events
  for select using (auth.role() = 'authenticated');

revoke all on pact_people, pact_counter_categories, pact_counter_events from anon;
revoke all on pact_people from authenticated;
revoke insert, update, delete, truncate on pact_counter_events from authenticated;

-- 5. Daily totals view (runs with the caller's permissions)
create or replace view pact_counter_daily with (security_invoker = true) as
select (e.created_at at time zone 'America/New_York')::date as day,
       e.category_id,
       e.person,
       sum(e.amount)::integer as total
from pact_counter_events e
group by 1, 2, 3;
revoke all on pact_counter_daily from anon;
grant select on pact_counter_daily to authenticated;

-- 6. Add to my counter: +1 (minor) or +5 (major).
create or replace function pact_counter_add(p_category uuid, p_person text, p_amount integer) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  who text := btrim(p_person);
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  if p_amount is null or p_amount not in (1, 5) then raise exception 'Choose +1 or +5.'; end if;
  if who is null or length(who) < 1 or length(who) > 40 then raise exception 'Missing name.'; end if;
  if not exists (select 1 from pact_counter_categories where id = p_category) then
    raise exception 'That category no longer exists.';
  end if;
  begin
    insert into pact_people (person, owner_id) values (who, uid) on conflict (person) do nothing;
  exception when unique_violation then
    raise exception 'That counter belongs to someone else.';
  end;
  if not exists (select 1 from pact_people where person = who and owner_id = uid) then
    raise exception 'That counter belongs to someone else.';
  end if;
  insert into pact_counter_events (category_id, person, amount) values (p_category, who, p_amount);
end $$;

revoke all on function pact_counter_add(uuid, text, integer) from public, anon;
grant execute on function pact_counter_add(uuid, text, integer) to authenticated;

-- 7. Realtime
do $$
begin
  alter publication supabase_realtime add table pact_counter_categories;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table pact_counter_events;
exception when duplicate_object then null;
end $$;

-- 8. Tidy: pin the search_path of the month helper from 022 (security advisor suggestion).
alter function pact_current_month() set search_path = public, pg_temp;
