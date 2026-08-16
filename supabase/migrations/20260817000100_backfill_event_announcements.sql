-- Backfill: announce events that already existed before the announce_event
-- trigger was added (20260817000000). Idempotent — skips any event that
-- already has an announcement by the same author with the same title.

insert into public.announcements (title, body, author_id)
select e.title,
       array_to_string(
         array_remove(
           array[
             case when e.starts_at is not null
                  then 'When: ' || to_char(e.starts_at, 'Mon DD, YYYY · HH12:MI AM') end,
             case when coalesce(e.location, '') <> '' then 'Where: ' || e.location end,
             case when coalesce(e.description, '') <> '' then e.description end
           ]::text[],
           null
         ),
         E'\n'
       ),
       e.created_by
from public.events e
where not exists (
  select 1 from public.announcements a
  where a.author_id = e.created_by and a.title = e.title
);