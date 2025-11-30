'use client';

import Image from 'next/image';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { requestPasswordReset } from '../actions/auth';

export default function ForgotPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Page wrapper */}
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
        {/* Nav */}
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center">
            <Link href="/">
              <Image
                src="/images/logo/Logo_Side_White.png"
                alt="Household Toolbox"
                width={200}
                height={40}
                className="h-auto"
                priority
              />
            </Link>
          </div>

          <nav className="hidden gap-6 text-sm text-slate-300 sm:flex items-center">
            <Link href="/" className="hover:text-emerald-300">
              Back to Home
            </Link>
          </nav>
        </header>

        {/* Main Content */}
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 shadow-2xl shadow-emerald-500/10">
              <h1 className="mb-2 text-2xl font-semibold text-slate-50">
                Forgot Password?
              </h1>
              <p className="mb-6 text-sm text-slate-400">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              {error && (
                <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </div>
              )}

              {success ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                    If an account with that email exists, we've sent you a password reset link. Please check your email.
                  </div>
                  <Link
                    href="/"
                    className="block w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-center text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
                  >
                    Back to Sign In
                  </Link>
                </div>
              ) : (
                <form
                  ref={formRef}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setError(null);
                    setIsLoading(true);

                    const form = e.currentTarget;
                    const formData = new FormData(form);
                    const email = formData.get('email') as string;

                    const result = await requestPasswordReset({ email });
                    setIsLoading(false);

                    if (result.success) {
                      setSuccess(true);
                      formRef.current?.reset();
                    } else {
                      setError(result.error || 'Failed to send reset email');
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label htmlFor="email" className="block text-xs font-medium text-slate-300 mb-1.5">
                      Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      placeholder="you@example.com"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>

                  <div className="text-center">
                    <Link
                      href="/"
                      className="text-sm text-emerald-400 hover:text-emerald-300"
                    >
                      Back to Sign In
                    </Link>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

