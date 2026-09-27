import type { Metadata } from 'next';
import { publicMetadata } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Support | Household Toolbox',
  description: 'Contact Household Toolbox support with a question, a problem, or a feature request.',
  path: '/support',
});

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
