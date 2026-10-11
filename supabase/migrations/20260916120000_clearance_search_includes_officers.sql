-- ============================================================
-- Clearance search must include student officers
--
-- Officers (governor, secretary, treasurer, ...) are nursing
-- students carrying PULSO duties, so they are stored with
-- role = 'moderator' rather than 'student'. search_students()
-- filtered on p.role = 'student', which silently hid all of
-- them from Clinical Instructors: officers with rotational
-- clearance forms could not be found by name, ID or email.
--
-- The scan path was never affected (it resolves a profile by
-- UUID), which is why officers appeared when scanned but not
-- when searched.
--
-- faculty / superadmin stay excluded: they are staff, not
-- rotation candidates. The first-year exclusion is unchanged.
-- ============================================================

create or replace function public.search_students(p_q text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_q text;
begin
  if not coalesce(public.is_clearance_viewer(), false) then
    raise exception 'insufficient privileges';
  end if;
  v_q := lower(coalesce(trim(p_q), ''));
  if v_q = '' then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'id_no', p.id_no,
      'program', p.program,
      'year_level', p.year_level,
      'section', p.section,
      'avatar_url', p.avatar_url,
      'role', p.role,
      'positions', p.positions
    ) order by p.full_name)
    from public.profiles p
    where p.role in ('student', 'moderator')
      and coalesce(p.year_level, '') <> '1'
      and (
        lower(coalesce(p.full_name, '')) like '%' || v_q || '%'
        or lower(coalesce(p.id_no, '')) like '%' || v_q || '%'
        or lower(coalesce(p.email, '')) like '%' || v_q || '%'
      )
    limit 20
  ), '[]'::jsonb);
end;
$fn$;

grant execute on function public.search_students(text) to authenticated;