-- FNAHS Schema — dumped from production with correct ordering

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT ''::text,
  author_id uuid,
  pinned boolean NOT NULL DEFAULT false,
  archived_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer NOT NULL DEFAULT 1,
  maintenance_mode boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  membership_fee_amount numeric NOT NULL DEFAULT 200,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.attendance (
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  scanned_at timestamp with time zone NOT NULL DEFAULT now(),
  time_out timestamp with time zone,
  scan_type text NOT NULL DEFAULT 'time_in'::text,
  PRIMARY KEY (event_id, user_id, scan_type)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.class_attendance (
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  scanned_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.class_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL,
  faculty_id uuid NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.clearance_forms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  school_year text NOT NULL,
  semester text NOT NULL,
  placement text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.clearance_rows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL,
  dates text NOT NULL,
  concept text NOT NULL,
  hours numeric NOT NULL,
  cleared_at timestamp with time zone,
  recorded_by uuid,
  remark text,
  demerit integer,
  days_extension integer,
  merit integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  updated_by uuid,
  updated_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  agency text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  image_url text,
  parent_id uuid,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.event_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  member_id uuid NOT NULL,
  amount numeric NOT NULL,
  paid_at timestamp with time zone NOT NULL DEFAULT now(),
  recorded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.event_polls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  question text NOT NULL,
  created_by uuid,
  closes_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT ''::text,
  location text DEFAULT ''::text,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  fee_amount numeric NOT NULL DEFAULT 0,
  morning_time_in time without time zone,
  morning_time_out time without time zone,
  afternoon_time_in time without time zone,
  afternoon_time_out time without time zone,
  time_in_locked boolean NOT NULL DEFAULT false,
  time_out_locked boolean NOT NULL DEFAULT false,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.faculty_subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.fee_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  school_year text NOT NULL,
  payment_type text NOT NULL,
  amount numeric NOT NULL,
  receipt text,
  paid_at timestamp with time zone NOT NULL DEFAULT now(),
  recorded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.news_cache (
  key text NOT NULL,
  payload jsonb NOT NULL,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'system'::text,
  title text NOT NULL,
  body text NOT NULL DEFAULT ''::text,
  link text,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.poll_options (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL,
  label text NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  poll_id uuid NOT NULL,
  option_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  content text NOT NULL,
  image_url text,
  archived_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  full_name text NOT NULL DEFAULT ''::text,
  email text,
  program text,
  year_level text,
  role text NOT NULL DEFAULT 'student'::text,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  positions text[] NOT NULL DEFAULT '{}'::text[],
  privacy_policy_accepted_at timestamp with time zone,
  section text,
  surname text,
  first_name text,
  middle_initial text,
  id_no text,
  clearance_locked boolean NOT NULL DEFAULT false,
  requested_role text,
  email_changed_count integer NOT NULL DEFAULT 0,
  email_changed_at timestamp with time zone,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket text NOT NULL,
  window_at timestamp with time zone NOT NULL,
  calls integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_at)
);

CREATE TABLE IF NOT EXISTS public.report_connectors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'google'::text,
  label text NOT NULL DEFAULT 'Org Google Sheet'::text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  last_synced_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.rsvps (
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'going'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

-- Helper functions (must be created first)

CREATE OR REPLACE FUNCTION public.block_duplicate_member_name()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

begin
  if exists (
    select 1 from public.profiles p
    where public.norm_person_name(p.full_name) = public.norm_person_name(new.full_name)
      and p.id <> new.id
  ) then
    raise exception 'An account with this name already exists — one account per member';
  end if;
  return new;
end;

$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.is_announcer()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'superadmin' or positions && array[
        'governor', 'v-governor', 'pio', 'assoc-pio',
        'v-gov-internal', 'v-gov-external',
        'secretary', 'assoc-secretary'
      ]::text[])
  );

$function$
;

CREATE OR REPLACE FUNCTION public.is_clearance_officer()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('faculty', 'superadmin')
      and not coalesce(clearance_locked, false)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_clearance_viewer()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('faculty', 'superadmin')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_console_officer()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'superadmin' or positions && array[
        'governor', 'v-governor', 'secretary', 'treasurer',
        'auditor', 'business-manager'
      ]::text[])
  );

$function$
;

CREATE OR REPLACE FUNCTION public.is_directory_viewer()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role in ('moderator', 'superadmin') or positions && array[
        'governor', 'v-governor', 'secretary', 'treasurer',
        'auditor', 'business-manager'
      ]::text[])
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_door_officer()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role in ('superadmin', 'moderator') or positions && array[
        'governor', 'v-governor',
        'v-gov-internal', 'v-gov-external',
        'secretary', 'assoc-secretary',
        'treasurer', 'assoc-treasurer',
        'business-manager', 'assoc-business-manager'
      ]::text[])
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_event_fee_manager()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role in ('moderator', 'superadmin') or positions && array[
        'governor', 'v-governor', 'pio', 'v-gov-internal',
        'v-gov-external', 'secretary', 'assoc-secretary',
        'treasurer', 'business-manager'
      ]::text[])
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_event_manager()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'superadmin' or positions && array[
        'governor', 'v-governor', 'pio', 'assoc-pio',
        'v-gov-internal', 'v-gov-external',
        'secretary', 'assoc-secretary',
        'treasurer', 'assoc-treasurer',
        'business-manager'
      ]::text[])
  );

$function$
;

