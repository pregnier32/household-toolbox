'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlanBilling } from '@/app/components/plan/PlanBilling';

export default function PlanBillingPage() {
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
        if (data.user.householdRole === 'user') {
          router.replace('/dashboard');
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
        <div className="mx-auto max-w-4xl px-4 py-8 text-slate-400">Loading plan and billing...</div>
      </main>
    );
  }

  return <PlanBilling userName={userName} />;
}
