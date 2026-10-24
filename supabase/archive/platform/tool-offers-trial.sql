-- Catalog flag for the one-time 7-day tool trial.
-- Safe to re-run. Existing tools stay eligible until a superadmin unchecks the box.
-- After this succeeds, reload types:
--   npm run supabase:types

ALTER TABLE public.tools
  ADD COLUMN IF NOT EXISTS offers_trial boolean NOT NULL DEFAULT true;
