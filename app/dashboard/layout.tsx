import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  
  if (!user) {
    redirect('/');
  }

  return <>{children}</>;
}

export const dynamic = 'force-dynamic';

