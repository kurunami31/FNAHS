-- ---------- 14 · maintenance mode ----------
-- Single-row settings table. The flag is read by everyone (via the
-- security-definer get_maintenance_mode() RPC — including logged-out
-- visitors, so the whole app can show the maintenance screen) and can only
-- be flipped by console officers through set_maintenance_mode().
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  maintenance_mode boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.app_settings (id, maintenance_mode)
values (1, true)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "settings readable by members" on public.app_settings;
create policy "settings readable by members"
  on public.app_settings for select
  using (auth.role() = 'authenticated');
-- no insert/update/delete policies — the flag only changes via the RPC below

create or replace function public.get_maintenance_mode()
returns boolean language sql security definer set search_path = public as $$
  select coalesce((select maintenance_mode from public.app_settings where id = 1), false);
$$;

create or replace function public.set_maintenance_mode(p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_console_officer() then
    raise exception 'insufficient privileges';
  end if;
  update public.app_settings
  set maintenance_mode = coalesce(p_on, false), updated_at = now(), updated_by = auth.uid()
  where id = 1;
  if not found then
    insert into public.app_settings (id, maintenance_mode, updated_by)
    values (1, coalesce(p_on, false), auth.uid());
  end if;
end;
$$;

grant execute on function public.get_maintenance_mode() to anon, authenticated;
grant execute on function public.set_maintenance_mode(boolean) to authenticated;

