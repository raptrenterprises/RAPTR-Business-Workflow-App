-- Migration 021: Pact section (monthly vote).
-- Run AFTER 020. Additive only: creates one new table; nothing existing is changed or removed.
--
-- pact_votes   one row per calendar month (Eastern time), 'YYYY-MM'. The month's single vote.
--              ballots is keyed by display name, same idea as gym_challenges.participants:
--                { "Cathy": { "status": "Single" | "In a relationship" | "Married", "interest": 1-100 },
--                  "Evan":  { ... } }
--              The result category, thresholds and combined score are NOT stored; the app works
--              them out from the ballots each time, so changing the rules later re-scores history.
--              Changing a month's vote updates that month's row (unique on month).
--
-- Safe to re-run: every statement is guarded (if not exists / drop policy if exists / exception handler).

create table if not exists pact_votes (
  id uuid primary key default gen_random_uuid(),
  month text not null unique check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  ballots jsonb not null default '{}'::jsonb,
  submitted_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table pact_votes enable row level security;
drop policy if exists "authenticated read/write pact_votes" on pact_votes;
create policy "authenticated read/write pact_votes" on pact_votes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

do $$
begin
  alter publication supabase_realtime add table pact_votes;
exception when duplicate_object then null;
end $$;
