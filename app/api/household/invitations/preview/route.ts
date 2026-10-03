import { NextRequest, NextResponse } from 'next/server';
import { previewHouseholdInvitation } from '@/lib/household';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || '';
  try {
    const preview = await previewHouseholdInvitation(token);
    return NextResponse.json(preview);
  } catch (error) {
    console.error('GET /api/household/invitations/preview failed', error);
    return NextResponse.json({ state: 'invalid' }, { status: 500 });
  }
}
