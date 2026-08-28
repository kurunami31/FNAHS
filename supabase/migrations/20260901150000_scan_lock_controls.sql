-- ============================================================
-- FNAHS — scan lock controls + manual scan type support
--
-- Adds per-event lock columns so officers can cut off
-- time-in or time-out scanning at any point.
-- ============================================================

-- lock controls on events
alter table public.events
  add column if not exists time_in_locked boolean not null default false,
  add column if not exists time_out_locked boolean not null default false;
