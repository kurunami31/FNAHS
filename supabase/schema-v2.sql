-- ============================================================
-- FNAHS — schema v2 (idempotent; apply over schema.sql)
--   Roles:  student | moderator | superadmin   (staff removed)
--   Positions: 15 officer positions granting permission scopes.
--   New tables: announcements, notifications, event_polls,
--               poll_options, poll_votes, chat_messages, news_cache.
--   Security: change_role()/set_positions() superadmin-gated RPCs,
--             position-aware RLS, attendance reads scoped,
--             officer updates can never touch role/positions directly.
-- Mirrors src/rbac.js — keep the two files in sync.
-- ============================================================

-- ---------- 1 · roles: drop 'staff' ----------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'moderator', 'superadmin'));

-- one-time migration of legacy staff accounts -> moderator
update public.profiles set role = 'moderator' where role = 'staff';

-- ---------- 2 · positions column ----------
alter table public.profiles add column if not exists positions text[] not null default '{}';

-- privacy notice acceptance (set by the consent gate after first login)
alter table public.profiles add column if not exists privacy_policy_accepted_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_positions_check') then
    alter table public.profiles add constraint profiles_positions_check
      check (positions <@ array[
        'governor', 'v-governor', 'pio', 'assoc-pio',
        'v-gov-internal', 'v-gov-external',
        'secretary', 'assoc-secretary',
        'treasurer', 'assoc-treasurer',
        'auditor', 'assoc-auditor',
        'business-manager', 'assoc-business-manager',
        'committees'
      ]::text[]);
  end if;
end $$;

-- ---------- 3 · position helpers (mirror rbac.js scopes) ----------
create or replace function public.is_announcer()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'superadmin' or positions && array[
        'governor', 'v-governor', 'pio', 'assoc-pio',
        'v-gov-internal', 'v-gov-external',
        'secretary', 'assoc-secretary'
      ]::text[])
  );
$$;

create or replace function public.is_door_officer()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'superadmin' or positions && array[
        'governor', 'v-governor',
        'v-gov-internal', 'v-gov-external',
        'secretary', 'assoc-secretary',
        'treasurer', 'assoc-treasurer',
        'business-manager', 'assoc-business-manager'
      ]::text[])
  );
$$;

create or replace function public.is_event_manager()
returns boolean language sql security definer set search_path = public as $$
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
$$;

create or replace function public.is_console_officer()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role = 'superadmin' or positions && array[
        'governor', 'v-governor', 'secretary', 'treasurer',
        'auditor', 'business-manager'
      ]::text[])
  );
$$;

-- ---------- 4 · role/position RPCs (superadmin only) ----------
create or replace function public.change_role(p_target uuid, p_new_role text)
returns void language plpgsql security definer set search_path = public as $$
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

  if p_new_role not in ('student', 'moderator', 'superadmin') then
    raise exception 'invalid role';
  end if;

  if v_current = 'superadmin' and p_new_role <> 'superadmin'
     and (select count(*) from public.profiles where role = 'superadmin') <= 1 then
    raise exception 'cannot demote the last superadmin';
  end if;

  update public.profiles set role = p_new_role where id = p_target;
end;
$$;

create or replace function public.set_positions(p_target uuid, p_positions text[])
returns void language plpgsql security definer set search_path = public as $$
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
$$;

-- ---------- 5 · officer updates can never touch role/positions ----------
-- (direct updates as an officer blocked; change_role/set_positions run as
--  the definer owner (postgres) and are the only sanctioned path)
create or replace function public.guard_officer_privilege_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_user <> 'postgres'
     and (old.role is distinct from new.role
          or old.positions is distinct from new.positions) then
    raise exception 'role and positions can only change through change_role()/set_positions()';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists guard_officer_privilege_columns on public.profiles;
create trigger guard_officer_privilege_columns
  before update on public.profiles
  for each row execute function public.guard_officer_privilege_columns();

