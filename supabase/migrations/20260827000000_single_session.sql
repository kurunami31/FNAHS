-- ============================================================
-- single-session login (one device per account)
--
-- Security measure: when a user signs in on a new device, every
-- earlier session of that user is invalidated immediately. The
-- old device's refresh token dies (its next refresh fails), and
-- the app's session heartbeat (is_latest_session) force-signs
-- that device out within seconds.
--
--   · public.claim_session()  — called right after a successful
--     sign-in / MFA verify: deletes all other sessions of the
--     caller (session id read from the JWT's session_id claim).
--   · public.is_latest_session() — heartbeat check: true only
--     while the caller's session is still the user's newest.
-- Functions live in the public schema (postgres cannot create
-- objects in the auth schema; SELECT/DELETE on auth.sessions are
-- granted).
-- ============================================================

create or replace function public.claim_session()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sid uuid := coalesce(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'session_id')::uuid,
    '00000000-0000-0000-0000-000000000000'
  );
begin
  -- The session must actually exist and belong to the caller.
  if not exists (select 1 from auth.sessions where id = v_sid and user_id = auth.uid()) then
    raise exception 'invalid session';
  end if;
  -- Invalidate every other session of this user.
  delete from auth.sessions
  where user_id = auth.uid()
    and id <> v_sid;
end;
$$;

create or replace function public.is_latest_session()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.sessions s
    where s.id = coalesce(
      (current_setting('request.jwt.claims', true)::jsonb ->> 'session_id')::uuid,
      '00000000-0000-0000-0000-000000000000'
    )
      and s.user_id = auth.uid()
      and s.id = (
        select t.id
        from auth.sessions t
        where t.user_id = auth.uid()
        order by t.created_at desc, t.id desc
        limit 1
      )
  );
$$;

grant execute on function public.claim_session() to authenticated;
grant execute on function public.is_latest_session() to authenticated;