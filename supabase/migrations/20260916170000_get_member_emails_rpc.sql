-- ============================================================
-- get_member_emails(): staff-facing email access after the
-- profiles.email column lock-down
--
-- 20260916140000 revoked SELECT on profiles.email from anon and
-- authenticated, which correctly stopped students dumping all 644
-- addresses. But three officer/faculty embeds selected email straight
-- off profiles and started failing with 42501:
--
--   api.js:1793  event_payments  -> profiles!member_id(..., email)
--   api.js:1866  attendance      -> profiles(..., email, id_no)
--   api.js:2030  class_attendance-> profiles(..., email, id_no)
--
-- Rosters and their XLSX exports legitimately show an Email column, so
-- this function restores that access in a gated way. The client embeds
-- no longer request email; they fetch it here and merge it in.
--
-- Gate: any active account except a plain student. That matches the
-- audience of admin_get_users() (moderator/superadmin) and additionally
-- allows faculty, who export their own class attendance.
-- ============================================================

create or replace function public.get_member_emails(p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ok boolean;
begin
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and coalesce(role, '') <> 'student'
  ) into v_ok;

  if not coalesce(v_ok, false) then
    raise exception 'insufficient privileges';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'email', p.email))
    from public.profiles p
    where p.id = any(p_ids)
  ), '[]'::jsonb);
end;
$fn$;

grant execute on function public.get_member_emails(uuid[]) to authenticated;