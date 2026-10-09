-- Migration 019: aspect ratio on shot list items and media items; story stickers replace the story poll.
-- Run AFTER 018. Additive, plus a one-time data move for the 2 existing story polls.
--
-- ASPECT RATIO
--   shot_items.aspect_ratio  text, e.g. '3:4'. Blank/null = "any" (used by "Other" posts).
--     Defaults come from the post type: Image post / Carousel = 3:4, Story / Reel = 9:16,
--     Blog post (thumbnail) = 3:2, Pinterest pin = 2:3. Existing shots are filled in below
--     from their post's type. Posts of type "Other" stay blank.
--   media_items.aspect_ratio / width / height  filled in by the app when a file is picked
--     (the app reads the pixel size in the browser). Existing items: none (the library is empty).
--
-- STORY STICKERS
--   posts.sticker_enabled / sticker_type / sticker_details replace the poll checkbox on Stories.
--   sticker_type is one of: location, mention, add_yours, frames, questions, cutouts,
--   get_orders, poll, add_yours_music, link, slider, reveal, hashtag, donation, countdown, food_orders.
--   sticker_details is a small JSON object whose keys depend on the type (see socialConstants.js).
--   The poll_* columns stay for Image posts, Carousels and Reels, which keep their poll checkbox.
--   DATA MOVE: each Story that had the poll box ticked becomes sticker_type 'poll' with its
--   question and choices copied over, and its poll_* columns are cleared. Any "poll_results" note
--   in a Story's metrics is renamed "sticker_results". Nothing else is touched.

alter table shot_items add column if not exists aspect_ratio text;

-- The backfill below touches every shot row. The shot_items_sync trigger (which moves a Planned post to
-- Filmed once all its shots are done) is switched off for it, so filling in ratios can't change any post's status.
alter table shot_items disable trigger shot_items_sync;

update shot_items s
set aspect_ratio = case p.post_type
    when 'Image post'    then '3:4'
    when 'Carousel'      then '3:4'
    when 'Story'         then '9:16'
    when 'Reel'          then '9:16'
    when 'Blog post'     then '3:2'
    when 'Pinterest pin' then '2:3'
    else null
  end
from posts p
where p.id = s.post_id
  and s.aspect_ratio is null;

alter table shot_items enable trigger shot_items_sync;

alter table media_items
  add column if not exists aspect_ratio text,
  add column if not exists width integer,
  add column if not exists height integer;

alter table posts
  add column if not exists sticker_enabled boolean not null default false,
  add column if not exists sticker_type text,
  add column if not exists sticker_details jsonb not null default '{}'::jsonb;

update posts
set sticker_enabled = true,
    sticker_type = 'poll',
    sticker_details = jsonb_build_object('question', coalesce(poll_question, ''), 'options', to_jsonb(coalesce(poll_options, '{}'::text[]))),
    metrics = case
      when metrics ? 'poll_results' then (metrics - 'poll_results') || jsonb_build_object('sticker_results', metrics -> 'poll_results')
      else metrics
    end,
    poll_enabled = false,
    poll_question = null,
    poll_options = '{}'
where post_type = 'Story'
  and poll_enabled
  and sticker_type is null;
