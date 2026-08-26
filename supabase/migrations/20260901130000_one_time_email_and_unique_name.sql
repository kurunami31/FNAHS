-- ============================================================
-- account integrity: one-time email change + one account per name
--
-- 1. Email changes are allowed exactly once per account. A counter on
--    profiles is bumped by the auth.users trigger whenever the email
--    actually changes (i.e. after the confirmation link is clicked);
--    a second change is blocked. Requesting a change without
--    confirming never consumes the allowance.
-- 2. Signups/admin-created members whose full name matches an existing
--    account (case/spacing-insensitive) are rejected — one account
--    per person. Existing duplicates are grandfathered.
-- ============================================================

alter table public.profiles
  add column if not exists email_changed_count integer not null default 0;

alter table public.profiles
  add column if not exists email_changed_at timestamptz;

-- fires on every auth.users update (logins touch last_sign_in_at) and
-- only acts when the email itself actually changed
create or replace function public.guard_email_change_once()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_changes integer;
begin
  if tg_op = 'UPDATE' and new.email is distinct from old.email then
    select coalesce(email_changed_count, 0) into v_changes
    from public.profiles where id = new.id;

    if v_changes is null then
      raise exception 'Profile missing for email change';
    end if;
    if v_changes >= 1 then
      raise exception 'Email can only be changed once';
    end if;

    update public.profiles
    set email_changed_count = v_changes + 1,
        email_changed_at = now()
    where id = new.id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists guard_email_change_once on auth.users;
create trigger guard_email_change_once
  before update on auth.users
  for each row execute function public.guard_email_change_once();

-- normalize names for comparison: trim, lowercase, collapse spaces
create or replace function public.norm_person_name(t text)
returns text
language sql
immutable
as $$
  select lower(btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')))
$$;

create or replace function public.block_duplicate_member_name()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if exists (
    select 1 from public.profiles p
    where public.norm_person_name(p.full_name) = public.norm_person_name(new.full_name)
      and p.id <> new.id
  ) then
    raise exception 'An account with this name already exists — one account per member';
  end if;
  return new;
end;
$$;

drop trigger if exists block_duplicate_member_name on public.profiles;
create trigger block_duplicate_member_name
  before insert on public.profiles
  for each row execute function public.block_duplicate_member_name();