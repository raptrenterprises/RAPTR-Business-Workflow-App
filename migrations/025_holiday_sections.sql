-- Migration 025: two more text sections on each holiday page: "About" and "Condensed Version". Run AFTER 024.
-- Additive only: two new text columns on rr_holidays, empty by default. Existing text and years are untouched. Safe to re-run.
-- (The section called "Required Elements" is now titled "Basic Requirements" on screen; its column keeps the name required_elements.)
alter table rr_holidays add column if not exists about text not null default '';
alter table rr_holidays add column if not exists condensed_version text not null default '';
