-- RAPTR Ops — Supabase schema
-- Run this once in your Supabase project's SQL Editor (Dashboard > SQL Editor > New query).

create extension if not exists "pgcrypto";

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  owner text not null,               -- 'shared' or a username
  completed boolean not null default false,
  created_by text not null,
  created_at timestamptz not null default now(),
  importance text not null default 'Medium',
  urgency text not null default 'Medium',
  due_date date,
  recurrence text not null default 'none'
);

create table if not exists threads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  participants text[] not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  importance text not null default 'Medium',
  urgency text not null default 'Medium',
  status text not null default 'active',   -- 'active' | 'complete'
  turn text,                                -- username whose turn it is to act
  seen_by text[] not null default '{}',
  completed_at timestamptz,
  due_date date,
  messages jsonb not null default '[]'      -- [{id, from, body, at}, ...]
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'Other', -- 'Weekly Call' | 'RAPTRMeet' | 'Playtest' | 'Social Media Post Goes Live' | 'Other'
  event_date date not null,
  end_date date not null default (event_date), -- multi-day events: last day of the event, inclusive
  event_time time,
  all_day boolean not null default true,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists gym_challenges (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  target_workouts_per_week int not null default 3,
  created_by text not null,
  created_at timestamptz not null default now(),
  -- { "Cathy": { startingWeight, targetWeight, weighIns: [{week, weight, at}], workoutDates: [date,...] }, "Evan": {...} }
  participants jsonb not null default '{}'
);

-- Row Level Security: now that real login (Supabase Auth) is in place,
-- any signed-in user can read/write everything — matches the "no privacy
-- between the two of us" design. This is still shared-everything, but at
-- least requires a valid login instead of being open to the whole internet.
alter table tasks enable row level security;
alter table threads enable row level security;
alter table events enable row level security;
alter table gym_challenges enable row level security;

drop policy if exists "allow all on tasks" on tasks;
drop policy if exists "allow all on threads" on threads;

create policy "authenticated read/write tasks" on tasks
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read/write threads" on threads
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read/write events" on events
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read/write gym_challenges" on gym_challenges
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Realtime: lets both of you see each other's changes live.
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table threads;
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table gym_challenges;
