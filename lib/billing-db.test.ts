import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module from 'node:module';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import Stripe from 'stripe';

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

test('per-account leases, webhook completion, and operation recovery use the service-role client', { skip: databaseReady ? false : databaseSkip }, async (t) => {
  const { supabaseServer } = await import('./supabaseServer');
  const { claimBillingLock, releaseBillingLock, claimStripeEvent, finishStripeEvent } = await import('./billing-lock');
  const { recoverBillingOperations } = await import('./billing-sync');
  const { listReconcileCandidates } = await import('./billing-store');

  const user = await supabaseServer.from('users').select('id').limit(1).maybeSingle();
  if (user.error) throw user.error;
  if (!user.data?.id) {
    t.skip('No user row is available for the lock test.');
    return;
  }
  const userId = user.data.id;
  const existing = await supabaseServer
    .from('billing_accounts')
    .select('user_id, lock_owner, locked_until, last_reconciled_at, stripe_customer_id, stripe_subscription_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing.error && existing.error.code !== 'PGRST205' && existing.error.code !== '42P01') throw existing.error;
  if (existing.error) {
    t.skip('Billing tables are not installed.');
    return;
  }
  const heldUntil = existing.data?.locked_until ? Date.parse(existing.data.locked_until) : 0;
  if (existing.data?.lock_owner && heldUntil > Date.now()) {
    t.skip('A billing lock is already held.');
    return;
  }

  const eventId = `evt_test_${randomUUID()}`;
  const stripeInvoiceId = `in_test_${randomUUID().replace(/-/g, '')}`;
  const periodStart = '2026-10-15T15:00:00.000Z';
  try {
    const first = await claimBillingLock(userId, 'billing-test-a', 60);
    assert.equal(first, 'billing-test-a');
    const second = await claimBillingLock(userId, 'billing-test-b', 60);
    assert.equal(second, null);
    await releaseBillingLock(userId, 'billing-test-a');
    const third = await claimBillingLock(userId, 'billing-test-c', 60);
    assert.equal(third, 'billing-test-c');
    await supabaseServer.from('billing_accounts').update({ locked_until: new Date(Date.now() - 1000).toISOString() }).eq('user_id', userId);
    const recovered = await claimBillingLock(userId, 'billing-test-d', 60);
    assert.equal(recovered, 'billing-test-d');
    await releaseBillingLock(userId, 'billing-test-d');

    const claimed = await claimStripeEvent({ eventId, type: 'invoice.paid', livemode: false, payload: { id: eventId }, owner: 'event-a' });
    assert.equal(claimed.claim, 'claimed');
    const busy = await claimStripeEvent({ eventId, type: 'invoice.paid', livemode: false, payload: { id: eventId }, owner: 'event-b' });
    assert.equal(busy.claim, 'busy');
    assert.equal(await finishStripeEvent(eventId, 'event-b', 'failed', 'wrong owner'), false);
    assert.equal(await finishStripeEvent(eventId, 'event-a', 'failed', 'processing failed'), true);
    const retry = await claimStripeEvent({ eventId, type: 'invoice.paid', livemode: false, payload: { id: eventId }, owner: 'event-c' });
    assert.equal(retry.claim, 'claimed');
    assert.equal(await finishStripeEvent(eventId, 'event-c', 'completed', null), true);
    const replay = await claimStripeEvent({ eventId, type: 'invoice.paid', livemode: false, payload: { id: eventId }, owner: 'event-d' });
    assert.equal(replay.claim, 'completed');
    const stored = await supabaseServer.from('stripe_events').select('status, completed_at').eq('stripe_event_id', eventId).single();
    if (stored.error) throw stored.error;
    assert.equal(stored.data.status, 'completed');
    assert.ok(stored.data.completed_at);

    const open = await supabaseServer.from('billing_operations').select('id').eq('user_id', userId).in('status', ['started', 'stripe_succeeded']);
    if (open.error) throw open.error;
    if ((open.data ?? []).length === 0) {
    const inserted = await supabaseServer.from('billing_operations').insert({
      user_id: userId,
      idempotency_key: `test-recover:${stripeInvoiceId}`,
      kind: 'supplemental',
      status: 'stripe_succeeded',
      stripe_id: stripeInvoiceId,
      payload: { amountCents: 200, periodStart, status: 'open', amountPaidCents: 0, role: 'supplemental' },
      livemode: false,
    }).select('id').single();
    if (inserted.error) throw inserted.error;
    await supabaseServer.from('billing_accounts').update({ last_reconciled_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }).eq('user_id', userId);
    const candidates = await listReconcileCandidates(new Date(Date.now() - 48 * 60 * 60 * 1000));
    assert.equal(candidates.includes(userId), true);
    await recoverBillingOperations(userId);
    await recoverBillingOperations(userId);
    const invoices = await supabaseServer.from('billing_invoices').select('role, status, amount_cents').eq('stripe_invoice_id', stripeInvoiceId);
    if (invoices.error) throw invoices.error;
    assert.equal(invoices.data?.length, 1);
    assert.equal(invoices.data?.[0]?.role, 'supplemental');
    assert.equal(invoices.data?.[0]?.status, 'open');
    assert.equal(invoices.data?.[0]?.amount_cents, 200);
    const operation = await supabaseServer.from('billing_operations').select('status').eq('id', inserted.data.id).single();
    if (operation.error) throw operation.error;
    assert.equal(operation.data.status, 'completed');
    } else {
      t.diagnostic('Operation recovery was not run because this account already has an open billing operation.');
    }
  } finally {
    await supabaseServer.from('billing_invoices').delete().eq('stripe_invoice_id', stripeInvoiceId);
    await supabaseServer.from('billing_operations').delete().eq('idempotency_key', `test-recover:${stripeInvoiceId}`);
    await supabaseServer.from('stripe_events').delete().eq('stripe_event_id', eventId);
    if (existing.data) {
      await supabaseServer.from('billing_accounts').update({
        lock_owner: existing.data.lock_owner,
        locked_until: existing.data.locked_until,
        last_reconciled_at: existing.data.last_reconciled_at,
      }).eq('user_id', userId);
    } else {
      const created = await supabaseServer.from('billing_accounts').select('stripe_customer_id, stripe_subscription_id').eq('user_id', userId).maybeSingle();
      if (!created.error && created.data && !created.data.stripe_customer_id && !created.data.stripe_subscription_id) {
        await supabaseServer.from('billing_accounts').delete().eq('user_id', userId);
      }
    }
  }
});

test('cron authorization accepts the bearer secret on GET and rejects a missing or wrong secret', async () => {
  const previous = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  const loader = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = loader._load;
  loader._load = function (request: string, parent: unknown, isMain: boolean) {
    const normalized = request.replace(/\\/g, '/');
    if (normalized === 'server-only' || normalized.endsWith('/server-only')) return {};
    if (normalized.includes('supabaseServer')) {
      return {
        supabaseServer: {
          from() {
            throw new Error('cron authorization must not query the database');
          },
        },
      };
    }
    return originalLoad(request, parent, isMain);
  };
  try {
    const { cronAuthorization } = await import('./billing-reconcile');
    assert.equal(cronAuthorization(new Request('http://localhost/api/cron/billing-reconcile')), 'missing');
    process.env.CRON_SECRET = 'cron-test-secret';
    const url = 'http://localhost/api/cron/billing-reconcile';
    assert.equal(cronAuthorization(new Request(url, { headers: { authorization: 'Bearer cron-test-secret' } })), 'ok');
    assert.equal(cronAuthorization(new Request(url, { method: 'POST', headers: { authorization: 'Bearer cron-test-secret' } })), 'ok');
    assert.equal(cronAuthorization(new Request(url, { headers: { authorization: 'Bearer nope' } })), 'rejected');
    assert.equal(cronAuthorization(new Request(url, { headers: { authorization: 'Bearer wrong-secret-val' } })), 'rejected');
  } finally {
    loader._load = originalLoad;
    if (previous == null) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test('a non-sandbox Stripe secret is refused', async () => {
  const previous = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = 'sk_live_not_a_real_key';
  const { stripeConfigured, stripeServer } = await import('./stripe-server');
  try {
    assert.equal(stripeConfigured(), false);
    assert.throws(() => stripeServer(), /sandbox test secret key/);
  } finally {
    if (previous == null) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previous;
  }
});

test('a signed sandbox webhook is completed only after processing, and a live event is ignored', { skip: databaseReady && (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_') ? false : databaseReady ? 'Sandbox Stripe is not configured' : databaseSkip }, async (t) => {
  const previous = process.env.STRIPE_WEBHOOK_SECRET;
  const secret = 'whsec_test_only_webhook_secret_value';
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY?.trim() ?? '');
  const { POST } = await import('../app/api/stripe/webhook/route');
  const { supabaseServer } = await import('./supabaseServer');
  const eventId = `evt_test_${randomUUID()}`;
  const liveId = `evt_test_live_${randomUUID()}`;
  try {
    const tables = await supabaseServer.from('stripe_events').select('stripe_event_id').limit(1);
    if (tables.error && (tables.error.code === 'PGRST205' || tables.error.code === '42P01')) {
      t.skip('Billing tables are not installed.');
      return;
    }
    const unsigned = await POST(new Request('http://localhost/api/stripe/webhook', { method: 'POST', body: '{}' }));
    assert.equal(unsigned.status, 400);
    const livePayload = JSON.stringify({
      id: liveId,
      object: 'event',
      type: 'checkout.session.expired',
      livemode: true,
      created: Math.floor(Date.now() / 1000),
      data: { object: { id: 'cs_test_live', object: 'checkout.session' } },
    });
    const live = await POST(new Request('http://localhost/api/stripe/webhook', {
      method: 'POST',
      body: livePayload,
      headers: { 'stripe-signature': stripe.webhooks.generateTestHeaderString({ payload: livePayload, secret }) },
    }));
    assert.equal(live.status, 200);
    const liveRow = await supabaseServer.from('stripe_events').select('stripe_event_id').eq('stripe_event_id', liveId).maybeSingle();
    if (liveRow.error) throw liveRow.error;
    assert.equal(liveRow.data, null);

    const payload = JSON.stringify({
      id: eventId,
      object: 'event',
      type: 'checkout.session.expired',
      livemode: false,
      created: Math.floor(Date.now() / 1000),
      data: { object: { id: 'cs_test_expired', object: 'checkout.session' } },
    });
    const accepted = await POST(new Request('http://localhost/api/stripe/webhook', {
      method: 'POST',
      body: payload,
      headers: { 'stripe-signature': stripe.webhooks.generateTestHeaderString({ payload, secret }) },
    }));
    assert.equal(accepted.status, 200);
    const row = await supabaseServer.from('stripe_events').select('status, completed_at').eq('stripe_event_id', eventId).single();
    if (row.error) throw row.error;
    assert.equal(row.data.status, 'completed');
    assert.ok(row.data.completed_at);
    const replay = await POST(new Request('http://localhost/api/stripe/webhook', {
      method: 'POST',
      body: payload,
      headers: { 'stripe-signature': stripe.webhooks.generateTestHeaderString({ payload, secret }) },
    }));
    assert.equal(replay.status, 200);
  } finally {
    await supabaseServer.from('stripe_events').delete().eq('stripe_event_id', eventId);
    if (previous == null) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = previous;
  }
});