CREATE OR REPLACE FUNCTION public.is_fee_manager()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role in ('moderator', 'superadmin') or positions && array[
        'treasurer', 'assoc-treasurer', 'auditor', 'business-manager'
      ]::text[])
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_fee_viewer()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role in ('moderator', 'superadmin') or positions && array[
        'governor', 'v-governor', 'secretary', 'treasurer',
        'assoc-treasurer', 'auditor', 'business-manager'
      ]::text[])
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_latest_session()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select exists (
      select 1
      from auth.sessions s
      where s.user_id = auth.uid()
        and s.id = (
          select t.id
          from auth.sessions t
          where t.user_id = auth.uid()
          order by t.created_at desc, t.id desc
          limit 1
        )
    );
  $function$
;

-- Other functions

CREATE OR REPLACE FUNCTION public.admin_get_users()
 RETURNS SETOF profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    begin
      if not exists (
        select 1 from public.profiles
        where id = auth.uid() and role in ('staff', 'moderator', 'superadmin')
      ) then
        raise exception 'insufficient privileges';
      end if;
      return query select * from public.profiles order by full_name;
    end;
    $function$
;

CREATE OR REPLACE FUNCTION public.announce_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_parts text[];
begin
  perform set_config('app.event_announce', 'true', true);

  v_parts := array[]::text[];
  if new.starts_at is not null then
    v_parts := array_append(v_parts,
      'When: ' || to_char(new.starts_at at time zone 'Asia/Manila', 'Mon DD, YYYY · HH12:MI AM'));
  end if;
  if coalesce(new.location, '') <> '' then
    v_parts := array_append(v_parts, 'Where: ' || new.location);
  end if;
  if coalesce(new.description, '') <> '' then
    v_parts := array_append(v_parts, new.description);
  end if;

  insert into public.announcements (title, body, author_id)
  values (new.title, array_to_string(v_parts, E'\n'), new.created_by);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.block_freshman_clearance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_level text;
begin
  select year_level into v_level from public.profiles where id = new.member_id;
  if coalesce(v_level, '') = '1' then
    raise exception 'First-year students are not eligible for rotational clearance';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.bump_rate(p_bucket text, p_max integer DEFAULT 20, p_window_minutes integer DEFAULT 1)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / (p_window_minutes * 60)) * p_window_minutes * 60);
  v_calls int;
begin
  insert into public.rate_limits (bucket, window_at, calls)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_at) do update set calls = public.rate_limits.calls + 1
  returning calls into v_calls;
  delete from public.rate_limits where window_at < now() - interval '2 hours';
  return v_calls <= p_max;
end;

$function$
;

CREATE OR REPLACE FUNCTION public.change_role(p_target uuid, p_new_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor text;
  v_current text;
begin
  select role into v_actor from public.profiles where id = auth.uid();
  if v_actor is distinct from 'superadmin' then
    raise exception 'insufficient privileges';
  end if;

  select role into v_current from public.profiles where id = p_target;
  if not found then
    raise exception 'member not found';
  end if;

  if p_new_role not in ('student', 'faculty', 'moderator', 'superadmin') then
    raise exception 'invalid role';
  end if;

  if v_current = 'superadmin' and p_new_role <> 'superadmin'
     and (select count(*) from public.profiles where role = 'superadmin') <= 1 then
    raise exception 'cannot demote the last superadmin';
  end if;

  update public.profiles set role = p_new_role where id = p_target;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_session()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  declare
    v_claims text := nullif(current_setting('request.jwt.claims', true), '');
    v_sid text;
  begin
    if v_claims is null or v_claims = '' then
      return;
    end if;
    v_sid := v_claims::jsonb ->> 'session_id';
    if v_sid is null then
      return;
    end if;
    begin
      if not exists (select 1 from auth.sessions where id = v_sid::uuid and user_id = auth.uid()) then
        return;
      end if;
      delete from auth.sessions
      where user_id = auth.uid()
        and id <> v_sid::uuid;
    exception when others then
      return;
    end;
  end;
  $function$
;

CREATE OR REPLACE FUNCTION public.clearance_rows_json(p_form_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(j), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', r.id,
      'form_id', r.form_id,
      'dates', r.dates,
      'concept', r.concept,
      'hours', r.hours,
      'agency', r.agency,
      'cleared_at', r.cleared_at,
      'remark', r.remark,
      'demerit', r.demerit,
      'days_extension', r.days_extension,
      'merit', r.merit,
      'recorded_by', r.recorded_by,
      'recorded_by_name', rec.full_name,
      'created_by', r.created_by,
      'updated_by', r.updated_by,
      'updated_by_name', up.full_name,
      'created_at', r.created_at
    ) j
    from public.clearance_rows r
    left join public.profiles rec on rec.id = r.recorded_by
    left join public.profiles up on up.id = r.updated_by
    where r.form_id = p_form_id
    order by r.created_at, r.id
  ) sub;
$function$
;

