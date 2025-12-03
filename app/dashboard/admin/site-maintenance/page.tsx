'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function SiteMaintenancePage() {
  const [signUpsDisabled, setSignUpsDisabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [user, setUser] = useState<{ userStatus?: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check authentication and superadmin status
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          if (data.user.userStatus !== 'superadmin') {
            router.push('/dashboard');
            return;
          }
          // Load site maintenance settings
          loadSettings();
        } else {
          router.push('/');
        }
      })
      .catch(() => {
        router.push('/');
      });
  }, [router]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/site-maintenance');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load settings');
      }

      setSignUpsDisabled(data.setting?.signUpsDisabled || false);
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settings');
      setIsLoading(false);
    }
  };

  const handleToggle = async (newValue: boolean) => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/site-maintenance', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signUpsDisabled: newValue,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update settings');
      }

      setSignUpsDisabled(newValue);
      setSuccess(
        newValue
          ? 'New user sign ups have been disabled'
          : 'New user sign ups have been enabled'
      );
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Error updating settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-slate-400">Loading settings...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
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
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="mb-4 flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-300"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span>Back to Dashboard</span>
          </button>
          <h1 className="text-2xl font-semibold text-slate-50">Site Maintenance</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage site-wide settings and maintenance options
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {success}
          </div>
        )}

        {/* Settings Card */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-50 mb-2">User Registration</h2>
            <p className="text-sm text-slate-400">
              Control whether new users can sign up for accounts
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label htmlFor="signUpsToggle" className="block text-sm font-medium text-slate-200 mb-1">
                Disable New User Sign Ups
              </label>
              <p className="text-xs text-slate-400">
                {signUpsDisabled
                  ? 'New user registration is currently disabled. Users will not be able to create new accounts.'
                  : 'New user registration is currently enabled. Users can create new accounts.'}
              </p>
            </div>
            <div className="ml-6">
              <button
                type="button"
                id="signUpsToggle"
                onClick={() => handleToggle(!signUpsDisabled)}
                disabled={isSaving}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50 ${
                  signUpsDisabled ? 'bg-red-500' : 'bg-emerald-500'
                }`}
                role="switch"
                aria-checked={signUpsDisabled}
                aria-label="Toggle new user sign ups"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    signUpsDisabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {signUpsDisabled && (
            <div className="mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3">
              <p className="text-sm text-amber-300">
                <strong>Note:</strong> When sign ups are disabled, the "Sign Up" button on the main page will be disabled and users will not be able to create new accounts.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

