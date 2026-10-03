'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AccountNotices } from '@/app/components/notices/AccountNotices';

export default function NoticesPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((response) => response.json())
      .then((data) => {
        if (!data.user) {
          router.push('/');
          return;
        }
        const name = `${data.user.firstName || ''} ${data.user.lastName || ''}`.trim();
        setUserName(name || 'Account');
      })
      .catch(() => {
        router.push('/');
      });
  }, [router]);

  if (!userName) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-4xl px-4 py-8 text-slate-400">Loading notices...</div>
      </main>
    );
  }

  return <AccountNotices userName={userName} />;
}
