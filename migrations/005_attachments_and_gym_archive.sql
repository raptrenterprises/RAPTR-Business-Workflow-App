-- Migration: adds file-attachment support to tasks/threads/events, and an
-- "archived" flag to gym_challenges so old challenges can be minimized.
-- Run this once in the Supabase SQL Editor after deploying the Stage 9 code.

-- ---- Attachments ----
-- Tasks and events are single rows, so attachments live directly on the row
-- as a jsonb array: [{ name, path, url, size, type, uploadedBy, uploadedAt }, ...]
alter table tasks add column if not exists attachments jsonb not null default '[]';
alter table events add column if not exists attachments jsonb not null default '[]';
-- Threads don't need a new column — attachments are stored per-message inside
-- the existing `messages` jsonb array (each message gets an `attachments: []`
-- field). No migration needed there; older messages just default to [] in the
-- app when the field is missing.

-- ---- Gym challenge archiving ----
alter table gym_challenges add column if not exists archived boolean not null default false;

-- ---- Storage bucket for attachments ----
-- Creates a PUBLIC bucket named "attachments" (read is public so uploaded
-- files can be linked/downloaded directly without generating signed URLs;
-- write/delete is restricted to signed-in users only, same trust model as
-- the rest of the app). If you'd rather keep files private, let me know and
-- I'll switch this to signed URLs instead.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

drop policy if exists "authenticated upload attachments" on storage.objects;
drop policy if exists "authenticated delete attachments" on storage.objects;
drop policy if exists "public read attachments" on storage.objects;

create policy "public read attachments" on storage.objects
  for select using (bucket_id = 'attachments');
create policy "authenticated upload attachments" on storage.objects
  for insert with check (bucket_id = 'attachments' and auth.role() = 'authenticated');
create policy "authenticated delete attachments" on storage.objects
  for delete using (bucket_id = 'attachments' and auth.role() = 'authenticated');
