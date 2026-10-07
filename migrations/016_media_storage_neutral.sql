-- Migration 016: storage-neutral media locations.
-- Run AFTER 015. Additive; the media library was empty when this was written.
--
-- A media item's file lives in one of two folders: asset_kind 'raw' -> the "raw" folder,
-- 'finished' -> the "edited" folder. Its location inside that folder is subfolder (optional)
-- plus file_name (the original name, captured automatically by the bulk add).
-- media_number is a permanent number for each item (shown as #123 in the app).
-- media_locations holds, per folder, the base link and how to turn it into a link:
--   link_style 'folder': every item opens that folder link (OneDrive today)
--   link_style 'path'  : the app builds base_url + subfolder/file_name (a server later)
-- Moving to a server later means copying the files and changing these two rows.
-- A file name can only be used once per folder (case-insensitive).

alter table media_items
  add column if not exists subfolder text,
  add column if not exists media_number bigint generated always as identity;

create unique index if not exists media_items_path_unique
  on media_items (asset_kind, coalesce(subfolder, ''), lower(file_name))
  where file_name is not null and file_name <> '';

create table if not exists media_locations (
  collection text primary key check (collection in ('raw', 'edited')),
  base_url text,
  link_style text not null default 'folder' check (link_style in ('folder', 'path')),
  updated_at timestamptz not null default now()
);
insert into media_locations (collection) values ('raw'), ('edited') on conflict do nothing;

alter table media_locations enable row level security;
drop policy if exists "authenticated read/write media_locations" on media_locations;
create policy "authenticated read/write media_locations" on media_locations
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

do $$
begin
  alter publication supabase_realtime add table media_locations;
exception when duplicate_object then null;
end $$;
