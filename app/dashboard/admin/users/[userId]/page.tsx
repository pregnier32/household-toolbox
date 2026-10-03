'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { UserEntitlementsAdmin } from '@/app/components/admin/user-entitlements/UserEntitlementsAdmin';

function UserEntitlementsPage() {
  const params = useParams<{ userId: string }>();
  const search = useSearchParams();
  const userId = typeof params.userId === 'string' ? params.userId : '';
  const userName = search.get('name')?.trim() || 'User';
  const userEmail = search.get('email')?.trim() || '';

  return <UserEntitlementsAdmin userId={userId} userName={userName} userEmail={userEmail} />;
}

export default function Page() {
  return (
    <Suspense
      fallback={(
        <main className="min-h-screen bg-slate-950 text-slate-100">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="text-slate-400">Loading discounts and entitlements...</div>
          </div>
        </main>
      )}
    >
      <UserEntitlementsPage />
    </Suspense>
  );
}
