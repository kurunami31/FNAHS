-- ============================================================
-- faculty signup approval
--
-- Public signup always creates a 'student' profile — no
-- self-escalation. A registrant who picked "Faculty" stores that
-- intent in profiles.requested_role so a superadmin can promote
-- them through the Admin console (resolve_faculty_request), which
-- also clears the pending request.
-- ============================================================

alter table public.profiles add column if not exists requested_role text;
alter table public.profiles drop constraint if exists profiles_requested_role_check;
alter table public.profiles add constraint profiles_requested_role_check
  check (requested_role is null or requested_role in ('faculty'));

-- auto-create a profile when a user signs up; role stays 'student'
-- (pending approval) and the faculty request is preserved for the
-- superadmin to review.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, requested_role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    'student',
    case when new.raw_user_meta_data ->> 'requested_role' = 'faculty' then 'faculty' else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Superadmin resolves a pending faculty request: approve promotes
-- the member to 'faculty' (via the sanctioned role path) and clears
-- the request; dismiss just clears the request.
create or replace function public.resolve_faculty_request(p_target uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text;
begin
  select role into v_actor from public.profiles where id = auth.uid();
  if v_actor is distinct from 'superadmin' then
    raise exception 'insufficient privileges';
  end if;
  if p_approve then
    update public.profiles
    set role = 'faculty', requested_role = null
    where id = p_target;
  else
    update public.profiles
    set requested_role = null
    where id = p_target;
  end if;
end;
$$;

grant execute on function public.resolve_faculty_request(uuid, boolean) to authenticated;