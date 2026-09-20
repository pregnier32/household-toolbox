'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserMenu } from '../../components/UserMenu';
import { SideLogo } from '../../components/SideLogo';
import { useTheme } from '../../components/AppThemeProvider';
import { completeSignOut } from '@/lib/client-sign-out';

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

  const removeButtonClass = isLight
    ? 'rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50'
    : 'rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50';

  const modalBackdropClass = 'fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4';
  const modalCardClass = isLight
    ? 'w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl'
    : 'w-full max-w-lg rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl';
  const modalTitleClass = isLight ? 'mb-2 text-xl font-semibold text-slate-900' : 'mb-2 text-xl font-semibold text-slate-50';
  const modalBodyClass = isLight ? 'text-sm text-slate-700' : 'text-sm text-slate-300';
  const warningBoxClass = isLight
    ? 'mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3'
    : 'mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3';
  const warningTitleClass = isLight ? 'mb-2 font-semibold text-red-700' : 'mb-2 font-semibold text-red-300';
  const warningTextClass = isLight ? 'text-sm text-red-600' : 'text-sm text-red-200';
  const checkboxLabelClass = isLight
    ? 'mb-4 flex items-start gap-3 text-sm text-slate-800'
    : 'mb-4 flex items-start gap-3 text-sm text-slate-200';
  const modalInputClass = isLight
    ? 'mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50'
    : 'mb-4 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50';
  const cancelButtonClass = isLight
    ? 'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50'
    : 'rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50';
  const confirmDangerButtonClass =
    'rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50';

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
  const [removeTool, setRemoveTool] = useState<UserTool | null>(null);
  const [removeStep, setRemoveStep] = useState<'warn' | 'final' | null>(null);
  const [exportedAck, setExportedAck] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [finalAck, setFinalAck] = useState(false);
  const [agreeConfirmText, setAgreeConfirmText] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);
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
    await completeSignOut();
  };

  const loadTools = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/my-tools');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load tools');
      }

      const sorted = [...(data.tools || [])].sort((a: UserTool, b: UserTool) =>
        (a.tools?.name || '').localeCompare(b.tools?.name || '', undefined, { sensitivity: 'base' })
      );
      setTools(sorted);
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

  const daysOwnedLabel = (createdAt: string) => {
    const start = new Date(createdAt);
    if (Number.isNaN(start.getTime())) return 'an unknown number of days';
    const days = Math.max(0, Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)));
    if (days === 0) return 'less than a day';
    if (days === 1) return '1 day';
    return `${days} days`;
  };

  const resetRemoveFlow = () => {
    setRemoveTool(null);
    setRemoveStep(null);
    setExportedAck(false);
    setDeleteConfirmText('');
    setFinalAck(false);
    setAgreeConfirmText('');
    setIsRemoving(false);
  };

  const openRemoveFlow = (tool: UserTool) => {
    setError(null);
    setSuccess(null);
    setRemoveTool(tool);
    setRemoveStep('warn');
    setExportedAck(false);
    setDeleteConfirmText('');
    setFinalAck(false);
    setAgreeConfirmText('');
  };

  const handleRemoveTool = async () => {
    if (!removeTool) return;
    if (agreeConfirmText !== 'I Agree' || !finalAck) return;

    setIsRemoving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/my-tools', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolId: removeTool.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove tool');
      }

      const removedName = data.toolName || removeTool.tools?.name || 'Tool';
      resetRemoveFlow();
      setSuccess(`${removedName} was removed. All records and documents for that tool are gone.`);
      loadTools();
      setTimeout(() => {
        setSuccess(null);
      }, 2500);
    } catch (err) {
      console.error('Error removing tool:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove tool');
      setIsRemoving(false);
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
              <span>Back to Toolbox</span>
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
                              onClick={() => openRemoveFlow(tool)}
                              disabled={isRemoving}
                              className={removeButtonClass}
                              title="Remove tool and delete all of its data"
                            >
                              Remove
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

      {removeTool && removeStep === 'warn' && (
        <div className={modalBackdropClass} onClick={() => !isRemoving && resetRemoveFlow()}>
          <div
            className={modalCardClass}
            role="dialog"
            aria-modal="true"
            aria-labelledby="my-tools-remove-warn-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="my-tools-remove-warn-title" className={modalTitleClass}>
              Remove {removeTool.tools?.name || 'this tool'}
            </h3>
            <div className={warningBoxClass}>
              <p className={warningTitleClass}>This permanently deletes this tool&apos;s data.</p>
              <p className={warningTextClass}>
                Removing {removeTool.tools?.name || 'this tool'} deletes all of its records, documents, and calendar pins
                for your account. Your other tools are not affected. There is no undo.
              </p>
            </div>
            <p className={`${modalBodyClass} mb-3`}>
              You have had this tool for <strong>{daysOwnedLabel(removeTool.created_at)}</strong>
              {removeTool.created_at ? ` (since ${formatDate(removeTool.created_at)})` : ''}.
            </p>
            <p className={`${modalBodyClass} mb-4`}>
              Export this tool to PDF from the tool itself before you continue. Removing it will not create a backup.
            </p>
            <label className={checkboxLabelClass}>
              <input
                type="checkbox"
                checked={exportedAck}
                onChange={(event) => setExportedAck(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-400"
              />
              <span>I have exported this tool to PDF and I understand there is no undo.</span>
            </label>
            <p className={`${modalBodyClass} mb-2`}>
              Type <strong>delete</strong> to continue:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              placeholder="Type 'delete' to continue"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === 'Escape') resetRemoveFlow();
              }}
              className={modalInputClass}
            />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={resetRemoveFlow} className={cancelButtonClass}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!exportedAck || deleteConfirmText.toLowerCase() !== 'delete'}
                onClick={() => {
                  setFinalAck(false);
                  setAgreeConfirmText('');
                  setRemoveStep('final');
                }}
                className={confirmDangerButtonClass}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {removeTool && removeStep === 'final' && (
        <div className={modalBackdropClass}>
          <div
            className={modalCardClass}
            role="dialog"
            aria-modal="true"
            aria-labelledby="my-tools-remove-final-title"
          >
            <h3 id="my-tools-remove-final-title" className={modalTitleClass}>
              Final confirmation
            </h3>
            <div className={warningBoxClass}>
              <p className={warningTitleClass}>Last chance to keep this data.</p>
              <p className={warningTextClass}>
                All data for {removeTool.tools?.name || 'this tool'} will be permanently removed. This cannot be undone.
              </p>
            </div>
            <label className={checkboxLabelClass}>
              <input
                type="checkbox"
                checked={finalAck}
                onChange={(event) => setFinalAck(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-400"
              />
              <span>I understand that all data for this tool will be permanently removed.</span>
            </label>
            <p className={`${modalBodyClass} mb-2`}>
              Type <strong>I Agree</strong> to remove this tool:
            </p>
            <input
              type="text"
              value={agreeConfirmText}
              onChange={(event) => setAgreeConfirmText(event.target.value)}
              placeholder='Type "I Agree"'
              autoFocus
              onKeyDown={(event) => {
                if (event.key === 'Escape' && !isRemoving) setRemoveStep('warn');
              }}
              className={modalInputClass}
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => !isRemoving && setRemoveStep('warn')}
                disabled={isRemoving}
                className={cancelButtonClass}
              >
                Back
              </button>
              <button
                type="button"
                disabled={!finalAck || agreeConfirmText !== 'I Agree' || isRemoving}
                onClick={() => void handleRemoveTool()}
                className={confirmDangerButtonClass}
              >
                {isRemoving ? 'Removing...' : 'Remove tool'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
