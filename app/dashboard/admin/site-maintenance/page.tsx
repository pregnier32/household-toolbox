'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function SiteMaintenancePage() {
  const [signUpsDisabled, setSignUpsDisabled] = useState(false);
  const [platformFee, setPlatformFee] = useState<number>(5.00);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingFee, setIsSavingFee] = useState(false);
  const [isSyncingBilling, setIsSyncingBilling] = useState(false);
  const [billingSyncResult, setBillingSyncResult] = useState<{ success: boolean; message?: string; count?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [user, setUser] = useState<{ userStatus?: string } | null>(null);
  const [openModal, setOpenModal] = useState<'user-registration' | 'platform-fee' | 'billing-sync' | null>(null);
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
      setPlatformFee(data.platformFee || 5.00);
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

  const handleBillingSync = async () => {
    setIsSyncingBilling(true);
    setError(null);
    setSuccess(null);
    setBillingSyncResult(null);

    try {
      const response = await fetch('/api/admin/billing/sync-all');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync billing');
      }

      setBillingSyncResult({
        success: true,
        message: data.message,
        count: data.count,
      });
      setSuccess(`Billing sync completed: ${data.message}`);
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccess(null);
        setBillingSyncResult(null);
      }, 5000);
    } catch (err) {
      console.error('Error syncing billing:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync billing');
      setBillingSyncResult({
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsSyncingBilling(false);
    }
  };

  const handlePlatformFeeUpdate = async (newFee: number) => {
    setIsSavingFee(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/site-maintenance', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platformFee: newFee,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update platform fee');
      }

      setPlatformFee(newFee);
      setSuccess(`Platform fee updated to ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(newFee)}`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Error updating platform fee:', err);
      setError(err instanceof Error ? err.message : 'Failed to update platform fee');
    } finally {
      setIsSavingFee(false);
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

        {/* Settings Cards Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* User Registration Card */}
          <button
            onClick={() => setOpenModal('user-registration')}
            className="rounded-lg border border-slate-800 bg-slate-900/70 p-6 text-left hover:border-emerald-500/50 transition-colors"
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-50 mb-2">User Registration</h2>
              <p className="text-sm text-slate-400">
                Control whether new users can sign up for accounts
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {signUpsDisabled ? 'Sign ups disabled' : 'Sign ups enabled'}
              </span>
              <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Platform Fee Card */}
          <button
            onClick={() => setOpenModal('platform-fee')}
            className="rounded-lg border border-slate-800 bg-slate-900/70 p-6 text-left hover:border-emerald-500/50 transition-colors"
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-50 mb-2">Platform Fee</h2>
              <p className="text-sm text-slate-400">
                Set the monthly platform fee charged to users
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Current: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(platformFee)}/month
              </span>
              <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Billing Sync Card */}
          <button
            onClick={() => setOpenModal('billing-sync')}
            className="rounded-lg border border-slate-800 bg-slate-900/70 p-6 text-left hover:border-emerald-500/50 transition-colors"
          >
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-50 mb-2">Billing Sync</h2>
              <p className="text-sm text-slate-400">
                Force sync billing records for all users
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Manual sync tool</span>
              <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>

        {/* Modal */}
        {openModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setOpenModal(null)}
          >
            <div 
              className="w-full max-w-2xl rounded-lg border border-slate-800 bg-slate-900 p-6 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* User Registration Modal */}
              {openModal === 'user-registration' && (
                <>
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-50">User Registration</h2>
                    <button
                      onClick={() => setOpenModal(null)}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-slate-400 mb-6">
                    Control whether new users can sign up for accounts
                  </p>

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
                </>
              )}

              {/* Platform Fee Modal */}
              {openModal === 'platform-fee' && (
                <>
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-50">Platform Fee</h2>
                    <button
                      onClick={() => setOpenModal(null)}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-slate-400 mb-6">
                    Set the monthly platform fee charged to users who have at least one active tool subscription
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="platformFeeModal" className="block text-sm font-medium text-slate-200 mb-2">
                        Monthly Platform Fee
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="relative flex-1 max-w-xs">
                          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <span className="text-slate-400 text-sm">$</span>
                          </div>
                          <input
                            type="number"
                            id="platformFeeModal"
                            min="0"
                            step="0.01"
                            value={platformFee}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value) && value >= 0) {
                                setPlatformFee(value);
                              }
                            }}
                            onBlur={(e) => {
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value) && value >= 0 && value !== platformFee) {
                                handlePlatformFeeUpdate(value);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            disabled={isSavingFee}
                            className="block w-full pl-7 pr-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="5.00"
                          />
                        </div>
                        {isSavingFee && (
                          <span className="text-sm text-slate-400">Saving...</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        This fee is charged monthly to users who have at least one active or trial tool subscription. 
                        Users with no active tools are not charged the platform fee.
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-3">
                      <p className="text-sm text-slate-300">
                        <strong>Current fee:</strong>{' '}
                        <span className="text-emerald-300 font-medium">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(platformFee)}
                        </span>
                        {' '}per month
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* Billing Sync Modal */}
              {openModal === 'billing-sync' && (
                <>
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-50">Billing Sync</h2>
                    <button
                      onClick={() => setOpenModal(null)}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-slate-400 mb-6">
                    Force sync billing records for all users. The nightly cron job automatically syncs all users, 
                    but you can run this manually anytime if you need to update billing data immediately.
                  </p>

                  <div className="space-y-4">
                    <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-6">
                      <p className="text-sm text-slate-300 mb-4">
                        This will populate the <code className="text-emerald-400">billing_active</code> table 
                        based on current tool subscriptions from the <code className="text-emerald-400">users_tools</code> table.
                      </p>
                      <button
                        onClick={handleBillingSync}
                        disabled={isSyncingBilling}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                      >
                        {isSyncingBilling ? 'Syncing...' : 'Force Sync All Users Billing'}
                      </button>
                      {billingSyncResult && (
                        <div className={`mt-4 p-3 rounded-lg ${
                          billingSyncResult.success 
                            ? 'bg-emerald-500/20 border border-emerald-500/50' 
                            : 'bg-red-500/20 border border-red-500/50'
                        }`}>
                          <p className={`text-sm ${
                            billingSyncResult.success ? 'text-emerald-300' : 'text-red-300'
                          }`}>
                            {billingSyncResult.message}
                            {billingSyncResult.count !== undefined && ` (${billingSyncResult.count} users)`}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

