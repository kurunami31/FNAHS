-- ============================================================
-- event attendance: time-in / time-out scanning
--
-- First scan of a member records their time in (existing rows from
-- single-scan days become time-ins automatically). A second scan
-- stamps time out. Further scans are no-ops. Door officers only,
-- mirroring the table's own RLS policies.
-- ============================================================

alter table public.attendance add column if not exists time_out timestamptz;

create or replace function public.scan_attendance(p_event uuid, p_user uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_time_out timestamptz;
begin
  if not is_door_officer() then
    raise exception 'Only door officers can record attendance';
  end if;

  select time_out into v_time_out
  from public.attendance
  where event_id = p_event and user_id = p_user;

  if not found then
    insert into public.attendance (event_id, user_id, scanned_at)
    values (p_event, p_user, now());
    return 'in';
  end if;

  if v_time_out is null then
    update public.attendance
    set time_out = now()
    where event_id = p_event and user_id = p_user;
    return 'out';
  end if;

  return 'already-out';
end;
$$;

grant execute on function public.scan_attendance(uuid, uuid) to authenticated;