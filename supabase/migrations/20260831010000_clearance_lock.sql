-- ============================================================
-- clearance lock flag
--
-- profiles.clearance_locked — when true, the account is treated
-- as NOT a clearance officer even if its role is faculty or
-- superadmin (used to keep specific admin accounts out of the
-- rotational clearance workflow; only CIs may then edit/delete).
-- Mirrors src/rbac.js (can('clearance.scan')) and the demo store.
-- ============================================================

alter table public.profiles
  add column if not exists clearance_locked boolean not null default false;

create or replace function public.is_clearance_officer()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('faculty', 'superadmin')
      and not coalesce(clearance_locked, false)
  );
$$;

update public.profiles
  set clearance_locked = true
  where email = 'fnahsadmin@dorsu.edu.ph';