CREATE OR REPLACE FUNCTION public.create_member(p_email text, p_password text, p_full_name text, p_role text DEFAULT 'student'::text, p_positions text[] DEFAULT '{}'::text[], p_program text DEFAULT NULL::text, p_year_level text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_actor text;
  v_id uuid;
  v_profile public.profiles;
begin
  -- Only console officers may create accounts; only a superadmin may
  -- create another superadmin or a faculty member (same rule
  -- change_role() enforces).
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
  if p_role not in ('student', 'faculty', 'moderator', 'superadmin') then
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_kind text, p_title text, p_body text DEFAULT ''::text, p_link text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

  insert into public.notifications (user_id, kind, title, body, link)
  values (p_user_id, p_kind, p_title, p_body, p_link);

$function$
;

CREATE OR REPLACE FUNCTION public.get_audit_logs(p_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, actor_id uuid, action text, entity text, entity_id text, meta jsonb, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select l.id, l.actor_id, l.action, l.entity, l.entity_id, l.meta, l.created_at
  from public.audit_logs l
  where public.is_console_officer()
  order by l.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$function$
;

CREATE OR REPLACE FUNCTION public.get_clearance_forms(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_directory()
 RETURNS TABLE(id uuid, full_name text, program text, year_level text, role text, positions text[], avatar_url text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_event_tallies()
 RETURNS TABLE(event_id uuid, count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.event_id, count(*)::bigint as count
  from public.attendance a
  group by a.event_id;
$function$
;

CREATE OR REPLACE FUNCTION public.get_faculty()
 RETURNS TABLE(id uuid, full_name text, program text, year_level text, role text, positions text[], avatar_url text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
    select p.id, p.full_name, p.program, p.year_level, p.role, p.positions, p.avatar_url, p.created_at
    from public.profiles p
    where p.role = 'faculty'
       or (p.role = 'superadmin' and p.program = 'Faculty')
    order by p.full_name;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_maintenance_mode()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select maintenance_mode from public.app_settings where id = 1), false);
$function$
;

CREATE OR REPLACE FUNCTION public.get_member_count()
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*) from public.profiles where role is distinct from 'superadmin';
$function$
;

CREATE OR REPLACE FUNCTION public.get_membership_fee_amount()
 RETURNS numeric
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select membership_fee_amount from public.app_settings where id = 1), 200);
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_class_attendance()
 RETURNS TABLE(session_id uuid, subject_id uuid, subject_name text, started_at timestamp with time zone, scanned_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select ca.session_id, s.subject_id, fs.name, s.started_at, ca.scanned_at from public.class_attendance ca join public.class_sessions s on s.id = ca.session_id join public.faculty_subjects fs on fs.id = s.subject_id where ca.user_id = auth.uid() order by ca.scanned_at desc; 
$function$
;

CREATE OR REPLACE FUNCTION public.guard_email_change_once()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare
  v_changes integer;
begin
  if tg_op = 'UPDATE' and new.email is distinct from old.email then
    select coalesce(email_changed_count, 0) into v_changes
    from public.profiles where id = new.id;

    if v_changes is null then
      raise exception 'Profile missing for email change';
    end if;
    if v_changes >= 1 then
      raise exception 'Email can only be changed once';
    end if;

    update public.profiles
    set email_changed_count = v_changes + 1,
        email_changed_at = now()
    where id = new.id;
  end if;
  return coalesce(new, old);
end;

$function$
;

CREATE OR REPLACE FUNCTION public.guard_officer_privilege_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

begin
  if current_user <> 'postgres'
     and (old.role is distinct from new.role
          or old.positions is distinct from new.positions) then
    raise exception 'role and positions can only change through change_role()/set_positions()';
  end if;
  return coalesce(new, old);
end;

$function$
;

CREATE OR REPLACE FUNCTION public.log_audit(p_action text, p_entity text, p_entity_id text DEFAULT NULL::text, p_meta jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_meta, '{}'::jsonb));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_my_class_attendance(p_session uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

begin
  if not exists (
    select 1 from public.class_sessions s
    where s.id = p_session and s.ended_at is null
  ) then
    raise exception 'Class session not found or already ended';
  end if;

  insert into public.class_attendance (session_id, user_id, scanned_at)
  values (p_session, auth.uid(), now())
  on conflict (session_id, user_id) do nothing;
end;

$function$
;

CREATE OR REPLACE FUNCTION public.norm_person_name(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$

  select lower(btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')))

$function$
;

CREATE OR REPLACE FUNCTION public.notify_announcement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if current_setting('app.event_announce', true) = 'true' then
    return new;
  end if;
  insert into public.notifications (user_id, kind, title, body, link)
  select id, 'announcement', new.title, '', '/app/feed#announcements'
  from public.profiles;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_attendance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare
  v_title text;
begin
  select title into v_title from public.events where id = new.event_id;
  insert into public.notifications (user_id, kind, title, body, link)
  values (new.user_id, 'attendance', 'Checked in!',
          coalesce(v_title, 'Your event') || ' — attendance recorded.', '/app/events');
  return new;
end;

$function$
;

CREATE OR REPLACE FUNCTION public.notify_clearance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_member uuid;
  v_placement text;
begin
  select f.member_id, f.placement into v_member, v_placement
  from public.clearance_forms f
  where f.id = new.form_id;

  if TG_OP = 'INSERT' then
    insert into public.notifications (user_id, kind, title, body, link)
    values (v_member, 'clearance', 'New rotation row - ' || coalesce(v_placement, 'your rotation'),
            coalesce(new.concept, '') || ' - ' || coalesce(new.dates, ''), '/app/idcard');
  elsif TG_OP = 'UPDATE' and old.cleared_at is null and new.cleared_at is not null then
    insert into public.notifications (user_id, kind, title, body, link)
    values (v_member, 'clearance', 'Clearance signed - ' || coalesce(v_placement, 'your rotation'),
            coalesce(new.concept, '') || ' - ' || coalesce(new.dates, ''), '/app/idcard');
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_author uuid;
  v_name text;
  v_target uuid;
begin
  -- notify the post author (skip self-comments)
  select user_id into v_author from public.posts where id = new.post_id;
  if v_author is not null and v_author <> new.user_id then
    select full_name into v_name from public.profiles where id = new.user_id;
    insert into public.notifications (user_id, kind, title, body, link)
    values (v_author, 'mention', coalesce(v_name, 'A member') || ' commented on your post',
            left(new.content, 120), '/app/feed');
  end if;

  -- notify the author of the comment being replied to
  if new.parent_id is not null then
    select user_id into v_target from public.comments where id = new.parent_id;
    if v_target is not null and v_target <> new.user_id then
      select full_name into v_name from public.profiles where id = new.user_id;
      insert into public.notifications (user_id, kind, title, body, link)
      values (v_target, 'mention', coalesce(v_name, 'A member') || ' replied to your comment',
              left(new.content, 120), '/app/feed');
    end if;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.notifications (user_id, kind, title, body, link)
  select id, 'event', 'New event: ' || new.title,
         to_char(new.starts_at at time zone 'Asia/Manila', 'Mon DD at HH24:MI'),
         '/app/events?open=' || new.id::text
  from public.profiles
  where id is distinct from new.created_by;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_like()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare
  v_author uuid;
  v_name text;
begin
  select user_id into v_author from public.posts where id = new.post_id;
  if v_author is null or v_author = new.user_id then
    return new;
  end if;
  select full_name into v_name from public.profiles where id = new.user_id;
  insert into public.notifications (user_id, kind, title, body, link)
  values (v_author, 'mention', coalesce(v_name, 'A member') || ' liked your post',
          '', '/app/feed');
  return new;
end;

$function$
;

CREATE OR REPLACE FUNCTION public.notify_poll()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

begin
  insert into public.notifications (user_id, kind, title, body, link)
  select r.user_id, 'poll', 'New poll: ' || new.question, '', '/app/events'
  from public.rsvps r
  where r.event_id = new.event_id and r.status = 'going';
  return new;
end;

$function$
;

CREATE OR REPLACE FUNCTION public.population_breakdown()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_last_superadmin_demotion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

begin
  if old.role = 'superadmin' and (tg_op <> 'UPDATE' or new.role <> 'superadmin') then
    if (select count(*) from public.profiles where role = 'superadmin') = 1 then
      raise exception 'cannot demote or remove the last superadmin';
    end if;
  end if;
  return coalesce(new, old);
end;

$function$
;

CREATE OR REPLACE FUNCTION public.report_sync_status()
 RETURNS TABLE(id uuid, kind text, label text, enabled boolean, last_synced_at timestamp with time zone, last_error text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select rc.id, rc.kind, rc.label, rc.enabled, rc.last_synced_at, rc.last_error
  from public.report_connectors rc
  where (select role from public.profiles where id = auth.uid()) = 'superadmin'
     or public.is_console_officer()
  order by rc.created_at;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_faculty_request(p_target uuid, p_approve boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.scan_attendance(p_event uuid, p_user uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare
  v_time_out timestamptz;
begin
  if not is_door_officer() then
    raise exception 'Only door officers can record attendance';
  end if;

  select time_out into v_time_out
  from public.attendance
  where event_id = p_event and user_id = p_user;

  if not found then
    insert into public.attendance (event_id, user_id, scanned_at)
    values (p_event, p_user, now());
    return 'in';
  end if;

  if v_time_out is null then
    update public.attendance
    set time_out = now()
    where event_id = p_event and user_id = p_user;
    return 'out';
  end if;

  return 'already-out';
end;

$function$
;

CREATE OR REPLACE FUNCTION public.scan_attendance_manual(p_event uuid, p_user uuid, p_scan_type text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not is_door_officer() then
    raise exception 'Only door officers can record attendance';
  end if;

  if p_scan_type = 'time_in' then
    insert into public.attendance (event_id, user_id, scanned_at)
    values (p_event, p_user, now())
    on conflict (event_id, user_id) do update
      set scanned_at = coalesce(excluded.scanned_at, attendance.scanned_at);
    return 'in';
  elsif p_scan_type = 'time_out' then
    update public.attendance
      set time_out = now()
    where event_id = p_event and user_id = p_user and time_out is null;
    return 'out';
  end if;
  return 'in';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.search_students(p_q text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.set_maintenance_mode(p_on boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_console_officer() then
    raise exception 'insufficient privileges';
  end if;
  update public.app_settings
  set maintenance_mode = coalesce(p_on, false), updated_at = now(), updated_by = auth.uid()
  where id = 1;
  if not found then
    insert into public.app_settings (id, maintenance_mode, updated_by)
    values (1, coalesce(p_on, false), auth.uid());
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_membership_fee_amount(p_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_fee_manager() then
    raise exception 'insufficient privileges';
  end if;
  update public.app_settings
  set membership_fee_amount = greatest(coalesce(p_amount, 0), 0), updated_at = now(), updated_by = auth.uid()
  where id = 1;
  if not found then
    insert into public.app_settings (id, membership_fee_amount, updated_by)
    values (1, greatest(coalesce(p_amount, 0), 0), auth.uid());
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_positions(p_target uuid, p_positions text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare
  v_actor text;
  p text;
begin
  select role into v_actor from public.profiles where id = auth.uid();
  if v_actor is distinct from 'superadmin' then
    raise exception 'insufficient privileges';
  end if;

  if not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'member not found';
  end if;

  foreach p in array p_positions loop
    if p not in (
      'governor', 'v-governor', 'pio', 'assoc-pio',
      'v-gov-internal', 'v-gov-external',
      'secretary', 'assoc-secretary',
      'treasurer', 'assoc-treasurer',
      'auditor', 'assoc-auditor',
      'business-manager', 'assoc-business-manager',
      'committees'
    ) then
      raise exception 'invalid position: %', p;
    end if;
  end loop;

  update public.profiles set positions = array(select distinct unnest(p_positions))
  where id = p_target;
end;

$function$
;

DROP TRIGGER IF EXISTS notify_attendance ON public.attendance;
CREATE TRIGGER notify_attendance AFTER INSERT ON public.attendance FOR EACH ROW EXECUTE FUNCTION notify_attendance();

DROP TRIGGER IF EXISTS block_freshman_clearance ON public.clearance_forms;
CREATE TRIGGER block_freshman_clearance BEFORE INSERT OR UPDATE OF member_id ON public.clearance_forms FOR EACH ROW EXECUTE FUNCTION block_freshman_clearance();

DROP TRIGGER IF EXISTS notify_clearance ON public.clearance_rows;
CREATE TRIGGER notify_clearance AFTER INSERT OR UPDATE ON public.clearance_rows FOR EACH ROW EXECUTE FUNCTION notify_clearance();

DROP TRIGGER IF EXISTS notify_comment ON public.comments;
CREATE TRIGGER notify_comment AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION notify_comment();

DROP TRIGGER IF EXISTS notify_poll ON public.event_polls;
CREATE TRIGGER notify_poll AFTER INSERT ON public.event_polls FOR EACH ROW EXECUTE FUNCTION notify_poll();

DROP TRIGGER IF EXISTS announce_event ON public.events;
CREATE TRIGGER announce_event AFTER INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION announce_event();

DROP TRIGGER IF EXISTS notify_event ON public.events;
CREATE TRIGGER notify_event AFTER INSERT ON public.events FOR EACH ROW EXECUTE FUNCTION notify_event();

DROP TRIGGER IF EXISTS notify_like ON public.post_likes;
CREATE TRIGGER notify_like AFTER INSERT ON public.post_likes FOR EACH ROW EXECUTE FUNCTION notify_like();

DROP TRIGGER IF EXISTS block_duplicate_member_name ON public.profiles;
CREATE TRIGGER block_duplicate_member_name BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION block_duplicate_member_name();

DROP TRIGGER IF EXISTS guard_last_superadmin ON public.profiles;
CREATE TRIGGER guard_last_superadmin BEFORE DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION prevent_last_superadmin_demotion();

DROP TRIGGER IF EXISTS guard_officer_privilege_columns ON public.profiles;
CREATE TRIGGER guard_officer_privilege_columns BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION guard_officer_privilege_columns();

DROP POLICY IF EXISTS "announcements are readable by members" ON public.announcements;
CREATE POLICY "announcements are readable by members" ON public.announcements FOR SELECT USING (((auth.role() = 'authenticated'::text) AND (archived_at IS NULL)));

DROP POLICY IF EXISTS "announcers delete announcements" ON public.announcements;
CREATE POLICY "announcers delete announcements" ON public.announcements FOR DELETE USING (((author_id = auth.uid()) OR is_announcer()));

DROP POLICY IF EXISTS "announcers manage announcements" ON public.announcements;
CREATE POLICY "announcers manage announcements" ON public.announcements FOR UPDATE USING (((author_id = auth.uid()) OR is_announcer()));

DROP POLICY IF EXISTS "announcers post announcements" ON public.announcements;
CREATE POLICY "announcers post announcements" ON public.announcements FOR INSERT WITH CHECK ((is_announcer() AND (author_id = auth.uid())));

DROP POLICY IF EXISTS "settings readable by members" ON public.app_settings;
CREATE POLICY "settings readable by members" ON public.app_settings FOR SELECT USING ((auth.role() = 'authenticated'::text));

DROP POLICY IF EXISTS "attendance visible to its owner or door officers" ON public.attendance;
CREATE POLICY "attendance visible to its owner or door officers" ON public.attendance FOR SELECT USING (((auth.uid() = user_id) OR is_door_officer()));

DROP POLICY IF EXISTS "door officers delete attendance" ON public.attendance;
CREATE POLICY "door officers delete attendance" ON public.attendance FOR DELETE USING (is_door_officer());

DROP POLICY IF EXISTS "door officers record attendance" ON public.attendance;
CREATE POLICY "door officers record attendance" ON public.attendance FOR INSERT WITH CHECK (is_door_officer());

DROP POLICY IF EXISTS "door officers update attendance" ON public.attendance;
CREATE POLICY "door officers update attendance" ON public.attendance FOR UPDATE USING (is_door_officer());

DROP POLICY IF EXISTS "users read their chat history" ON public.chat_messages;
CREATE POLICY "users read their chat history" ON public.chat_messages FOR SELECT USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "users write their chat history" ON public.chat_messages;
CREATE POLICY "users write their chat history" ON public.chat_messages FOR INSERT WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "attendance_read_owner_or_self" ON public.class_attendance;
CREATE POLICY "attendance_read_owner_or_self" ON public.class_attendance FOR SELECT USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM class_sessions s
  WHERE ((s.id = class_attendance.session_id) AND (s.faculty_id = auth.uid()))))));

DROP POLICY IF EXISTS "session_owner_deletes_attendance" ON public.class_attendance;
CREATE POLICY "session_owner_deletes_attendance" ON public.class_attendance FOR DELETE USING ((EXISTS ( SELECT 1
   FROM class_sessions s
  WHERE ((s.id = class_attendance.session_id) AND (s.faculty_id = auth.uid())))));

DROP POLICY IF EXISTS "session_owner_records_attendance" ON public.class_attendance;
CREATE POLICY "session_owner_records_attendance" ON public.class_attendance FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM class_sessions s
  WHERE ((s.id = class_attendance.session_id) AND (s.faculty_id = auth.uid())))));

DROP POLICY IF EXISTS "session_owner_updates_attendance" ON public.class_attendance;
CREATE POLICY "session_owner_updates_attendance" ON public.class_attendance FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM class_sessions s
  WHERE ((s.id = class_attendance.session_id) AND (s.faculty_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM class_sessions s
  WHERE ((s.id = class_attendance.session_id) AND (s.faculty_id = auth.uid())))));

DROP POLICY IF EXISTS "faculty_owner_manages_own_sessions" ON public.class_sessions;
CREATE POLICY "faculty_owner_manages_own_sessions" ON public.class_sessions FOR ALL USING ((faculty_id = auth.uid())) WITH CHECK ((faculty_id = auth.uid()));

DROP POLICY IF EXISTS "clearance forms - own or officer" ON public.clearance_forms;
CREATE POLICY "clearance forms - own or officer" ON public.clearance_forms FOR SELECT USING (((auth.uid() = member_id) OR is_clearance_viewer()));

DROP POLICY IF EXISTS "clearance officers create forms" ON public.clearance_forms;
CREATE POLICY "clearance officers create forms" ON public.clearance_forms FOR INSERT WITH CHECK ((is_clearance_officer() AND (created_by = auth.uid())));

DROP POLICY IF EXISTS "clearance officers delete forms" ON public.clearance_forms;
CREATE POLICY "clearance officers delete forms" ON public.clearance_forms FOR DELETE USING (is_clearance_officer());

DROP POLICY IF EXISTS "clearance officers update forms" ON public.clearance_forms;
CREATE POLICY "clearance officers update forms" ON public.clearance_forms FOR UPDATE USING (is_clearance_officer());

DROP POLICY IF EXISTS "clearance officers create rows" ON public.clearance_rows;
CREATE POLICY "clearance officers create rows" ON public.clearance_rows FOR INSERT WITH CHECK ((is_clearance_officer() AND (created_by = auth.uid())));

DROP POLICY IF EXISTS "clearance rows - own or officer" ON public.clearance_rows;
CREATE POLICY "clearance rows - own or officer" ON public.clearance_rows FOR SELECT USING ((is_clearance_viewer() OR (EXISTS ( SELECT 1
   FROM clearance_forms f
  WHERE ((f.id = clearance_rows.form_id) AND (f.member_id = auth.uid()))))));

DROP POLICY IF EXISTS "clearing CI or superadmin delete rows" ON public.clearance_rows;
CREATE POLICY "clearing CI or superadmin delete rows" ON public.clearance_rows FOR DELETE USING ((is_clearance_officer() AND ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'superadmin'::text) OR (recorded_by = auth.uid()) OR (recorded_by IS NULL))));

DROP POLICY IF EXISTS "clearing CI or superadmin update rows" ON public.clearance_rows;
CREATE POLICY "clearing CI or superadmin update rows" ON public.clearance_rows FOR UPDATE USING ((is_clearance_officer() AND ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'superadmin'::text) OR (recorded_by = auth.uid()) OR (recorded_by IS NULL))));

