import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyBillingClosure,
  customerToClose,
  emptyLedger,
  mergeArchivedInvoice,
  planDeletionCheckout,
  recordPaymentOnArchive,
  syncBlockedByDeletion,
  type ClosureSnapshot,
  type ClosureStripe,
  type LedgerSnapshot,
  type SubscriptionSnapshot,
} from './billing-account-deletion';

const CANCEL = { invoice_now: false as const, prorate: false as const };

function ledger(): LedgerSnapshot {
  return {
    account: { stripe_customer_id: 'cus_owned', stripe_subscription_id: 'sub_live', deletion_status: 'deleting' },
    invoices: [
      { stripe_invoice_id: 'in_open', status: 'open', amount_cents: 200, amount_paid_cents: 0, collection_state: 'processing' },
      { stripe_invoice_id: 'in_other', status: 'open', amount_cents: 400, amount_paid_cents: 0, collection_state: null },
    ],
    operations: [{ idempotency_key: 'supplemental:once', status: 'completed', stripe_id: 'in_open' }],
    periods: [{ period_start: '2026-10-24T20:48:53.000Z', tools: [] }],
    checkoutSessions: [{ stripe_session_id: 'cs_open', status: 'open' }],
  };
}

function fakeStripe(subscriptions: SubscriptionSnapshot[], options?: { failCancel?: boolean; scheduleLeavesActive?: boolean }): ClosureStripe & { calls: string[] } {
  const calls: string[] = [];
  const rows = subscriptions.map((subscription) => ({ ...subscription }));
  return {
    calls,
    async listOpenSessions() {
      calls.push('list-sessions');
      return ['cs_open'];
    },
    async expireSession(sessionId) {
      calls.push(`expire:${sessionId}`);
    },
    async listSubscriptions() {
      calls.push('list-subscriptions');
      return rows.map((subscription) => ({ ...subscription }));
    },
    async retrieveSubscription(subscriptionId) {
      const found = rows.find((subscription) => subscription.id === subscriptionId);
      if (!found) throw new Error('missing subscription');
      return { ...found };
    },
    async cancelSchedule(scheduleId, params) {
      calls.push(`cancel-schedule:${scheduleId}:${JSON.stringify(params)}`);
      assert.deepEqual(params, CANCEL);
      const match = rows.find((subscription) => subscription.scheduleId === scheduleId);
      if (match && !options?.scheduleLeavesActive) match.status = 'canceled';
    },
    async cancelSubscription(subscriptionId, params) {
      calls.push(`cancel-subscription:${subscriptionId}:${JSON.stringify(params)}`);
      assert.deepEqual(params, CANCEL);
      if (options?.failCancel) throw new Error('Stripe unavailable');
      const match = rows.find((subscription) => subscription.id === subscriptionId);
      if (match) match.status = 'canceled';
    },
  };
}

function memory(initial: LedgerSnapshot) {
  let phase: ClosureSnapshot = { phase: null, customerId: null, lastError: null, archive: null };
  let live = structuredClone(initial);
  let removed = false;
  return {
    snapshot: () => phase,
    live: () => live,
    removed: () => removed,
    async read() {
      return structuredClone(phase);
    },
    async write(next: ClosureSnapshot) {
      phase = structuredClone(next);
    },
    async readLedger() {
      return structuredClone(live);
    },
    async removeLiveLedger() {
      removed = true;
      live = emptyLedger();
    },
  };
}

test('an active subscription and a scheduled subscription are canceled immediately', async () => {
  const stripe = fakeStripe([
    { id: 'sub_active', status: 'active', scheduleId: null },
    { id: 'sub_scheduled', status: 'active', scheduleId: 'sched_1' },
  ]);
  const store = memory(ledger());
  const closed = await applyBillingClosure({
    ...store,
    stripe,
    role: 'admin',
    ownedCustomerId: 'cus_owned',
    householdCustomerId: null,
  });
  assert.equal(closed.phase, 'billing_closed');
  assert.ok(stripe.calls.some((call) => call.startsWith('expire:cs_open')));
  assert.ok(stripe.calls.some((call) => call.startsWith('cancel-subscription:sub_active')));
  assert.ok(stripe.calls.some((call) => call.startsWith('cancel-schedule:sched_1')));
  assert.equal(stripe.calls.some((call) => call.startsWith('cancel-subscription:sub_scheduled')), false);
  assert.equal(stripe.calls.some((call) => call.includes('customers.del')), false);
});

