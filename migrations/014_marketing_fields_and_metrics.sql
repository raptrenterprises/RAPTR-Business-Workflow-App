-- Migration 014: music/audio, polls, Pinterest fields, performance metrics, and calendar events
-- only for posts that have seeder comments. Run AFTER 013. Additive, except:
--   * posts.pin_boards (empty) is renamed pin_boards_secondary, since boards are now a
--     primary board plus secondary boards.
--   * posts_sync_calendar only CREATES events for Image post, Reel, and Carousel posts.
--     Existing events (including the 7 imported posts typed "Other") keep being updated
--     and are only removed when the post leaves scheduled/ready/live or loses its date.
--
-- posts gains: music_audio; poll_enabled / poll_question / poll_options; pin_title,
--   pin_link (where a click on the pin leads), pin_topics (max 10), pin_alt_text,
--   pin_board_primary, pin_boards_secondary; metrics (jsonb, keyed by metric name) and
--   metrics_updated_on.
-- post_keywords (new): Google Search Console keywords for a blog post, with 30-day data.

alter table posts
  add column if not exists music_audio text,
  add column if not exists poll_enabled boolean not null default false,
  add column if not exists poll_question text,
  add column if not exists poll_options text[] not null default '{}',
  add column if not exists pin_title text,
  add column if not exists pin_link text,
  add column if not exists pin_topics text[] not null default '{}',
  add column if not exists pin_alt_text text,
  add column if not exists pin_board_primary text,
  add column if not exists metrics jsonb not null default '{}',
  add column if not exists metrics_updated_on date;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'posts' and column_name = 'pin_boards') then
    alter table posts rename column pin_boards to pin_boards_secondary;
  end if;
end $$;
alter table posts add column if not exists pin_boards_secondary text[] not null default '{}';

alter table posts drop constraint if exists posts_pin_topics_max;
alter table posts add constraint posts_pin_topics_max check (cardinality(pin_topics) <= 10);

create table if not exists post_keywords (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  keyword text not null,
  impressions integer,
  clicks integer,
  ctr numeric,            -- click rate, in percent (e.g. 3.5 means 3.5%)
  avg_position numeric,
  period_days integer not null default 30,
  created_at timestamptz not null default now()
);
create index if not exists post_keywords_post_idx on post_keywords (post_id);
create index if not exists post_keywords_keyword_idx on post_keywords (lower(keyword));

alter table post_keywords enable row level security;
drop policy if exists "authenticated read/write post_keywords" on post_keywords;
create policy "authenticated read/write post_keywords" on post_keywords
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

do $$
begin
  alter publication supabase_realtime add table post_keywords;
exception when duplicate_object then null;
end $$;

create or replace function posts_sync_calendar() returns trigger as $$
declare
  new_event_id uuid;
  ev_desc text;
begin
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
