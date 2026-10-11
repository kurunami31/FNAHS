-- ============================================================
-- Population breakdown must include student officers
--
-- Same root cause as the clearance search fix: officers are
-- nursing students stored with role = 'moderator', but this
-- function counted role = 'student' only, under-reporting the
-- nursing population by the number of officers (44 at the time
-- of writing) and mis-sizing every year-level bar on the
-- dashboard.
--
-- faculty / superadmin stay excluded: they are staff, not
-- nursing students.
-- ============================================================

create or replace function public.population_breakdown()
returns jsonb
language sql
security definer
set search_path = public
as $fn$
  select coalesce(jsonb_agg(jsonb_build_object(
    'year_level', y.year_level,
    'count', y.n
  ) order by y.ord), '[]'::jsonb)
  from (
    select coalesce(p.year_level, '—') as year_level, count(*)::int as n,
           case p.year_level when '1' then 1 when '2' then 2 when '3' then 3 when '4' then 4 else 5 end as ord
    from public.profiles p
    where p.role in ('student', 'moderator')
    group by p.year_level
  ) y;
$fn$;

grant execute on function public.population_breakdown() to authenticated;