'use client';

import Image from 'next/image'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signUp, signIn } from './actions/auth'
import { HelpMenu } from './components/HelpMenu'

export default function Home() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [savedEmail, setSavedEmail] = useState<string>('');
  const [signUpsDisabled, setSignUpsDisabled] = useState(false);
  const [isCheckingMaintenance, setIsCheckingMaintenance] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Load saved email on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rememberedEmail');
      if (saved) {
        setSavedEmail(saved);
        setRememberMe(true);
        // Set the email input value if it exists
        if (emailInputRef.current) {
          emailInputRef.current.value = saved;
        }
      }
    }
  }, []);

  // Check site maintenance setting
  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const response = await fetch('/api/site-maintenance');
        const data = await response.json();
        setSignUpsDisabled(data.signUpsDisabled || false);
      } catch (err) {
        console.error('Error checking site maintenance:', err);
        // Default to allowing sign ups if there's an error
        setSignUpsDisabled(false);
      } finally {
        setIsCheckingMaintenance(false);
      }
    };
    checkMaintenance();
  }, []);
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Page wrapper */}
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
        {/* Nav */}
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center">
            <Image
              src="/images/logo/Logo_Side_White.png"
              alt="Household Toolbox"
              width={200}
              height={40}
              className="h-auto"
              priority
            />
          </div>

          <nav className="hidden gap-6 text-sm text-slate-300 sm:flex items-center">
            <a href="#features" className="hover:text-emerald-300">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-emerald-300">
              How it works
            </a>
            <Link href="/pricing" className="hover:text-emerald-300">
              Pricing
            </Link>
            <HelpMenu />
          </nav>
        </header>

        {/* Hero */}
        <section className="mb-16 grid flex-1 gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:items-center">
          <div>
            <div className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
             Organize, plan, and maintain your household
            </div>

            <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl md:text-6xl">
              The digital toolbox
              <br />
              for your whole household.
            </h1>

            <p className="mt-4 max-w-xl text-pretty text-sm text-slate-300 sm:text-base">
              Household Toolbox brings your maintenance schedules, important documents,
              checklists, and planning tools together so nothing around the house slips
              through the cracks again.
            </p>

            {/* Coming Soon Message */}
            <div className="mt-8 inline-flex items-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-6 py-4">
              <p className="text-lg font-semibold text-emerald-200">
                Coming Soon in 2026
              </p>
            </div>
          </div>

          {/* Right side "card" - Sign In/Sign Up */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-2xl shadow-emerald-500/10">
            <div className="mb-4 flex gap-2 rounded-lg bg-slate-900/70 p-1">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setError(null);
                  setSuccess(null);
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  !isSignUp
                    ? 'bg-emerald-400/20 text-emerald-300'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!signUpsDisabled) {
                    setIsSignUp(true);
                    setError(null);
                    setSuccess(null);
                  }
                }}
                disabled={signUpsDisabled || isCheckingMaintenance}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isSignUp
                    ? 'bg-emerald-400/20 text-emerald-300'
                    : signUpsDisabled
                    ? 'text-slate-500 cursor-not-allowed opacity-50'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
                title={signUpsDisabled ? 'New user registration is currently disabled' : ''}
              >
                Sign Up
              </button>
            </div>

            {signUpsDisabled && isSignUp && (
              <div className="mb-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                New user registration is currently disabled. Please contact support if you need assistance.
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                {success}
              </div>
            )}

            <form
              ref={formRef}
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                setSuccess(null);
                setIsLoading(true);

                const form = e.currentTarget;
                const formData = new FormData(form);
                const email = formData.get('email') as string;
                const password = formData.get('password') as string;
                const firstName = formData.get('firstName') as string;
                const lastName = formData.get('lastName') as string;

                if (isSignUp) {
                  // Double-check that sign ups are not disabled (client-side validation)
                  if (signUpsDisabled) {
                    setIsLoading(false);
                    setError('New user registration is currently disabled. Please contact support.');
                    return;
                  }
                  
                  const result = await signUp({ email, password, firstName, lastName });
                  setIsLoading(false);

                  if (result.success) {
                    setSuccess('Account created successfully! You can now sign in.');
                    // Reset form
                    formRef.current?.reset();
                  } else {
                    setError(result.error || 'Failed to create account');
                  }
                } else {
                  const result = await signIn({ email, password });
                  setIsLoading(false);

                  if (result.success) {
                    // Save email if "Remember me" is checked
                    if (rememberMe && typeof window !== 'undefined') {
                      localStorage.setItem('rememberedEmail', email);
                    } else if (typeof window !== 'undefined') {
                      // Remove saved email if checkbox is unchecked
                      localStorage.removeItem('rememberedEmail');
                    }
                    // Redirect to dashboard
                    router.push('/dashboard');
                  } else {
                    setError(result.error || 'Failed to sign in');
                  }
                }
              }}
              className="space-y-4"
            >
              {isSignUp && (
                <>
                  <div>
                    <label htmlFor="firstName" className="block text-xs font-medium text-slate-300 mb-1.5">
                      First Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      placeholder="First name"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-xs font-medium text-slate-300 mb-1.5">
                      Last Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      placeholder="Last name"
                      required
                    />
                  </div>
                </>
              )}

              <div>
                <label htmlFor="email" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  ref={emailInputRef}
                  type="email"
                  id="email"
                  name="email"
                  defaultValue={savedEmail}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Password <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  placeholder="••••••••"
                  required
                />
              </div>

              {!isSignUp && (
                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 text-slate-400">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900/70 text-emerald-500 focus:ring-emerald-500/50"
                    />
                    <span>Remember me</span>
                  </label>
                  <Link href="/forgot-password" className="text-emerald-400 hover:text-emerald-300">
                    Forgot password?
                  </Link>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading
                  ? 'Processing...'
                  : isSignUp
                    ? 'Create Account'
                    : 'Sign In'}
              </button>
            </form>

            {isSignUp && (
              <p className="mt-4 text-center text-xs text-slate-400">
                By signing up, you agree to our{' '}
                <Link href="/terms-of-service" className="text-emerald-400 hover:text-emerald-300">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy-policy" className="text-emerald-400 hover:text-emerald-300">
                  Privacy Policy
                </Link>
              </p>
            )}
          </div>
        </section>

        {/* Control Panel Section */}
        <section className="mb-16">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">
            At-a-glance
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-50 sm:text-2xl">
            Your household control panel
          </h2>
          <p className="mt-2 max-w-xl text-sm text-slate-300">
            See what needs attention this week across maintenance, bills, and
            tasks—without digging through emails, texts, and paper folders.
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-2xl">🧰</p>
              <h3 className="mt-3 text-sm font-semibold text-slate-100">
                Maintenance timeline
              </h3>
              <p className="mt-2 text-xs text-slate-400">
                Track filters, gutters, inspections, and more with reminders.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-2xl">📂</p>
              <h3 className="mt-3 text-sm font-semibold text-slate-100">
                Important documents
              </h3>
              <p className="mt-2 text-xs text-slate-400">
                Keep warranties, policies, and records organized and easy to find.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-2xl">✅</p>
              <h3 className="mt-3 text-sm font-semibold text-slate-100">
                Shared checklists
              </h3>
              <p className="mt-2 text-xs text-slate-400">
                Coordinate move-in, hosting, packing, and seasonal checklists with
                your whole household.
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mb-16">
          <h2 className="text-xl font-semibold text-slate-50 sm:text-2xl">
            Designed for real-life households
          </h2>
          <p className="mt-2 max-w-xl text-sm text-slate-300">
            Household Toolbox isn't another todo app. It's a practical command center
            for the boring but important stuff that keeps your home running.
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-2xl">🗓️</p>
              <h3 className="mt-3 text-sm font-semibold text-slate-100">
                Preventive maintenance
              </h3>
              <p className="mt-2 text-xs text-slate-400">
                Build a repeating schedule for home tasks so you stay ahead of repairs
                instead of reacting to them.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-2xl">👥</p>
              <h3 className="mt-3 text-sm font-semibold text-slate-100">
                Everyone on the same page
              </h3>
              <p className="mt-2 text-xs text-slate-400">
                Share responsibility with partners, roommates, or family—see who&apos;s
                doing what and when.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-2xl">🔐</p>
              <h3 className="mt-3 text-sm font-semibold text-slate-100">
                Peace-of-mind records
              </h3>
              <p className="mt-2 text-xs text-slate-400">
                Store key details and docs in one place so you&apos;re not hunting
                through drawers or old emails.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mb-16">
          <h2 className="text-xl font-semibold text-slate-50 sm:text-2xl">
            How Household Toolbox works
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                Step 1
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-100">
                Add your home basics
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Enter your home type, key systems, and existing maintenance habits.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                Step 2
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-100">
                Build your toolbox
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Turn on the tools you need: maintenance calendar, document vault,
                checklists, and more.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                Step 3
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-100">
                Stay ahead effortlessly
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Get gentle reminders and a single dashboard view of what matters this
                week.
              </p>
            </div>
          </div>
        </section>


        {/* Footer */}
        <footer className="border-t border-slate-800 pt-4 text-xs text-slate-500">
          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <p>© {new Date().getFullYear()} Household Toolbox. All rights reserved.</p>
            <p className="text-[11px] text-slate-500">
              Built to make home life admin less painful.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
