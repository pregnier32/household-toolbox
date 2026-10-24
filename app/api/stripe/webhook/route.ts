import { NextResponse } from 'next/server';
import { claimStripeEvent, finishStripeEvent } from '@/lib/billing-lock';
import { processStripeEvent } from '@/lib/billing-webhook';
import { stripeConfigured, stripeServer } from '@/lib/stripe-server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? '';
  if (!secret || !stripeConfigured()) {
    return NextResponse.json({ error: 'Stripe webhook is not configured for sandbox.' }, { status: 503 });
  }
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');
  let event;
  try {
    event = stripeServer().webhooks.constructEvent(body, signature ?? '', secret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }
  if (event.livemode) return NextResponse.json({ received: true });
  const claimed = await claimStripeEvent({
    eventId: event.id,
    type: event.type,
    livemode: false,
    payload: event,
  });
  if (claimed.claim === 'completed') return NextResponse.json({ received: true });
  if (claimed.claim === 'busy') return NextResponse.json({ error: 'Event is already processing.' }, { status: 500 });
  try {
    await processStripeEvent(event);
    const finished = await finishStripeEvent(event.id, claimed.owner, 'completed', null);
    if (!finished) throw new Error('Event completion was not recorded.');
    return NextResponse.json({ received: true });
  } catch (error) {
    await finishStripeEvent(event.id, claimed.owner, 'failed', error instanceof Error ? error.message : 'Webhook failed.');
    console.error('Stripe webhook failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
