-- Migration: adds recurrence support to calendar events.
-- Run this once in the Supabase SQL Editor after deploying the Stage 8 code.

alter table events add column if not exists recurrence text not null default 'none';
alter table events add column if not exists recurrence_end date;
