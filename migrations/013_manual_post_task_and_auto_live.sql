-- Migration 013: manual-post tasks and automatic Live for scheduled posts.
-- Run AFTER 012. Adds one nullable column to tasks and two small functions. Enables the
-- pg_cron extension (Supabase's built-in scheduler) and schedules one job.
--
-- Manual posts: when a post becomes 'ready_to_post', a task is created for Cathy:
--   "Post manually at 6:00 PM: <title>", due on the publish date, importance High. Urgency
--   comes from the due date automatically (due today = Immediate), the same as every task.
--   While the post stays ready_to_post, title/date/time changes update the task. When the
--   post goes Live the task is marked done; if the post moves anywhere else, the open task
--   is deleted. Deleting the post deletes its task.
-- Auto-Live: every 5 minutes, any 'scheduled' post whose publish date and time (Eastern)
--   has passed becomes 'live'. 'ready_to_post' posts are never moved automatically.

alter table tasks add column if not exists post_id uuid references posts(id) on delete cascade;
create index if not exists tasks_post_idx on tasks (post_id);

create or replace function posts_sync_manual_task() returns trigger as $$
declare
  t_title text;
begin
  t_title := 'Post manually'
    || case when new.publish_time is not null then ' at ' || to_char(new.publish_time, 'FMHH12:MI AM') else '' end
    || ': ' || new.title;
  if new.status = 'ready_to_post' then
    if not exists (select 1 from tasks where post_id = new.id) then
      insert into tasks (title, owner, importance, urgency, due_date, recurrence, tags, created_by, post_id)
      values (t_title, 'Cathy', 'High', 'Medium', new.publish_date, 'none', array['social', 'manual post'], new.created_by, new.id);
    else
      update tasks set title = t_title, due_date = new.publish_date
       where post_id = new.id and not completed and (title, due_date) is distinct from (t_title, new.publish_date);
    end if;
  elsif new.status = 'live' then
    update tasks set completed = true where post_id = new.id and not completed;
  else
    delete from tasks where post_id = new.id and not completed;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists posts_manual_task_sync on posts;
create trigger posts_manual_task_sync after insert or update of status, title, publish_date, publish_time on posts
  for each row execute function posts_sync_manual_task();

create or replace function posts_auto_live() returns integer as $$
  with moved as (
    update posts set status = 'live'
     where status = 'scheduled' and publish_date is not null and publish_time is not null
       and (publish_date + publish_time) <= (now() at time zone 'America/New_York')
    returning id)
  select count(*)::integer from moved;
$$ language sql;

create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'posts-auto-live';
select cron.schedule('posts-auto-live', '*/5 * * * *', 'select public.posts_auto_live()');
