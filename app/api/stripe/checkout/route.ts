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

function paymentResponse(result: { url: string | null; kind: string; explanation: string }) {
  if (result.kind === 'checkout' || result.kind === 'portal') {
    if (!result.url) return NextResponse.json({ error: 'Payment setup could not be started.' }, { status: 500 });
    return NextResponse.json({ url: result.url });
  }
  return NextResponse.json({ refresh: true, explanation: result.explanation }, { status: 409 });
}

export async function POST(request: Request) {
  const user = await getHouseholdDataSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.householdRole !== 'admin') return NextResponse.json({ error: 'Only the household Admin can set up payment.' }, { status: 403 });
  const body = await expectationFrom(request);
  if (body && 'error' in body && body.error) return body.error;
  try {
    const origin = new URL(request.url).origin;
    const result = await beginPayment(user.id, origin, 'checkout', body && 'expected' in body ? body.expected : null);
    return paymentResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'Sandbox payments are not configured.' || message === 'Live payments are not configured.' || message === 'Live billing storage is not ready.' || message === 'New charges are disabled. Existing billing remains active.' || message === 'This household has live billing records. Test mode will not create a customer or charge.') {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    console.error('Checkout failed', message || 'unknown');
    return NextResponse.json({ error: 'Payment setup could not be started.' }, { status: 500 });
  }
}
