-- Migration 029: page-by-page Search Console summary for the Performance tab.
-- Run BEFORE deploying the new code. Adds one read-only function; nothing existing is changed. Safe to re-run.
--
-- gsc_page_stats(p_days): every page on the site that appeared in Google for the last p_days days, with
--   clicks, impressions, average position (weighted by impressions), how many different keywords led to it
--   (keyword_count), and its best keyword. Most-clicked pages first.

create or replace function gsc_page_stats(p_days integer)
returns table (page text, clicks bigint, impressions bigint, avg_position numeric, keyword_count bigint, top_query text)
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
         count(*)::bigint,
         max(r.query) filter (where r.rn = 1)
  from ranked r
  group by r.page
  order by sum(r.clicks) desc, sum(r.impressions) desc
  limit 500;
$$;
