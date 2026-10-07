-- Migration 017: blog SEO fields; no calendar events for blog posts, pins, or stories;
-- a simpler tag on manual-post tasks. Run AFTER 016.
--
-- posts gains seo_title and seo_description (blog posts).
-- Calendar: blog posts, Pinterest pins, and Stories never have an event on the main calendar.
--   The 3 existing events for scheduled blog posts are deleted (the posts stay, and still show on
--   the Marketing calendar), and changing a post to one of those types removes its event.
-- Manual-post tasks are tagged "Social Media" (instead of "social" + "manual post"); the 3
--   existing ones are updated.

alter table posts
  add column if not exists seo_title text,
  add column if not exists seo_description text;

create or replace function posts_sync_calendar() returns trigger as $$
declare
  new_event_id uuid;
  ev_desc text;
begin
  if new.post_type in ('Blog post', 'Pinterest pin', 'Story') then
    if new.calendar_event_id is not null then
      delete from events where id = new.calendar_event_id;   -- the link on the post clears itself
    end if;
    return null;
  end if;
  ev_desc := posts_event_description(new);
  if new.status in ('scheduled', 'ready_to_post', 'live') and new.publish_date is not null then
    if new.calendar_event_id is null then
      if new.status in ('scheduled', 'ready_to_post') and new.post_type in ('Image post', 'Reel', 'Carousel') then
        insert into events (title, category, description, event_date, end_date, event_time, all_day, recurrence, created_by, post_id)
        values (new.title, 'Social Media Post Goes Live', ev_desc, new.publish_date, new.publish_date,
                new.publish_time, new.publish_time is null, 'none', new.created_by, new.id)
        returning id into new_event_id;
        update posts set calendar_event_id = new_event_id where id = new.id;
      end if;
    else
      update events
         set title = new.title,
             description = ev_desc,
             event_date = new.publish_date,
             end_date = new.publish_date,
             event_time = new.publish_time,
             all_day = (new.publish_time is null)
       where id = new.calendar_event_id
         and (title, description, event_date, event_time)
             is distinct from (new.title, ev_desc, new.publish_date, new.publish_time);
    end if;
  elsif new.calendar_event_id is not null then
    delete from events where id = new.calendar_event_id;
  end if;
  return null;
end;
$$ language plpgsql;

-- The post_type column is not in the trigger's column list, so add it: changing a post's type
-- must re-run the rule above.
drop trigger if exists posts_calendar_sync on posts;
create trigger posts_calendar_sync
  after insert or update of status, title, post_type, publish_date, publish_time, seeder_comments,
    seeder_raptr, seeder_evan, seeder_evan_reply, seeder_cathy, seeder_cathy_reply on posts
  for each row execute function posts_sync_calendar();

delete from events
 where id in (select calendar_event_id from posts
               where post_type in ('Blog post', 'Pinterest pin', 'Story') and calendar_event_id is not null);

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
      values (t_title, 'Cathy', 'High', 'Medium', new.publish_date, 'none', array['Social Media'], new.created_by, new.id);
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

update tasks set tags = array['Social Media'] where post_id is not null and tags is distinct from array['Social Media'];
