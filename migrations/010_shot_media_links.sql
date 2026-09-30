-- Migration 010: Social Media section, Stage 3 — link library media to shot items.
-- Run AFTER 007 (media_items) and 008 (shot_items). Adds ONE new table and one
-- trigger; no existing table, row, or policy is changed.
--
-- Linking a media item to a shot marks the shot complete; removing its last
-- link marks it incomplete again. Completing shots then feeds the existing
-- "all shots done -> post becomes Filmed" rule from migration 008.
-- Deleting a media item or a shot simply removes its links.

create table if not exists shot_item_media (
  shot_item_id uuid not null references shot_items(id) on delete cascade,
  media_id uuid not null references media_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shot_item_id, media_id)
);

create index if not exists shot_item_media_media_idx on shot_item_media (media_id);

create or replace function shot_item_media_sync_completed() returns trigger as $$
declare
  sid uuid;
  has_links boolean;
begin
  sid := coalesce(new.shot_item_id, old.shot_item_id);
  select exists (select 1 from shot_item_media where shot_item_id = sid) into has_links;
  update shot_items set completed = has_links where id = sid and completed is distinct from has_links;
  return null;
end;
$$ language plpgsql;

drop trigger if exists shot_item_media_sync on shot_item_media;
create trigger shot_item_media_sync after insert or delete on shot_item_media
  for each row execute function shot_item_media_sync_completed();

alter table shot_item_media enable row level security;
drop policy if exists "authenticated read/write shot_item_media" on shot_item_media;
create policy "authenticated read/write shot_item_media" on shot_item_media
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

do $$
begin
  alter publication supabase_realtime add table shot_item_media;
exception when duplicate_object then null;
end $$;
