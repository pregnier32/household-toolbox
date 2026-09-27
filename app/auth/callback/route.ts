import { NextResponse } from 'next/server';
import { createSupabaseAuthServerClient } from '@/lib/supabaseAuthServer';

export const dynamic = 'force-dynamic';

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/';
  }
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const nextPath = safeNextPath(url.searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(new URL(nextPath, url.origin));
  }

  const supabase = await createSupabaseAuthServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('Auth callback exchange failed', error.code);
    const failed = nextPath.startsWith('/reset-password')
      ? '/reset-password?error=expired'
      : '/?auth=expired';
    return NextResponse.redirect(new URL(failed, url.origin));
  }

  return NextResponse.redirect(new URL(nextPath, url.origin));
}
