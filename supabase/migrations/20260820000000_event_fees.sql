-- ============================================================
-- Event contributions: events carry an optional fee amount and
-- each attendee's payment is tracked per event.
-- Mirrors rbac.js 'events.manage' scope: officers who create and
-- manage events (governor, v-governor, pio, v-gov-internal,
-- v-gov-external, secretary, assoc-secretary, treasurer,
-- business-manager, plus moderator/superadmin roles) record,
-- edit, and void event payments; members see their own.
-- ============================================================

alter table public.events add column if not exists fee_amount numeric(8, 2) not null default 0 check (fee_amount >= 0);

create table if not exists public.event_payments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(8, 2) not null check (amount >= 0),
  paid_at timestamptz not null default now(),
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (event_id, member_id)
);

create index if not exists event_payments_event_idx on public.event_payments (event_id);
create index if not exists event_payments_member_idx on public.event_payments (member_id);

alter table public.event_payments enable row level security;

create or replace function public.is_event_fee_manager()
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (role in ('moderator', 'superadmin') or positions && array[
        'governor', 'v-governor', 'pio', 'v-gov-internal',
        'v-gov-external', 'secretary', 'assoc-secretary',
        'treasurer', 'business-manager'
      ]::text[])
  );
$$;

drop policy if exists "members see their own event payments" on public.event_payments;
create policy "members see their own event payments"
  on public.event_payments for select
  using (auth.uid() = member_id or public.is_event_fee_manager());

drop policy if exists "event managers record payments" on public.event_payments;
create policy "event managers record payments"
  on public.event_payments for insert
  with check (public.is_event_fee_manager());

drop policy if exists "event managers update payments" on public.event_payments;
create policy "event managers update payments"
  on public.event_payments for update
  using (public.is_event_fee_manager());

drop policy if exists "event managers void payments" on public.event_payments;
create policy "event managers void payments"
  on public.event_payments for delete
  using (public.is_event_fee_manager());

grant select, insert, update, delete on public.event_payments to authenticated;