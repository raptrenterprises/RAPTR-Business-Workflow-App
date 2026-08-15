-- Migration: adds richer event details (description, category, multi-day end date).
-- Run this in the Supabase SQL Editor for a project that already has the
-- original schema.sql applied.

alter table events add column if not exists description text;
alter table events add column if not exists category text not null default 'Other';
alter table events add column if not exists end_date date;

-- Backfill end_date for existing rows so multi-day logic has a value to compare against.
update events set end_date = event_date where end_date is null;

alter table events alter column end_date set not null;
