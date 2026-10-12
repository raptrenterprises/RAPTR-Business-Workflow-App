-- Migration 026: counters become micro AND macro. The "+5" button is replaced by a separate macro counter. Run AFTER 025.
--
-- WHAT IT DOES TO EXISTING DATA
--   * Every counter click is now one count of a kind: 'micro' (what +1 was) or 'macro'.
--   * Any old +5 click becomes ONE macro count; any old +1 click stays ONE micro count.
--     (Checked before running: there was 1 click in total, a +1, so nothing needed converting.)
--   * Categories, people and everything outside the counters are untouched. Safe to re-run.
--
-- COMPATIBLE WITH THE PREVIOUS APP VERSION
--   The older pact_counter_add(category, person, amount) still works: amount 1 records a micro count, 5 a macro
--   count. The view keeps its old columns and only adds `kind` at the end. So the app keeps working between running
--   this and deploying the new code. Once the new code is live, the old three-argument version can be dropped.

-- 1. Kind of each click
alter table pact_counter_events add column if not exists kind text not null default 'micro' check (kind in ('micro', 'macro'));

do $$
begin
  if exists (select 1 from pact_counter_events where amount <> 1) then
    update pact_counter_events set kind = 'macro' where amount = 5;
    update pact_counter_events set amount = 1 where amount <> 1;
  end if;
end $$;

alter table pact_counter_events drop constraint if exists pact_counter_events_amount_check;
alter table pact_counter_events add constraint pact_counter_events_amount_check check (amount = 1);

-- 2. Daily totals now split by kind (new column last, so the old columns are unchanged)
create or replace view pact_counter_daily with (security_invoker = true) as
select (e.created_at at time zone 'America/New_York')::date as day,
       e.category_id,
       e.person,
       sum(e.amount)::integer as total,
       e.kind
from pact_counter_events e
group by 1, 2, 3, 5;
revoke all on pact_counter_daily from anon;
grant select on pact_counter_daily to authenticated;

-- 3. Add one micro or macro count to my counter
create or replace function pact_counter_add(p_category uuid, p_person text, p_kind text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  who text := btrim(p_person);
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  if p_kind is null or p_kind not in ('micro', 'macro') then raise exception 'Choose micro or macro.'; end if;
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
  insert into pact_counter_events (category_id, person, amount, kind) values (p_category, who, 1, p_kind);
end $$;

-- The previous app version's call: +1 is a micro count, +5 a macro count.
create or replace function pact_counter_add(p_category uuid, p_person text, p_amount integer) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_amount is null or p_amount not in (1, 5) then raise exception 'Choose +1 or +5.'; end if;
  perform pact_counter_add(p_category, p_person, (case p_amount when 5 then 'macro' else 'micro' end)::text);
end $$;

revoke all on function pact_counter_add(uuid, text, text), pact_counter_add(uuid, text, integer) from public, anon;
grant execute on function pact_counter_add(uuid, text, text), pact_counter_add(uuid, text, integer) to authenticated;
