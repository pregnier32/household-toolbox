'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type UserTool = {
  id: string;
  price: number;
  status: string;
  created_at: string;
  updated_at: string | null;
  promo_code_id: string | null;
  promo_expiration_date: string | null;
  trial_start_date: string | null;
  trial_end_date: string | null;
  tools: {
    id: string;
    name: string;
    tool_tip: string | null;
  } | null;
  promo_codes: {
    id: string;
    code: string;
  } | null;
};

export default function MyToolsPage() {
  const [tools, setTools] = useState<UserTool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [user, setUser] = useState<{ id?: string } | null>(null);
  const [inactivatingId, setInactivatingId] = useState<string | null>(null);
  const [editMenu, setEditMenu] = useState<{ isOpen: boolean; toolId: string | null; toolName: string }>({
    isOpen: false,
    toolId: null,
    toolName: '',
  });
  const [confirmInactivate, setConfirmInactivate] = useState<{ isOpen: boolean; toolId: string | null; toolName: string }>({
    isOpen: false,
    toolId: null,
    toolName: '',
  });
  const [showPreview, setShowPreview] = useState(false);
  const [platformFee, setPlatformFee] = useState<number>(5.00); // Default to $5.00
  const router = useRouter();

  useEffect(() => {
    // Check authentication
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          // Load platform fee
          loadPlatformFee();
          // Load user tools
          loadTools();
        } else {
          router.push('/');
        }
      })
      .catch(() => {
        router.push('/');
      });
  }, [router]);

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

  const loadTools = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/my-tools');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load tools');
      }

      setTools(data.tools || []);
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading tools:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tools');
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getDaysRemaining = (trialEndDate: string | null) => {
    if (!trialEndDate) return null;
    try {
      const endDate = new Date(trialEndDate);
      const now = new Date();
      const diffTime = endDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    } catch {
      return null;
    }
  };

  const handleEditClick = (tool: UserTool) => {
    setEditMenu({
      isOpen: true,
      toolId: tool.id,
      toolName: tool.tools?.name || 'Unknown Tool',
    });
    setError(null);
    setSuccess(null);
  };

  const handleEditMenuClose = () => {
    setEditMenu({
      isOpen: false,
      toolId: null,
      toolName: '',
    });
  };

  const handleInactivateClick = () => {
    if (!editMenu.toolId) return;
    setConfirmInactivate({
      isOpen: true,
      toolId: editMenu.toolId,
      toolName: editMenu.toolName,
    });
    setEditMenu({
      isOpen: false,
      toolId: null,
      toolName: '',
    });
  };

  const handleInactivateCancel = () => {
    setConfirmInactivate({
      isOpen: false,
      toolId: null,
      toolName: '',
    });
  };

  const handleInactivateConfirm = async () => {
    if (!confirmInactivate.toolId) return;

    setInactivatingId(confirmInactivate.toolId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/my-tools', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolId: confirmInactivate.toolId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to inactivate tool');
      }

      setSuccess('Tool inactivated successfully');
      setConfirmInactivate({
        isOpen: false,
        toolId: null,
        toolName: '',
      });
      
      // Reload tools after a short delay to show success message
      setTimeout(() => {
        loadTools();
        setSuccess(null);
      }, 1500);
    } catch (err) {
      console.error('Error inactivating tool:', err);
      setError(err instanceof Error ? err.message : 'Failed to inactivate tool');
    } finally {
      setInactivatingId(null);
    }
  };

  // Helper function to check if platform fee applies
  const shouldChargePlatformFee = (toolsList: UserTool[]) => {
    return toolsList.some(tool => tool.status === 'active' || tool.status === 'trial');
  };

  // Calculate total monthly cost
  const toolSubscriptionsCost = tools.reduce((sum, tool) => {
    // During trial, cost is $0
    if (tool.status === 'trial') {
      return sum;
    }
    return sum + Number(tool.price);
  }, 0);

  // Add platform fee if user has at least 1 active/trial tool
  const platformFeeAmount = shouldChargePlatformFee(tools) ? platformFee : 0;
  const totalMonthlyCost = toolSubscriptionsCost + platformFeeAmount;

  // Calculate billing date from oldest activated date (7 days after activation for trials)
  const getBillingDate = () => {
    if (tools.length === 0) return null;
    
    // Find the oldest billing date (7 days after activation)
    const oldestBillingDate = tools.reduce((oldest, tool) => {
      let toolBillingDate: Date;
      
      if (tool.status === 'trial' && tool.trial_end_date) {
        // For trials, use the trial end date (which is 7 days after activation)
        toolBillingDate = new Date(tool.trial_end_date);
      } else {
        // For active tools, use created_at + 7 days (to account for the trial period that would have ended)
        const createdDate = new Date(tool.created_at);
        toolBillingDate = new Date(createdDate);
        toolBillingDate.setDate(toolBillingDate.getDate() + 7);
      }
      
      const oldestDateObj = new Date(oldest);
      return toolBillingDate < oldestDateObj ? toolBillingDate : oldest;
    }, (() => {
      // Initialize with the first tool's billing date
      const firstTool = tools[0];
      if (firstTool.status === 'trial' && firstTool.trial_end_date) {
        return new Date(firstTool.trial_end_date);
      } else {
        const createdDate = new Date(firstTool.created_at);
        const billingDate = new Date(createdDate);
        billingDate.setDate(billingDate.getDate() + 7);
        return billingDate;
      }
    })());
    
    // Extract day of month from the billing date
    return oldestBillingDate.getDate();
  };

  const billingDay = getBillingDate();

  // Calculate next month's billing preview
  const calculateNextMonthBilling = () => {
    if (tools.length === 0 || billingDay === null) {
      return {
        total: 0,
        toolSubscriptionsTotal: 0,
        activeTools: [],
        trialToolsEnding: [],
        nextBillingDate: '',
        platformFee: 0,
      };
    }

    // Calculate the actual next billing date
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Calculate this month's billing date
    const thisMonthBilling = new Date(currentYear, currentMonth, billingDay);
    // Set time to start of day for accurate comparison
    thisMonthBilling.setHours(0, 0, 0, 0);
    const nowStartOfDay = new Date(now);
    nowStartOfDay.setHours(0, 0, 0, 0);
    
    // Determine next billing date - always show the NEXT billing cycle
    let nextBillingDate: Date;
    if (nowStartOfDay > thisMonthBilling) {
      // We've passed this month's billing date, so next is next month
      nextBillingDate = new Date(currentYear, currentMonth + 1, billingDay);
    } else {
      // This month's billing date is today or in the future
      // For preview purposes, show next month's billing
      nextBillingDate = new Date(currentYear, currentMonth + 1, billingDay);
    }
    
    // Set time to start of day for accurate comparison
    nextBillingDate.setHours(0, 0, 0, 0);

    const activeTools: Array<{ name: string; price: number }> = [];
    const trialToolsEnding: Array<{ name: string; price: number; trialEndDate: string; daysUntilEnd: number }> = [];
    let toolSubscriptionsTotal = 0;

    tools.forEach((tool) => {
      if (tool.status === 'active') {
        // All active tools will be charged on the next billing date
        activeTools.push({
          name: tool.tools?.name || 'Unknown Tool',
          price: Number(tool.price),
        });
        toolSubscriptionsTotal += Number(tool.price);
      } else if (tool.status === 'trial' && tool.trial_end_date) {
        const trialEndDate = new Date(tool.trial_end_date);
        trialEndDate.setHours(0, 0, 0, 0);
        
        // If trial ends before or on the next billing date, it will be charged
        if (trialEndDate <= nextBillingDate) {
          const daysUntilEnd = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          trialToolsEnding.push({
            name: tool.tools?.name || 'Unknown Tool',
            price: Number(tool.price),
            trialEndDate: tool.trial_end_date,
            daysUntilEnd: daysUntilEnd > 0 ? daysUntilEnd : 0,
          });
          toolSubscriptionsTotal += Number(tool.price);
        }
      }
    });

    // Calculate if platform fee applies (if there will be at least 1 active/trial tool on billing date)
    // Platform fee applies if:
    // 1. There are active tools, OR
    // 2. There are trials that will still be active (not ending before billing date), OR
    // 3. There are trials ending on or before billing date (they'll become active)
    const hasActiveTools = activeTools.length > 0;
    const hasTrialsEnding = trialToolsEnding.length > 0;
    const hasActiveTrials = tools.some(tool => {
      if (tool.status === 'trial' && tool.trial_end_date) {
        const trialEndDate = new Date(tool.trial_end_date);
        trialEndDate.setHours(0, 0, 0, 0);
        return trialEndDate > nextBillingDate; // Trial still active on billing date
      }
      return false;
    });
    
    const platformFeeApplies = hasActiveTools || hasTrialsEnding || hasActiveTrials;
    const platformFeeAmount = platformFeeApplies ? platformFee : 0;
    const total = toolSubscriptionsTotal + platformFeeAmount;

    return {
      total,
      toolSubscriptionsTotal,
      activeTools,
      trialToolsEnding,
      platformFee: platformFeeAmount,
      nextBillingDate: nextBillingDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    };
  };

  const nextMonthPreview = calculateNextMonthBilling();

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-slate-400">Loading your tools...</div>
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
          <h1 className="text-2xl font-semibold text-slate-50">My Tools</h1>
          <p className="mt-1 text-sm text-slate-400">
            View your active tool subscriptions and monthly costs
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-4 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {success}
          </div>
        )}

        {/* Tools List */}
        {tools.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-8 text-center">
            <p className="text-slate-400">You don't have any active tools yet.</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-emerald-400"
            >
              Browse Tools
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900/70 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">
                        Tool
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">
                        Activated Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">
                        Promo Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">
                        Promo Expiration
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-300">
                        Monthly Cost
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {tools.map((tool) => {
                      const isTrial = tool.status === 'trial';
                      const daysRemaining = isTrial ? getDaysRemaining(tool.trial_end_date) : null;
                      
                      return (
                        <tr key={tool.id} className="hover:bg-slate-800/30">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-100">
                                {tool.tools?.name || 'Unknown Tool'}
                              </span>
                              {isTrial && (
                                <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300">
                                  Trial
                                </span>
                              )}
                            </div>
                            {isTrial && daysRemaining !== null && (
                              <p className="text-xs text-amber-300/80 mt-1">
                                {daysRemaining === 0 
                                  ? 'Trial ends today' 
                                  : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-300">
                            {formatDate(tool.created_at)}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-300">
                            {tool.promo_codes?.code || '—'}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-300">
                            {tool.promo_expiration_date ? formatDate(tool.promo_expiration_date) : '—'}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-medium text-emerald-400">
                            {isTrial ? (
                              <span className="text-slate-400">Free (Trial)</span>
                            ) : (
                              formatCurrency(Number(tool.price))
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleEditClick(tool)}
                              className="rounded bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/30"
                              title="Edit tool"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total Monthly Cost */}
            <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-50">Total Monthly Charge</h3>
                  <div className="mt-2 space-y-1">
                    {platformFeeAmount > 0 && (
                      <p className="text-sm text-slate-300">
                        Platform Fee: <span className="font-medium text-emerald-300">{formatCurrency(platformFeeAmount)}</span>
                      </p>
                    )}
                    {toolSubscriptionsCost > 0 && (
                      <p className="text-sm text-slate-300">
                        Tool Subscriptions: <span className="font-medium text-emerald-300">{formatCurrency(toolSubscriptionsCost)}</span>
                        {tools.some(t => t.status === 'trial') && (
                          <span className="text-amber-300 text-xs ml-1">(trials are free)</span>
                        )}
                      </p>
                    )}
                    {platformFeeAmount === 0 && toolSubscriptionsCost === 0 && (
                      <p className="text-sm text-slate-400">
                        All tools are in trial period
                      </p>
                    )}
                  </div>
                  {billingDay !== null && (
                    <p className="text-sm text-slate-300 mt-2">
                      Billing date: <span className="font-semibold text-emerald-300">Day {billingDay}</span> of each month
                    </p>
                  )}
                </div>
                <div className="flex items-end gap-4">
                  <div className="text-right">
                    <p className="text-3xl font-bold text-emerald-400">
                      {formatCurrency(totalMonthlyCost)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">per month</p>
                  </div>
                  <button
                    onClick={() => setShowPreview(true)}
                    className="rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/30 whitespace-nowrap"
                  >
                    Preview Next Month
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Edit Menu Modal */}
        {editMenu.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-50">Edit Tool</h2>
                <button
                  onClick={handleEditMenuClose}
                  className="text-slate-400 hover:text-slate-300 transition-colors"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-slate-300 mb-4">
                Manage <span className="font-semibold text-slate-100">{editMenu.toolName}</span>
              </p>
              <div className="space-y-3">
                <button
                  onClick={handleInactivateClick}
                  className="w-full rounded-lg bg-red-500/20 px-4 py-3 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/30 text-left flex items-center gap-3"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                    />
                  </svg>
                  <span>Inactivate</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Next Month Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-50">Next Month Billing Preview</h2>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-slate-400 hover:text-slate-300 transition-colors"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <p className="text-sm text-slate-300">
                  <span className="font-semibold">Next billing date:</span>{' '}
                  <span className="text-emerald-300">{nextMonthPreview.nextBillingDate}</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  This preview includes active subscriptions and trials that will end before the billing date.
                </p>
              </div>

              {/* Active Tools */}
              {nextMonthPreview.activeTools.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">Active Subscriptions</h3>
                  <div className="space-y-2">
                    {nextMonthPreview.activeTools.map((tool, index) => (
                      <div key={index} className="flex items-center justify-between rounded border border-slate-700 bg-slate-800/30 px-3 py-2">
                        <span className="text-sm text-slate-200">{tool.name}</span>
                        <span className="text-sm font-medium text-emerald-400">
                          {formatCurrency(tool.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trials Ending */}
              {nextMonthPreview.trialToolsEnding.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-amber-300 mb-2">Trials Ending (Will Be Charged)</h3>
                  <div className="space-y-2">
                    {nextMonthPreview.trialToolsEnding.map((tool, index) => (
                      <div key={index} className="flex items-center justify-between rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                        <div className="flex-1">
                          <span className="text-sm text-slate-200">{tool.name}</span>
                          <p className="text-xs text-amber-300/80 mt-0.5">
                            Trial ends in {tool.daysUntilEnd} day{tool.daysUntilEnd !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <span className="text-sm font-medium text-emerald-400">
                          {formatCurrency(tool.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {nextMonthPreview.activeTools.length === 0 && nextMonthPreview.trialToolsEnding.length === 0 && nextMonthPreview.platformFee === 0 && (
                <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/30 p-4 text-center">
                  <p className="text-sm text-slate-400">
                    No charges expected next month. All tools are in trial period.
                  </p>
                </div>
              )}

              {/* Platform Fee */}
              {nextMonthPreview.platformFee > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">Platform Fee</h3>
                  <div className="flex items-center justify-between rounded border border-slate-700 bg-slate-800/30 px-3 py-2">
                    <span className="text-sm text-slate-200">Monthly platform access</span>
                    <span className="text-sm font-medium text-emerald-400">
                      {formatCurrency(nextMonthPreview.platformFee)}
                    </span>
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="mt-4 rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-4">
                <div className="space-y-2 mb-3">
                  {nextMonthPreview.toolSubscriptionsTotal > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">Tool Subscriptions:</span>
                      <span className="text-slate-200 font-medium">{formatCurrency(nextMonthPreview.toolSubscriptionsTotal)}</span>
                    </div>
                  )}
                  {nextMonthPreview.platformFee > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">Platform Fee:</span>
                      <span className="text-slate-200 font-medium">{formatCurrency(nextMonthPreview.platformFee)}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-emerald-500/30 pt-2">
                  <span className="text-lg font-semibold text-slate-50">Projected Total</span>
                  <span className="text-2xl font-bold text-emerald-400">
                    {formatCurrency(nextMonthPreview.total)}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 text-right">for {nextMonthPreview.nextBillingDate}</p>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowPreview(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Inactivate Confirmation Modal */}
        {confirmInactivate.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl">
              <h2 className="text-xl font-semibold text-slate-50 mb-2">Inactivate Tool</h2>
              <p className="text-sm text-slate-300 mb-4">
                Are you sure you want to inactivate <span className="font-semibold text-slate-100">{confirmInactivate.toolName}</span>?
              </p>
              <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 mb-4">
                <p className="text-sm text-amber-300">
                  This will stop your subscription for this tool. You can reactivate it later from the Tools page.
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleInactivateCancel}
                  disabled={inactivatingId !== null}
                  className="rounded border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInactivateConfirm}
                  disabled={inactivatingId !== null}
                  className="rounded bg-red-500 px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {inactivatingId ? 'Inactivating...' : 'Inactivate'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}


