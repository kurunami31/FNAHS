-- ============================================================
-- 19 · audit log (Security Level 1)
-- Sensitive operations (role changes, fee records, event edits,
-- member deletions, …) append a row here. Rows are never written
-- directly — the security-definer log_audit() RPC stamps the actor
-- from auth.uid(). Reading is limited to console officers via
-- get_audit_logs(). No PII beyond ids: names/emails are looked up
-- at display time and never stored in the log.
-- ============================================================

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id);

alter table public.audit_logs enable row level security;

-- no direct table access for anyone (the RPCs below are the only door)

create or replace function public.log_audit(
  p_action text,
  p_entity text,
  p_entity_id text default null,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_meta, '{}'::jsonb));
end;
$$;

create or replace function public.get_audit_logs(p_limit int default 100)
returns table (
  id uuid,
  actor_id uuid,
  action text,
  entity text,
  entity_id text,
  meta jsonb,
  created_at timestamptz
)
language sql security definer set search_path = public as $$
  select l.id, l.actor_id, l.action, l.entity, l.entity_id, l.meta, l.created_at
  from public.audit_logs l
  where public.is_console_officer()
  order by l.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

grant execute on function public.log_audit(text, text, text, jsonb) to authenticated;
grant execute on function public.get_audit_logs(int) to authenticated;