-- ---------- 6 · announcements ----------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  author_id uuid references public.profiles (id) on delete set null,
  pinned boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

drop policy if exists "announcements are readable by members" on public.announcements;
create policy "announcements are readable by members"
  on public.announcements for select
  using (auth.role() = 'authenticated' and archived_at is null);

drop policy if exists "announcers post announcements" on public.announcements;
create policy "announcers post announcements"
  on public.announcements for insert
  with check (public.is_announcer() and author_id = auth.uid());

drop policy if exists "announcers manage announcements" on public.announcements;
create policy "announcers manage announcements"
  on public.announcements for update
  using (author_id = auth.uid() or public.is_announcer());

drop policy if exists "announcers delete announcements" on public.announcements;
create policy "announcers delete announcements"
  on public.announcements for delete
  using (author_id = auth.uid() or public.is_announcer());

-- ---------- 7 · notifications ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'system'
    check (kind in ('announcement', 'event', 'poll', 'attendance', 'mention', 'system')),
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists "users see their own notifications" on public.notifications;
create policy "users see their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "users update their own notifications" on public.notifications;
create policy "users update their own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- service-role insert path (edge functions + triggers)
create or replace function public.create_notification(
  p_user_id uuid, p_kind text, p_title text, p_body text default '', p_link text default null
) returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, link)
  values (p_user_id, p_kind, p_title, p_body, p_link);
$$;

-- fan-out to members when an officer posts an announcement
create or replace function public.notify_announcement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, title, body, link)
  select id, 'announcement', new.title, '', '/app/feed#announcements'
  from public.profiles;
  return new;
end;
$$;

drop trigger if exists notify_announcement on public.announcements;
create trigger notify_announcement
  after insert on public.announcements
  for each row execute function public.notify_announcement();

-- ---------- 8 · event polls ----------
create table if not exists public.event_polls (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  question text not null,
  created_by uuid references public.profiles (id) on delete set null,
  closes_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.event_polls (id) on delete cascade,
  label text not null
);

