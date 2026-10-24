import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cancellationUpdateParams,
  describeCancellationNotice,
  describeSubscriptionCancellation,
  subscriptionBillingPatch,
  subscriptionEventApplies,
  supplementalBlockedByCancellation,
} from './billing-subscription';

const CANCEL_AT = Math.floor(Date.parse('2026-11-24T20:48:53.000Z') / 1000);

function subscription(overrides: Partial<{
  status: string;
  cancel_at: number | null;
  cancel_at_period_end: boolean;
  periodEnd: number;
}> = {}) {
  return {
    id: 'sub_test',
    status: overrides.status ?? 'active',
    cancel_at: overrides.cancel_at === undefined ? null : overrides.cancel_at,
    cancel_at_period_end: overrides.cancel_at_period_end ?? false,
    billing_cycle_anchor: CANCEL_AT,
    items: { data: [{ id: 'si_test', current_period_end: overrides.periodEnd ?? CANCEL_AT, price: { unit_amount: 200 } }] },
  };
}

test('flexible billing cancel_at schedules cancellation while cancel_at_period_end stays false', () => {
  const described = describeSubscriptionCancellation(subscription({ cancel_at: CANCEL_AT }));
  assert.equal(described.scheduled, true);
  assert.equal(described.effectiveAt, '2026-11-24T20:48:53.000Z');
  const notice = describeCancellationNotice({ scheduled: described.scheduled, effectiveAt: described.effectiveAt });
  assert.equal(notice.message, 'Cancellation scheduled. Access continues until November 24, 2026. Your subscription will not renew.');
  assert.equal(notice.accessEndsLabel, 'November 24, 2026');
  const stored = subscriptionBillingPatch(subscription({ cancel_at: CANCEL_AT }));
  assert.equal(stored.cancel_at_period_end, true);
  assert.equal(stored.subscription_status, 'active');
  assert.equal(stored.current_period_end, '2026-11-24T20:48:53.000Z');
  assert.equal(stored.synced_amount_cents, 200);
});

test('clearing cancel_at restores a normal renewal and a past cancellation does not stay scheduled', () => {
  const reversed = describeSubscriptionCancellation(subscription());
  assert.equal(reversed.scheduled, false);
  assert.equal(reversed.effectiveAt, null);
  assert.equal(describeCancellationNotice({ scheduled: false, effectiveAt: null }).message, null);
  const ended = describeSubscriptionCancellation(subscription({ status: 'canceled', cancel_at: CANCEL_AT }));
  assert.equal(ended.scheduled, false);
  const stored = subscriptionBillingPatch(subscription({ status: 'canceled', cancel_at: CANCEL_AT }));
  assert.equal(stored.subscription_status, 'canceled');
  assert.equal(stored.stripe_subscription_id, null);
  assert.equal(stored.cancel_at_period_end, false);
});

test('a classic cancel_at_period_end flag still schedules the period end', () => {
  const described = describeSubscriptionCancellation(subscription({ cancel_at_period_end: true, periodEnd: CANCEL_AT }));
  assert.equal(described.scheduled, true);
  assert.equal(described.effectiveAt, '2026-11-24T20:48:53.000Z');
});

test('an older subscription event does not replace a newer one, and a retry still applies', () => {
  assert.equal(subscriptionEventApplies(200, 100), false);
  assert.equal(subscriptionEventApplies(200, 200), true);
  assert.equal(subscriptionEventApplies(200, 201), true);
  assert.equal(subscriptionEventApplies(null, 50), true);
});

test('a price update keeps the same cancel_at and does not invent one', () => {
  assert.deepEqual(cancellationUpdateParams(CANCEL_AT), { cancel_at: CANCEL_AT });
  assert.deepEqual(cancellationUpdateParams(null), {});
});

test('cancellation blocks a renewal at the cancel date and keeps an earlier period charge', () => {
  const cancelAt = '2026-11-24T20:48:53.000Z';
  assert.equal(supplementalBlockedByCancellation('2026-10-24T20:48:53.000Z', cancelAt, true), false);
  assert.equal(supplementalBlockedByCancellation(cancelAt, cancelAt, true), true);
  assert.equal(supplementalBlockedByCancellation('2026-12-24T20:48:53.000Z', cancelAt, true), true);
  assert.equal(supplementalBlockedByCancellation(cancelAt, cancelAt, false), false);
});
