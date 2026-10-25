/** A Plan & Billing visit reuses a Stripe read for this long, then reads again. */
export const PLAN_STRIPE_FRESH_MS = 5 * 60 * 1000;

export function planStripeRefreshDue(input: {
  checkoutSuccess: boolean;
  hasSameModeCustomer: boolean;
  observedAt: string | null;
  now: number;
}): boolean {
  if (!input.hasSameModeCustomer) return false;
  if (input.checkoutSuccess) return true;
  if (!input.observedAt) return true;
  const observed = Date.parse(input.observedAt);
  if (Number.isNaN(observed)) return true;
  return input.now - observed >= PLAN_STRIPE_FRESH_MS;
}
