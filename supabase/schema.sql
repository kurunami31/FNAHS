-- ============================================================
-- FNAHS — Supabase schema (hardened)
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor).
-- Tables: profiles, posts, comments, post_likes, events, rsvps, attendance, rate_limits
--
-- Security model:
--   · RLS is enabled on every table and anon has NO access anywhere.
--   · Emails are readable only through the admin_get_users() RPC (staff+ only).
--   · Members can never change their own role (server-side guard).
--   · The last superadmin can never be demoted or deleted.
--   · Directory data goes through the security-definer get_directory() RPC.
--   · Florence chat is rate-limited through bump_rate().
-- ============================================================

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  program text,
  year_level text,
  role text not null default 'student' check (role in ('student', 'staff', 'moderator', 'superadmin')),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- idempotent role constraint (covers databases created before 'moderator')
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'staff', 'moderator', 'superadmin'));

alter table public.profiles enable row level security;

drop policy if exists "profiles are readable by members" on public.profiles;
create policy "profiles are readable by members"
  on public.profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "users can insert their own profile" on public.profiles;
create policy "users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

drop policy if exists "staff can manage member profiles" on public.profiles;
create policy "staff can manage member profiles"
  on public.profiles for update
  using ((select role from public.profiles where id = auth.uid()) in ('staff', 'moderator', 'superadmin'));

drop policy if exists "staff can delete member profiles" on public.profiles;
create policy "staff can delete member profiles"
  on public.profiles for delete
  using ((select role from public.profiles where id = auth.uid()) in ('staff', 'superadmin'));

-- auto-create a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- never allow the last superadmin to be demoted or removed
create or replace function public.prevent_last_superadmin_demotion()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.role = 'superadmin' and (tg_op <> 'UPDATE' or new.role <> 'superadmin') then
    if (select count(*) from public.profiles where role = 'superadmin') = 1 then
      raise exception 'cannot demote or remove the last superadmin';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists guard_last_superadmin on public.profiles;
create trigger guard_last_superadmin
  before update or delete on public.profiles
  for each row execute function public.prevent_last_superadmin_demotion();

-- ---------- posts ----------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  content text not null,
  image_url text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

-- idempotent defaults for databases created before auth.uid() defaults
alter table public.posts alter column user_id set default auth.uid();

alter table public.posts enable row level security;

drop policy if exists "posts are readable by members" on public.posts;
create policy "posts are readable by members"
  on public.posts for select
  using (auth.role() = 'authenticated');

drop policy if exists "members can post" on public.posts;
create policy "members can post"
  on public.posts for insert
  with check (auth.uid() = user_id);

drop policy if exists "authors or staff can update posts" on public.posts;
create policy "authors or staff can update posts"
  on public.posts for update
  using (
    auth.uid() = user_id
    or (select role from public.profiles where id = auth.uid()) in ('staff', 'moderator', 'superadmin')
  );

drop policy if exists "authors or staff can delete posts" on public.posts;
create policy "authors or staff can delete posts"
  on public.posts for delete
  using (
    auth.uid() = user_id
    or (select role from public.profiles where id = auth.uid()) in ('staff', 'moderator', 'superadmin')
  );

-- ---------- comments ----------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  content text not null,
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.comments alter column user_id set default auth.uid();

alter table public.comments enable row level security;

drop policy if exists "comments are readable by members" on public.comments;
create policy "comments are readable by members"
  on public.comments for select
  using (auth.role() = 'authenticated');

drop policy if exists "members can comment" on public.comments;
create policy "members can comment"
  on public.comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "authors or staff can delete comments" on public.comments;
create policy "authors or staff can delete comments"
  on public.comments for delete
  using (
    auth.uid() = user_id
    or (select role from public.profiles where id = auth.uid()) in ('staff', 'moderator', 'superadmin')
  );

drop policy if exists "authors or staff can update comments" on public.comments;
create policy "authors or staff can update comments"
  on public.comments for update
  using (
    auth.uid() = user_id
    or (select role from public.profiles where id = auth.uid()) in ('staff', 'moderator', 'superadmin')
  );

-- ---------- post_likes ----------
create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;

drop policy if exists "likes are readable by members" on public.post_likes;
create policy "likes are readable by members"
  on public.post_likes for select
  using (auth.role() = 'authenticated');

drop policy if exists "members can like" on public.post_likes;
create policy "members can like"
  on public.post_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can unlike" on public.post_likes;
create policy "users can unlike"
  on public.post_likes for delete
  using (auth.uid() = user_id);

-- ---------- events ----------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  location text default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

drop policy if exists "events are readable by members" on public.events;
create policy "events are readable by members"
  on public.events for select
  using (auth.role() = 'authenticated');

