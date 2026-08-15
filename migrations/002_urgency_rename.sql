-- Migration: renames urgency "Critical" -> "Immediate" on existing rows.
-- Run this once in the Supabase SQL Editor after deploying the Stage 2 code.
--
-- Note: importance data needs no changes. "Critical" importance is a brand
-- new level added in Stage 2 — no existing rows used that value, so there's
-- nothing to convert there.

update tasks set urgency = 'Immediate' where urgency = 'Critical';
update threads set urgency = 'Immediate' where urgency = 'Critical';

-- Verify: should return 0 rows once the above has run successfully.
select id, 'tasks' as source, urgency from tasks where urgency = 'Critical'
union all
select id, 'threads' as source, urgency from threads where urgency = 'Critical';
