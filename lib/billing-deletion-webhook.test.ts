import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type Stripe from 'stripe';

function loadLocalEnv(): void {
  const file = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadLocalEnv();

const PRODUCTION_SUPABASE_REF = 'hjbneuicvfbihtbufrxq';
const isolatedUrl = process.env.HTB_TEST_SUPABASE_URL ?? '';
const isolatedAnon = process.env.HTB_TEST_SUPABASE_ANON_KEY ?? '';
const isolatedService = process.env.HTB_TEST_SUPABASE_SERVICE_ROLE_KEY ?? '';
const isolatedReady = Boolean(isolatedUrl && isolatedAnon && isolatedService) && !isolatedUrl.includes(PRODUCTION_SUPABASE_REF);
if (isolatedReady) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = isolatedUrl;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = isolatedAnon;
  process.env.SUPABASE_SERVICE_ROLE_KEY = isolatedService;
}
const databaseReady = isolatedReady;
const databaseSkip = isolatedUrl.includes(PRODUCTION_SUPABASE_REF)
  ? 'HTB_TEST_SUPABASE_URL points at the production project.'
  : 'Set HTB_TEST_SUPABASE_URL, HTB_TEST_SUPABASE_ANON_KEY, and HTB_TEST_SUPABASE_SERVICE_ROLE_KEY to an isolated project.';
