-- Migration 012: type-specific post fields (slides, beats, blog/pin fields, seeder
-- comment slots) and the "ready to manually post" status.
-- Run AFTER 007-011. Additive: no existing row is changed or removed.
--
-- posts gains: description (idea overview), final_url (final edited image/video or
--   blog thumbnail link), five seeder comment slots, blog fields (text, Squarespace
--   categories and tags, cross-reference links), pin fields, and
--   attachments (a list of {label, url} for "Other" posts).
-- post_units (new): one row per carousel slide or reel beat, in sort_order.
-- shot_items gains unit_id: which slide/beat a shot belongs to (null = the post itself).
-- status gains 'ready_to_post': an alternative to 'scheduled' for posts that can't be
--   pre-scheduled. It puts the post on the calendar exactly like 'scheduled' does
--   (migration 013 adds the task for Cathy and auto-Live for scheduled posts).
-- events gains post_id so the calendar can link back to the full post.
-- The old free-text seeder comments on the imported posts are parsed into the five
--   slots (only when every line is recognized; otherwise they are left untouched).
--
-- The old free-text posts.seeder_comments column is kept for anything that could not be
-- parsed; it is appended, unlabeled, after the five seeder slots in the calendar description.

alter table posts
  add column if not exists description text,
  add column if not exists final_url text,
  add column if not exists seeder_raptr text,
  add column if not exists seeder_evan text,
  add column if not exists seeder_evan_reply text,
  add column if not exists seeder_cathy text,
  add column if not exists seeder_cathy_reply text,
  add column if not exists blog_text text,
  add column if not exists sqs_categories text[] not null default '{}',
  add column if not exists sqs_tags text[] not null default '{}',
  add column if not exists cross_links text,
  add column if not exists pin_categories text[] not null default '{}',
  add column if not exists pin_boards text[] not null default '{}',
  add column if not exists pin_description text,
  add column if not exists attachments jsonb not null default '[]';

alter table posts drop constraint if exists posts_status_check;
alter table posts add constraint posts_status_check
  check (status in ('idea', 'planned', 'filmed', 'drafted', 'edited', 'scheduled', 'ready_to_post', 'live'));

create table if not exists post_units (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  sort_order integer not null default 0,
  text_overlay text,      -- carousel slide
  script text,            -- reel beat
  editing_notes text,     -- reel beat: editing notes / text overlays
  final_url text,         -- carousel slide: final edited image link
  created_at timestamptz not null default now()
);
create index if not exists post_units_post_idx on post_units (post_id, sort_order);

alter table shot_items add column if not exists unit_id uuid references post_units(id) on delete cascade;
create index if not exists shot_items_unit_idx on shot_items (unit_id);

alter table post_units enable row level security;
drop policy if exists "authenticated read/write post_units" on post_units;
create policy "authenticated read/write post_units" on post_units
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

do $$
begin
  alter publication supabase_realtime add table post_units;
exception when duplicate_object then null;
end $$;

alter table events add column if not exists post_id uuid references posts(id) on delete set null;
create index if not exists events_post_idx on events (post_id);
update events e set post_id = p.id from posts p where p.calendar_event_id = e.id and e.post_id is null;

-- The calendar event description: labeled seeder comments (only the filled-in ones),
-- then any legacy free-text seeder comments.
create or replace function posts_event_description(p posts) returns text as $$
  select nullif(concat_ws(E'\n',
    case when nullif(btrim(p.seeder_raptr), '') is not null then 'RAPTR (initial comment): ' || btrim(p.seeder_raptr) end,
    case when nullif(btrim(p.seeder_evan), '') is not null then 'Evan: ' || btrim(p.seeder_evan) end,
    case when nullif(btrim(p.seeder_evan_reply), '') is not null then 'Reply to Evan: ' || btrim(p.seeder_evan_reply) end,
    case when nullif(btrim(p.seeder_cathy), '') is not null then 'Cathy: ' || btrim(p.seeder_cathy) end,
    case when nullif(btrim(p.seeder_cathy_reply), '') is not null then 'Reply to Cathy: ' || btrim(p.seeder_cathy_reply) end,
    nullif(btrim(p.seeder_comments), '')
  ), '');
