import { requirePageSession } from '@/lib/require-page-session';
import type { Metadata } from 'next';
import { privatePageMetadata } from '@/lib/public-site';

export const metadata: Metadata = privatePageMetadata();

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageSession();

  return <>{children}</>;
}

export const dynamic = 'force-dynamic';

