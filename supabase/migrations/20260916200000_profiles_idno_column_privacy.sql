-- ============================================================
-- Lock down profiles.id_no (same treatment as email)
--
-- Passwords default to the student ID number, so a readable id_no
-- effectively exposed every member's credential:
--
--   select id_no from profiles;   -- 200, all 644 ID numbers
--
-- Re-grants SELECT on the 17 remaining columns; email and id_no are now
-- served only through get_member_details() (see
-- 20260916180000_get_member_details_rpc.sql).
--
-- NOTE: this closes the enumeration path but not the underlying weakness.
-- The durable fix is to stop using the student ID number as the default
-- password.
-- ============================================================

revoke select on public.profiles from anon, authenticated;

grant select (
  id, full_name, program, year_level, role, avatar_url, created_at,
  positions, privacy_policy_accepted_at, section, surname, first_name,
  middle_initial, clearance_locked, requested_role,
  email_changed_count, email_changed_at
) on public.profiles to anon, authenticated;