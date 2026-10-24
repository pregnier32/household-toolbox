import { NextResponse } from 'next/server';
import { cronAuthorization, reconcileBilling } from '@/lib/billing-reconcile';
import { stripeConfigured } from '@/lib/stripe-server';

export const runtime = 'nodejs';

/**
 * Vercel Cron calls this route with GET on the production deployment only.
 * Hobby plans accept a daily schedule and may run it any time during that hour.
 * Pro plans can use a more frequent schedule. Authorization is the Bearer
 * CRON_SECRET header Vercel sends when that variable is set on the project.
 */
async function handle(request: Request) {
  const authorization = cronAuthorization(request);
  if (authorization === 'missing') return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
  if (authorization === 'rejected') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!stripeConfigured()) return NextResponse.json({ error: 'Sandbox payments are not configured.' }, { status: 503 });
  try {
    const result = await reconcileBilling();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Billing reconcile failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Billing reconcile failed.' }, { status: 500 });
  }
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
