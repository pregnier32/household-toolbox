import { NextResponse } from 'next/server';
import { acceptVerifiedStripeEvent } from '@/lib/billing-webhook';
import { assertConfiguredStripe, paymentsConfigurationError, stripeConfigured, stripeServer } from '@/lib/stripe-server';
import { webhookDisposition } from '@/lib/stripe-mode';
import { liveBillingStorageReady } from '@/lib/billing-environment';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET?.trim() || !stripeConfigured()) {
    return NextResponse.json({ error: paymentsConfigurationError() }, { status: 503 });
  }
  const body = await request.text();
  const signature = request.headers.get('stripe-signature') ?? '';
  let event;
  let verifiedWithIgnoredSecret = false;
  try {
    event = stripeServer().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET.trim());
  } catch {
    const ignored = process.env.STRIPE_IGNORED_WEBHOOK_SECRET?.trim() ?? '';
    if (!ignored) return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
    try {
      event = stripeServer().webhooks.constructEvent(body, signature, ignored);
      verifiedWithIgnoredSecret = true;
    } catch {
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
    }
  }
  const action = webhookDisposition({
    verifiedWithIgnoredSecret,
    eventLivemode: event.livemode,
    eventAccount: typeof event.account === 'string' ? event.account : null,
  });
  if (action === 'ignore') return NextResponse.json({ received: true });
  try {
    await assertConfiguredStripe();
    if (!(await liveBillingStorageReady())) throw new Error('Live billing storage is not ready.');
  } catch (error) {
    console.error('Stripe mode check failed', error instanceof Error ? error.message : 'unknown');
    const message = error instanceof Error && error.message === 'Live billing storage is not ready.'
      ? error.message
      : paymentsConfigurationError();
    return NextResponse.json({ error: message }, { status: 503 });
  }
  const accepted = await acceptVerifiedStripeEvent(event);
  if (accepted.outcome === 'duplicate' || accepted.outcome === 'completed') return NextResponse.json({ received: true });
  if (accepted.outcome === 'failed') console.error('Stripe webhook failed', accepted.message ?? 'unknown');
  const error = accepted.outcome === 'busy' ? 'Event is already processing.' : 'Webhook processing failed.';
  return NextResponse.json({ error }, { status: 500 });
}
