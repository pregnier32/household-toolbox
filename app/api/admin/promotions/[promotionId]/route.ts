import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { savePromotion, setPromotionStatus } from '@/lib/promotion-service';
import { normalizeDiscountDraft, STORED_STATUSES } from '@/lib/discount-codes';

async function requireSuperadmin() {
  const user = await getSession();
  if (!user) return { user: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.userStatus !== 'superadmin') return { user: null, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user, response: null };
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ promotionId: string }> }) {
  const gate = await requireSuperadmin();
  if (gate.response || !gate.user) return gate.response;
  const { promotionId } = await context.params;
  try {
    const body = await request.json();
    if (body.status && STORED_STATUSES.includes(body.status) && !body.draft) {
      const result = await setPromotionStatus(gate.user.actorId, promotionId, body.status);
      if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    const result = await savePromotion(gate.user.actorId, normalizeDiscountDraft(body.draft), promotionId);
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Promotion update failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'That discount code could not be saved.' }, { status: 500 });
  }
}
