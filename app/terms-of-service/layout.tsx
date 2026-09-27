import type { Metadata } from 'next';
import { publicMetadata } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Terms of Service | Household Toolbox',
  description: 'The terms of service for using Household Toolbox.',
  path: '/terms-of-service',
});

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