DROP POLICY IF EXISTS "authors can delete their comments" ON public.comments;
CREATE POLICY "authors can delete their comments" ON public.comments FOR DELETE USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "authors or staff can delete comments" ON public.comments;
CREATE POLICY "authors or staff can delete comments" ON public.comments FOR DELETE USING (((auth.uid() = user_id) OR (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['staff'::text, 'moderator'::text, 'superadmin'::text]))));

DROP POLICY IF EXISTS "authors or staff can update comments" ON public.comments;
CREATE POLICY "authors or staff can update comments" ON public.comments FOR UPDATE USING (((auth.uid() = user_id) OR (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['staff'::text, 'moderator'::text, 'superadmin'::text]))));

DROP POLICY IF EXISTS "comments are publicly readable" ON public.comments;
CREATE POLICY "comments are publicly readable" ON public.comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "comments are readable by members" ON public.comments;
CREATE POLICY "comments are readable by members" ON public.comments FOR SELECT USING ((auth.role() = 'authenticated'::text));

DROP POLICY IF EXISTS "members can comment" ON public.comments;
CREATE POLICY "members can comment" ON public.comments FOR INSERT WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "event managers record payments" ON public.event_payments;
CREATE POLICY "event managers record payments" ON public.event_payments FOR INSERT WITH CHECK (is_event_fee_manager());