test('a schedule that stays active is then canceled on the subscription', async () => {
  const stripe = fakeStripe([{ id: 'sub_scheduled', status: 'active', scheduleId: 'sched_1' }], { scheduleLeavesActive: true });
  await closeThrough(stripe);
  assert.ok(stripe.calls.some((call) => call.startsWith('cancel-schedule:sched_1')));
  assert.ok(stripe.calls.some((call) => call.startsWith('cancel-subscription:sub_scheduled')));
});

test('no Stripe customer still closes billing without calling Stripe', async () => {
  const stripe = fakeStripe([]);
  const store = memory(emptyLedger());
  const closed = await applyBillingClosure({
    ...store,
    stripe,
    role: 'admin',
    ownedCustomerId: null,
    householdCustomerId: 'cus_household',
  });
  assert.equal(closed.phase, 'billing_closed');
  assert.deepEqual(stripe.calls, []);
});

test('an already canceled subscription is a successful no-op', async () => {
  const stripe = fakeStripe([{ id: 'sub_done', status: 'canceled', scheduleId: null }]);
  await closeThrough(stripe);
  assert.equal(stripe.calls.some((call) => call.startsWith('cancel-')), false);
});

test('a Stripe failure stays pending and a retry confirms cancellation', async () => {
  const stripe = fakeStripe([{ id: 'sub_active', status: 'active', scheduleId: null }], { failCancel: true });
  const store = memory(ledger());
  await assert.rejects(() => applyBillingClosure({
    ...store,
    stripe,
    role: 'admin',
    ownedCustomerId: 'cus_owned',
    householdCustomerId: null,
  }));
  assert.equal(store.snapshot().phase, 'pending');
  assert.equal(store.removed(), false);
  assert.match(store.snapshot().lastError ?? '', /Stripe unavailable/);
  stripe.calls.length = 0;
  const patched = fakeStripe([{ id: 'sub_active', status: 'active', scheduleId: null }]);
  const closed = await applyBillingClosure({
    ...store,
    stripe: patched,
    role: 'admin',
    ownedCustomerId: 'cus_owned',
    householdCustomerId: null,
  });
  assert.equal(closed.phase, 'billing_closed');
  assert.equal(store.removed(), true);
});

test('partial ledger removal keeps the archive and the next attempt finishes', async () => {
  const stripe = fakeStripe([{ id: 'sub_active', status: 'canceled', scheduleId: null }]);
  const store = memory(ledger());
  const originalRemove = store.removeLiveLedger;
  let failed = false;
  store.removeLiveLedger = async () => {
    if (!failed) {
      failed = true;
      throw new Error('archive delete failed');
    }
    await originalRemove();
  };
  await assert.rejects(() => applyBillingClosure({
    ...store,
    stripe,
    role: 'admin',
    ownedCustomerId: 'cus_owned',
    householdCustomerId: null,
  }));
  assert.equal(store.snapshot().phase, 'pending');
  assert.equal(store.snapshot().archive?.invoices.length, 2);
  const closed = await applyBillingClosure({
    ...store,
    stripe,
    role: 'admin',
    ownedCustomerId: 'cus_owned',
    householdCustomerId: null,
  });
  assert.equal(closed.phase, 'billing_closed');
  assert.equal(closed.archive?.invoices.some((invoice) => invoice.stripe_invoice_id === 'in_open'), true);
  assert.equal(closed.archive?.operations[0]?.idempotency_key, 'supplemental:once');
  assert.equal(closed.archive?.periods[0]?.period_start, '2026-10-24T20:48:53.000Z');
  assert.equal(closed.archive?.account?.stripe_customer_id, 'cus_owned');
  assert.equal(store.removed(), true);
  assert.equal(store.live().invoices.length, 0);
});

test('a pending closure blocks reconciliation from creating another charge', async () => {
  let charged = false;
  const store = memory(ledger());
  const stripe = fakeStripe([{ id: 'sub_active', status: 'active', scheduleId: null }]);
  const write = store.write;
  store.write = async (next) => {
    await write(next);
    if (syncBlockedByDeletion(next.phase)) return;
    charged = true;
  };
  await applyBillingClosure({
    ...store,
    stripe,
    role: 'admin',
    ownedCustomerId: 'cus_owned',
    householdCustomerId: null,
  });
  assert.equal(charged, false);
  assert.equal(syncBlockedByDeletion('pending'), true);
  assert.equal(syncBlockedByDeletion('billing_closed'), true);
  assert.equal(syncBlockedByDeletion(null), false);
});

