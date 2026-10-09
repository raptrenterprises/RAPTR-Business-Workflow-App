-- Migration 020: Google Search Console integration.
-- Run AFTER 019. Additive only; nothing existing is changed or removed.
--
-- gsc_search_daily   one row per day + search query + page, as reported by Search Console.
--                    Filled by the /api/gsc-sync function (daily, and from the "Sync now" button).
--                    Rows are only ever written by that function (it uses the service role);
--                    signed-in users can read them.
-- integration_status one row per connected service ('gsc' now; Instagram, Etsy, etc. later):
--                    when it last synced, whether that worked, and a short message.
-- posts.live_url     the published web address of a blog post. A blog post's keywords are matched
--                    to Search Console pages by this address.
-- post_keywords      gains "source" ('manual' typed by hand, 'gsc' filled in by the sync) and updated_at.
--                    Each sync replaces a blog post's 'gsc' rows with its top 25 keywords (last 30 days).
--                    A hand-typed row for a keyword the sync also finds is replaced by the synced numbers.
-- Functions          gsc_totals / gsc_keywords / gsc_pages summarise the last N days in the database,
--                    so the app doesn't have to download every daily row.

alter table posts add column if not exists live_url text;

alter table post_keywords
  add column if not exists source text not null default 'manual' check (source in ('manual', 'gsc')),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists gsc_search_daily (
  date date not null,
  query text not null,
  page text not null,
  clicks integer not null default 0,
  impressions integer not null default 0,
  "position" numeric,
  primary key (date, query, page)
);
create index if not exists gsc_search_daily_page_idx on gsc_search_daily (page, date);
create index if not exists gsc_search_daily_query_idx on gsc_search_daily (lower(query), date);

alter table gsc_search_daily enable row level security;
drop policy if exists "authenticated read gsc_search_daily" on gsc_search_daily;
create policy "authenticated read gsc_search_daily" on gsc_search_daily
  for select using (auth.role() = 'authenticated');

create table if not exists integration_status (
  key text primary key,
  last_synced_at timestamptz,
  last_status text,
  last_message text,
  details jsonb not null default '{}'::jsonb
);
alter table integration_status enable row level security;
drop policy if exists "authenticated read integration_status" on integration_status;
create policy "authenticated read integration_status" on integration_status
  for select using (auth.role() = 'authenticated');

do $$
begin
  alter publication supabase_realtime add table integration_status;
exception when duplicate_object then null;
end $$;

-- The newest day we have data for.
create or replace function gsc_latest_date() returns date
language sql stable as $$ select max(date) from gsc_search_daily $$;

-- Totals for the last p_days days ("current") and the p_days before that ("previous").
-- Average position is weighted by impressions.
create or replace function gsc_totals(p_days integer)
returns table (period text, clicks bigint, impressions bigint, avg_position numeric)
language sql stable as $$
  with latest as (select max(date) as d from gsc_search_daily),
  tagged as (
    select case
             when g.date > latest.d - p_days then 'current'
             when g.date > latest.d - 2 * p_days then 'previous'
           end as period, g.*
    from gsc_search_daily g, latest
  )
  select period, sum(clicks)::bigint, sum(impressions)::bigint,
         round((sum(tagged."position" * tagged.impressions) / nullif(sum(impressions), 0))::numeric, 1)
  from tagged
  where period is not null
  group by period;
$$;

-- Top keywords for the last p_days days, with the page that gets the most clicks for each.
create or replace function gsc_keywords(p_days integer)
returns table (query text, clicks bigint, impressions bigint, avg_position numeric, top_page text)
language sql stable as $$
  with latest as (select max(date) as d from gsc_search_daily),
  per_page as (
    select g.query, g.page, sum(g.clicks) as clicks, sum(g.impressions) as impressions,
           sum(g."position" * g.impressions) / nullif(sum(g.impressions), 0) as pos
    from gsc_search_daily g, latest
    where g.date > latest.d - p_days
    group by g.query, g.page
  ),
  ranked as (
    select *, row_number() over (partition by query order by clicks desc, impressions desc) as rn
    from per_page
  )
  select r.query, sum(r.clicks)::bigint, sum(r.impressions)::bigint,
         round((sum(r.pos * r.impressions) / nullif(sum(r.impressions), 0))::numeric, 1),
         max(r.page) filter (where r.rn = 1)
  from ranked r
  group by r.query
  order by sum(r.clicks) desc, sum(r.impressions) desc
  limit 500;
$$;

-- Top pages for the last p_days days, with each page's best keyword.
create or replace function gsc_pages(p_days integer)
returns table (page text, clicks bigint, impressions bigint, avg_position numeric, top_query text)
language sql stable as $$
  with latest as (select max(date) as d from gsc_search_daily),
  per_query as (
    select g.page, g.query, sum(g.clicks) as clicks, sum(g.impressions) as impressions,
           sum(g."position" * g.impressions) / nullif(sum(g.impressions), 0) as pos
    from gsc_search_daily g, latest
    where g.date > latest.d - p_days
    group by g.page, g.query
  ),
  ranked as (
    select *, row_number() over (partition by page order by clicks desc, impressions desc) as rn
    from per_query
  )
  select r.page, sum(r.clicks)::bigint, sum(r.impressions)::bigint,
         round((sum(r.pos * r.impressions) / nullif(sum(r.impressions), 0))::numeric, 1),
         max(r.query) filter (where r.rn = 1)
  from ranked r
  group by r.page
  order by sum(r.clicks) desc, sum(r.impressions) desc
  limit 200;
$$;
