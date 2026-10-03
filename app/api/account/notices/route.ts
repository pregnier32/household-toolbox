import { NextRequest, NextResponse } from 'next/server';
import { getHouseholdDataSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import { persistAccountNotices } from '@/lib/promotion-service';

export async function GET() {
  const user = await getHouseholdDataSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await persistAccountNotices(user.id, new Date());
    const { data, error } = await supabaseServer
      .from('account_notices')
      .select('id, kind, severity, title, body, href, created_at, read_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ notices: data ?? [] });
  } catch (error) {
    console.error('Notice list failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Notices could not be loaded.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getHouseholdDataSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const now = new Date().toISOString();
    if (body.all) {
      const updated = await supabaseServer.from('account_notices').update({ read_at: now }).eq('user_id', user.id).is('read_at', null);
      if (updated.error) throw updated.error;
      return NextResponse.json({ ok: true });
    }
    if (!body.id) return NextResponse.json({ error: 'A notice is required.' }, { status: 400 });
    const updated = await supabaseServer.from('account_notices').update({ read_at: now }).eq('id', body.id).eq('user_id', user.id);
    if (updated.error) throw updated.error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Notice update failed', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'That notice could not be updated.' }, { status: 500 });
  }
}
