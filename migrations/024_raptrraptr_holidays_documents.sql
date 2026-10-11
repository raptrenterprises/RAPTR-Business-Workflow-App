-- Migration 024: raptrraptr "Holidays" and "Documents" sub-sections. Run AFTER 023.
-- Additive only: creates new tables and one new storage bucket; nothing existing is changed. Safe to re-run.
--
-- rr_holidays     the four holiday info cards. Both of you can read and edit them. The four rows are fixed
--                 (no add/delete from the app); only their text and first-celebration year change.
--                   required_elements   free text; lines starting with "- " show as bullets
--                   anniversary_notes   same, for the 10 yr Anniversary section
--                   first_year          year of the first celebration. "Upcoming 10 yr" is worked out from it in the app.
-- rr_documents    one row per uploaded document: its title, original file name, and where the file sits in storage.
-- rr-documents    a PRIVATE storage bucket for the files themselves (unlike the older public "attachments" bucket).
--                 Only signed-in users can read or write it, and the app downloads files through your sign-in,
--                 so there are no public links. 25 MB per file; PDF, Word (.docx) and images only.

-- 1. Holidays
create table if not exists rr_holidays (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null,
  sort_order integer not null,
  required_elements text not null default '',
  anniversary_notes text not null default '',
  first_year integer check (first_year between 1900 and 2200),
  updated_at timestamptz not null default now()
);

insert into rr_holidays (id, name, sort_order) values
  ('hammock-day', 'Hammock Day', 1),
  ('halloween-dinner', 'Halloween Dinner', 2),
  ('winter-screening', 'Winter Screening', 3),
  ('april-11th', 'Celebration of April 11th', 4)
on conflict (id) do nothing;

alter table rr_holidays enable row level security;
drop policy if exists "authenticated read rr_holidays" on rr_holidays;
create policy "authenticated read rr_holidays" on rr_holidays for select using (auth.role() = 'authenticated');
drop policy if exists "authenticated update rr_holidays" on rr_holidays;
create policy "authenticated update rr_holidays" on rr_holidays for update
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
revoke all on rr_holidays from anon;
revoke insert, delete, truncate on rr_holidays from authenticated;

-- 2. Documents
create table if not exists rr_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 120),
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  uploaded_by text,
  created_at timestamptz not null default now()
);

alter table rr_documents enable row level security;
drop policy if exists "authenticated manage rr_documents" on rr_documents;
create policy "authenticated manage rr_documents" on rr_documents
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
revoke all on rr_documents from anon;

-- 3. Private storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rr-documents', 'rr-documents', false, 26214400, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif'
])
on conflict (id) do nothing;

drop policy if exists "rr documents read" on storage.objects;
create policy "rr documents read" on storage.objects for select to authenticated using (bucket_id = 'rr-documents');
drop policy if exists "rr documents upload" on storage.objects;
create policy "rr documents upload" on storage.objects for insert to authenticated with check (bucket_id = 'rr-documents');
drop policy if exists "rr documents update" on storage.objects;
create policy "rr documents update" on storage.objects for update to authenticated
  using (bucket_id = 'rr-documents') with check (bucket_id = 'rr-documents');
drop policy if exists "rr documents delete" on storage.objects;
create policy "rr documents delete" on storage.objects for delete to authenticated using (bucket_id = 'rr-documents');

-- 4. Realtime, so a change by one of you shows up for the other
do $$
begin
  alter publication supabase_realtime add table rr_holidays;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table rr_documents;
exception when duplicate_object then null;
end $$;