-- legacy policy from pre-hardening runs — anon must never read events
drop policy if exists "events are publicly readable" on public.events;

drop policy if exists "members can create events" on public.events;
drop policy if exists "staff can create events" on public.events;
create policy "staff can create events"
  on public.events for insert
  with check ((select role from public.profiles where id = auth.uid()) in ('staff', 'moderator', 'superadmin'));

drop policy if exists "staff can manage events" on public.events;
create policy "staff can manage events"
  on public.events for update
  using ((select role from public.profiles where id = auth.uid()) in ('staff', 'superadmin'));

drop policy if exists "staff can delete events" on public.events;
create policy "staff can delete events"
  on public.events for delete
  using ((select role from public.profiles where id = auth.uid()) in ('staff', 'superadmin'));

-- ---------- rsvps ----------
create table if not exists public.rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'going' check (status in ('going', 'maybe')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.rsvps enable row level security;

drop policy if exists "rsvps are readable by members" on public.rsvps;
create policy "rsvps are readable by members"
  on public.rsvps for select
  using (auth.role() = 'authenticated');

drop policy if exists "members can manage their rsvp" on public.rsvps;
create policy "members can manage their rsvp"
  on public.rsvps for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- attendance ----------
create table if not exists public.attendance (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  scanned_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.attendance enable row level security;

drop policy if exists "attendance is readable by members" on public.attendance;
create policy "attendance is readable by members"
  on public.attendance for select
  using (auth.role() = 'authenticated');

drop policy if exists "staff can record attendance" on public.attendance;
create policy "staff can record attendance"
  on public.attendance for insert
  with check ((select role from public.profiles where id = auth.uid()) in ('staff', 'superadmin'));

drop policy if exists "staff can update attendance" on public.attendance;
create policy "staff can update attendance"
  on public.attendance for update
  using ((select role from public.profiles where id = auth.uid()) in ('staff', 'superadmin'));

drop policy if exists "staff can delete attendance" on public.attendance;
create policy "staff can delete attendance"
  on public.attendance for delete
  using ((select role from public.profiles where id = auth.uid()) in ('staff', 'superadmin'));

-- ---------- rate limits (Florence chat) ----------
create table if not exists public.rate_limits (
  bucket text not null,
  window_at timestamptz not null,
  calls int not null default 0,
  primary key (bucket, window_at)
);

alter table public.rate_limits enable row level security;

create or replace function public.bump_rate(p_bucket text, p_max int default 20, p_window_minutes int default 1)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- ---------- directory RPC (no emails, no RLS gaps) ----------
create or replace function public.get_directory()
returns table (id uuid, full_name text, program text, year_level text, role text, avatar_url text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select id, full_name, program, year_level, role, avatar_url, created_at
  from public.profiles
  where role is distinct from 'superadmin'
  order by full_name;
$$;

-- ---------- admin RPC (staff+ only; includes emails) ----------
create or replace function public.admin_get_users()
returns setof public.profiles
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('staff', 'moderator', 'superadmin')
  ) then
    raise exception 'insufficient privileges';
  end if;
  return query select * from public.profiles order by full_name;
end;
$$;

-- ============================================================
-- GRANTS — the anon role is locked out entirely.
-- Authenticated gets exactly the columns/commands it needs.
-- ============================================================

revoke all on table public.profiles, public.posts, public.comments, public.post_likes,
  public.events, public.rsvps, public.attendance, public.rate_limits from anon;

revoke all on table public.profiles, public.posts, public.comments, public.post_likes,
  public.events, public.rsvps, public.attendance, public.rate_limits from authenticated;

revoke all on all functions in schema public from public;

grant usage on schema public to authenticated;

-- profiles: safe columns only — email stays behind admin_get_users()
grant select (id, full_name, program, year_level, role, avatar_url, created_at) on public.profiles to authenticated;
grant insert (id, full_name, program, year_level, role, avatar_url) on public.profiles to authenticated;
grant update (id, full_name, program, year_level, role, avatar_url) on public.profiles to authenticated;
grant delete on public.profiles to authenticated;

-- content tables (RLS policies decide who may write)
grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, update, delete on public.comments to authenticated;
grant select, insert, delete on public.post_likes to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.rsvps to authenticated;
grant select, insert, update, delete on public.attendance to authenticated;

-- RPCs: directory + admin are reachable by authenticated; bump_rate is service-role only
grant execute on function public.get_directory() to authenticated;
grant execute on function public.admin_get_users() to authenticated;
grant execute on function public.bump_rate(text, int, int) to service_role;

-- ============================================================
-- First staff/superadmin account:
--   Run in the SQL editor (as postgres, bypasses RLS):
--   update public.profiles set role = 'superadmin'
--   where id = (select id from auth.users where email = '<their email>');
-- ============================================================
