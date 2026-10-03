import { NextRequest, NextResponse } from 'next/server';
import { getHouseholdDataSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { assignPromotion } from '@/lib/promotion-service';

export async function POST(request: NextRequest) {
  const user = await getHouseholdDataSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.householdRole !== 'admin') return NextResponse.json({ error: 'Only the household Admin can apply a code.' }, { status: 403 });
  try {
    const body = await request.json();
    const code = String(body.code || '').trim().toLowerCase().replace(/[%_]/g, '');
    if (!code) return NextResponse.json({ error: 'Enter a discount code.' }, { status: 400 });
    const { data, error } = await supabaseServer.from('promotions').select('id, public_code').ilike('public_code', code).maybeSingle();
    if (error) {
      console.error('Code lookup failed', error.message);
      return NextResponse.json({ error: 'That code could not be applied. Please try again.' }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'That code was not found.' }, { status: 400 });
    const result = await assignPromotion({
      userId: user.id,
      promotionId: data.id,
      source: 'user_entered',
      assignedBy: null,
      effectiveAt: new Date().toISOString(),
      override: false,
      note: null,
      signup: false,
    });
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
    return NextResponse.json({
      ok: true,
      displayName: result.displayName,
      publicCode: result.publicCode,
      description: result.customerDescription,
      effectiveAt: result.effectiveAt,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    console.error('Code redemption failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'That code could not be applied. Please try again.' }, { status: 500 });
  }
}
