-- ============================================================
-- get_member_details(): gated access to profiles.email + profiles.id_no
--
-- Supersedes get_member_emails() from 20260916170000.
--
-- profiles.email and profiles.id_no are column-protected (see
-- 20260916140000 and 20260916200000): members cannot select them off the
-- table, because RLS is row-level and could never hide a column. A plain
-- student could otherwise enumerate every address and every student ID
-- number - and passwords default to the student ID number.
--
-- Returns email+id_no when either:
--   * every requested id is the caller themselves (the digital ID card
--     shows your own ID number), or
--   * the caller holds any role other than plain student (officers and
--     faculty rosters and their XLSX exports show ID numbers and emails).
--
-- Client side: attachMemberDetails() merges these fields in after load and
-- degrades to absent fields rather than a failed query when not permitted.
-- ============================================================

create or replace function public.get_member_details(p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_staff boolean;
begin
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and coalesce(role, '') <> 'student'
  ) into v_staff;

  if not coalesce(v_staff, false) then
    if auth.uid() is null or not (p_ids <@ array[auth.uid()]) then
      raise exception 'insufficient privileges';
    end if;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'email', p.email, 'id_no', p.id_no))
    from public.profiles p
    where p.id = any(p_ids)
  ), '[]'::jsonb);
end;
$fn$;

grant execute on function public.get_member_details(uuid[]) to authenticated;

drop function if exists public.get_member_emails(uuid[]);