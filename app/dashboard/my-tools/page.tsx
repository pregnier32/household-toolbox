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
  tools: {
    id: string;
    name: string;
    tool_tip: string | null;
  } | null;
};

export default function MyToolsPage() {
  const [tools, setTools] = useState<UserTool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [user, setUser] = useState<{ id?: string } | null>(null);
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
          <p className="mt-1 text-sm text-slate-400">View and manage your active tools.</p>
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
              className="mt-4 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
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
                        Notes
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
                      const isInactive = tool.status === 'inactive';
                      
                      return (
                        <tr key={tool.id} className="hover:bg-slate-800/30">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-100">
                                {tool.tools?.name || 'Unknown Tool'}
                              </span>
                              {isInactive && (
                                <span className="inline-flex items-center rounded-full bg-slate-500/20 px-2 py-0.5 text-xs font-medium text-slate-300">
                                  Inactive
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-300">
                            {formatDate(tool.created_at)}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-300">
                            <span className="text-slate-400">—</span>
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-medium text-emerald-400">
                            {formatCurrency(Number(tool.price))}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleToggleActive(tool.id)}
                              disabled={inactivatingId === tool.id}
                              className="rounded bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/30 disabled:opacity-50"
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
            <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-50">Total Monthly Charge</h3>
                  <div className="mt-2 space-y-1">
                    {totalMonthlyCost > 0 && (
                      <p className="text-sm text-slate-300">
                        Active Tools: <span className="font-medium text-emerald-300">{formatCurrency(totalMonthlyCost)}</span>
                      </p>
                    )}
                    {totalMonthlyCost === 0 && (
                      <p className="text-sm text-slate-400">
                        No active tools
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-end">
                  <div className="text-right">
                    <p className="text-3xl font-semibold text-emerald-400">
                      {formatCurrency(totalMonthlyCost)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">per month</p>
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


