import { redirect } from 'next/navigation';
import { requirePageSession } from '@/lib/require-page-session';

export default async function ToolboxRedirectPage() {
  await requirePageSession();
  redirect('/dashboard?tab=tools');
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
