import type { NextRequest } from 'next/server';
import { refreshSupabaseAuthSession } from '@/lib/supabaseAuthProxy';

export async function proxy(request: NextRequest) {
  return refreshSupabaseAuthSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
