-- Migration 007: Social Media section, Stage 1a — the media library.
-- Run once in the Supabase SQL Editor. Adds ONE new table (media_items) and
-- nothing else: no existing table, row, policy, or storage bucket is changed.
-- Thumbnails reuse the existing "attachments" bucket under media/thumbs/.
--
-- Each item is a link to a file that lives in OneDrive (the file itself is
-- NOT stored in Supabase) plus a small thumbnail and searchable metadata.

create table if not exists media_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  media_type text not null default 'photo',   -- 'photo' | 'video'
  asset_kind text not null default 'raw',     -- 'raw' (unedited footage/photo) | 'finished' (edited, ready-to-post)
  post_format text,                           -- finished items only: 'Reel' | 'Carousel' | 'Image post' | 'Story' | 'Pinterest pin' | 'Blog thumbnail' | 'Other'
  source_url text,                            -- OneDrive link to the file
  file_name text,
  onedrive_item_id text,                      -- filled by the OneDrive picker in Stage 1b
  thumbnail_url text,
  thumbnail_path text,                        -- storage path in the "attachments" bucket, for cleanup
  people text[] not null default '{}',        -- who's in it: 'Cathy' | 'Evan' | 'Product' | 'Other'
  tags text[] not null default '{}',          -- free-form, stored lowercase (e.g. 'flatlay', 'box photo', product names)
  shot_date date,
  notes text,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_items_type_check check (media_type in ('photo', 'video')),
  constraint media_items_kind_check check (asset_kind in ('raw', 'finished'))
);

create index if not exists media_items_tags_idx on media_items using gin (tags);
create index if not exists media_items_people_idx on media_items using gin (people);
create index if not exists media_items_created_idx on media_items (created_at desc);

create or replace function media_items_touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists media_items_touch on media_items;
create trigger media_items_touch before update on media_items
  for each row execute function media_items_touch_updated_at();

-- Same access model as every other table: any signed-in user can read/write.
alter table media_items enable row level security;
drop policy if exists "authenticated read/write media_items" on media_items;
create policy "authenticated read/write media_items" on media_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Realtime, so Cathy and Evan see each other's changes live.
do $$
begin
  alter publication supabase_realtime add table media_items;
exception when duplicate_object then null;
end $$;
