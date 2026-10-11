-- ============================================================
-- Remove the abandoned report-sync scaffolding
--
-- sync-reports was an unfinished stub: a 5-line edge function calling
-- an undefined runSync(). It was never reachable from the app, and its
-- pg_cron job ("report-sync-fallback", every 5 minutes) posted to a
-- project ref belonging to a previous project rather than this one, so
-- it had been failing silently on a loop.
--
-- report_connectors and news_cache both hold zero rows and are
-- referenced nowhere in the codebase. The cron job and the edge
-- function have already been removed.
--
-- The original scaffold remains in git history (commit 89d78aa) if the
-- feature is ever picked up.
-- ============================================================

drop function if exists public.report_sync_status();
drop table if exists public.report_connectors cascade;
drop table if exists public.news_cache cascade;