import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

export default async function AddressBookRedirectPage() {
  const user = await getSession();
  if (!user) {
    redirect('/');
  }
  redirect('/dashboard?tab=tools&open=address-book');
}

export const dynamic = 'force-dynamic';
