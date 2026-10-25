-- Extra totals for the Superuser nightly billing log.
-- Safe to re-run. Does not change charges, trials, or existing run rows.

ALTER TABLE public.billing_reconcile_runs
  ADD COLUMN IF NOT EXISTS failed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retried_event_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS detail TEXT;

NOTIFY pgrst, 'reload schema';
