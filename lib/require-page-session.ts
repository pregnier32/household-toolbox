import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { PLAN_BILLING_PATH } from '@/lib/auth-app-origin';
import { getSessionGate } from '@/lib/session';

/** Signed-in gate. Users who turned on an authenticator must finish that step first. */
export async function requirePageSession() {
  const gate = await getSessionGate();
  const path = (await headers()).get('x-htb-pathname');
  const resumePlan = path === PLAN_BILLING_PATH;
  if (gate.status === 'anonymous') {
    redirect(resumePlan ? `/?next=${encodeURIComponent(PLAN_BILLING_PATH)}` : '/');
  }
  if (gate.status === 'mfa_required' || gate.status === 'mfa_unknown') {
    redirect(resumePlan ? `/auth/mfa?next=${encodeURIComponent(PLAN_BILLING_PATH)}` : '/auth/mfa');
  }
  return gate.user;
}
