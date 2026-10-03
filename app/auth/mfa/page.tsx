import { redirect } from 'next/navigation';
import { getSessionGate } from '@/lib/session';
import { privatePageMetadata } from '@/lib/public-site';
import { MfaChallengeClient } from './MfaChallengeClient';

export const dynamic = 'force-dynamic';
export const metadata = privatePageMetadata();

function safeInviteNext(value: string | undefined): string {
  if (!value || !value.startsWith('/invite/') || value.startsWith('//') || value.includes('\\')) return '/dashboard';
  return value;
}

export default async function MfaChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const nextPath = safeInviteNext((await searchParams).next);
  const gate = await getSessionGate();
  if (gate.status === 'anonymous') {
    redirect('/');
  }
  if (gate.status === 'ok') {
    redirect(nextPath);
  }
  return <MfaChallengeClient checkFailed={gate.status === 'mfa_unknown'} nextPath={nextPath} />;
}
