import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { listDiscountCodes, savePromotion } from '@/lib/promotion-service';
import { normalizeDiscountDraft } from '@/lib/discount-codes';

async function requireSuperadmin() {
  const user = await getSession();
  if (!user) return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.userStatus !== 'superadmin') return { user: null, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user, response: null };
}

export async function GET() {
  const gate = await requireSuperadmin();
  if (gate.response) return gate.response;
  try {
    const codes = await listDiscountCodes();
    return NextResponse.json({ codes });
  } catch (error) {
    console.error('Promotion list failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Discount codes could not be loaded.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireSuperadmin();
  if (gate.response || !gate.user) return gate.response;
  try {
    const body = await request.json();
    const result = await savePromotion(gate.user.actorId, normalizeDiscountDraft(body.draft));
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Promotion create failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'That discount code could not be saved.' }, { status: 500 });
  }
}
