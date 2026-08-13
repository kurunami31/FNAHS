-- ============================================================
-- FNAHS — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor).
-- Tables: profiles, posts, comments, post_likes, events, rsvps, attendance
-- ============================================================

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  program text,
  year_level text,
  role text not null default 'student' check (role in ('student', 'staff', 'superadmin')),
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by members"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

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

-- ---------- posts ----------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  image_url text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;

create policy "posts are publicly readable"
  on public.posts for select
  using (true);

create policy "members can post"
  on public.posts for insert
  with check (auth.uid() = user_id);

create policy "authors can update/archive their posts"
  on public.posts for update
  using (auth.uid() = user_id or (select role from public.profiles where id = auth.uid()) in ('staff', 'superadmin'));

create policy "authors can delete their posts"
  on public.posts for delete
  using (auth.uid() = user_id or (select role from public.profiles where id = auth.uid()) in ('staff', 'superadmin'));

-- ---------- comments ----------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

create policy "comments are publicly readable"
  on public.comments for select
  using (true);

create policy "members can comment"
  on public.comments for insert
  with check (auth.uid() = user_id);

create policy "authors can delete their comments"
  on public.comments for delete
  using (auth.uid() = user_id);

-- ---------- post_likes ----------
create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;

create policy "likes are publicly readable"
  on public.post_likes for select
  using (true);

create policy "members can like"
  on public.post_likes for insert
  with check (auth.uid() = user_id);

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

create policy "events are publicly readable"
  on public.events for select
  using (true);

create policy "members can create events"
  on public.events for insert
  with check (auth.uid() = created_by);

create policy "staff can manage events"
  on public.events for update
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

create policy "rsvps are publicly readable"
  on public.rsvps for select
  using (true);

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

create policy "attendance is readable by members"
  on public.attendance for select
  using (auth.role() = 'authenticated');

create policy "staff can record attendance"
  on public.attendance for insert
  with check ((select role from public.profiles where id = auth.uid()) in ('staff', 'superadmin'));

create policy "staff can update attendance"
  on public.attendance for update
  using ((select role from public.profiles where id = auth.uid()) in ('staff', 'superadmin'));

-- ---------- helpers: promote a user to staff ----------
-- Run once for your first staff account:
--   update public.profiles set role = 'staff' where id = '<their auth user id>';
