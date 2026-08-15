-- Migration: makes urgency nullable, since a task/thread now stores EITHER
-- a manual urgency OR a due date, never both. When a due date is set, the
-- app displays a computed urgency instead and leaves this column null.
-- Run this once in the Supabase SQL Editor after deploying the Stage 3 code.

alter table tasks alter column urgency drop not null;
alter table threads alter column urgency drop not null;

-- Existing rows that already have both an urgency and a due date set (from
-- before this rule existed) keep working fine as-is — the app will now just
-- prefer the due date and ignore the stored urgency for those. Optional
-- cleanup, only if you want the data itself to reflect the new rule:
-- update tasks set urgency = null where due_date is not null;
-- update threads set urgency = null where due_date is not null;
