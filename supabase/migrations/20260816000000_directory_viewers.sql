-- ============================================================
-- Restrict the member directory to moderators, superadmins, and
-- console-officer positions (mirrors rbac.js 'directory.view').
-- Regular members keep only the lightweight member count.
-- ============================================================

-- directory viewers: superadmin/moderator roles + console-officer positions
create or replace function public.is_directory_viewer()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role in ('moderator', 'superadmin') or positions && array[
        'governor', 'v-governor', 'secretary', 'treasurer',
        'auditor', 'business-manager'
      ]::text[])
  );
$$;

-- get_directory() now raises for non-viewers instead of returning rows
drop function if exists public.get_directory();
create or replace function public.get_directory()
returns table (id uuid, full_name text, program text, year_level text, role text, positions text[], avatar_url text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_directory_viewer() then
    raise exception 'insufficient privileges';
  end if;
  return query
    select p.id, p.full_name, p.program, p.year_level, p.role, p.positions, p.avatar_url, p.created_at
    from public.profiles p
    where p.role is distinct from 'superadmin'
    order by p.full_name;
end;
$$;

-- lightweight member count — safe for everyone (no names, no emails)
create or replace function public.get_member_count()
returns bigint language sql security definer set search_path = public as $$
  select count(*) from public.profiles where role is distinct from 'superadmin';
$$;

grant execute on function public.get_directory() to authenticated;
grant execute on function public.get_member_count() to authenticated;