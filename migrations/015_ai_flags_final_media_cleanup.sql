-- Migration 015: AI flags, library-linked final media, blog document link, tag cleanup.
-- Run AFTER 014. Additive, plus one small data cleanup (see the end).
--
-- media_items.is_ai: marks a library item as AI-generated.
-- posts.ai_images_allowed: whether AI images may be used for this post's shot list items
--   (default false). The database refuses to link an AI-marked media item to a shot on a post
--   that doesn't allow AI images. Existing links are not touched.
-- posts.final_media_id / post_units.final_media_id: the final edited image or video, chosen
--   from the media library (replaces pasting a link). The old posts.final_url /
--   post_units.final_url columns are kept so nothing already entered is lost.
-- posts.blog_doc_url: link to the blog post's document file (replaces typing the text in).
--   The old posts.blog_text column is kept.
-- Cleanup: the tags "q4-campaign" and "halloween-series" duplicated the campaigns those posts
--   already belong to, so they are removed from posts in the matching campaign.

alter table media_items add column if not exists is_ai boolean not null default false;

alter table posts
  add column if not exists ai_images_allowed boolean not null default false,
  add column if not exists final_media_id uuid references media_items(id) on delete set null,
  add column if not exists blog_doc_url text;
alter table post_units add column if not exists final_media_id uuid references media_items(id) on delete set null;

create or replace function shot_item_media_ai_check() returns trigger as $$
begin
  if exists (
    select 1 from media_items m, shot_items s, posts p
     where m.id = new.media_id and s.id = new.shot_item_id and p.id = s.post_id
       and m.is_ai and not p.ai_images_allowed
  ) then
    raise exception 'This post does not allow AI images, and that media item is marked as AI.';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists shot_item_media_ai on shot_item_media;
create trigger shot_item_media_ai before insert on shot_item_media
  for each row execute function shot_item_media_ai_check();

update posts p set tags = array_remove(p.tags, 'q4-campaign')
  from campaigns c
 where p.campaign_id = c.id and c.name = 'Q4 2026 Holiday & Black Friday Campaign' and 'q4-campaign' = any(p.tags);
update posts p set tags = array_remove(p.tags, 'halloween-series')
  from campaigns c
 where p.campaign_id = c.id and c.name = 'Halloween 2026 Blog Series' and 'halloween-series' = any(p.tags);
