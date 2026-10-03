import type { Metadata } from 'next';
import { publicMetadata } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Support | Household Toolbox',
  description: 'Contact Household Toolbox support, or read answers to common questions about accounts and tools.',
  path: '/support',
});

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
