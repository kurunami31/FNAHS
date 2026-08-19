-- ============================================================
-- one account per member
--
-- A school ID number may belong to exactly one account. The
-- signup form has no ID field, so a person could in theory create
-- two accounts and claim the same ID on both; this index makes
-- that impossible at the database level (the second save fails
-- with a unique_violation, which the app translates into a clear
-- message).
--
--   · normalize whitespace-only id_no values to NULL
--   · partial functional unique index (case/space-insensitive)
-- ============================================================

update public.profiles
set id_no = null
where id_no is not null and trim(id_no) = '';

drop index if exists profiles_id_no_unique;
create unique index profiles_id_no_unique
  on public.profiles (lower(trim(id_no)))
  where id_no is not null and id_no <> '';