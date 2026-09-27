import { redirect } from 'next/navigation';
import { getSessionGate } from '@/lib/session';
import { privatePageMetadata } from '@/lib/public-site';
import { MfaChallengeClient } from './MfaChallengeClient';

export const dynamic = 'force-dynamic';
export const metadata = privatePageMetadata();

export default async function MfaChallengePage() {
  const gate = await getSessionGate();
  if (gate.status === 'anonymous') {
    redirect('/');
  }
  if (gate.status === 'ok') {
    redirect('/dashboard');
  }
  return <MfaChallengeClient checkFailed={gate.status === 'mfa_unknown'} />;
}
