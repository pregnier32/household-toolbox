import { NextResponse } from 'next/server';
import { getHouseholdDataSession } from '@/lib/session';
import { beginPayment } from '@/lib/billing-sync';
import { parsePaymentExpectation } from '@/lib/billing-payment-workflow';

async function expectationFrom(request: Request) {
  const raw = await request.text();
  if (!raw.trim()) return null;
  try {
    const parsed = parsePaymentExpectation(JSON.parse(raw));
    if (!parsed) return { error: NextResponse.json({ error: 'Payment request could not be read.' }, { status: 400 }) };
    return { expected: parsed };
  } catch {
    return { error: NextResponse.json({ error: 'Payment request could not be read.' }, { status: 400 }) };
  }
}

export async function POST(request: Request) {
  const user = await getHouseholdDataSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.householdRole !== 'admin') return NextResponse.json({ error: 'Only the household Admin can manage payment.' }, { status: 403 });
  const body = await expectationFrom(request);
  if (body && 'error' in body && body.error) return body.error;
  try {
    const origin = new URL(request.url).origin;
    const result = await beginPayment(user.id, origin, 'portal', body && 'expected' in body ? body.expected : null);
    if (result.kind === 'portal' && result.url) return NextResponse.json({ url: result.url });
    if (result.kind === 'portal') return NextResponse.json({ error: 'Payment management could not be opened.' }, { status: 500 });
    return NextResponse.json({ refresh: true, explanation: result.explanation }, { status: 409 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'Sandbox payments are not configured.' || message === 'Live payments are not configured.' || message === 'Live billing storage is not ready.') {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    console.error('Customer portal failed', message || 'unknown');
    return NextResponse.json({ error: 'Payment management could not be opened.' }, { status: 500 });
  }
}
