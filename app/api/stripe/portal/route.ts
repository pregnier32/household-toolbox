import { NextResponse } from 'next/server';
import { getHouseholdDataSession } from '@/lib/session';
import { startPortal } from '@/lib/billing-sync';
import { stripeConfigured } from '@/lib/stripe-server';

export async function POST(request: Request) {
  const user = await getHouseholdDataSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.householdRole !== 'admin') return NextResponse.json({ error: 'Only the household Admin can manage payment.' }, { status: 403 });
  if (!stripeConfigured()) return NextResponse.json({ error: 'Sandbox payments are not configured.' }, { status: 503 });
  try {
    const origin = new URL(request.url).origin;
    const url = await startPortal(user.id, origin);
    return NextResponse.json({ url });
  } catch (error) {
    console.error('Customer portal failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Payment management could not be opened.' }, { status: 500 });
  }
}