DROP POLICY IF EXISTS "event managers update payments" ON public.event_payments;
CREATE POLICY "event managers update payments" ON public.event_payments FOR UPDATE USING (is_event_fee_manager());

DROP POLICY IF EXISTS "event managers void payments" ON public.event_payments;
CREATE POLICY "event managers void payments" ON public.event_payments FOR DELETE USING (is_event_fee_manager());

DROP POLICY IF EXISTS "members see their own event payments" ON public.event_payments;
CREATE POLICY "members see their own event payments" ON public.event_payments FOR SELECT USING (((auth.uid() = member_id) OR is_event_fee_manager()));

DROP POLICY IF EXISTS "event managers create polls" ON public.event_polls;
CREATE POLICY "event managers create polls" ON public.event_polls FOR INSERT WITH CHECK ((is_event_manager() AND (created_by = auth.uid())));

DROP POLICY IF EXISTS "event managers delete polls" ON public.event_polls;
CREATE POLICY "event managers delete polls" ON public.event_polls FOR DELETE USING (is_event_manager());

DROP POLICY IF EXISTS "event managers update polls" ON public.event_polls;
CREATE POLICY "event managers update polls" ON public.event_polls FOR UPDATE USING (is_event_manager());

DROP POLICY IF EXISTS "polls readable by members" ON public.event_polls;
CREATE POLICY "polls readable by members" ON public.event_polls FOR SELECT USING ((auth.role() = 'authenticated'::text));

