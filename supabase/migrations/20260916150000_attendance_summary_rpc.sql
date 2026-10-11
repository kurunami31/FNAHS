-- ============================================================
-- Attendance summary as an aggregate
--
-- getAttendanceSummary() in the client fetched the ENTIRE attendance
-- table (`select event_id, events(title)`, no limit) and counted the
-- rows in JavaScript. At 5,210 rows that is already wasteful, and it
-- grows with every event — hundreds of rows per event, forever.
--
-- This returns one row per event instead, so the payload is constant
-- no matter how much attendance accumulates.
--
-- Gated on is_door_officer(), matching the attendance SELECT policy
-- ("owner or door officers").
-- ============================================================

create or replace function public.get_attendance_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if not coalesce(public.is_door_officer(), false) then
    raise exception 'insufficient privileges';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'event_id', a.event_id,
      'count', a.n,
      'title', coalesce(e.title, 'Event')
    ) order by e.starts_at desc nulls last)
    from (
      select event_id, count(1)::int as n
      from public.attendance
      group by event_id
    ) a
    left join public.events e on e.id = a.event_id
  ), '[]'::jsonb);
end;
$fn$;

grant execute on function public.get_attendance_summary() to authenticated;