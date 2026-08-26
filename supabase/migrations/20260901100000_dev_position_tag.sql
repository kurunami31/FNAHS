-- ============================================================
-- allow the 'dev' position tag
--
-- Display-only developer marker: a superadmin tagged positions='dev'
-- renders as "DEV" across the app (roleLabel, ID card, member chips)
-- while keeping every superadmin permission untouched.
-- ============================================================

alter table public.profiles drop constraint profiles_positions_check;

alter table public.profiles
  add constraint profiles_positions_check
  check (positions <@ array[
    'dev'::text,
    'governor'::text,
    'v-governor'::text,
    'pio'::text,
    'assoc-pio'::text,
    'v-gov-internal'::text,
    'v-gov-external'::text,
    'secretary'::text,
    'assoc-secretary'::text,
    'treasurer'::text,
    'assoc-treasurer'::text,
    'auditor'::text,
    'assoc-auditor'::text,
    'business-manager'::text,
    'assoc-business-manager'::text,
    'committees'::text
  ]);