DROP POLICY IF EXISTS "events are readable by members" ON public.events;
CREATE POLICY "events are readable by members" ON public.events FOR SELECT USING ((auth.role() = 'authenticated'::text));

DROP POLICY IF EXISTS "officers create events" ON public.events;
CREATE POLICY "officers create events" ON public.events FOR INSERT WITH CHECK ((is_event_manager() AND (auth.uid() = created_by)));

DROP POLICY IF EXISTS "officers delete events" ON public.events;
CREATE POLICY "officers delete events" ON public.events FOR DELETE USING (is_event_manager());

DROP POLICY IF EXISTS "officers manage events" ON public.events;
CREATE POLICY "officers manage events" ON public.events FOR UPDATE USING (is_event_manager());

DROP POLICY IF EXISTS "faculty_owner_manages_own_subjects" ON public.faculty_subjects;
CREATE POLICY "faculty_owner_manages_own_subjects" ON public.faculty_subjects FOR ALL USING ((faculty_id = auth.uid())) WITH CHECK ((faculty_id = auth.uid()));

DROP POLICY IF EXISTS "fee managers record payments" ON public.fee_payments;
CREATE POLICY "fee managers record payments" ON public.fee_payments FOR INSERT WITH CHECK (is_fee_manager());

DROP POLICY IF EXISTS "fee managers update payments" ON public.fee_payments;
CREATE POLICY "fee managers update payments" ON public.fee_payments FOR UPDATE USING (is_fee_manager());

