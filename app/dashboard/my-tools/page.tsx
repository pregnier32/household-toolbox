'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserMenu } from '../../components/UserMenu';
import { SideLogo } from '../../components/SideLogo';
import { useTheme } from '../../components/AppThemeProvider';

type UserTool = {
  id: string;
  price: number;
  status: string;
  created_at: string;
  updated_at: string | null;
  tools: {
    id: string;
    name: string;
    tool_tip: string | null;
  } | null;
};

export default function MyToolsPage() {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  const headerChromeButtonClass = isLight
    ? 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900'
    : 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100';

  const headerBarClass = isLight
    ? 'border-b-2 border-slate-400 bg-slate-900/50'
    : 'border-b border-slate-800 bg-slate-900/50';

  const errorAlertClass = isLight
    ? 'mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'
    : 'mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300';

  const successAlertClass = isLight
    ? 'mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900'
    : 'mb-4 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300';

  const emptyStateCardClass = isLight
    ? 'rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm'
    : 'rounded-lg border border-slate-800 bg-slate-900/70 p-8 text-center';

  const tableCardClass = isLight
    ? 'mb-6 rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm'
    : 'mb-6 rounded-lg border border-slate-800 bg-slate-900/70 overflow-hidden';

  const theadClass = isLight ? 'bg-slate-100' : 'bg-slate-800/50';

  const thLeftClass = isLight
    ? 'px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600'
    : 'px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300';

  const thRightClass = isLight
    ? 'px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-600'
    : 'px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-300';

  const tbodyDivideClass = isLight ? 'divide-y divide-slate-200' : 'divide-y divide-slate-800';

  const rowHoverClass = isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/30';

  const cellNameClass = isLight
    ? 'text-sm font-medium text-slate-900'
    : 'text-sm font-medium text-slate-100';

  const cellMutedClass = isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-300';

  const inactiveBadgeClass = isLight
    ? 'inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700'
    : 'inline-flex items-center rounded-full bg-slate-500/20 px-2 py-0.5 text-xs font-medium text-slate-300';

  const priceClass = isLight
    ? 'text-right text-sm font-medium text-emerald-700'
    : 'text-right text-sm font-medium text-emerald-400';

  const reactivateButtonClass = isLight
    ? 'rounded bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900 transition-colors hover:bg-emerald-200 disabled:opacity-50'
    : 'rounded bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/30 disabled:opacity-50';

  const inactivateButtonClass = isLight
    ? 'rounded bg-red-100 px-3 py-1 text-xs font-semibold text-red-900 transition-colors hover:bg-red-200 disabled:opacity-50'
    : 'rounded bg-red-500/20 px-3 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/30 disabled:opacity-50';

  const totalBoxClass = isLight
    ? 'rounded-lg border border-emerald-200 bg-emerald-50 p-6'
    : 'rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-6';

  const totalTitleClass = isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50';

  const totalMetaClass = isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-300';

  const totalAmountClass = isLight ? 'text-3xl font-semibold text-emerald-800' : 'text-3xl font-semibold text-emerald-400';

  const totalInlineAmountClass = isLight ? 'font-medium text-emerald-800' : 'font-medium text-emerald-300';

  const totalPerMonthClass = isLight ? 'text-xs text-slate-500 mt-1' : 'text-xs text-slate-400 mt-1';

  const browseToolsButtonClass = isLight
    ? 'mt-4 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white'
    : 'mt-4 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';

  const emptyHelpTextClass = isLight ? 'text-slate-600' : 'text-slate-400';

  const pageTitleClass = isLight ? 'text-2xl font-semibold text-slate-900' : 'text-2xl font-semibold text-slate-50';

  const pageSubtitleClass = isLight ? 'mt-1 text-sm text-slate-600' : 'mt-1 text-sm text-slate-400';

  const loadingHintClass = isLight ? 'text-slate-600' : 'text-slate-400';

  const [tools, setTools] = useState<UserTool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [user, setUser] = useState<{ id?: string; firstName?: string; lastName?: string } | null>(null);
  const [inactivatingId, setInactivatingId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check authentication
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          loadTools();
        } else {
          router.push('/');
        }
      })
      .catch(() => {
        router.push('/');
      });
  }, [router]);

  const handleSignOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.push('/');
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

  const handleToggleActive = async (toolId: string) => {
    if (!toolId) return;

    setInactivatingId(toolId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/my-tools', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolId: toolId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update tool');
      }

      const currentTool = tools.find(t => t.id === toolId);
      const isInactive = currentTool?.status === 'inactive';
      setSuccess(isInactive ? 'Tool reactivated successfully' : 'Tool inactivated successfully');

      // Reload tools after a short delay to show success message
      setTimeout(() => {
        loadTools();
        setSuccess(null);
      }, 1500);
    } catch (err) {
      console.error('Error updating tool:', err);
      setError(err instanceof Error ? err.message : 'Failed to update tool');
    } finally {
      setInactivatingId(null);
    }
  };

  // Calculate total monthly cost
  const totalMonthlyCost = tools.reduce((sum, tool) => {
    if (tool.status === 'active') return sum + Number(tool.price);
    return sum;
  }, 0);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className={loadingHintClass}>Loading your tools...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className={headerBarClass}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <SideLogo priority />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className={headerChromeButtonClass}
            >
              <svg
                className="h-4 w-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              <span>Back to Dashboard</span>
            </button>
            <UserMenu
              userName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Account'}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className={pageTitleClass}>My Tools</h1>
          <p className={pageSubtitleClass}>View and manage your active tools.</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className={errorAlertClass}>
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className={successAlertClass}>
            {success}
          </div>
        )}

        {/* Tools List */}
        {tools.length === 0 ? (
          <div className={emptyStateCardClass}>
            <p className={emptyHelpTextClass}>You don&apos;t have any active tools yet.</p>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className={browseToolsButtonClass}
            >
              Browse Tools
            </button>
          </div>
        ) : (
          <>
            <div className={tableCardClass}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={theadClass}>
                    <tr>
                      <th className={thLeftClass}>
                        Tool
                      </th>
                      <th className={thLeftClass}>
                        Activated Date
                      </th>
                      <th className={thRightClass}>
                        Monthly Cost
                      </th>
                      <th className={thRightClass}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className={tbodyDivideClass}>
                    {tools.map((tool) => {
                      const isInactive = tool.status === 'inactive';

                      return (
                        <tr key={tool.id} className={rowHoverClass}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={cellNameClass}>
                                {tool.tools?.name || 'Unknown Tool'}
                              </span>
                              {isInactive && (
                                <span className={inactiveBadgeClass}>
                                  Inactive
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={`px-6 py-4 ${cellMutedClass}`}>
                            {formatDate(tool.created_at)}
                          </td>
                          <td className={`px-6 py-4 ${priceClass}`}>
                            {formatCurrency(Number(tool.price))}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(tool.id)}
                              disabled={inactivatingId === tool.id}
                              className={isInactive ? reactivateButtonClass : inactivateButtonClass}
                              title={tool.status === 'inactive' ? 'Reactivate tool' : 'Inactivate tool'}
                            >
                              {inactivatingId === tool.id
                                ? 'Updating...'
                                : tool.status === 'inactive'
                                  ? 'Reactivate'
                                  : 'Inactivate'}
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
            <div className={totalBoxClass}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className={totalTitleClass}>Total Monthly Charge</h3>
                  <div className="mt-2 space-y-1">
                    {totalMonthlyCost > 0 && (
                      <p className={totalMetaClass}>
                        Active Tools: <span className={totalInlineAmountClass}>{formatCurrency(totalMonthlyCost)}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-end">
                  <div className="text-right">
                    <p className={totalAmountClass}>
                      {formatCurrency(totalMonthlyCost)}
                    </p>
                    <p className={totalPerMonthClass}>per month</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
