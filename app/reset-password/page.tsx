'use client';

import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { resetPassword } from '../actions/auth';

export default function ResetPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (!tokenParam) {
      setError('Invalid reset link. Please request a new password reset.');
    } else {
      setToken(tokenParam);
    }
  }, [searchParams]);

  if (!token) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
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
          </header>

          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-md">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 shadow-2xl shadow-emerald-500/10">
                {error && (
                  <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    {error}
                  </div>
                )}
                <Link
                  href="/forgot-password"
                  className="block w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-center text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
                >
                  Request New Reset Link
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

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
                Reset Your Password
              </h1>
              <p className="mb-6 text-sm text-slate-400">
                Enter your new password below.
              </p>

              {error && (
                <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </div>
              )}

              {success ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                    Your password has been reset successfully! You can now sign in with your new password.
                  </div>
                  <Link
                    href="/"
                    className="block w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-center text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
                  >
                    Sign In
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
                    const newPassword = formData.get('newPassword') as string;
                    const confirmPassword = formData.get('confirmPassword') as string;

                    const result = await resetPassword({
                      token: token!,
                      newPassword,
                      confirmPassword,
                    });
                    setIsLoading(false);

                    if (result.success) {
                      setSuccess(true);
                      formRef.current?.reset();
                      // Redirect to home page after 3 seconds
                      setTimeout(() => {
                        router.push('/');
                      }, 3000);
                    } else {
                      setError(result.error || 'Failed to reset password');
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label htmlFor="newPassword" className="block text-xs font-medium text-slate-300 mb-1.5">
                      New Password <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="password"
                      id="newPassword"
                      name="newPassword"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      placeholder="••••••••"
                      required
                      disabled={isLoading}
                      minLength={8}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Must be at least 8 characters long
                    </p>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-xs font-medium text-slate-300 mb-1.5">
                      Confirm Password <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      placeholder="••••••••"
                      required
                      disabled={isLoading}
                      minLength={8}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? 'Resetting...' : 'Reset Password'}
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

