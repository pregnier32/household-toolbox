import { NextResponse } from 'next/server';
import { acceptVerifiedStripeEvent } from '@/lib/billing-webhook';
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
  const accepted = await acceptVerifiedStripeEvent(event);
  if (accepted.outcome === 'duplicate' || accepted.outcome === 'completed') return NextResponse.json({ received: true });
  if (accepted.outcome === 'failed') console.error('Stripe webhook failed', accepted.message ?? 'unknown');
  const error = accepted.outcome === 'busy' ? 'Event is already processing.' : 'Webhook processing failed.';
  return NextResponse.json({ error }, { status: 500 });
}
