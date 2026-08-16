-- Event times in auto-generated announcements/notifications must render
-- in Philippine time — to_char() was using the DB session timezone (UTC),
-- so an 18:00 PHT event read as 10:00 AM.

create or replace function public.announce_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_parts text[];
begin
  perform set_config('app.event_announce', 'true', true);

  v_parts := array[]::text[];
  if new.starts_at is not null then
    v_parts := array_append(v_parts,
      'When: ' || to_char(new.starts_at at time zone 'Asia/Manila', 'Mon DD, YYYY · HH12:MI AM'));
  end if;
  if coalesce(new.location, '') <> '' then
    v_parts := array_append(v_parts, 'Where: ' || new.location);
  end if;
  if coalesce(new.description, '') <> '' then
    v_parts := array_append(v_parts, new.description);
  end if;

  insert into public.announcements (title, body, author_id)
  values (new.title, array_to_string(v_parts, E'\n'), new.created_by);
  return new;
end;
$$;

create or replace function public.notify_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, title, body, link)
  select id, 'event', 'New event: ' || new.title,
         to_char(new.starts_at at time zone 'Asia/Manila', 'Mon DD at HH24:MI'), '/app/events'
  from public.profiles
  where id is distinct from new.created_by;
  return new;
end;
$$;

-- Rewrite the When line of announcements already created for existing events
-- so they show Philippine time (matching what the events page shows).
update public.announcements a
set body = regexp_replace(
  a.body,
  '^When: .*',
  'When: ' || to_char(e.starts_at at time zone 'Asia/Manila', 'Mon DD, YYYY · HH12:MI AM')
)
from public.events e
where a.author_id = e.created_by
  and a.title = e.title
  and a.body ~ '^When: ';