create table if not exists public.poll_votes (
  poll_id uuid not null references public.event_polls (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

alter table public.event_polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

drop policy if exists "polls readable by members" on public.event_polls;
create policy "polls readable by members"
  on public.event_polls for select using (auth.role() = 'authenticated');
drop policy if exists "event managers create polls" on public.event_polls;
create policy "event managers create polls"
  on public.event_polls for insert
  with check (public.is_event_manager() and created_by = auth.uid());
drop policy if exists "event managers update polls" on public.event_polls;
create policy "event managers update polls"
  on public.event_polls for update using (public.is_event_manager());
drop policy if exists "event managers delete polls" on public.event_polls;
create policy "event managers delete polls"
  on public.event_polls for delete using (public.is_event_manager());

drop policy if exists "options readable by members" on public.poll_options;
create policy "options readable by members"
  on public.poll_options for select using (auth.role() = 'authenticated');
drop policy if exists "event managers manage options" on public.poll_options;
create policy "event managers manage options"
  on public.poll_options for insert with check (public.is_event_manager());
drop policy if exists "event managers update options" on public.poll_options;
create policy "event managers update options"
  on public.poll_options for update using (public.is_event_manager());
drop policy if exists "event managers delete options" on public.poll_options;
create policy "event managers delete options"
  on public.poll_options for delete using (public.is_event_manager());

drop policy if exists "votes readable by members" on public.poll_votes;
create policy "votes readable by members"
  on public.poll_votes for select using (auth.role() = 'authenticated');
drop policy if exists "members vote once" on public.poll_votes;
create policy "members vote once"
  on public.poll_votes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- 9 · Florence chat history ----------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

drop policy if exists "users read their chat history" on public.chat_messages;
create policy "users read their chat history"
  on public.chat_messages for select using (auth.uid() = user_id);

drop policy if exists "users write their chat history" on public.chat_messages;
create policy "users write their chat history"
  on public.chat_messages for insert with check (auth.uid() = user_id);

-- ---------- 10 · news cache for the health-topics proxy ----------
create table if not exists public.news_cache (
  key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.news_cache enable row level security;
-- no policies -> locked down; the edge function writes via service role.

-- ---------- 11 · RLS updates: attendance + events + profiles ----------
drop policy if exists "attendance is readable by members" on public.attendance;
drop policy if exists "attendance visible to its owner or door officers" on public.attendance;
create policy "attendance visible to its owner or door officers"
  on public.attendance for select
  using (auth.uid() = user_id or public.is_door_officer());

drop policy if exists "staff can record attendance" on public.attendance;
drop policy if exists "staff can update attendance" on public.attendance;
drop policy if exists "staff can delete attendance" on public.attendance;
drop policy if exists "door officers record attendance" on public.attendance;
drop policy if exists "door officers update attendance" on public.attendance;
drop policy if exists "door officers delete attendance" on public.attendance;
create policy "door officers record attendance"
  on public.attendance for insert
  with check (public.is_door_officer());
create policy "door officers update attendance"
  on public.attendance for update using (public.is_door_officer());
create policy "door officers delete attendance"
  on public.attendance for delete using (public.is_door_officer());

drop policy if exists "staff can create events" on public.events;
drop policy if exists "members can create events" on public.events;
drop policy if exists "officers create events" on public.events;
create policy "officers create events"
  on public.events for insert
  with check (public.is_event_manager() and auth.uid() = created_by);

drop policy if exists "staff can manage events" on public.events;
drop policy if exists "officers manage events" on public.events;
create policy "officers manage events"
  on public.events for update using (public.is_event_manager());

drop policy if exists "staff can delete events" on public.events;
drop policy if exists "officers delete events" on public.events;
create policy "officers delete events"
  on public.events for delete using (public.is_event_manager());

-- officer profile edits: role/positions are untouchable (guard trigger),
-- so officers may manage everything else about member profiles
drop policy if exists "staff can manage member profiles" on public.profiles;
drop policy if exists "console officers manage member profiles" on public.profiles;
create policy "console officers manage member profiles"
  on public.profiles for update
  using (public.is_console_officer());

-- only superadmin deletes accounts
drop policy if exists "staff can delete member profiles" on public.profiles;
drop policy if exists "superadmin deletes member profiles" on public.profiles;
create policy "superadmin deletes member profiles"
  on public.profiles for delete
  using ((select role from public.profiles where id = auth.uid()) = 'superadmin');

-- ---------- 12 · directory includes positions ----------
drop function if exists public.get_directory();
create or replace function public.get_directory()
returns table (id uuid, full_name text, program text, year_level text, role text, positions text[], avatar_url text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select id, full_name, program, year_level, role, positions, avatar_url, created_at
  from public.profiles
  where role is distinct from 'superadmin'
  order by full_name;
$$;

-- ---------- 13 · grants ----------
grant select (id, full_name, program, year_level, role, positions, avatar_url, created_at) on public.profiles to authenticated;
grant update (id, full_name, program, year_level, role, positions, avatar_url, privacy_policy_accepted_at) on public.profiles to authenticated;

grant select, insert, update, delete on public.announcements to authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert, update, delete on public.event_polls to authenticated;
grant select, insert, update, delete on public.poll_options to authenticated;
grant select, insert, update, delete on public.poll_votes to authenticated;
grant select, insert on public.chat_messages to authenticated;

grant execute on function public.change_role(uuid, text) to authenticated;
grant execute on function public.set_positions(uuid, text[]) to authenticated;
grant execute on function public.get_directory() to authenticated;

-- ---------- 14 · realtime ----------
do $$
declare
  t text;
begin
  foreach t in array array['public.posts','public.comments','public.attendance','public.notifications','public.announcements','public.event_polls','public.poll_options','public.poll_votes','public.chat_messages'] loop
    begin
      execute format('alter publication supabase_realtime add table %s', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;