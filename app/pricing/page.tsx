'use client';

import { useRouter } from 'next/navigation';
import { HelpMenu } from '../components/HelpMenu';
import { SideLogo } from '../components/SideLogo';
import { PublicFooter } from '../components/public/PublicFooter';

export default function Pricing() {
  const router = useRouter();
  const money = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  const extraToolPrice = 2;
  const extraStoragePrice = 1;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <button
              onClick={() => router.push('/')}
              className="flex items-center"
            >
              <SideLogo priority />
            </button>
          </div>

          <nav className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-sm text-slate-300">
            <button
              onClick={() => router.push('/')}
              className="hover:text-emerald-300 transition-colors"
            >
              Home
            </button>
            <button
              onClick={() => router.push('/tools')}
              className="hover:text-emerald-300 transition-colors"
            >
              Tools
            </button>
            <HelpMenu />
          </nav>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">
            Simple, Transparent Pricing
          </p>
          <h1 className="mt-2 text-4xl font-semibold text-slate-50 mb-4">
            Affordable tools for your household
          </h1>
          <p className="mt-2 max-w-2xl mx-auto text-sm text-slate-300">
            Your first two tools are free. Each tool after that is {money(extraToolPrice)} a month.
            Storage is included with your plan, and you can add more when you need it.
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 max-w-3xl mx-auto">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-50 mb-4">
              How pricing works
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20">
                    <svg className="h-4 w-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    Your first 2 tools are free
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Choose any two tools and use them with no monthly charge. This is the free plan,
                    and it includes <span className="font-semibold text-emerald-300">200MB</span> of storage.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20">
                    <svg className="h-4 w-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    Additional tools are {money(extraToolPrice)} a month
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Each tool after the first two is{' '}
                    <span className="font-semibold text-emerald-300">{money(extraToolPrice)}</span> per month.
                    Adding a paid tool moves you to the paid plan, which includes{' '}
                    <span className="font-semibold text-emerald-300">1GB</span> of storage.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20">
                    <svg className="h-4 w-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    Extra storage is {money(extraStoragePrice)} a month per GB
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Need more room for files? Add storage in 1GB blocks at{' '}
                    <span className="font-semibold text-emerald-300">{money(extraStoragePrice)}</span> per
                    month for each GB. That charge is on top of any paid tools.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20">
                    <svg className="h-4 w-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    Up to 4 Users included at no extra charge
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Share your account with family members, roommates, or partners.
                    Invite up to 4 Users to use your household tools and records at no extra charge.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20">
                    <svg className="h-4 w-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    Cancel anytime, no questions asked
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    No long-term contracts or commitments. Cancel individual tools or your entire account 
                    at any time with just a few clicks. Your data remains accessible during your billing period.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-700">
            <div className="bg-slate-800/50 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-slate-100 mb-3">
                Example monthly cost
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-4 text-slate-300">
                  <span>2 tools, free plan</span>
                  <span className="shrink-0 text-right font-medium text-emerald-300">{money(0)} · 200MB</span>
                </div>
                <div className="flex justify-between gap-4 text-slate-300">
                  <span>4 tools, paid plan</span>
                  <span className="shrink-0 text-right font-medium text-emerald-300">{money(extraToolPrice * 2)} · 1GB</span>
                </div>
                <div className="flex justify-between gap-4 border-t border-slate-700 pt-3 text-slate-300">
                  <span>4 tools plus 1 extra GB</span>
                  <span className="shrink-0 text-right font-semibold text-emerald-300">
                    {money(extraToolPrice * 2 + extraStoragePrice)} · 2GB
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-4">
                The first two tools are free. Each tool after that is {money(extraToolPrice)} per month,
                and that is when the included storage becomes 1GB. Extra storage is {money(extraStoragePrice)} per
                month for each additional GB. Prices are billed monthly.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <p className="text-sm text-emerald-200 text-center">
              <strong>Start with two free tools.</strong> Add more at {money(extraToolPrice)} a month
              each, and add storage at {money(extraStoragePrice)} a month per GB when you need the room.
            </p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-12 text-center">
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
          >
            Get Started
          </button>
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-4 pb-12 sm:px-6 lg:px-8">
        <PublicFooter />
      </div>
    </main>
  );
}

