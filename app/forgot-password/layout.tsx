import type { Metadata } from 'next';
import { privatePageMetadata } from '@/lib/public-site';

export const metadata: Metadata = privatePageMetadata();

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
