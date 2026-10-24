import type Stripe from 'stripe';
import { billingDateLabel } from './billing-cycle';

export function subscriptionItemId(subscription: Stripe.Subscription): string | null {
  return subscription.items.data[0]?.id ?? null;
}

export function subscriptionPeriodEnd(subscription: Stripe.Subscription): number | null {
  return subscription.items.data[0]?.current_period_end ?? null;
}

type CancellationSubscription = {
  id: string;
  status: string;
  cancel_at: number | null;
  cancel_at_period_end: boolean;
  billing_cycle_anchor: number;
  items: { data: Array<{ id?: string; current_period_end?: number | null; price?: { unit_amount?: number | null } | null }> };
};

function isoSeconds(seconds: number | null | undefined): string | null {
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null;
}

/**
 * Stripe API 2026-09-30.endive, with flexible billing, schedules a cancellation
 * on cancel_at. cancel_at_period_end stays false. A classic subscription can
 * still use cancel_at_period_end. Either one is a scheduled cancellation.
 * A canceled status means the cancellation has already taken effect.
 */
export function describeSubscriptionCancellation(subscription: CancellationSubscription): {
  scheduled: boolean;
  effectiveAt: string | null;
  periodEnd: string | null;
} {
  const periodEnd = isoSeconds(subscription.items.data[0]?.current_period_end);
  const cancelAt = isoSeconds(subscription.cancel_at);
  const ended = subscription.status === 'canceled' || subscription.status === 'cancelled' || subscription.status === 'incomplete_expired';
  const scheduled = !ended && (Boolean(subscription.cancel_at) || subscription.cancel_at_period_end);
  return {
    scheduled,
    effectiveAt: scheduled ? (cancelAt ?? periodEnd) : null,
    periodEnd,
  };
}

export function subscriptionBillingPatch(subscription: CancellationSubscription): {
  stripe_subscription_id: string | null;
  stripe_subscription_item_id: string | null;
  subscription_status: string;
  cancel_at_period_end: boolean;
  billing_cycle_anchor: string;
  current_period_end: string | null;
  synced_amount_cents?: number | null;
} {
  const cancellation = describeSubscriptionCancellation(subscription);
  const ended = subscription.status === 'canceled' || subscription.status === 'cancelled' || subscription.status === 'incomplete_expired';
  const item = subscription.items.data[0];
  return {
    stripe_subscription_id: ended ? null : subscription.id,
    stripe_subscription_item_id: ended ? null : item?.id ?? null,
    subscription_status: subscription.status,
    cancel_at_period_end: cancellation.scheduled,
    billing_cycle_anchor: new Date(subscription.billing_cycle_anchor * 1000).toISOString(),
    current_period_end: cancellation.effectiveAt ?? cancellation.periodEnd,
    ...(ended ? {} : { synced_amount_cents: item?.price?.unit_amount ?? null }),
  };
}

export function subscriptionEventApplies(storedEventCreated: number | null, eventCreated: number): boolean {
  if (storedEventCreated == null) return true;
  return eventCreated >= storedEventCreated;
}

/** Keep a scheduled cancel_at on a price update. Omitting it must not be used to clear one. */
export function cancellationUpdateParams(cancelAt: number | null): { cancel_at?: number } {
  if (cancelAt == null) return {};
  return { cancel_at: cancelAt };
}

/** A renewal whose period starts at or after cancellation is not collected. Earlier period charges stay. */
export function supplementalBlockedByCancellation(periodStart: string | null, cancelAt: string | null, scheduled: boolean): boolean {
  if (!scheduled || !periodStart || !cancelAt) return false;
  const start = Date.parse(periodStart);
  const end = Date.parse(cancelAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return start >= end;
}

export function describeCancellationNotice(input: { scheduled: boolean; effectiveAt: string | null }): {
  message: string | null;
  accessEndsLabel: string | null;
} {
  if (!input.scheduled || !input.effectiveAt) return { message: null, accessEndsLabel: null };
  const date = billingDateLabel(input.effectiveAt);
  return {
    message: `Cancellation scheduled. Access continues until ${date}. Your subscription will not renew.`,
    accessEndsLabel: date,
  };
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
  preserveCancelAt?: number | null,
): Promise<Stripe.Subscription> {
  const updated = await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: 'none',
    billing_cycle_anchor: { type: 'unchanged' },
    ...cancellationUpdateParams(preserveCancelAt ?? null),
  }, idempotencyKey ? { idempotencyKey } : undefined);
  if (updated.billing_cycle_anchor !== previousAnchor) {
    throw new Error('Stripe moved the billing cycle anchor.');
  }
  return updated;
}
