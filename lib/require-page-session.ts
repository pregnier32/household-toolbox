import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

/** Same signed-in gate Dashboard uses: no valid session → `/` auth page. */
export async function requirePageSession() {
  const user = await getSession();
  if (!user) {
    redirect('/');
  }
  return user;
}
