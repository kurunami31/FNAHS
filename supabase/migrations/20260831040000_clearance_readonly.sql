-- ============================================================
-- Clearance read-only split
--
-- is_clearance_officer() remains the WRITE gate (faculty +
-- superadmin, excluding clearance_locked accounts). A new
-- is_clearance_viewer() gate (faculty + superadmin, lock ignored)
-- now governs every READ: the SELECT policies on both tables, the
-- get_clearance_forms() RPC and search_students(). This lets a
-- clearance-locked superadmin (e.g. fnahsadmin@dorsu.edu.ph) still
-- view / scan / search student clearances without being able to
-- edit or delete anything.
-- ============================================================

create or replace function public.is_clearance_viewer()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('faculty', 'superadmin')
  );
$$;

grant execute on function public.is_clearance_viewer() to authenticated;

-- ---- reads use the viewer gate ----
drop policy if exists "clearance forms - own or officer" on public.clearance_forms;
create policy "clearance forms - own or officer"
  on public.clearance_forms for select
  using (auth.uid() = member_id or public.is_clearance_viewer());

drop policy if exists "clearance rows - own or officer" on public.clearance_rows;
create policy "clearance rows - own or officer"
  on public.clearance_rows for select
  using (
    public.is_clearance_viewer() or exists (
      select 1 from public.clearance_forms f
      where f.id = form_id and f.member_id = auth.uid()
    )
  );

-- ---- RPCs: viewers may read ----
create or replace function public.get_clearance_forms(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_out jsonb;
  v_level text;
begin
  if not coalesce(public.is_clearance_viewer() or auth.uid() = p_student_id, false) then
    raise exception 'insufficient privileges';
  end if;

  select year_level into v_level from public.profiles where id = p_student_id;
  if coalesce(v_level, '') = '1' then
    raise exception 'First-year students are not eligible for rotational clearance';
  end if;

  select coalesce(jsonb_agg(j), '[]'::jsonb)
  into v_out
  from (
    select jsonb_build_object(
      'id', f.id,
      'member_id', f.member_id,
      'school_year', f.school_year,
      'semester', f.semester,
      'placement', f.placement,
      'created_by', f.created_by,
      'created_at', f.created_at,
      'rows', public.clearance_rows_json(f.id)
    ) j
    from public.clearance_forms f
    where f.member_id = p_student_id
    order by f.school_year, f.semester
  ) s;

  return v_out;
end;
$$;

grant execute on function public.get_clearance_forms(uuid) to authenticated;

create or replace function public.search_students(p_q text)
returns jsonb language plpgsql security definer set search_path = public as $$
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
      'role', p.role
    ) order by p.full_name)
    from public.profiles p
    where p.role = 'student'
      and coalesce(p.year_level, '') <> '1'
      and (
        lower(coalesce(p.full_name, '')) like '%' || v_q || '%'
        or lower(coalesce(p.id_no, '')) like '%' || v_q || '%'
        or lower(coalesce(p.email, '')) like '%' || v_q || '%'
      )
    limit 20
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.search_students(text) to authenticated;

-- ---- WRITE policies unchanged: is_clearance_officer() still excludes
-- ---- clearance_locked accounts, so locked viewers can never modify. ----