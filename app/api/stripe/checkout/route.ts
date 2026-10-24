import { NextResponse } from 'next/server';
import { getHouseholdDataSession } from '@/lib/session';
import { startCheckout } from '@/lib/billing-sync';
import { stripeConfigured } from '@/lib/stripe-server';

export async function POST(request: Request) {
  const user = await getHouseholdDataSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.householdRole !== 'admin') return NextResponse.json({ error: 'Only the household Admin can set up payment.' }, { status: 403 });
  if (!stripeConfigured()) return NextResponse.json({ error: 'Sandbox payments are not configured.' }, { status: 503 });
  try {
    const origin = new URL(request.url).origin;
    const result = await startCheckout(user.id, origin);
    if (result.kind === 'none') return NextResponse.json({ error: 'No payment is due.' }, { status: 400 });
    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error('Checkout failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Payment setup could not be started.' }, { status: 500 });
  }
}