const sandboxKey = (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_');

type SupabaseServer = typeof import('./supabaseServer').supabaseServer;
type RecordInvoice = typeof import('./billing-closure').recordDeletionInvoice;

function token(): string {
  return randomUUID().replace(/-/g, '');
}

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function preservedDigest(supabase: SupabaseServer): Promise<string> {
  const [users, accounts, closures, archive, events] = await Promise.all([
    supabase.from('users').select('id'),
    supabase.from('billing_accounts').select('user_id, updated_at'),
    supabase.from('billing_account_closures').select('id, status, completed_at, updated_at'),
    supabase.from('billing_ledger_archive').select('id, updated_at'),
    supabase.from('stripe_events').select('stripe_event_id, status, attempt_count, updated_at'),
  ]);
  for (const result of [users, accounts, closures, archive, events]) {
    if (result.error) throw result.error;
  }
  const stable = (rows: Array<Record<string, unknown>> | null, key: string) =>
    [...(rows ?? [])].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
  return digest({
    users: stable(users.data as Array<Record<string, unknown>>, 'id'),
    accounts: stable(accounts.data as Array<Record<string, unknown>>, 'user_id'),
    closures: stable(closures.data as Array<Record<string, unknown>>, 'id'),
    archive: stable(archive.data as Array<Record<string, unknown>>, 'id'),
    events: stable(events.data as Array<Record<string, unknown>>, 'stripe_event_id'),
  });
}

function mockStripe(subscriptionId: string) {
  const calls: string[] = [];
  let status = 'active';
  const state = { failCancel: false, leaveActive: false };
  const stripe = {
    subscriptions: {
      async retrieve(id: string) {
        calls.push(`retrieve:${id}`);
        if (id !== subscriptionId) throw new Error('unexpected subscription');
        return { id, status, livemode: false, schedule: null };
      },
      async cancel(id: string, params: { invoice_now?: boolean; prorate?: boolean }) {
        calls.push(`cancel:${id}:${String(params.invoice_now)}:${String(params.prorate)}`);
        if (id !== subscriptionId) throw new Error('unexpected subscription');
        if (state.failCancel) throw new Error('Stripe cancel failed');
        if (!state.leaveActive) status = 'canceled';
        return { id, status, livemode: false, schedule: null };
      },
      async create() { throw new Error('subscriptions.create is not used by this fixture'); },
      async list() { throw new Error('subscriptions.list is not used by this fixture'); },
    },
    checkout: {
      sessions: {
        async expire(id: string) { calls.push(`expire:${id}`); },
        async create() { throw new Error('checkout.sessions.create is not used by this fixture'); },
        async retrieve() { throw new Error('checkout.sessions.retrieve is not used by this fixture'); },
      },
    },
    paymentIntents: {
      async create() { throw new Error('paymentIntents.create is not used by this fixture'); },
      async retrieve() { throw new Error('paymentIntents.retrieve is not used by this fixture'); },
    },
    charges: { async create() { throw new Error('charges.create is not used by this fixture'); } },
    customers: {
      async create() { throw new Error('customers.create is not used by this fixture'); },
      async del() { throw new Error('customers.del is not used by this fixture'); },
    },
    subscriptionSchedules: {
      async cancel() { throw new Error('subscriptionSchedules.cancel is not used by this fixture'); },
    },
  };
  return { stripe: stripe as unknown as Stripe, calls, state, status: () => status };
}

function syntheticCheckoutEvent(eventId: string, session: Record<string, unknown>): Stripe.Event {
  return {
    id: eventId,
    object: 'event',
    api_version: 'fixture-not-from-stripe',
    created: 1792882000,
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    type: 'checkout.session.completed',
    data: { object: session },
  } as unknown as Stripe.Event;
}

function checkoutSession(input: {
  sessionId: string;
  customerId: string;
  userId: string;
  mode: 'payment' | 'subscription';
  paymentIntentId?: string;
  invoiceId?: string;
  subscriptionId?: string;
}): Record<string, unknown> {
  return {
    id: input.sessionId,
    object: 'checkout.session',
    livemode: false,
    customer: input.customerId,
    metadata: { hhtb_user_id: input.userId },
    mode: input.mode,
    status: 'complete',
    payment_status: 'paid',
    amount_total: 200,
    subscription: input.subscriptionId ?? null,
    invoice: input.invoiceId ?? null,
    payment_intent: input.paymentIntentId ?? null,
  };
}

test('a delayed checkout completion is processed for the first time after deletion', { skip: databaseReady ? false : databaseSkip }, async () => {
  assert.equal(sandboxKey, true, 'Stripe configuration must be a sandbox test key');
  const { supabaseServer } = await import('./supabaseServer');
  const { acceptVerifiedStripeEvent } = await import('./billing-webhook');
  const { recordDeletionInvoice } = await import('./billing-closure');
  const before = await preservedDigest(supabaseServer);
  const created: Array<{ userId: string; eventIds: string[] }> = [];

  async function mustDelete(result: { error: { message?: string } | null }) {
    if (result.error) throw new Error(result.error.message || 'Fixture cleanup failed');
  }

  async function cleanup() {
    for (const fixture of created) {
      if (fixture.eventIds.length > 0) {
        await mustDelete(await supabaseServer.from('stripe_events').delete().in('stripe_event_id', fixture.eventIds));
      }
      await mustDelete(await supabaseServer.from('billing_ledger_archive').delete().eq('former_user_id', fixture.userId));
      await mustDelete(await supabaseServer.from('billing_invoices').delete().eq('user_id', fixture.userId));
      await mustDelete(await supabaseServer.from('billing_operations').delete().eq('user_id', fixture.userId));
      await mustDelete(await supabaseServer.from('billing_periods').delete().eq('user_id', fixture.userId));
      await mustDelete(await supabaseServer.from('billing_checkout_sessions').delete().eq('user_id', fixture.userId));
      await mustDelete(await supabaseServer.from('billing_accounts').delete().eq('user_id', fixture.userId));
      await mustDelete(await supabaseServer.from('users').delete().eq('id', fixture.userId));
      await mustDelete(await supabaseServer.from('billing_account_closures').delete().eq('former_user_id', fixture.userId));
    }
  }

  async function openFixture() {
    const userId = randomUUID();
    const customerId = `cus_fixture_${token()}`;
    const now = new Date().toISOString();
    const inserted = await supabaseServer.from('billing_account_closures').insert({
      former_user_id: userId,
      status: 'completed',
      stripe_customer_id: customerId,
      livemode: false,
      started_at: now,
      billing_closed_at: now,
      user_deleted_at: now,
      completed_at: now,
      updated_at: now,
    }).select('id, completed_at').single();
    if (inserted.error) throw inserted.error;
    const fixture = { userId, customerId, closureId: inserted.data.id as string, completedAt: inserted.data.completed_at as string, eventIds: [] as string[] };
    created.push(fixture);
    return fixture;
  }

  async function assertAccountStaysDeleted(userId: string, completedAt: string) {
    const profile = await supabaseServer.from('users').select('id').eq('id', userId).maybeSingle();
    if (profile.error) throw profile.error;
    assert.equal(profile.data, null);
    const account = await supabaseServer.from('billing_accounts').select('user_id').eq('user_id', userId).maybeSingle();
    if (account.error) throw account.error;
    assert.equal(account.data, null);
    const invoices = await supabaseServer.from('billing_invoices').select('id').eq('user_id', userId);
    if (invoices.error) throw invoices.error;
    assert.equal(invoices.data?.length ?? 0, 0);
    const authUser = await supabaseServer.auth.admin.getUserById(userId);
    assert.equal(authUser.data?.user ?? null, null);
    const closure = await supabaseServer.from('billing_account_closures').select('status, completed_at').eq('former_user_id', userId).single();
    if (closure.error) throw closure.error;
    assert.equal(closure.data.status, 'completed');
    assert.equal(closure.data.completed_at, completedAt);
  }

  async function archiveRows(userId: string) {
    const rows = await supabaseServer.from('billing_ledger_archive').select('kind, source_id, payload').eq('former_user_id', userId);
    if (rows.error) throw rows.error;
    return rows.data ?? [];
  }

  async function eventRow(eventId: string) {
    const row = await supabaseServer.from('stripe_events').select('status, attempt_count, livemode').eq('stripe_event_id', eventId).single();
    if (row.error) throw row.error;
    return row.data;
  }

  try {
    const payment = await openFixture();
    const paymentEventId = `evt_fixture_${token()}`;
    const paymentIntentId = `pi_fixture_${token()}`;
    payment.eventIds.push(paymentEventId);
    const paymentStripe = mockStripe(`sub_fixture_${token()}`);
    const paymentEvent = syntheticCheckoutEvent(paymentEventId, checkoutSession({
      sessionId: `cs_fixture_${token()}`,
      customerId: payment.customerId,
      userId: payment.userId,
      mode: 'payment',
      paymentIntentId,
    }));

    const firstPayment = await acceptVerifiedStripeEvent(paymentEvent, { stripe: paymentStripe.stripe });
    assert.equal(firstPayment.outcome, 'completed');
    assert.deepEqual(paymentStripe.calls, []);
    const storedPayment = await eventRow(paymentEventId);
    assert.equal(storedPayment.status, 'completed');
    assert.equal(storedPayment.attempt_count, 1);
    assert.equal(storedPayment.livemode, false);
    const paymentArchive = await archiveRows(payment.userId);
    assert.equal(paymentArchive.length, 1);
    assert.equal(paymentArchive[0]?.kind, 'invoice');
    assert.equal(paymentArchive[0]?.source_id, paymentIntentId);
    const paymentPayload = paymentArchive[0]?.payload as { status?: string; amount_cents?: number; amount_paid_cents?: number; role?: string };
    assert.equal(paymentPayload.status, 'paid');
    assert.equal(paymentPayload.amount_cents, 200);
    assert.equal(paymentPayload.amount_paid_cents, 200);
    assert.equal(paymentPayload.role, 'supplemental');
    await assertAccountStaysDeleted(payment.userId, payment.completedAt);

    const replayPayment = await acceptVerifiedStripeEvent(paymentEvent, { stripe: paymentStripe.stripe });
    assert.equal(replayPayment.outcome, 'duplicate');
    assert.deepEqual(paymentStripe.calls, []);
    assert.equal((await eventRow(paymentEventId)).attempt_count, 1);
    assert.equal((await archiveRows(payment.userId)).length, 1);
    await assertAccountStaysDeleted(payment.userId, payment.completedAt);

    const subscription = await openFixture();
    const subscriptionEventId = `evt_fixture_${token()}`;
    const subscriptionId = `sub_fixture_${token()}`;
    const subscriptionInvoiceId = `in_fixture_${token()}`;
    subscription.eventIds.push(subscriptionEventId);
    const subscriptionStripe = mockStripe(subscriptionId);
    const subscriptionEvent = syntheticCheckoutEvent(subscriptionEventId, checkoutSession({
      sessionId: `cs_fixture_${token()}`,
      customerId: subscription.customerId,
      userId: subscription.userId,
      mode: 'subscription',
      invoiceId: subscriptionInvoiceId,
      subscriptionId,
    }));
    const firstSubscription = await acceptVerifiedStripeEvent(subscriptionEvent, { stripe: subscriptionStripe.stripe });
    assert.equal(firstSubscription.outcome, 'completed');
    assert.equal(subscriptionStripe.status(), 'canceled');
    const cancelAt = subscriptionStripe.calls.findIndex((call) => call === `cancel:${subscriptionId}:false:false`);
    assert.ok(cancelAt > 0);
    assert.ok(subscriptionStripe.calls.slice(cancelAt + 1).some((call) => call.startsWith('retrieve:')));
    const subscriptionArchive = await archiveRows(subscription.userId);
    assert.equal(subscriptionArchive.filter((row) => row.kind === 'invoice').length, 1);
    const subscriptionAccount = subscriptionArchive.find((row) => row.kind === 'account')?.payload as { deletion_snapshot?: string; closure_results?: Array<{ result?: string; subscription_status?: string }> };
    assert.equal(subscriptionAccount.deletion_snapshot, 'before_deletion');
    assert.equal(subscriptionAccount.closure_results?.[0]?.result, 'final');
    assert.equal(subscriptionAccount.closure_results?.[0]?.subscription_status, 'canceled');
    await assertAccountStaysDeleted(subscription.userId, subscription.completedAt);
    const callsAfterCancel = subscriptionStripe.calls.length;
    const replaySubscription = await acceptVerifiedStripeEvent(subscriptionEvent, { stripe: subscriptionStripe.stripe });
    assert.equal(replaySubscription.outcome, 'duplicate');
    assert.equal(subscriptionStripe.calls.length, callsAfterCancel);
    assert.equal((await eventRow(subscriptionEventId)).attempt_count, 1);
    assert.equal((await archiveRows(subscription.userId)).filter((row) => row.kind === 'invoice').length, 1);

    const cancelRetry = await openFixture();
    const cancelEventId = `evt_fixture_${token()}`;
    const cancelSubscriptionId = `sub_fixture_${token()}`;
    const cancelInvoiceId = `in_fixture_${token()}`;
    cancelRetry.eventIds.push(cancelEventId);
    const cancelStripe = mockStripe(cancelSubscriptionId);
    cancelStripe.state.leaveActive = true;
    const cancelEvent = syntheticCheckoutEvent(cancelEventId, checkoutSession({
      sessionId: `cs_fixture_${token()}`,
      customerId: cancelRetry.customerId,
      userId: cancelRetry.userId,
      mode: 'subscription',
      invoiceId: cancelInvoiceId,
      subscriptionId: cancelSubscriptionId,
    }));
    const failedCancel = await acceptVerifiedStripeEvent(cancelEvent, { stripe: cancelStripe.stripe });
    assert.equal(failedCancel.outcome, 'failed');
    assert.match(failedCancel.message ?? '', /Subscription cancellation was not confirmed/);
    assert.equal((await eventRow(cancelEventId)).status, 'failed');
    assert.equal((await eventRow(cancelEventId)).attempt_count, 1);
    assert.equal((await archiveRows(cancelRetry.userId)).length, 0);
    await assertAccountStaysDeleted(cancelRetry.userId, cancelRetry.completedAt);
    cancelStripe.state.leaveActive = false;
    const retriedCancel = await acceptVerifiedStripeEvent(cancelEvent, { stripe: cancelStripe.stripe });
    assert.equal(retriedCancel.outcome, 'completed');
    assert.equal(cancelStripe.status(), 'canceled');
    assert.equal((await eventRow(cancelEventId)).status, 'completed');
    assert.equal((await eventRow(cancelEventId)).attempt_count, 2);
    assert.equal((await archiveRows(cancelRetry.userId)).filter((row) => row.source_id === cancelInvoiceId).length, 1);
    const duplicateCancel = await acceptVerifiedStripeEvent(cancelEvent, { stripe: cancelStripe.stripe });
    assert.equal(duplicateCancel.outcome, 'duplicate');
    assert.equal((await eventRow(cancelEventId)).attempt_count, 2);
    assert.equal((await archiveRows(cancelRetry.userId)).filter((row) => row.kind === 'invoice').length, 1);

    const archiveRetry = await openFixture();
    const archiveEventId = `evt_fixture_${token()}`;
    const archiveSubscriptionId = `sub_fixture_${token()}`;
    const archiveInvoiceId = `in_fixture_${token()}`;
    archiveRetry.eventIds.push(archiveEventId);
    const archiveStripe = mockStripe(archiveSubscriptionId);
    let archiveUnavailable = true;
    const archiveEvent = syntheticCheckoutEvent(archiveEventId, checkoutSession({
      sessionId: `cs_fixture_${token()}`,
      customerId: archiveRetry.customerId,
      userId: archiveRetry.userId,
      mode: 'subscription',
      invoiceId: archiveInvoiceId,
      subscriptionId: archiveSubscriptionId,
    }));
    const archiveDeps = {
      stripe: archiveStripe.stripe,
      recordInvoice: async (userId: string, invoice: Parameters<RecordInvoice>[1]) => {
        if (archiveUnavailable) throw new Error('archive unavailable');
        await recordDeletionInvoice(userId, invoice);
      },
    };
    const failedArchive = await acceptVerifiedStripeEvent(archiveEvent, archiveDeps);
    assert.equal(failedArchive.outcome, 'failed');
    assert.equal(failedArchive.message, 'archive unavailable');
    assert.equal(archiveStripe.status(), 'canceled');
    assert.equal(archiveStripe.calls.filter((call) => call.startsWith('cancel:')).length, 1);
    assert.equal((await eventRow(archiveEventId)).status, 'failed');
    assert.equal((await archiveRows(archiveRetry.userId)).filter((row) => row.kind === 'invoice').length, 0);
    archiveUnavailable = false;
    const retriedArchive = await acceptVerifiedStripeEvent(archiveEvent, archiveDeps);
    assert.equal(retriedArchive.outcome, 'completed');
    assert.equal(archiveStripe.calls.filter((call) => call.startsWith('cancel:')).length, 1);
    assert.equal((await eventRow(archiveEventId)).attempt_count, 2);
    const archived = (await archiveRows(archiveRetry.userId)).filter((row) => row.kind === 'invoice');
    assert.equal(archived.length, 1);
    assert.equal(archived[0]?.source_id, archiveInvoiceId);
    const archivedPayload = archived[0]?.payload as { status?: string; amount_cents?: number; amount_paid_cents?: number };
    assert.equal(archivedPayload.status, 'paid');
    assert.equal(archivedPayload.amount_cents, 200);
    assert.equal(archivedPayload.amount_paid_cents, 200);
    await assertAccountStaysDeleted(archiveRetry.userId, archiveRetry.completedAt);
    const duplicateArchive = await acceptVerifiedStripeEvent(archiveEvent, archiveDeps);
    assert.equal(duplicateArchive.outcome, 'duplicate');
    assert.equal((await archiveRows(archiveRetry.userId)).filter((row) => row.kind === 'invoice').length, 1);
    assert.equal(archiveStripe.calls.filter((call) => call.startsWith('cancel:')).length, 1);
  } finally {
    await cleanup();
    assert.equal(await preservedDigest(supabaseServer), before);
  }
});
