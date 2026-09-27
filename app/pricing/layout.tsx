import type { Metadata } from 'next';
import { publicMetadata } from '@/lib/public-site';

export const metadata: Metadata = publicMetadata({
  title: 'Pricing | Household Toolbox',
  description:
    'Your first two Household Toolbox tools are free. Each tool after that is $2 a month, with storage included on the free and paid plans.',
  path: '/pricing',
});

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
