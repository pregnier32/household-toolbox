import type { Metadata } from 'next';
import { publicMetadata } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'FAQ | Household Toolbox',
  description: 'Answers to common questions about Household Toolbox, accounts, and how the household tools fit together.',
  path: '/faq',
});

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
