-- ============================================================
-- create_member() — console-officer account creation
--
-- Why: the old Admin "Add member" flow inserted a row straight into
-- public.profiles. In live mode that can never work:
--   · profiles.id references auth.users(id), so a profile can only
--     exist for a real auth user;
--   · the profiles INSERT policy requires auth.uid() = id, which a
--     member manager never satisfies for someone else's account.
-- It also handed any console officer a path to mint a superadmin row
-- (privilege escalation), since the insert bypassed the change_role()
-- gate. This RPC creates the auth user (email + hashed password),
-- lets the signup trigger build the profile, then applies the
-- requested role/positions as postgres — the only sanctioned path,
-- mirroring change_role()/set_positions().
-- ============================================================

create or replace function public.create_member(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text default 'student',
  p_positions text[] default '{}',
  p_program text default null,
  p_year_level text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor text;
  v_id uuid;
  v_profile public.profiles;
begin
  -- Only console officers may create accounts; only a superadmin may
  -- create another superadmin (same rule change_role() enforces).
  select role into v_actor from public.profiles where id = auth.uid();
  if v_actor is null or not public.is_console_officer() then
    raise exception 'insufficient privileges';
  end if;
  if v_actor is distinct from 'superadmin' then
    -- Non-superadmins create plain student accounts only; role and
    -- positions requests are ignored, mirroring change_role()/set_positions().
    p_role := 'student';
    p_positions := '{}';
  end if;

  if p_email is null or position('@' in p_email) = 0 then
    raise exception 'invalid email';
  end if;
  if coalesce(char_length(p_password), 0) < 6 then
    raise exception 'password must be at least 6 characters';
  end if;
  if p_role not in ('student', 'moderator', 'superadmin') then
    raise exception 'invalid role';
  end if;

  -- Reject duplicate emails with a friendly error (auth.users is unique).
  if exists (select 1 from auth.users where lower(email) = lower(p_email)) then
    raise exception 'a member with that email already exists';
  end if;

  -- Create the auth user; handle_new_user() fires and inserts the profile.
  v_id := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    lower(p_email), crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name),
    now(), now(), '', '', '', ''
  );

  -- Apply the requested role/positions/program as postgres (guard
  -- trigger exempts the definer, exactly like change_role()).
  update public.profiles
  set role = p_role,
      positions = array(select distinct unnest(p_positions)),
      program = coalesce(p_program, program),
      year_level = coalesce(p_year_level, year_level)
  where id = v_id
  returning * into v_profile;

  return to_jsonb(v_profile);
end;
$$;

grant execute on function public.create_member(text, text, text, text, text[], text, text) to authenticated;