DROP POLICY IF EXISTS "fee managers void payments" ON public.fee_payments;
CREATE POLICY "fee managers void payments" ON public.fee_payments FOR DELETE USING (is_fee_manager());

DROP POLICY IF EXISTS "members see their own fee payments" ON public.fee_payments;
CREATE POLICY "members see their own fee payments" ON public.fee_payments FOR SELECT USING (((auth.uid() = member_id) OR is_fee_viewer()));

DROP POLICY IF EXISTS "users see their own notifications" ON public.notifications;
CREATE POLICY "users see their own notifications" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "users update their own notifications" ON public.notifications;
CREATE POLICY "users update their own notifications" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "event managers delete options" ON public.poll_options;
CREATE POLICY "event managers delete options" ON public.poll_options FOR DELETE USING (is_event_manager());

DROP POLICY IF EXISTS "event managers manage options" ON public.poll_options;
CREATE POLICY "event managers manage options" ON public.poll_options FOR INSERT WITH CHECK (is_event_manager());

DROP POLICY IF EXISTS "event managers update options" ON public.poll_options;
CREATE POLICY "event managers update options" ON public.poll_options FOR UPDATE USING (is_event_manager());

DROP POLICY IF EXISTS "options readable by members" ON public.poll_options;
CREATE POLICY "options readable by members" ON public.poll_options FOR SELECT USING ((auth.role() = 'authenticated'::text));

DROP POLICY IF EXISTS "members vote once" ON public.poll_votes;
CREATE POLICY "members vote once" ON public.poll_votes FOR ALL USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "votes readable by members" ON public.poll_votes;
CREATE POLICY "votes readable by members" ON public.poll_votes FOR SELECT USING ((auth.role() = 'authenticated'::text));

DROP POLICY IF EXISTS "likes are publicly readable" ON public.post_likes;
CREATE POLICY "likes are publicly readable" ON public.post_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "likes are readable by members" ON public.post_likes;
CREATE POLICY "likes are readable by members" ON public.post_likes FOR SELECT USING ((auth.role() = 'authenticated'::text));

DROP POLICY IF EXISTS "members can like" ON public.post_likes;
CREATE POLICY "members can like" ON public.post_likes FOR INSERT WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "users can unlike" ON public.post_likes;
CREATE POLICY "users can unlike" ON public.post_likes FOR DELETE USING ((auth.uid() = user_id));

DROP POLICY IF EXISTS "authors can delete their posts" ON public.posts;
CREATE POLICY "authors can delete their posts" ON public.posts FOR DELETE USING (((auth.uid() = user_id) OR (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['staff'::text, 'superadmin'::text]))));

DROP POLICY IF EXISTS "authors can update/archive their posts" ON public.posts;
CREATE POLICY "authors can update/archive their posts" ON public.posts FOR UPDATE USING (((auth.uid() = user_id) OR (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['staff'::text, 'superadmin'::text]))));

