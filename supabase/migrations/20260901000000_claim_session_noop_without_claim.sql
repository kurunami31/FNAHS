-- ============================================================
-- claim_session / is_latest_session: survive empty jwt.claims
--
-- request.jwt.claims can persist as an EMPTY STRING on pooled
-- backends after anonymous requests; ''::jsonb throws, which made
-- these RPCs fail with confusing 400s. Both now treat NULL *and*
-- blank as "no claims". A provided-but-invalid session still raises
-- in claim_session; is_latest_session simply reports false.
-- ============================================================

create or replace function public.claim_session()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_sid uuid := coalesce(
    nullif(current_setting('request.jwt.claims', true), ''),
    '{}'
  )::jsonb ->> 'session_id';
begin
  -- No usable session claim (anon caller / pre-exchange reset page): no-op.
  if v_sid is null then
    return;
  end if;
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
set search_path to 'public'
as $$
  select exists (
    select 1
    from auth.sessions s
    where s.id = coalesce(
      coalesce(
        nullif(current_setting('request.jwt.claims', true), ''),
        '{}'
      )::jsonb ->> 'session_id',
      '00000000-0000-0000-0000-000000000000'
    )::uuid
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