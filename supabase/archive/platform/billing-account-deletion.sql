-- Account-deletion billing archive. Additive. Does not delete rows.
-- billing_account_closures has no foreign key to public.users, so the marker
-- and the copied ledger survive account deletion.
-- Safe to re-run. Does not change prices, trials, or existing subscriptions.

ALTER TABLE public.billing_accounts
  ADD COLUMN IF NOT EXISTS deletion_status TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'billing_accounts_deletion_status_check'
      AND conrelid = 'public.billing_accounts'::regclass
  ) THEN
    ALTER TABLE public.billing_accounts
      ADD CONSTRAINT billing_accounts_deletion_status_check
      CHECK (deletion_status IS NULL OR deletion_status = 'deleting');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.billing_account_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  former_user_id UUID NOT NULL,
  status TEXT NOT NULL,
  stripe_customer_id TEXT,
  last_error TEXT,
  livemode BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  billing_closed_at TIMESTAMPTZ,
  user_deleted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT billing_account_closures_user_unique UNIQUE (former_user_id),
  CONSTRAINT billing_account_closures_status_check CHECK (status IN ('pending', 'billing_closed', 'user_deleted', 'completed')),
  CONSTRAINT billing_account_closures_livemode_sandbox CHECK (livemode = false)
);

CREATE INDEX IF NOT EXISTS billing_account_closures_customer_idx
  ON public.billing_account_closures (stripe_customer_id);

CREATE TABLE IF NOT EXISTS public.billing_ledger_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_id UUID NOT NULL REFERENCES public.billing_account_closures (id),
  former_user_id UUID NOT NULL,
  kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  livemode BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT billing_ledger_archive_source_unique UNIQUE (kind, source_id),
  CONSTRAINT billing_ledger_archive_kind_check CHECK (kind IN ('account', 'invoice', 'operation', 'period', 'checkout_session')),
  CONSTRAINT billing_ledger_archive_livemode_sandbox CHECK (livemode = false)
);

ALTER TABLE public.billing_account_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_ledger_archive ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['billing_account_closures', 'billing_ledger_archive']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Deny all client access to %1$s" ON public.%1$I', table_name);
    EXECUTE format(
      'CREATE POLICY "Deny all client access to %1$s" ON public.%1$I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      table_name
    );
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', table_name);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
