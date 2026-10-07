-- Migration 018: new urgency scale, resettable urgency, and RAPTRMeet-driven urgency.
-- Run AFTER 017.
--
-- NEW SCALE (days until the "urgency date"):
--   Immediate = today or overdue, High = within a week, Medium = within a month,
--   Low = within 3 months, N/A = no timeline, or more than 3 months away.
-- URGENCY DATE: the due date if there is one; otherwise, for a task tied to a RAPTRMeet, the
--   RAPTRMeet's date (the task's planned meet day if it has one, else the meet's start date);
--   otherwise a manually set urgency counts down from when it was set: Low = 90 days,
--   Medium = 30 days, High = 7 days, Immediate = today, N/A never escalates. So a Low task
--   becomes Medium with a month left, High with a week left, and Immediate on the day.
-- RESET: urgency_set_at records when an urgency was last set (falls back to created_at).
--   Changing a task's or thread's urgency in the app (or pressing "Restart timeline") sets it to now.
-- MIGRATION: each open task or thread with no due date (and no RAPTRMeet) keeps the urgency
--   it shows TODAY under the old escalation rules, with its clock restarted from today.
--   Items with due dates (or a RAPTRMeet) are re-read from their dates under the new scale.
-- Also updates the effective_urgency() function and personal_urgent_view that mirror the app.

alter table tasks add column if not exists urgency_set_at timestamptz;
alter table threads add column if not exists urgency_set_at timestamptz;

-- 1) Keep each undated item at the level it currently shows, then restart its clock.
with t as (
  select id, coalesce(nullif(urgency, ''), 'Medium') as base,
         ((now() at time zone 'America/New_York')::date - (created_at at time zone 'America/New_York')::date) as age
    from tasks
   where due_date is null and raptrmeet_id is null and not completed
)
update tasks set
  urgency = case
    when t.base = 'Low' then case when t.age >= 25 then 'High' when t.age >= 21 then 'Medium' else 'Low' end
    when t.base = 'Medium' then case when t.age >= 4 then 'High' else 'Medium' end
    else t.base end,
  urgency_set_at = now()
from t where tasks.id = t.id;

with t as (
  select id, coalesce(nullif(urgency, ''), 'Medium') as base,
         ((now() at time zone 'America/New_York')::date - (created_at at time zone 'America/New_York')::date) as age
    from threads
   where due_date is null and completed_at is null
)
update threads set
  urgency = case
    when t.base = 'Low' then case when t.age >= 25 then 'High' when t.age >= 21 then 'Medium' else 'Low' end
    when t.base = 'Medium' then case when t.age >= 4 then 'High' else 'Medium' end
    else t.base end,
  urgency_set_at = now()
from t where threads.id = t.id;

-- 2) The SQL copy of the urgency rules. Same name and arguments as before (created_at now means
--    "when the urgency was set" and due_date means "the urgency date"), so existing callers keep working.
create or replace function public.effective_urgency(base_urgency text, created_at timestamptz, due_date date)
returns text
language plpgsql
stable
as $function$
declare
  today date := (now() at time zone 'America/New_York')::date;
  set_date date := (created_at at time zone 'America/New_York')::date;
  remaining int;
  horizon int;
begin
  if due_date is not null then
    remaining := due_date - today;
  else
    if base_urgency is null or base_urgency = '' then base_urgency := 'Medium'; end if;
    if base_urgency = 'N/A' then return 'N/A'; end if;
    horizon := case base_urgency when 'Immediate' then 0 when 'High' then 7 when 'Medium' then 30 when 'Low' then 90 else 30 end;
    remaining := horizon - (today - set_date);
  end if;
  if remaining <= 0 then return 'Immediate';
  elsif remaining <= 7 then return 'High';
  elsif remaining <= 30 then return 'Medium';
  elsif remaining <= 90 then return 'Low';
  else return 'N/A';
  end if;
end;
$function$;

create or replace view public.personal_urgent_view as
 SELECT user_name,
    ( SELECT count(*) AS count
           FROM tasks t
          WHERE t.completed = false AND (t.owner = u.user_name OR t.owner = 'shared'::text)
            AND (effective_urgency(
                   t.urgency,
                   coalesce(t.urgency_set_at, t.created_at),
                   coalesce(t.due_date, (select coalesce(t.raptrmeet_day, m.start_date) from raptrmeets m where m.id = t.raptrmeet_id))
                 ) = 'Immediate'::text
                 OR t.due_date IS NOT NULL AND t.due_date < (now() AT TIME ZONE 'America/New_York'::text)::date)) AS urgent_task_count,
    ( SELECT count(*) AS count
           FROM threads th
          WHERE th.status = 'active'::text AND th.turn = u.user_name AND NOT (u.user_name = ANY (th.seen_by))) AS unread_thread_count
   FROM ( VALUES ('Cathy'::text), ('Evan'::text)) u(user_name);
