-- Sandbox Stripe ledger. The pricing engine remains the source of amounts.
-- Safe to re-run. Does not change trials, promotions, tool prices, or storage purchase.

CREATE TABLE IF NOT EXISTS public.billing_accounts (
  user_id UUID PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_subscription_item_id TEXT,
  subscription_status TEXT,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  billing_cycle_anchor TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  synced_amount_cents INTEGER,
  card_brand TEXT,
  card_last4 TEXT,
  subscription_event_created BIGINT,
  livemode BOOLEAN NOT NULL DEFAULT false,
  lock_owner TEXT,
  locked_until TIMESTAMPTZ,
  last_reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT billing_accounts_livemode_sandbox CHECK (livemode = false),
  CONSTRAINT billing_accounts_customer_unique UNIQUE (stripe_customer_id),
  CONSTRAINT billing_accounts_subscription_unique UNIQUE (stripe_subscription_id)
);

CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ,
  stripe_invoice_id TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  replaces_stripe_invoice_id TEXT,
  overcharge BOOLEAN NOT NULL DEFAULT false,
  livemode BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT billing_invoices_stripe_unique UNIQUE (stripe_invoice_id),
  CONSTRAINT billing_invoices_role_check CHECK (role IN ('setup', 'renewal', 'supplemental', 'replacement')),
  CONSTRAINT billing_invoices_status_check CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  CONSTRAINT billing_invoices_amount_check CHECK (amount_cents >= 0 AND amount_paid_cents >= 0),
  CONSTRAINT billing_invoices_livemode_sandbox CHECK (livemode = false)
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_invoices_one_open_renewal
  ON public.billing_invoices (user_id, period_start)
  WHERE role = 'renewal' AND status IN ('draft', 'open');

CREATE UNIQUE INDEX IF NOT EXISTS billing_invoices_one_replacement
  ON public.billing_invoices (replaces_stripe_invoice_id)
  WHERE replaces_stripe_invoice_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.billing_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  stripe_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  livemode BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT billing_operations_key_unique UNIQUE (idempotency_key),
  CONSTRAINT billing_operations_status_check CHECK (status IN ('started', 'stripe_succeeded', 'completed', 'failed')),
  CONSTRAINT billing_operations_livemode_sandbox CHECK (livemode = false)
);

CREATE INDEX IF NOT EXISTS billing_operations_open_idx
  ON public.billing_operations (user_id, status);

CREATE TABLE IF NOT EXISTS public.billing_checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  stripe_session_id TEXT NOT NULL,
  status TEXT NOT NULL,
  livemode BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT billing_checkout_sessions_stripe_unique UNIQUE (stripe_session_id),
  CONSTRAINT billing_checkout_sessions_status_check CHECK (status IN ('open', 'complete', 'expired')),
  CONSTRAINT billing_checkout_sessions_livemode_sandbox CHECK (livemode = false)
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_checkout_one_open
  ON public.billing_checkout_sessions (user_id)
  WHERE status = 'open';

CREATE TABLE IF NOT EXISTS public.stripe_events (
  stripe_event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  livemode BOOLEAN NOT NULL,
  status TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  payload JSONB,
  lock_owner TEXT,
  locked_until TIMESTAMPTZ,
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT stripe_events_status_check CHECK (status IN ('received', 'processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS stripe_events_status_idx
  ON public.stripe_events (status, locked_until);

CREATE TABLE IF NOT EXISTS public.billing_reconcile_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  scanned_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  CONSTRAINT billing_reconcile_runs_status_check CHECK (status IN ('running', 'completed', 'failed'))
);

ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_reconcile_runs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'billing_accounts',
    'billing_invoices',
    'billing_operations',
    'billing_checkout_sessions',
    'stripe_events',
    'billing_reconcile_runs'
  ]
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

CREATE OR REPLACE FUNCTION public.claim_billing_lock(p_user_id UUID, p_owner TEXT, p_seconds INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  claimed UUID;
BEGIN
  INSERT INTO public.billing_accounts (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.billing_accounts
  SET lock_owner = p_owner,
      locked_until = statement_timestamp() + make_interval(secs => p_seconds),
      updated_at = statement_timestamp()
  WHERE user_id = p_user_id
    AND (
      locked_until IS NULL
      OR locked_until < statement_timestamp()
      OR lock_owner = p_owner
    )
  RETURNING user_id INTO claimed;

  RETURN claimed IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_billing_lock(p_user_id UUID, p_owner TEXT)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE public.billing_accounts
  SET lock_owner = NULL,
      locked_until = NULL,
      updated_at = statement_timestamp()
  WHERE user_id = p_user_id
    AND lock_owner = p_owner;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_stripe_event(
  p_event_id TEXT,
  p_type TEXT,
  p_livemode BOOLEAN,
  p_owner TEXT,
  p_seconds INTEGER,
  p_payload JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  claimed TEXT;
  current_status TEXT;
BEGIN
  INSERT INTO public.stripe_events (stripe_event_id, type, livemode, status, payload)
  VALUES (p_event_id, p_type, p_livemode, 'received', p_payload)
  ON CONFLICT (stripe_event_id) DO UPDATE
    SET payload = COALESCE(public.stripe_events.payload, EXCLUDED.payload),
        updated_at = statement_timestamp();

  UPDATE public.stripe_events
  SET status = 'processing',
      attempt_count = attempt_count + 1,
      lock_owner = p_owner,
      locked_until = statement_timestamp() + make_interval(secs => p_seconds),
      last_error = NULL,
      updated_at = statement_timestamp()
  WHERE stripe_event_id = p_event_id
    AND status <> 'completed'
    AND (
      status <> 'processing'
      OR locked_until IS NULL
      OR locked_until < statement_timestamp()
    )
  RETURNING stripe_event_id INTO claimed;

  IF claimed IS NOT NULL THEN
    RETURN 'claimed';
  END IF;

  SELECT status INTO current_status
  FROM public.stripe_events
  WHERE stripe_event_id = p_event_id;

  IF current_status = 'completed' THEN
    RETURN 'completed';
  END IF;
  RETURN 'busy';
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_stripe_event(
  p_event_id TEXT,
  p_owner TEXT,
  p_status TEXT,
  p_error TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  updated_id TEXT;
BEGIN
  IF p_status NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'stripe event finish status must be completed or failed';
  END IF;

  UPDATE public.stripe_events
  SET status = p_status,
      last_error = p_error,
      completed_at = CASE WHEN p_status = 'completed' THEN statement_timestamp() ELSE completed_at END,
      lock_owner = NULL,
      locked_until = NULL,
      updated_at = statement_timestamp()
  WHERE stripe_event_id = p_event_id
    AND lock_owner = p_owner
    AND status = 'processing'
  RETURNING stripe_event_id INTO updated_id;

  RETURN updated_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_billing_lock(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_billing_lock(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_stripe_event(TEXT, TEXT, BOOLEAN, TEXT, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_stripe_event(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_billing_lock(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_billing_lock(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_stripe_event(TEXT, TEXT, BOOLEAN, TEXT, INTEGER, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_stripe_event(TEXT, TEXT, TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
