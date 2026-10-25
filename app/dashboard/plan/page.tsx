'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlanBilling, type PlanLoadSeed } from '@/app/components/plan/PlanBilling';

function planRequestUrl(): string {
  const checkout = new URLSearchParams(window.location.search).get('checkout');
  return checkout === 'success' ? '/api/account/plan?checkout=success' : '/api/account/plan';
}

export default function PlanBillingPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [seed, setSeed] = useState<PlanLoadSeed>({ status: 'loading', plan: null });

  useEffect(() => {
    fetch(planRequestUrl(), { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          setSeed({ status: 'error', plan: null });
          return;
        }
        setSeed({ status: 'ready', plan: data });
      })
      .catch(() => setSeed({ status: 'error', plan: null }));

    fetch('/api/auth/session')
      .then((response) => response.json())
      .then((data) => {
        if (!data.user) {
          router.push('/?next=/dashboard/plan');
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
        router.push('/?next=/dashboard/plan');
      });
  }, [router]);

  if (!userName) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-4xl px-4 py-8 text-slate-400">Loading plan and billing...</div>
      </main>
    );
  }

  return <PlanBilling userName={userName} seed={seed} />;
}
