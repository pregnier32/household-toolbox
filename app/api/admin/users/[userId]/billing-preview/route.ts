import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { loadBillingPreview } from '@/lib/load-billing-preview';
import { previewAccess, simulatedInstant } from '@/lib/billing-preview';

export async function GET(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const user = await getSession();
  const access = previewAccess(user?.userStatus);
  if (access === 'unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (access === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { userId } = await context.params;
  const now = new Date();
  const simulated = simulatedInstant(request.nextUrl.searchParams.get('effectiveAt'), now);
  if (!simulated) return NextResponse.json({ error: 'That date is not valid.' }, { status: 400 });
  try {
    const preview = await loadBillingPreview(userId, simulated, now);
    if (!preview) return NextResponse.json({ error: 'That account could not be loaded.' }, { status: 404 });
    return NextResponse.json(preview);
  } catch (error) {
    console.error('Billing preview failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'The billing preview could not be loaded.' }, { status: 500 });
  }
}
