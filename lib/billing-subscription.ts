import type Stripe from 'stripe';

export function subscriptionItemId(subscription: Stripe.Subscription): string | null {
  return subscription.items.data[0]?.id ?? null;
}

export function subscriptionPeriodEnd(subscription: Stripe.Subscription): number | null {
  return subscription.items.data[0]?.current_period_end ?? null;
}

/**
 * Classic Stripe billing resets the anchor and invoices immediately when a
 * subscription moves from a $0 price to a paid price. proration_behavior none
 * does not stop that. This API expects billing_cycle_anchor to be an object;
 * the older string "unchanged" is rejected. The object form keeps the anchor
 * and does not create an invoice.
 */
export async function replaceSubscriptionPrice(
  stripe: Stripe,
  subscriptionId: string,
  itemId: string,
  priceId: string,
  previousAnchor: number,
  idempotencyKey?: string,
): Promise<Stripe.Subscription> {
  const updated = await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: 'none',
    billing_cycle_anchor: { type: 'unchanged' },
  }, idempotencyKey ? { idempotencyKey } : undefined);
  if (updated.billing_cycle_anchor !== previousAnchor) {
    throw new Error('Stripe moved the billing cycle anchor.');
  }
  return updated;
}
