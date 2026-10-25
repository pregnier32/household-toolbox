-- Records when Plan & Billing last read the household's Stripe customer and
-- subscription. A later visit reuses that stored card and cancellation until
-- this time is five minutes old, or the customer returns from Checkout.
-- Safe to re-run. Does not change charges, trials, promotions, or Stripe ids.

ALTER TABLE public.billing_accounts
  ADD COLUMN IF NOT EXISTS stripe_observed_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
