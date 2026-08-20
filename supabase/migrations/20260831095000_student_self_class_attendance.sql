-- ============================================================
-- reverse class scanning: students scan the faculty's QR
--
-- The faculty starts a session and shows a QR code; each student
-- scans it with their own phone to record their attendance. A
-- security-definer RPC (owned by postgres, like the class tables)
-- validates the session is still open and inserts the caller's own
-- row, so no per-user insert policy is needed on class_attendance.
-- ============================================================

create or replace function public.mark_my_class_attendance(p_session uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.class_sessions s
    where s.id = p_session and s.ended_at is null
  ) then
    raise exception 'Class session not found or already ended';
  end if;

  insert into public.class_attendance (session_id, user_id, scanned_at)
  values (p_session, auth.uid(), now())
  on conflict (session_id, user_id) do nothing;
end;
$$;

grant execute on function public.mark_my_class_attendance(uuid) to authenticated;