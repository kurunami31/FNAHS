-- extend the remark vocabulary on clearance rows:
-- inc (Incomplete), deficient (Deficient/With Deficiency), good_standing (Good Standing)
alter table public.clearance_rows drop constraint if exists clearance_rows_remark_check;

alter table public.clearance_rows
  add constraint clearance_rows_remark_check
  check (remark in ('absent', 'late', 'ir', 'inc', 'deficient', 'good_standing'));