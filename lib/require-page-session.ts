import { redirect } from 'next/navigation';
import { getSessionGate } from '@/lib/session';

/** Signed-in gate. Users who turned on an authenticator must finish that step first. */
export async function requirePageSession() {
  const gate = await getSessionGate();
  if (gate.status === 'anonymous') {
    redirect('/');
  }
  if (gate.status === 'mfa_required' || gate.status === 'mfa_unknown') {
    redirect('/auth/mfa');
  }
  return gate.user;
}
