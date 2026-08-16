-- Auto-announce created events: every new event also appears on the
-- Announcements board, credited to its creator.

create or replace function public.announce_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_parts text[];
begin
  -- Mark this transaction so notify_announcement() skips its fan-out —
  -- members already get one 'event' notification via notify_event().
  perform set_config('app.event_announce', 'true', true);

  v_parts := array[]::text[];
  if new.starts_at is not null then
    v_parts := array_append(v_parts,
      'When: ' || to_char(new.starts_at, 'Mon DD, YYYY · HH12:MI AM'));
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

drop trigger if exists announce_event on public.events;
create trigger announce_event
  after insert on public.events
  for each row execute function public.announce_event();

-- notify_announcement: skip rows the announce_event trigger created
-- automatically (the flag is transaction-local, and the announcement
-- insert runs inside the events-insert transaction).
create or replace function public.notify_announcement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('app.event_announce', true) = 'true' then
    return new;
  end if;
  insert into public.notifications (user_id, kind, title, body, link)
  select id, 'announcement', new.title, '', '/app/feed#announcements'
  from public.profiles;
  return new;
end;
$$;