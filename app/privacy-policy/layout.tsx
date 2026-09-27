import type { Metadata } from 'next';
import { publicMetadata } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Privacy Policy | Household Toolbox',
  description: 'How Household Toolbox handles account information and the household records you store.',
  path: '/privacy-policy',
});

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
