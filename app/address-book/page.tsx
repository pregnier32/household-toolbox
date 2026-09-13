import { redirect } from 'next/navigation';
import { requirePageSession } from '@/lib/require-page-session';

export default async function AddressBookRedirectPage() {
  await requirePageSession();
  redirect('/dashboard?tab=tools&open=address-book');
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
