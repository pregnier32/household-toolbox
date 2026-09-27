import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { privatePageMetadata } from '@/lib/public-site';
import { AuthTestClient } from './AuthTestClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = privatePageMetadata();

export default function AuthTestPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return <AuthTestClient />;
}
