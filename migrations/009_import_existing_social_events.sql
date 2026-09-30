-- Migration 009 (optional, run AFTER 008): one-time import of the calendar events
-- already in the "Social Media Post Goes Live" category into the new posts table.
--
-- Each event becomes a post that stays linked to its original event, so when
-- calendar sync arrives (Stage 4) it updates these events instead of creating
-- duplicates. The events themselves are NOT modified or deleted.
-- Safe to re-run: events that already have a post are skipped.
--
-- Guesses made here (all editable afterwards in the app):
--   * status: 'live' if the event date has passed (Eastern time), otherwise 'scheduled'
--   * post type: 'Reel' if the title says reel, 'Carousel' if the description says
--     carousel, otherwise 'Other'
--   * "Caption:" text goes to caption; the comments (with or without a "Comments:"
--     header) go to seeder_comments

insert into posts (title, post_type, status, publish_date, publish_time, caption, seeder_comments, created_by, created_at, calendar_event_id)
select
  e.title,
  case
    when e.title ilike '%reel%' then 'Reel'
    when coalesce(e.description, '') ilike '%carousel%' then 'Carousel'
    else 'Other'
  end,
  case when e.event_date < (now() at time zone 'America/New_York')::date then 'live' else 'scheduled' end,
  e.event_date,
  e.event_time,
  case
    when e.description ~ '^Caption:' then nullif(btrim(regexp_replace(regexp_replace(e.description, '^Caption:', ''), 'Comments:.*$', ''), E' \t\r\n'), '')
    else null
  end,
  case
    when e.description is null then null
    when e.description ~ 'Comments:' then nullif(btrim(regexp_replace(e.description, '^.*?Comments:', ''), E' \t\r\n'), '')
    when e.description ~ '^Caption:' then null
    else nullif(btrim(e.description, E' \t\r\n'), '')
  end,
  e.created_by,
  e.created_at,
  e.id
from events e
where e.category = 'Social Media Post Goes Live'
  and not exists (select 1 from posts p where p.calendar_event_id = e.id);
