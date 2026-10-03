import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { privatePageMetadata } from '@/lib/public-site';
import { ManageUsersClient } from './ManageUsersClient';

export const dynamic = 'force-dynamic';
export const metadata = privatePageMetadata();

export default async function ManageUsersPage() {
  const user = await getSession();
  if (!user) redirect('/');
  if (user.householdRole !== 'admin') redirect('/dashboard');
  return <ManageUsersClient householdReady={user.householdReady} />;
}
