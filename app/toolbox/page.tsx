import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

export default async function ToolboxRedirectPage() {
  const user = await getSession();
  if (!user) {
    redirect('/');
  }
  redirect('/dashboard?tab=tools');
}

export const dynamic = 'force-dynamic';
