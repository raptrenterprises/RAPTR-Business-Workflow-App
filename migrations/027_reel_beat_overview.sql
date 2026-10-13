-- Migration 027: reel beats get an Overview field. Run BEFORE deploying the new code. Safe to re-run.
--
-- Reel beats now have four fields:
--   overview       (new)  what happens in the beat
--   script         spoken words only
--   text_overlay   on-screen words only (the column carousel slides already use)
--   editing_notes  production / editing notes
--
-- Existing beats are NOT changed. Any on-screen text that was typed into editing_notes
-- stays there until moved by hand into the Text overlay field.

alter table post_units add column if not exists overview text;
