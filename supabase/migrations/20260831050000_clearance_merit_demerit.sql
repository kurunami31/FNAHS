-- Merit/demerit are now editable counts on a 1-12 scale (was 1/2/3).
-- Days of extension are auto-derived from demerits (3 demerits = 1 day),
-- so the old manual days_extension column stays but is no longer written.

alter table public.clearance_rows drop constraint if exists clearance_rows_demerit_check;
alter table public.clearance_rows
  add constraint clearance_rows_demerit_check
  check (demerit is null or (demerit between 1 and 12));

alter table public.clearance_rows drop constraint if exists clearance_rows_merit_check;
alter table public.clearance_rows
  add constraint clearance_rows_merit_check
  check (merit between 0 and 12);