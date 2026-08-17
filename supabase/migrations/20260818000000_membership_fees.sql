-- ============================================================
-- Membership fees ledger: one row per member per school year,
-- with semester 1 and semester 2 tracked independently.
-- Mirrors rbac.js 'fees.view' / 'fees.manage' scopes.
-- ============================================================

create table if not exists public.membership_fees (
  member_id uuid not null references public.profiles(id) on delete cascade,
  school_year text not null check (school_year ~ '^\d{4}-\d{4}$'),
  sem1_amount numeric(8, 2) not null default 0,
  sem1_paid_at timestamptz,
  sem1_receipt text,
  sem2_amount numeric(8, 2) not null default 0,
  sem2_paid_at timestamptz,
  sem2_receipt text,
  recorded_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (member_id, school_year)
);

alter table public.membership_fees enable row level security;

-- fee viewers: superadmin/moderator roles + officer positions
-- (mirrors rbac.js 'fees.view')
create or replace function public.is_fee_viewer()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role in ('moderator', 'superadmin') or positions && array[
        'governor', 'v-governor', 'secretary', 'treasurer',
        'assoc-treasurer', 'auditor', 'business-manager'
      ]::text[])
  );
$$;

-- fee managers: finance positions + moderators/superadmin
-- (mirrors rbac.js 'fees.manage')
create or replace function public.is_fee_manager()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role in ('moderator', 'superadmin') or positions && array[
        'treasurer', 'assoc-treasurer', 'auditor', 'business-manager'
      ]::text[])
  );
$$;

-- members can always see their own row; fee viewers see the whole ledger
drop policy if exists "members see their own fee row" on public.membership_fees;
create policy "members see their own fee row"
  on public.membership_fees for select
  using (auth.uid() = member_id or public.is_fee_viewer());

drop policy if exists "fee managers record payments" on public.membership_fees;
create policy "fee managers record payments"
  on public.membership_fees for insert
  with check (public.is_fee_manager());

drop policy if exists "fee managers update payments" on public.membership_fees;
create policy "fee managers update payments"
  on public.membership_fees for update
  using (public.is_fee_manager());