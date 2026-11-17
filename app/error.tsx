'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { statusPrimaryClass, statusSecondaryClass, StatusPage } from './components/StatusPage';
import { sendPageError } from './components/send-page-error';

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    sendPageError(error);
  }, [error.digest, error.message]);

  return (
    <StatusPage
      title="Something went wrong"
      body="This page could not be opened. Try again, or go back home."
    >
      <button type="button" className={statusPrimaryClass} onClick={() => retry()}>
        Try again
      </button>
      <Link href="/" className={statusSecondaryClass}>
        Go home
      </Link>
    </StatusPage>
  );
}
