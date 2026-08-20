-- ============================================================
-- class attendance is private to the owning faculty member
--
-- The admin read/delete policies exposed every faculty member's
-- subjects, sessions and attendance to superadmins/moderators. Faculty
-- accounts should only ever see their own class data (the owner
-- policies already enforce that for writes; the read side now matches).
-- Students keep reading their own rows (via get_my_class_attendance()
-- and the self branch of the attendance select policy).
-- ============================================================

drop policy if exists "admins_read_subjects" on public.faculty_subjects;
drop policy if exists "admins_delete_subjects" on public.faculty_subjects;

drop policy if exists "admins_read_sessions" on public.class_sessions;
drop policy if exists "admins_delete_sessions" on public.class_sessions;

drop policy if exists "admins_delete_attendance" on public.class_attendance;
drop policy if exists "attendance_read_owner_or_admins_or_self" on public.class_attendance;

create policy "attendance_read_owner_or_self"
  on public.class_attendance for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.class_sessions s
      where s.id = session_id and s.faculty_id = auth.uid()
    )
  );