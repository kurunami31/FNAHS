-- ============================================================
-- Moderators gain door-duty powers (admin/mod can remove, and
-- record, attendance) — parity with the legacy 'staff' role.
-- is_door_officer() gates insert/update/delete on attendance,
-- so extending the helper covers removal automatically.
-- ============================================================

create or replace function public.is_door_officer()
returns boolean language sql security definer set search_path = public as $$
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
$$;