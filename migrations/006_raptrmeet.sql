-- Migration: RAPTRMeet planning section.
-- Run once in the Supabase SQL Editor after deploying the RAPTRMeet code.

-- ---- RAPTRMeets ----
create table if not exists raptrmeets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start_date date not null,
  end_date date not null,
  location text,
  address text,
  status text not null default 'upcoming', -- 'upcoming' | 'completed'
  -- { [displayName]: { arrival, departure, mode, notes } }
  travel jsonb not null default '{}',
  -- [{ id, date, mealType, menu, assignedTo }]
  meals jsonb not null default '[]',
  -- [{ id, name, quantity, category, checked, source }]
  grocery_items jsonb not null default '[]',
  notes text,
  attachments jsonb not null default '[]',
  created_by text not null,
  created_at timestamptz not null default now()
);

-- ---- Task extensions for RAPTRMeet ----
-- tags: free-form-ish tag list, app currently offers Business / Social Media /
--   Mystery Creation / Fun as suggested values but stores as text[] so it's
--   not locked to exactly those.
-- raptrmeet_id: which RAPTRMeet (if any) this task is assigned to, so it
--   shows on both the main Tasks list and that RAPTRMeet's Tasks tab.
-- raptrmeet_only: true = must be done in person at a RAPTRMeet (unchecked
--   tasks roll forward to the next RAPTRMeet when this one is marked
--   completed); false = can be done virtually (unchecked tasks just drop
--   back to the regular/main tasks list, still visible there as normal).
-- raptrmeet_day / raptrmeet_timeblock: optional scheduling within the
--   RAPTRMeet's daily timeline (morning / afternoon / evening).
alter table tasks add column if not exists tags text[] not null default '{}';
alter table tasks add column if not exists raptrmeet_id uuid references raptrmeets(id) on delete set null;
alter table tasks add column if not exists raptrmeet_only boolean not null default false;
alter table tasks add column if not exists raptrmeet_day date;
alter table tasks add column if not exists raptrmeet_timeblock text; -- 'morning' | 'afternoon' | 'evening'

alter table raptrmeets enable row level security;
drop policy if exists "authenticated read/write raptrmeets" on raptrmeets;
create policy "authenticated read/write raptrmeets" on raptrmeets
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter publication supabase_realtime add table raptrmeets;
