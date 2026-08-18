-- ============================================================
-- Per-event attendance counts visible to every member.
-- Attendance rows are RLS-restricted to the owner or door officers
-- (is_door_officer), so a plain select can't show members how many
-- attended. This security-definer RPC returns just the totals so the
-- events page can display "N attended" without exposing who was there.
-- ============================================================

create or replace function public.get_event_tallies()
returns table (event_id uuid, count bigint) language sql security definer set search_path = public as $$
  select a.event_id, count(*)::bigint as count
  from public.attendance a
  group by a.event_id;
$$;

grant execute on function public.get_event_tallies() to authenticated;