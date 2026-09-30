-- Migration 011: Social Media section, Stage 4 — posts <-> calendar events.
-- Run AFTER 008 (and after 009 if you're importing your existing events).
-- Adds two triggers on posts. No table or existing row is changed by running it.
--
-- What it does (one-way: post -> calendar event):
--   * A post that is "scheduled" with a publish date gets a calendar event in the
--     "Social Media Post Goes Live" category: title = post title, date/time = publish
--     date/time (all-day if there is no time), description = the seeder comments.
--   * While a post is "scheduled" or "live", edits to its title, date, time, or
--     seeder comments are copied to its event.
--   * Moving a post out of scheduled/live (or clearing its date) deletes its event.
--   * Deleting a post deletes its event.
-- Editing an event directly in the calendar does NOT change the post, and the
-- next change to the post will overwrite those edits.

create or replace function posts_sync_calendar() returns trigger as $$
declare
  new_event_id uuid;
begin
  if new.status in ('scheduled', 'live') and new.publish_date is not null then
    if new.calendar_event_id is null then
      if new.status = 'scheduled' then
        insert into events (title, category, description, event_date, end_date, event_time, all_day, recurrence, created_by)
        values (new.title, 'Social Media Post Goes Live', new.seeder_comments, new.publish_date, new.publish_date,
                new.publish_time, new.publish_time is null, 'none', new.created_by)
        returning id into new_event_id;
        update posts set calendar_event_id = new_event_id where id = new.id;
      end if;
    else
      update events
         set title = new.title,
             description = new.seeder_comments,
             event_date = new.publish_date,
             end_date = new.publish_date,
             event_time = new.publish_time,
             all_day = (new.publish_time is null)
       where id = new.calendar_event_id
         and (title, description, event_date, event_time)
             is distinct from (new.title, new.seeder_comments, new.publish_date, new.publish_time);
    end if;
  elsif new.calendar_event_id is not null then
    delete from events where id = new.calendar_event_id;   -- the link on the post clears itself
  end if;
  return null;
end;
$$ language plpgsql;

-- Only fires when one of the synced fields is written, so the small update
-- above (which only sets calendar_event_id) can't trigger it again.
drop trigger if exists posts_calendar_sync on posts;
create trigger posts_calendar_sync after insert or update of status, title, publish_date, publish_time, seeder_comments on posts
  for each row execute function posts_sync_calendar();

create or replace function posts_delete_calendar_event() returns trigger as $$
begin
  if old.calendar_event_id is not null then
    delete from events where id = old.calendar_event_id;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists posts_calendar_delete on posts;
create trigger posts_calendar_delete after delete on posts
  for each row execute function posts_delete_calendar_event();