$$ language sql stable;

create or replace function posts_sync_calendar() returns trigger as $$
declare
  new_event_id uuid;
  ev_desc text;
begin
  ev_desc := posts_event_description(new);
  if new.status in ('scheduled', 'ready_to_post', 'live') and new.publish_date is not null then
    if new.calendar_event_id is null then
      if new.status in ('scheduled', 'ready_to_post') then
        insert into events (title, category, description, event_date, end_date, event_time, all_day, recurrence, created_by, post_id)
        values (new.title, 'Social Media Post Goes Live', ev_desc, new.publish_date, new.publish_date,
                new.publish_time, new.publish_time is null, 'none', new.created_by, new.id)
        returning id into new_event_id;
        update posts set calendar_event_id = new_event_id where id = new.id;
      end if;
    else
      update events
         set title = new.title,
             description = ev_desc,
             event_date = new.publish_date,
             end_date = new.publish_date,
             event_time = new.publish_time,
             all_day = (new.publish_time is null)
       where id = new.calendar_event_id
         and (title, description, event_date, event_time)
             is distinct from (new.title, ev_desc, new.publish_date, new.publish_time);
    end if;
  elsif new.calendar_event_id is not null then
    delete from events where id = new.calendar_event_id;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists posts_calendar_sync on posts;
create trigger posts_calendar_sync
  after insert or update of status, title, publish_date, publish_time, seeder_comments,
    seeder_raptr, seeder_evan, seeder_evan_reply, seeder_cathy, seeder_cathy_reply on posts
  for each row execute function posts_sync_calendar();

-- Parse the imported posts' labeled seeder comments into the five slots. A post is only
-- converted when EVERY non-empty line is recognized and no slot is used twice; anything
-- else is left exactly as it was. Labels recognized: "...reply to Cathy", "...reply to
-- Evan", "Cathy...", "Evan...", and anything else mentioning RAPTR (the initial comment).
-- Wrapping quotation marks around a comment are removed.
with lines as (
  select p.id, l.n,
         split_part(l.line, ':', 1) as label,
         btrim(regexp_replace(substr(l.line, strpos(l.line, ':') + 1), '^\s*"(.*)"\s*$', '\1')) as body
  from posts p, regexp_split_to_table(p.seeder_comments, E'\n') with ordinality as l(line, n)
  where p.seeder_comments is not null and btrim(l.line) <> ''
), c as (
  select *, case
    when label ~* 'reply to cathy' then 'cathy_reply'
    when label ~* 'reply to evan' then 'evan_reply'
    when label ~* '^\s*cathy' then 'cathy'
    when label ~* '^\s*evan' then 'evan'
    when label ~* 'raptr' then 'raptr' end as slot
  from lines
), ok as (
  select id from c group by id having count(*) = count(slot) and count(*) = count(distinct slot)
), agg as (
  select id,
    max(body) filter (where slot = 'raptr') as raptr,
    max(body) filter (where slot = 'cathy') as cathy,
    max(body) filter (where slot = 'cathy_reply') as cathy_reply,
    max(body) filter (where slot = 'evan') as evan,
    max(body) filter (where slot = 'evan_reply') as evan_reply
  from c where id in (select id from ok) group by id
)
update posts p
   set seeder_raptr = a.raptr, seeder_cathy = a.cathy, seeder_cathy_reply = a.cathy_reply,
       seeder_evan = a.evan, seeder_evan_reply = a.evan_reply, seeder_comments = null
  from agg a
 where p.id = a.id and p.seeder_raptr is null and p.seeder_cathy is null and p.seeder_evan is null;
