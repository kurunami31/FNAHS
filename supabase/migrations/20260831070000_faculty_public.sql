-- ============================================================
-- faculty directory (public homepage list)
--
-- Any authenticated member can list faculty profiles on the home
-- page (avatar, name, program, year level). Emails stay private —
-- they remain readable only through admin_get_users().
-- Mirrors src/rbac.js and the Admin console display.
-- ============================================================

create or replace function public.get_faculty()
returns table (id uuid, full_name text, program text, year_level text, role text, positions text[], avatar_url text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select p.id, p.full_name, p.program, p.year_level, p.role, p.positions, p.avatar_url, p.created_at
    from public.profiles p
    where p.role = 'faculty'
    order by p.full_name;
end;
$$;

grant execute on function public.get_faculty() to authenticated;