import { NextRequest, NextResponse } from 'next/server';
import { syncAccountBilling } from '@/lib/billing-sync';
import { getHouseholdDataSession } from '@/lib/session';
import { getUserStorageQuota, includePaidStorageAllowance, purchaseStorageGigabyte } from '@/lib/user-storage';

export async function GET(request: NextRequest) {
  const user = await getHouseholdDataSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const refresh = request.nextUrl.searchParams.get('refresh') === '1';

  try {
    const storage = await getUserStorageQuota(user.id, { refresh });
    return NextResponse.json({ storage });
  } catch (error) {
    console.error('GET /api/account/storage:', error);
    return NextResponse.json({ error: 'Failed to load storage usage' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getHouseholdDataSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.householdRole !== 'admin') {
    return NextResponse.json({ error: 'Only the household Admin can change storage.' }, { status: 403 });
  }

  let action = '';
  try {
    const body = await request.json() as { action?: unknown };
    action = typeof body.action === 'string' ? body.action : '';
  } catch {
    return NextResponse.json({ error: 'Request could not be read.' }, { status: 400 });
  }

  try {
    if (action === 'include-paid') {
      const storage = await includePaidStorageAllowance(user.id);
      if (!storage) {
        return NextResponse.json({
          error: 'The 1 GB included allowance comes with a paid account.',
          needsPaidPlan: true,
        }, { status: 409 });
      }
      return NextResponse.json({ storage });
    }

    if (action !== 'add-gigabyte') {
      return NextResponse.json({ error: 'Unknown storage change.' }, { status: 400 });
    }

    const storage = await purchaseStorageGigabyte(user.id);
    let billingSynced = true;
    try {
      await syncAccountBilling(user.id);
    } catch (error) {
      billingSynced = false;
      console.error('Storage billing sync failed', error instanceof Error ? error.message : 'unknown');
    }
    return NextResponse.json({ storage, billingSynced });
  } catch (error) {
    console.error('POST /api/account/storage:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Storage could not be updated.' }, { status: 500 });
  }
}
