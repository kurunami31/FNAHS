-- ============================================================
-- notification deep links
--
-- Event notifications now carry the specific event id so the
-- bell can land the user on that event (Events page opens the
-- event modal when ?open=<id> is present).
-- ============================================================

create or replace function public.notify_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, title, body, link)
  select id, 'event', 'New event: ' || new.title,
         to_char(new.starts_at at time zone 'Asia/Manila', 'Mon DD at HH24:MI'),
         '/app/events?open=' || new.id::text
  from public.profiles
  where id is distinct from new.created_by;
  return new;
end;
$$;