DROP POLICY IF EXISTS "authors or staff can delete posts" ON public.posts;
CREATE POLICY "authors or staff can delete posts" ON public.posts FOR DELETE USING (((auth.uid() = user_id) OR (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['staff'::text, 'moderator'::text, 'superadmin'::text]))));

DROP POLICY IF EXISTS "authors or staff can update posts" ON public.posts;
CREATE POLICY "authors or staff can update posts" ON public.posts FOR UPDATE USING (((auth.uid() = user_id) OR (( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['staff'::text, 'moderator'::text, 'superadmin'::text]))));

DROP POLICY IF EXISTS "members can post" ON public.posts;
CREATE POLICY "members can post" ON public.posts FOR INSERT WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "posts are publicly readable" ON public.posts;
CREATE POLICY "posts are publicly readable" ON public.posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "posts are readable by members" ON public.posts;
CREATE POLICY "posts are readable by members" ON public.posts FOR SELECT USING ((auth.role() = 'authenticated'::text));

DROP POLICY IF EXISTS "console officers manage member profiles" ON public.profiles;
CREATE POLICY "console officers manage member profiles" ON public.profiles FOR UPDATE USING (is_console_officer());

DROP POLICY IF EXISTS "profiles are readable by members" ON public.profiles;
CREATE POLICY "profiles are readable by members" ON public.profiles FOR SELECT USING ((auth.role() = 'authenticated'::text));

DROP POLICY IF EXISTS "superadmin deletes member profiles" ON public.profiles;
CREATE POLICY "superadmin deletes member profiles" ON public.profiles FOR DELETE USING ((( SELECT profiles_1.role
   FROM profiles profiles_1
  WHERE (profiles_1.id = auth.uid())) = 'superadmin'::text));

DROP POLICY IF EXISTS "users can insert their own profile" ON public.profiles;
CREATE POLICY "users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));

DROP POLICY IF EXISTS "users can update their own profile" ON public.profiles;
CREATE POLICY "users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK (((auth.uid() = id) AND (role = ( SELECT profiles_1.role
   FROM profiles profiles_1
  WHERE (profiles_1.id = auth.uid())))));

DROP POLICY IF EXISTS "report_connectors_superadmin_all" ON public.report_connectors;
CREATE POLICY "report_connectors_superadmin_all" ON public.report_connectors FOR ALL USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'superadmin'::text)) WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'superadmin'::text));

DROP POLICY IF EXISTS "members can manage their rsvp" ON public.rsvps;
CREATE POLICY "members can manage their rsvp" ON public.rsvps FOR ALL USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

DROP POLICY IF EXISTS "rsvps are publicly readable" ON public.rsvps;
CREATE POLICY "rsvps are publicly readable" ON public.rsvps FOR SELECT USING (true);

DROP POLICY IF EXISTS "rsvps are readable by members" ON public.rsvps;
CREATE POLICY "rsvps are readable by members" ON public.rsvps FOR SELECT USING ((auth.role() = 'authenticated'::text));


GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;

-- ============================================
-- MIGRATION FUNCTION: relink old data to new user
-- ============================================
CREATE OR REPLACE FUNCTION public.migrate_old_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new UUID := auth.uid();
  v_new_email TEXT;
  v_old_id UUID;
  v_old_rec RECORD;
BEGIN
  IF v_new IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT email INTO v_new_email FROM public.profiles WHERE id = v_new;
  IF v_new_email IS NULL THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  SELECT id INTO v_old_id FROM public.profiles WHERE email = v_new_email AND id <> v_new LIMIT 1;
  IF v_old_id IS NULL THEN
    RAISE NOTICE 'no old profile found for %', v_new_email;
    RETURN;
  END IF;

  RAISE NOTICE 'migrating old profile % -> %', v_old_id, v_new;

  SELECT full_name, program, year_level, role, positions, avatar_url, id_no, section, surname, requested_role, clearance_locked
  INTO v_old_rec FROM public.profiles WHERE id = v_old_id;

  UPDATE public.profiles SET
    full_name = COALESCE(v_old_rec.full_name, ''),
    program = COALESCE(v_old_rec.program, program),
    year_level = COALESCE(v_old_rec.year_level, year_level),
    role = COALESCE(v_old_rec.role, role),
    positions = COALESCE(v_old_rec.positions, positions),
    avatar_url = COALESCE(v_old_rec.avatar_url, avatar_url),
    id_no = COALESCE(v_old_rec.id_no, id_no),
    section = COALESCE(v_old_rec.section, section),
    surname = COALESCE(v_old_rec.surname, surname),
    requested_role = v_old_rec.requested_role,
    clearance_locked = v_old_rec.clearance_locked
  WHERE id = v_new;

  UPDATE public.attendance SET user_id = v_new WHERE user_id = v_old_id;
  UPDATE public.rsvps SET user_id = v_new WHERE user_id = v_old_id;
  UPDATE public.post_likes SET user_id = v_new WHERE user_id = v_old_id;
  UPDATE public.chat_messages SET user_id = v_new WHERE user_id = v_old_id;
  UPDATE public.notifications SET user_id = v_new WHERE user_id = v_old_id;

  DELETE FROM public.profiles WHERE id = v_old_id;

  RAISE NOTICE 'migration complete for %', v_new_email;
END;
$function$;
