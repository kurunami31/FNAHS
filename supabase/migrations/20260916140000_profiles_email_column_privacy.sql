-- ============================================================
-- profiles.email must not be readable by members
--
-- RLS is ROW-level only: a policy can decide which rows you see,
-- never which columns. Because `authenticated` held a table-level
-- SELECT grant, any signed-in student could read every member's
-- email and id_no straight from the table:
--
--   select email from profiles;   -- returned all 644 addresses
--
-- get_directory() deliberately omits email/id_no and admin_get_users()
-- is gated to moderators/superadmins, but direct table access bypassed
-- both. This revokes the table-wide grant and re-grants SELECT on the
-- 18 non-email columns.
--
-- The app is unaffected: getProfile() never selects email (own-email
-- falls back to the session), and the SECURITY DEFINER RPCs
-- (admin_get_users, get_directory, search_students) run as the owner
-- and bypass column grants.
--
-- NOTE: id_no is intentionally still readable — getProfile() needs it
-- for the digital ID and CI clearance scan, and it appears in joined
-- embeds (attendance, clearance, class lists). Follow-up work: move
-- id_no behind a guarded RPC, since passwords currently default to the
-- student ID number.
-- ============================================================

revoke select on public.profiles from anon, authenticated;

grant select (
  id, full_name, program, year_level, role, avatar_url, created_at,
  positions, privacy_policy_accepted_at, section, surname, first_name,
  middle_initial, id_no, clearance_locked, requested_role,
  email_changed_count, email_changed_at
) on public.profiles to anon, authenticated;