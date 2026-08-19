-- ============================================================
-- Rotational clearance
--
-- A private per-student clearance record kept only between the
-- student and Clinical Instructors (Faculty). A CI scans the
-- student's ID QR to open their clearance form, adds duty rows,
-- and later clears/signs individual rows. Only faculty and
-- superadmin may touch other students' records; students see
-- their own form read-only.
--
--   · clearance_forms  — one form per student per year+semester
--                        (PLACEMENT set once at creation)
--   · clearance_rows   — the 10-column table (one duty row each)
--   · is_clearance_officer() — faculty + superadmin ONLY
--                        (excludes moderators and officers)
--   · UPDATE/DELETE scoped to the clearing CI (or superadmin)
--   · get_clearance_forms() RPC joins recorder names
--   · notify_clearance trigger pings the student
-- Mirrors src/rbac.js 'clearance.scan' scope.
-- ============================================================

-- notifications gain a 'clearance' kind (deep link to My ID)
do $$
declare v_name text;
begin
  select c.conname into v_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
  where t.relname = 'notifications' and c.contype = 'c' and a.attname = 'kind';
  if v_name is not null then
    execute format('alter table public.notifications drop constraint %I', v_name);
  end if;
end $$;

alter table public.notifications add constraint notifications_kind_check
  check (kind in ('announcement', 'event', 'poll', 'attendance', 'mention', 'system', 'clearance'));

-- clearance officer: faculty (CIs) + superadmin only — no moderators/officers
create or replace function public.is_clearance_officer()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('faculty', 'superadmin')
  );
$$;

-- one form per student per school year + semester; placement set once
create table if not exists public.clearance_forms (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  school_year text not null check (school_year ~ '^\d{4}-\d{4}$'),
  semester text not null check (semester in ('1st', '2nd', 'Summer')),
  placement text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (member_id, school_year, semester)
);

-- the 10-column table: one row per duty assignment
create table if not exists public.clearance_rows (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.clearance_forms(id) on delete cascade,
  dates text not null,
  concept text not null,
  hours numeric not null check (hours >= 0),
  cleared_at timestamptz,
  recorded_by uuid references public.profiles(id),
  remark text check (remark in ('absent', 'late', 'ir')),
  demerit int check (demerit in (1, 2, 3)),
  days_extension int check (days_extension in (1, 2, 3)),
  merit int not null default 0 check (merit >= 0),
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists clearance_forms_member_idx on public.clearance_forms (member_id, school_year, semester);
create index if not exists clearance_rows_form_idx on public.clearance_rows (form_id);

alter table public.clearance_forms enable row level security;
alter table public.clearance_rows enable row level security;

-- ---- clearance_forms RLS ----
drop policy if exists "clearance forms - own or officer" on public.clearance_forms;
create policy "clearance forms - own or officer"
  on public.clearance_forms for select
  using (auth.uid() = member_id or public.is_clearance_officer());

drop policy if exists "clearance officers create forms" on public.clearance_forms;
create policy "clearance officers create forms"
  on public.clearance_forms for insert
  with check (public.is_clearance_officer() and created_by = auth.uid());

drop policy if exists "clearance officers update forms" on public.clearance_forms;
create policy "clearance officers update forms"
  on public.clearance_forms for update
  using (public.is_clearance_officer());

drop policy if exists "clearance officers delete forms" on public.clearance_forms;
create policy "clearance officers delete forms"
  on public.clearance_forms for delete
  using (public.is_clearance_officer());

-- ---- clearance_rows RLS ----
-- members read their own rows; officers read everything
drop policy if exists "clearance rows - own or officer" on public.clearance_rows;
create policy "clearance rows - own or officer"
  on public.clearance_rows for select
  using (
    public.is_clearance_officer() or exists (
      select 1 from public.clearance_forms f
      where f.id = form_id and f.member_id = auth.uid()
    )
  );

drop policy if exists "clearance officers create rows" on public.clearance_rows;
create policy "clearance officers create rows"
  on public.clearance_rows for insert
  with check (public.is_clearance_officer() and created_by = auth.uid());

-- any officer may fill/clear a pending row; once cleared, only the CI who
-- signed it (recorded_by) or a superadmin may edit or void it
drop policy if exists "clearing CI or superadmin update rows" on public.clearance_rows;
create policy "clearing CI or superadmin update rows"
  on public.clearance_rows for update
  using (
    public.is_clearance_officer() and (
      (select role from public.profiles where id = auth.uid()) = 'superadmin'
      or recorded_by = auth.uid()
      or recorded_by is null
    )
  );

drop policy if exists "clearing CI or superadmin delete rows" on public.clearance_rows;
create policy "clearing CI or superadmin delete rows"
  on public.clearance_rows for delete
  using (
    public.is_clearance_officer() and (
      (select role from public.profiles where id = auth.uid()) = 'superadmin'
      or recorded_by = auth.uid()
      or recorded_by is null
    )
  );

grant select, insert, update, delete on public.clearance_forms to authenticated;
grant select, insert, update, delete on public.clearance_rows to authenticated;

-- rows as json with recorder names (used by get_clearance_forms)
create or replace function public.clearance_rows_json(p_form_id uuid)
returns jsonb language sql security definer set search_path = public as $$
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
$$;

-- full clearance history for one student (officer or the student themself)
create or replace function public.get_clearance_forms(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_out jsonb;
begin
  if not coalesce(public.is_clearance_officer() or auth.uid() = p_student_id, false) then
    raise exception 'insufficient privileges';
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
$$;

grant execute on function public.get_clearance_forms(uuid) to authenticated;

-- ping the student when a row is added or a pending row is signed
create or replace function public.notify_clearance()
returns trigger language plpgsql security definer set search_path = public as $$
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
$$;

drop trigger if exists notify_clearance on public.clearance_rows;
create trigger notify_clearance
  after insert or update on public.clearance_rows
  for each row execute function public.notify_clearance();