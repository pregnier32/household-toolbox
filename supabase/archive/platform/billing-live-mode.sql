-- Prepared for a later live-mode cutover. Do not apply until live billing is intentionally enabled.
-- Existing rows stay livemode false. This does not copy, delete, charge, or rewrite billing history.

ALTER TABLE public.billing_accounts DROP CONSTRAINT IF EXISTS billing_accounts_livemode_sandbox;
ALTER TABLE public.billing_invoices DROP CONSTRAINT IF EXISTS billing_invoices_livemode_sandbox;
ALTER TABLE public.billing_operations DROP CONSTRAINT IF EXISTS billing_operations_livemode_sandbox;
ALTER TABLE public.billing_checkout_sessions DROP CONSTRAINT IF EXISTS billing_checkout_sessions_livemode_sandbox;
ALTER TABLE public.billing_account_closures DROP CONSTRAINT IF EXISTS billing_account_closures_livemode_sandbox;
ALTER TABLE public.billing_ledger_archive DROP CONSTRAINT IF EXISTS billing_ledger_archive_livemode_sandbox;

ALTER TABLE public.billing_accounts
  ADD COLUMN IF NOT EXISTS preserved_test_stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS preserved_test_stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS preserved_test_stripe_subscription_item_id TEXT,
  ADD COLUMN IF NOT EXISTS preserved_test_card_brand TEXT,
  ADD COLUMN IF NOT EXISTS preserved_test_card_last4 TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS billing_accounts_preserved_test_customer_unique
  ON public.billing_accounts (preserved_test_stripe_customer_id)
  WHERE preserved_test_stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS billing_accounts_preserved_test_subscription_unique
  ON public.billing_accounts (preserved_test_stripe_subscription_id)
  WHERE preserved_test_stripe_subscription_id IS NOT NULL;

-- Customer-authorized live billing boundary. Null until that household starts live Checkout,
-- or until a new live household row is created. Tool history and the anchor are not rewritten.
ALTER TABLE public.billing_accounts
  ADD COLUMN IF NOT EXISTS live_billing_commenced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS live_billing_excluded_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS live_billing_excluded_tool_ids JSONB,
  ADD COLUMN IF NOT EXISTS live_billing_excluded_storage_gb INTEGER;

-- One open checkout, renewal, or operation key per mode. A sandbox row must not block or replace a live row.
DROP INDEX IF EXISTS public.billing_checkout_one_open;
CREATE UNIQUE INDEX billing_checkout_one_open
  ON public.billing_checkout_sessions (user_id, livemode)
  WHERE status = 'open';

DROP INDEX IF EXISTS public.billing_invoices_one_open_renewal;
CREATE UNIQUE INDEX billing_invoices_one_open_renewal
  ON public.billing_invoices (user_id, period_start, livemode)
  WHERE role = 'renewal' AND status IN ('draft', 'open');

ALTER TABLE public.billing_operations DROP CONSTRAINT IF EXISTS billing_operations_key_unique;
CREATE UNIQUE INDEX IF NOT EXISTS billing_operations_key_mode_unique
  ON public.billing_operations (idempotency_key, livemode);

NOTIFY pgrst, 'reload schema';
