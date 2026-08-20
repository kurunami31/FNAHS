-- ============================================================
-- class attendance for faculty
--
-- Faculty members keep a list of the subject(s) they teach, open
-- a session for each class meeting, then scan student IDs with
-- the same QR flow used for events. Students may read only their
-- own rows (get_my_class_attendance()).
-- ============================================================

create table public.faculty_subjects (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.faculty_subjects(id) on delete cascade,
  faculty_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.class_attendance (
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

alter table public.faculty_subjects enable row level security;
alter table public.class_sessions enable row level security;
alter table public.class_attendance enable row level security;

create policy "faculty_owner_manages_own_subjects"
  on public.faculty_subjects for all
  using (faculty_id = auth.uid())
  with check (faculty_id = auth.uid());

create policy "admins_read_subjects"
  on public.faculty_subjects for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('superadmin', 'moderator')));

create policy "faculty_owner_manages_own_sessions"
  on public.class_sessions for all
  using (faculty_id = auth.uid())
  with check (faculty_id = auth.uid());

create policy "admins_read_sessions"
  on public.class_sessions for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('superadmin', 'moderator')));

create policy "session_owner_records_attendance"
  on public.class_attendance for insert
  with check (exists (
    select 1 from public.class_sessions s
    where s.id = session_id and s.faculty_id = auth.uid()
  ));

-- upserts (re-scan of the same student) also update the scanned_at stamp.
create policy "session_owner_updates_attendance"
  on public.class_attendance for update
  using (exists (
    select 1 from public.class_sessions s
    where s.id = session_id and s.faculty_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.class_sessions s
    where s.id = session_id and s.faculty_id = auth.uid()
  ));

create policy "session_owner_deletes_attendance"
  on public.class_attendance for delete
  using (exists (
    select 1 from public.class_sessions s
    where s.id = session_id and s.faculty_id = auth.uid()
  ));

create policy "attendance_read_owner_or_admins_or_self"
  on public.class_attendance for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.class_sessions s
      where s.id = session_id and s.faculty_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles where id = auth.uid() and role in ('superadmin', 'moderator')
    )
  );

grant select, insert, update, delete on public.faculty_subjects to authenticated;
grant select, insert, update, delete on public.class_sessions to authenticated;
grant select, insert, update, delete on public.class_attendance to authenticated;

-- Students can always see their own class attendance (subject, date,
-- time) without exposing the session or other students' rows.
create or replace function public.get_my_class_attendance()
returns table (session_id uuid, subject_id uuid, subject_name text, started_at timestamptz, scanned_at timestamptz)
language sql security definer set search_path = public as $$
  select ca.session_id, s.subject_id, fs.name, s.started_at, ca.scanned_at
  from public.class_attendance ca
  join public.class_sessions s on s.id = ca.session_id
  join public.faculty_subjects fs on fs.id = s.subject_id
  where ca.user_id = auth.uid()
  order by ca.scanned_at desc;
$$;

grant execute on function public.get_my_class_attendance() to authenticated;