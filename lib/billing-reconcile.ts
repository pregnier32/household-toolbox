import { timingSafeEqual } from 'node:crypto';
import { refreshHouseholdLock } from '@/lib/billing-access';
import { syncAccountBilling } from '@/lib/billing-sync';
import { listReconcileCandidates } from '@/lib/billing-store';
import { claimStripeEvent, finishStripeEvent } from '@/lib/billing-lock';
import { processStripeEvent } from '@/lib/billing-webhook';
import { supabaseServer } from '@/lib/supabaseServer';
import { stripeServer } from '@/lib/stripe-server';
import type Stripe from 'stripe';

const STALE_MS = 60 * 60 * 1000;

export function cronAuthorization(request: Request): 'ok' | 'missing' | 'rejected' {
  const secret = process.env.CRON_SECRET?.trim() ?? '';
  if (!secret) return 'missing';
  const header = request.headers.get('authorization') ?? '';
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return 'rejected';
  return 'ok';
}

async function retryFailedEvents(): Promise<number> {
  const { data, error } = await supabaseServer
    .from('stripe_events')
    .select('stripe_event_id, type, payload')
    .eq('status', 'failed')
    .eq('livemode', false)
    .limit(50);
  if (error) throw error;
  let retried = 0;
  for (const row of data ?? []) {
    if (!row.payload || typeof row.payload !== 'object') continue;
    const event = row.payload as unknown as Stripe.Event;
    const claimed = await claimStripeEvent({
      eventId: row.stripe_event_id,
      type: row.type,
      livemode: false,
      payload: row.payload,
    });
    if (claimed.claim !== 'claimed') continue;
    try {
      await processStripeEvent(event);
      const finished = await finishStripeEvent(row.stripe_event_id, claimed.owner, 'completed', null);
      if (!finished) throw new Error('Failed event completion was not recorded.');
      retried += 1;
    } catch (cause) {
      await finishStripeEvent(row.stripe_event_id, claimed.owner, 'failed', cause instanceof Error ? cause.message : 'retry failed');
    }
  }
  return retried;
}

/**
 * Selects every household admin that has never been reconciled or was last
 * reconciled more than an hour ago. There is no maximum age, so a job that
 * did not run for days or weeks still picks those accounts up.
 * Vercel Cron on the Hobby plan can run only once per day, so this recovery
 * does not depend on an hourly schedule.
 */
export async function reconcileBilling(now = new Date()): Promise<{ scanned: number; failed: number; retriedEvents: number }> {
  stripeServer();
  const run = await supabaseServer.from('billing_reconcile_runs').insert({ status: 'running' }).select('id').single();
  if (run.error) throw run.error;
  let scanned = 0;
  let failed = 0;
  let retriedEvents = 0;
  try {
    retriedEvents = await retryFailedEvents();
    const userIds = await listReconcileCandidates(new Date(now.getTime() - STALE_MS));
    for (const userId of userIds) {
      try {
        await syncAccountBilling(userId, now);
        scanned += 1;
      } catch (error) {
        failed += 1;
        console.error('Billing reconcile failed for an account', error instanceof Error ? error.message : 'unknown');
      }
    }
    await supabaseServer.from('billing_reconcile_runs').update({
      try {
        await refreshHouseholdLock(userId, now);
      } catch (error) {
        failed += 1;
        console.error('Household tool access could not be saved', error instanceof Error ? error.message : 'unknown');
      }
      status: failed > 0 ? 'failed' : 'completed',
      finished_at: new Date().toISOString(),
      scanned_count: scanned,
      last_error: failed > 0 ? `${failed} account${failed === 1 ? '' : 's'} failed.` : null,
    }).eq('id', run.data.id);
    return { scanned, failed, retriedEvents };
  } catch (error) {
    await supabaseServer.from('billing_reconcile_runs').update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      scanned_count: scanned,
      last_error: error instanceof Error ? error.message.slice(0, 500) : 'Reconcile failed.',
    }).eq('id', run.data.id);
    throw error;
  }
}
