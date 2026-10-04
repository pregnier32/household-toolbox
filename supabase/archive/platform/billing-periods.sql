-- Anniversary billing periods.
-- One frozen row per account per billing anniversary. Tool data is not kept
-- here; this only remembers which tools were committed to the period and
-- which of those charges end at the next anniversary.
-- Safe to re-run. Does not touch trials, promotions, or users_tools.

CREATE TABLE IF NOT EXISTS public.billing_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT billing_periods_user_period_unique UNIQUE (user_id, period_start)
);

CREATE INDEX IF NOT EXISTS billing_periods_user_idx
  ON public.billing_periods (user_id, period_start);

ALTER TABLE public.billing_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all client access to billing_periods" ON public.billing_periods;
CREATE POLICY "Deny all client access to billing_periods"
  ON public.billing_periods
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON TABLE public.billing_periods FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.billing_periods TO service_role;

NOTIFY pgrst, 'reload schema';