test('late Checkout completion cancels a revived subscription and does not create one', () => {
  const plan = planDeletionCheckout({
    subscriptionId: 'sub_revived',
    subscriptionStatus: 'active',
    scheduleId: null,
  });
  assert.equal(plan.createSubscription, false);
  assert.equal(plan.cancelSubscriptionId, 'sub_revived');
  assert.equal(plan.cancelScheduleId, null);
  const scheduled = planDeletionCheckout({
    subscriptionId: 'sub_revived',
    subscriptionStatus: 'active',
    scheduleId: 'sched_late',
  });
  assert.equal(scheduled.createSubscription, false);
  assert.equal(scheduled.cancelScheduleId, 'sched_late');
  assert.equal(scheduled.cancelSubscriptionId, null);
});

test('in-flight and outstanding invoices stay owed and can still be marked paid', () => {
  const open = [
    { stripeInvoiceId: 'in_open', status: 'open' as const, amountCents: 200, amountPaidCents: 0, collectionState: 'processing' as const },
    { stripeInvoiceId: 'in_other', status: 'open' as const, amountCents: 400, amountPaidCents: 0, collectionState: null },
  ];
  const processing = recordPaymentOnArchive(open, open[0]);
  assert.equal(processing.find((invoice) => invoice.stripeInvoiceId === 'in_open')?.status, 'open');
  assert.equal(processing.find((invoice) => invoice.stripeInvoiceId === 'in_open')?.collectionState, 'processing');
  const untouched = recordPaymentOnArchive(processing, {
    stripeInvoiceId: 'in_open',
    status: 'void',
    amountCents: 200,
    amountPaidCents: 0,
    collectionState: null,
  });
  assert.equal(untouched.find((invoice) => invoice.stripeInvoiceId === 'in_open')?.status, 'open');
  const paid = recordPaymentOnArchive(untouched, {
    stripeInvoiceId: 'in_open',
    status: 'paid',
    amountCents: 200,
    amountPaidCents: 200,
    collectionState: null,
  });
  assert.equal(paid.find((invoice) => invoice.stripeInvoiceId === 'in_open')?.status, 'paid');
  assert.equal(paid.find((invoice) => invoice.stripeInvoiceId === 'in_open')?.amountPaidCents, 200);
  assert.equal(paid.find((invoice) => invoice.stripeInvoiceId === 'in_other')?.status, 'open');
  assert.equal(paid.find((invoice) => invoice.stripeInvoiceId === 'in_other')?.amountCents, 400);
  const kept = mergeArchivedInvoice(paid[0].stripeInvoiceId === 'in_other' ? paid[0] : paid[1], {
    stripeInvoiceId: 'in_other',
    status: 'void',
    amountCents: 0,
    amountPaidCents: 0,
    collectionState: null,
  });
  assert.equal(kept.status, 'open');
  assert.equal(kept.amountCents, 400);
});

test('member deletion closes a former personal subscription and leaves the household subscription', () => {
  assert.equal(customerToClose({ role: 'member', ownedCustomerId: 'cus_personal', householdCustomerId: 'cus_household' }), 'cus_personal');
  assert.equal(customerToClose({ role: 'member', ownedCustomerId: null, householdCustomerId: 'cus_household' }), null);
  assert.equal(customerToClose({ role: 'member', ownedCustomerId: 'cus_household', householdCustomerId: 'cus_household' }), null);
  assert.equal(customerToClose({ role: 'admin', ownedCustomerId: 'cus_household', householdCustomerId: 'cus_household' }), 'cus_household');
});

test('a member closure does not call Stripe for the household customer', async () => {
  const stripe = fakeStripe([{ id: 'sub_personal', status: 'active', scheduleId: null }]);
  const store = memory({ ...ledger(), account: { stripe_customer_id: 'cus_personal' } });
  await applyBillingClosure({
    ...store,
    stripe,
    role: 'member',
    ownedCustomerId: 'cus_personal',
    householdCustomerId: 'cus_household',
  });
  assert.equal(store.snapshot().customerId, 'cus_personal');
  assert.ok(stripe.calls.some((call) => call.startsWith('cancel-subscription:sub_personal')));
});

async function closeThrough(stripe: ClosureStripe) {
  const store = memory(ledger());
  const closed = await applyBillingClosure({
    ...store,
    stripe,
    role: 'admin',
    ownedCustomerId: 'cus_owned',
    householdCustomerId: null,
  });
  assert.equal(closed.phase, 'billing_closed');
}
