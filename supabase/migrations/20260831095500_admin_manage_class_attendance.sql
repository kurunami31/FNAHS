-- ============================================================
-- admins may delete class attendance data they can already read
--
-- The admin read policies let superadmins/moderators SEE every
-- faculty_subjects / class_sessions / class_attendance row, but the
-- delete policies were owner-only. An admin deleting a subject they
-- don't own then affects 0 rows (RLS filters it out) and the row
-- silently comes back on the next fetch.
-- ============================================================

create policy "admins_delete_subjects"
  on public.faculty_subjects for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('superadmin', 'moderator')));

create policy "admins_delete_sessions"
  on public.class_sessions for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('superadmin', 'moderator')));

create policy "admins_delete_attendance"
  on public.class_attendance for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('superadmin', 'moderator')));