-- ============================================================
-- Membership fee rework: annual fee amount + payment records.
-- Replaces the old sem1/sem2 membership_fees table (dev-only data).
-- Each payment is FULL (100%) or HALF (50%) of the annual fee,
-- with an OR/receipt reference. A member is PAID once the sum of
-- their payments reaches the annual fee; PARTIAL otherwise.
-- ============================================================

-- dev-only data — drop the old model
drop table if exists public.membership_fees;

-- annual membership fee amount, set by fee managers
alter table public.app_settings add column if not exists membership_fee_amount numeric(8, 2) not null default 200;

create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  school_year text not null check (school_year ~ '^\d{4}-\d{4}$'),
  payment_type text not null check (payment_type in ('full', 'half')),
  amount numeric(8, 2) not null check (amount >= 0),
  receipt text,
  paid_at timestamptz not null default now(),
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists fee_payments_member_idx on public.fee_payments (member_id, school_year);

alter table public.fee_payments enable row level security;

-- members see their own payments; fee viewers see the whole ledger
drop policy if exists "members see their own fee payments" on public.fee_payments;
create policy "members see their own fee payments"
  on public.fee_payments for select
  using (auth.uid() = member_id or public.is_fee_viewer());

drop policy if exists "fee managers record payments" on public.fee_payments;
create policy "fee managers record payments"
  on public.fee_payments for insert
  with check (public.is_fee_manager());

drop policy if exists "fee managers update payments" on public.fee_payments;
create policy "fee managers update payments"
  on public.fee_payments for update
  using (public.is_fee_manager());

drop policy if exists "fee managers void payments" on public.fee_payments;
create policy "fee managers void payments"
  on public.fee_payments for delete
  using (public.is_fee_manager());

grant select, insert, update, delete on public.fee_payments to authenticated;

-- annual fee amount, readable by everyone, changeable by fee managers
create or replace function public.get_membership_fee_amount()
returns numeric(8, 2) language sql security definer set search_path = public as $$
  select coalesce((select membership_fee_amount from public.app_settings where id = 1), 200);
$$;

grant execute on function public.get_membership_fee_amount() to authenticated;

create or replace function public.set_membership_fee_amount(p_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
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
$$;

grant execute on function public.set_membership_fee_amount(numeric) to authenticated;