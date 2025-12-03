'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { HelpMenu } from '../components/HelpMenu';

export default function Pricing() {
  const router = useRouter();
  const [platformFee, setPlatformFee] = useState<number>(5.00);

  useEffect(() => {
    const loadPlatformFee = async () => {
      try {
        const response = await fetch('/api/billing/platform-fee');
        const data = await response.json();
        if (response.ok && data.amount) {
          setPlatformFee(Number(data.amount));
        }
      } catch (err) {
        console.error('Error loading platform fee:', err);
        // Keep default value of $5.00
      }
    };
    
    loadPlatformFee();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <button
              onClick={() => router.push('/')}
              className="flex items-center"
            >
              <Image
                src="/images/logo/Logo_Side_White.png"
                alt="Household Toolbox"
                width={200}
                height={40}
                className="h-auto"
                priority
              />
            </button>
          </div>

          <nav className="hidden gap-6 text-sm text-slate-300 sm:flex items-center">
            <button
              onClick={() => router.push('/')}
              className="hover:text-emerald-300 transition-colors"
            >
              Home
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
            Pay only for what you use. No hidden fees, no long-term contracts. 
            Cancel anytime, and invite up to 4 guests at no extra cost.
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
                    Low monthly platform fee
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Just <span className="font-semibold text-emerald-300">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(platformFee)}
                    </span> per month when you have at least one active tool. No platform fee if you have no active tools.
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
                    Pay only for the tools you use
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Each tool has its own monthly subscription fee. Most tools range from{' '}
                    <span className="font-semibold text-emerald-300">$1 - $3</span> per month, making it incredibly affordable. 
                    Activate only the tools you need, and you'll only be charged for those. No need to pay for features you don't use.
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
                    7-day free trial on every tool
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Try any tool risk-free for 7 days. No charges during the trial period. 
                    You can cancel before the trial ends with no obligation.
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
                    Up to 4 guests included at no extra charge
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Share your account with family members, roommates, or partners. 
                    Invite up to 4 guests to collaborate on your household management—completely free.
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
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-300">
                  <span>Platform Fee</span>
                  <span className="font-medium text-emerald-300">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(platformFee)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Active Tool Subscriptions (most tools $1-$3/month)</span>
                  <span className="font-medium text-slate-200">$2-$6</span>
                </div>
                <div className="flex justify-between text-slate-300 pt-2 border-t border-slate-700">
                  <span className="font-medium text-slate-100">Total Monthly Cost</span>
                  <span className="font-semibold text-emerald-300">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(platformFee + 2)} - {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(platformFee + 6)}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-4">
                *Example assumes 2-3 tools at typical pricing. Tool prices range from $1-$3 per month. 
                View individual tools in your dashboard to see specific pricing. All prices are per month, 
                billed on the same date each month. You only pay for tools you actively use.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <p className="text-sm text-emerald-200 text-center">
              <strong>Start free today.</strong> No credit card required to sign up. 
              Try any tool for 7 days, then pay only if you decide to keep it.
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
    </main>
  );
}

