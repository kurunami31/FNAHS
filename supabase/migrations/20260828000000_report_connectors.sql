-- ============================================================
-- live report sync — Google Sheet destinations
--
-- Admins enable a Google Sheet that the sync-reports edge
-- function keeps up to date (event contributions, membership
-- fees, event rosters). This table holds non-secret config only;
-- the Google service-account key lives in the function secrets.
--
--   · report_connectors    — superadmin-managed connector rows
--   · report_sync_status() — officers see status, never config
--   · pg_cron fallback     — syncs every 5 minutes even if the
--                            app's instant nudge was missed
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table if not exists public.report_connectors (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'google' check (kind in ('google')),
  label text not null default 'Org Google Sheet',
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.report_connectors enable row level security;

drop policy if exists report_connectors_superadmin_all on public.report_connectors;
create policy report_connectors_superadmin_all on public.report_connectors
  for all
  using ((select role from public.profiles where id = auth.uid()) = 'superadmin')
  with check ((select role from public.profiles where id = auth.uid()) = 'superadmin');

-- console officers read sync status only (no config, no secrets)
create or replace function public.report_sync_status()
returns table (id uuid, kind text, label text, enabled boolean, last_synced_at timestamptz, last_error text)
language sql security definer set search_path = public
as $$
  select rc.id, rc.kind, rc.label, rc.enabled, rc.last_synced_at, rc.last_error
  from public.report_connectors rc
  where (select role from public.profiles where id = auth.uid()) = 'superadmin'
     or public.is_console_officer()
  order by rc.created_at;
$$;

grant execute on function public.report_sync_status() to authenticated;

-- 5-minute fallback sync (calls the sync-reports edge function with the
-- anon key; the function ignores unauthenticated calls). Replace
-- __ANON_KEY__ with your project's anon key if you re-apply this file.
select cron.unschedule('report-sync-fallback') where exists (
  select 1 from cron.job where jobname = 'report-sync-fallback'
);
select cron.schedule('report-sync-fallback', '*/5 * * * *', $cron$
  select net.http_post(
    url := 'https://ixbdkehwzekagvfssblq.functions.supabase.co/sync-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer __ANON_KEY__'
    ),
    body := '{}'::jsonb
  );
$cron$);