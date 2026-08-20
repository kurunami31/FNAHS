-- ============================================================
-- faculty directory: also surface superadmin mentors
--
-- A superadmin account whose profile program is set to 'Faculty'
-- (e.g. Lendell Kelly B. Ytac) is displayed alongside role-level
-- faculty on the homepage list. Anything else stays hidden from
-- the public faculty list.
-- ============================================================

create or replace function public.get_faculty()
returns table (id uuid, full_name text, program text, year_level text, role text, positions text[], avatar_url text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select p.id, p.full_name, p.program, p.year_level, p.role, p.positions, p.avatar_url, p.created_at
    from public.profiles p
    where p.role = 'faculty'
       or (p.role = 'superadmin' and p.program = 'Faculty')
    order by p.full_name;
end;
$$;

grant execute on function public.get_faculty() to authenticated;