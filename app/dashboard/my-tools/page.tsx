'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserMenu } from '../../components/UserMenu';
import { SideLogo } from '../../components/SideLogo';
import { useTheme } from '../../components/AppThemeProvider';
import { completeSignOut } from '@/lib/client-sign-out';
import { isTypedRemovalConfirmation, removalConfirmationMessage } from '@/lib/tool-access-policy';

type UserTool = {
  id: string;
  status: string;
  created_at: string;
  updated_at: string | null;
  tools: {
    id: string;
    name: string;
    tool_tip: string | null;
  } | null;
  removalNotice?: string | null;
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

  const removeButtonClass = isLight
    ? 'rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50'
    : 'rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50';

  const modalBackdropClass = 'fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4';
  const modalCardClass = isLight
    ? 'w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl'
    : 'w-full max-w-lg rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl';
  const modalTitleClass = isLight ? 'mb-2 text-xl font-semibold text-slate-900' : 'mb-2 text-xl font-semibold text-slate-50';
  const modalBodyClass = isLight ? 'text-sm text-slate-700' : 'text-sm text-slate-300';
  const cancelButtonClass = isLight
    ? 'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50'
    : 'rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50';
  const confirmDangerButtonClass =
    'rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50';

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
  const [user, setUser] = useState<{ id?: string; firstName?: string; lastName?: string; householdRole?: 'admin' | 'user' } | null>(null);
  const [removeTool, setRemoveTool] = useState<UserTool | null>(null);
  const [removeConfirmText, setRemoveConfirmText] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);
  const removeConfirmed = isTypedRemovalConfirmation(removeConfirmText);

  const confirmInputClass = isLight
    ? 'mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50'
    : 'mb-4 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50';
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

  const resetRemoveFlow = () => {
    setRemoveTool(null);
    setRemoveConfirmText('');
    setIsRemoving(false);
  };

  const openRemoveFlow = (tool: UserTool) => {
    setError(null);
    setSuccess(null);
    setRemoveConfirmText('');
    setRemoveTool(tool);
  };

  const handleRemoveTool = async () => {
    if (!removeTool || !isTypedRemovalConfirmation(removeConfirmText)) return;

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
          confirmText: removeConfirmText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove tool');
      }

      const removedName = data.toolName || removeTool.tools?.name || 'Tool';
      resetRemoveFlow();
      setSuccess(data.message || `${removedName} and its saved data were permanently deleted.`);
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
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className={tbodyDivideClass}>
                    {tools.map((tool) => (
                        <tr key={tool.id} className={rowHoverClass}>
                          <td className="px-6 py-4">
                            <span className={cellNameClass}>
                              {tool.tools?.name || 'Unknown Tool'}
                            </span>
                          </td>
                          <td className={`px-6 py-4 ${cellMutedClass}`}>
                            {formatDate(tool.created_at)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {user?.householdRole === 'user' ? (
                              <span className={cellMutedClass}>Admin only</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openRemoveFlow(tool)}
                                disabled={isRemoving}
                                className={removeButtonClass}
                              >
                                {tool.status === 'removing' ? 'Try removal again' : 'Remove'}
                              </button>
                            )}
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {removeTool && (
        <div className={modalBackdropClass} onClick={() => !isRemoving && resetRemoveFlow()}>
          <div
            className={modalCardClass}
            role="dialog"
            aria-modal="true"
            aria-labelledby="my-tools-remove-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="my-tools-remove-title" className={modalTitleClass}>
              Remove {removeTool.tools?.name || 'this tool'}
            </h3>
            <p className={`${modalBodyClass} mb-4`}>{removalConfirmationMessage(removeTool.tools?.name || 'this tool')}</p>
            {removeTool.removalNotice && (
              <p className={`${modalBodyClass} mb-4`}>{removeTool.removalNotice}</p>
            )}
            <p className={`${modalBodyClass} mb-2`}>
              To confirm, please type <strong className={isLight ? 'text-slate-900' : 'text-slate-200'}>delete</strong> in the box below:
            </p>
            <input
              type="text"
              value={removeConfirmText}
              onChange={(event) => setRemoveConfirmText(event.target.value)}
              placeholder="Type 'delete' to confirm"
              autoFocus
              disabled={isRemoving}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && !isRemoving) resetRemoveFlow();
                if (event.key === 'Enter' && removeConfirmed && !isRemoving) void handleRemoveTool();
              }}
              className={confirmInputClass}
            />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={resetRemoveFlow} disabled={isRemoving} className={cancelButtonClass}>
                Cancel
              </button>
              <button
                type="button"
                disabled={isRemoving || !removeConfirmed}
                onClick={() => void handleRemoveTool()}
                className={confirmDangerButtonClass}
              >
                {isRemoving ? 'Removing...' : 'Remove tool and delete data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
