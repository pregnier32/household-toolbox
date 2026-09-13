import { requirePageSession } from '@/lib/require-page-session';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageSession();

  return <>{children}</>;
}

export const dynamic = 'force-dynamic';

