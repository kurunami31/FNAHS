-- ============================================================
-- student search + population breakdown + freshman clearance lock
--
--   1. search_students(q)  — officers (faculty/superadmin) search
--      students by name / ID / email. First-years are excluded.
--   2. population_breakdown() — year-level counts of the student
--      body (1st..4th + others); readable by all authenticated.
--   3. First-year students are locked out of rotational clearance:
--      · get_clearance_forms() refuses to serve year-1 students
--      · clearance_forms trigger refuses to create/attach a form
--        to a year-1 student
-- ============================================================

-- ---- 1. officer-only student search (name / id_no / email) ----
create or replace function public.search_students(p_q text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_q text;
begin
  if not coalesce(public.is_clearance_officer(), false) then
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

-- ---- 2. population breakdown (students by year level) ----
create or replace function public.population_breakdown()
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'year_level', y.year_level,
    'count', y.n
  ) order by y.ord), '[]'::jsonb)
  from (
    select coalesce(p.year_level, '—') as year_level, count(*)::int as n,
           case p.year_level when '1' then 1 when '2' then 2 when '3' then 3 when '4' then 4 else 5 end as ord
    from public.profiles p
    where p.role = 'student'
    group by p.year_level
  ) y;
$$;

grant execute on function public.population_breakdown() to authenticated;

-- ---- 3. first-year students are not eligible for rotational clearance ----
create or replace function public.get_clearance_forms(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_out jsonb;
  v_level text;
begin
  if not coalesce(public.is_clearance_officer() or auth.uid() = p_student_id, false) then
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

-- refuse to create or retarget a form onto a first-year student
create or replace function public.block_freshman_clearance()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_level text;
begin
  select year_level into v_level from public.profiles where id = new.member_id;
  if coalesce(v_level, '') = '1' then
    raise exception 'First-year students are not eligible for rotational clearance';
  end if;
  return new;
end;
$$;

drop trigger if exists block_freshman_clearance on public.clearance_forms;
create trigger block_freshman_clearance
  before insert or update of member_id on public.clearance_forms
  for each row execute function public.block_freshman_clearance();