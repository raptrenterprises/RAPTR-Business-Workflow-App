-- Migration 008: Social Media section, Stage 2 — post planning, shot lists, campaigns.
-- Run once in the Supabase SQL Editor. Adds THREE new tables (campaigns, posts,
-- shot_items) plus two small triggers. No existing table, row, or policy is changed.
-- (Independent of migration 007; either can be run first.)
--
-- posts.calendar_event_id will point at the calendar event created for a post
-- when calendar sync is added (Stage 4). Deleting an event only clears that link.

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  notes text,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  post_type text not null default 'Other',   -- 'Reel' | 'Carousel' | 'Image post' | 'Story' | 'Pinterest pin' | 'Blog post' | 'Other'
  status text not null default 'idea',       -- idea -> planned -> filmed (or drafted, for blog posts) -> edited -> scheduled -> live
  publish_date date,
  publish_time time,
  caption text,
  seeder_comments text,                      -- one per line; copied into the calendar event description in Stage 4
  text_overlay text,
  notes text,
  tags text[] not null default '{}',
  campaign_id uuid references campaigns(id) on delete set null,
  calendar_event_id uuid references events(id) on delete set null,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_status_check check (status in ('idea', 'planned', 'filmed', 'drafted', 'edited', 'scheduled', 'live'))
);

create table if not exists shot_items (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  description text not null,
  media_type text,                           -- 'photo' | 'video' | null (either)
  people text[] not null default '{}',       -- 'Cathy' | 'Evan' | 'Product' | 'Other'
  tags text[] not null default '{}',
  completed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint shot_items_type_check check (media_type is null or media_type in ('photo', 'video'))
);

create index if not exists posts_publish_idx on posts (publish_date);
create index if not exists posts_campaign_idx on posts (campaign_id);
create index if not exists shot_items_post_idx on shot_items (post_id);
create index if not exists shot_items_tags_idx on shot_items using gin (tags);

create or replace function posts_touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists posts_touch on posts;
create trigger posts_touch before update on posts
  for each row execute function posts_touch_updated_at();

-- When every shot on a post is checked off and the post is still "planned",
-- move it to "filmed". Forward-only: it never moves a post backward, and blog
-- posts (which go idea -> planned -> drafted) are left alone. Living in the
-- database means it works the same for edits made by Claude through Supabase.
create or replace function shot_items_sync_post_status() returns trigger as $$
declare
  pid uuid;
  total integer;
  done integer;
begin
  pid := coalesce(new.post_id, old.post_id);
  select count(*), count(*) filter (where completed) into total, done from shot_items where post_id = pid;
  if total > 0 and total = done then
    update posts set status = 'filmed' where id = pid and status = 'planned' and post_type <> 'Blog post';
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists shot_items_sync on shot_items;
create trigger shot_items_sync after insert or update of completed or delete on shot_items
  for each row execute function shot_items_sync_post_status();

-- Same access model as every other table: any signed-in user can read/write.
alter table campaigns enable row level security;
alter table posts enable row level security;
alter table shot_items enable row level security;

drop policy if exists "authenticated read/write campaigns" on campaigns;
drop policy if exists "authenticated read/write posts" on posts;
drop policy if exists "authenticated read/write shot_items" on shot_items;
create policy "authenticated read/write campaigns" on campaigns
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read/write posts" on posts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read/write shot_items" on shot_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Realtime, so Cathy and Evan see each other's changes live.
do $$
begin
  alter publication supabase_realtime add table campaigns;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table posts;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table shot_items;
exception when duplicate_object then null;
end $$;
