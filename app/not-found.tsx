import type { Metadata } from 'next';
import Link from 'next/link';
import { statusSecondaryClass, StatusPage } from './components/StatusPage';

export const metadata: Metadata = {
  title: 'Page not found',
};

export default function NotFound() {
  return (
    <StatusPage
      title="Page not found"
      body="That page is not part of Household Toolbox."
    >
      <Link href="/" className={statusSecondaryClass}>
        Go home
      </Link>
    </StatusPage>
  );
}
