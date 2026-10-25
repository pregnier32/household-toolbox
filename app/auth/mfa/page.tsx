import { redirect } from 'next/navigation';
import { PLAN_BILLING_PATH, resumeAfterAuth } from '@/lib/auth-app-origin';
import { getSessionGate } from '@/lib/session';
import { privatePageMetadata } from '@/lib/public-site';
import { MfaChallengeClient } from './MfaChallengeClient';

export const dynamic = 'force-dynamic';
export const metadata = privatePageMetadata();

export default async function MfaChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const nextPath = resumeAfterAuth((await searchParams).next);
  const gate = await getSessionGate();
  if (gate.status === 'anonymous') {
    redirect(nextPath === PLAN_BILLING_PATH ? `/?next=${encodeURIComponent(PLAN_BILLING_PATH)}` : '/');
  }
  if (gate.status === 'ok') {
    redirect(nextPath);
  }
  return <MfaChallengeClient checkFailed={gate.status === 'mfa_unknown'} nextPath={nextPath} />;
}
