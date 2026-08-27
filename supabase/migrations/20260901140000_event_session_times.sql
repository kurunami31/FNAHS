-- ============================================================
-- event session times: morning and afternoon time in/out
--
-- Add columns to the events table to store session times
-- for morning and afternoon sessions.
-- ============================================================

alter table public.events
  add column if not exists morning_time_in time,
  add column if not exists morning_time_out time,
  add column if not exists afternoon_time_in time,
  add column if not exists afternoon_time_out time;

comment on column public.events.morning_time_in is 'Morning session start time';
comment on column public.events.morning_time_out is 'Morning session end time';
comment on column public.events.afternoon_time_in is 'Afternoon session start time';
comment on column public.events.afternoon_time_out is 'Afternoon session end time';