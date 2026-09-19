import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUserStorageQuota } from '@/lib/user-storage';

export async function GET(request: NextRequest) {
  const user = await getSession();
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
