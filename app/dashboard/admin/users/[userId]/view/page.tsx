'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { BillingPreviewClient } from '@/app/components/admin/billing-preview/BillingPreviewClient';

function CustomerViewPage() {
  const params = useParams<{ userId: string }>();
  const userId = typeof params.userId === 'string' ? params.userId : '';
  return <BillingPreviewClient userId={userId} mode="customer" />;
}

export default function Page() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-400">Loading customer preview...</main>}>
      <CustomerViewPage />
    </Suspense>
  );
}
