'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type CronJobLog = {
  id: string;
  job_name: string;
  status: 'success' | 'error' | 'warning';
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  message: string | null;
  error_details: string | null;
  execution_data: Record<string, any> | null;
  created_at: string;
};

export default function CronLogsPage() {
  const [logs, setLogs] = useState<CronJobLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ userStatus?: string } | null>(null);
  const [filters, setFilters] = useState({
    jobName: '',
    status: '',
  });
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 100,
    offset: 0,
    hasMore: false,
  });
  const router = useRouter();

  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
      });
      
      if (filters.jobName) {
        params.append('job_name', filters.jobName);
      }
      if (filters.status) {
        params.append('status', filters.status);
      }

      const response = await fetch(`/api/admin/cron-logs?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load logs');
      }

      setLogs(data.logs || []);
      setPagination(data.pagination || pagination);
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load logs');
      setIsLoading(false);
    }
  }, [filters.jobName, filters.status, pagination.limit, pagination.offset]);

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
        } else {
          router.push('/');
        }
      })
      .catch(() => {
        router.push('/');
      });
  }, [router]);

  useEffect(() => {
    if (user?.userStatus === 'superadmin') {
      loadLogs();
    }
  }, [user?.userStatus, loadLogs]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50';
      case 'error':
        return 'bg-red-500/20 text-red-300 border-red-500/50';
      case 'warning':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/50';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/50';
    }
  };

  if (isLoading && logs.length === 0) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-slate-400">Loading cron job logs...</div>
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
          <h1 className="text-2xl font-semibold text-slate-50">Cron Job Logs</h1>
          <p className="mt-1 text-sm text-slate-400">
            View execution history and status of automated cron jobs
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="jobName" className="block text-sm font-medium text-slate-200 mb-1">
              Job Name
            </label>
            <input
              type="text"
              id="jobName"
              value={filters.jobName}
              onChange={(e) => {
                setFilters({ ...filters, jobName: e.target.value });
                setPagination({ ...pagination, offset: 0 });
              }}
              placeholder="Filter by job name..."
              className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="status" className="block text-sm font-medium text-slate-200 mb-1">
              Status
            </label>
            <select
              id="status"
              value={filters.status}
              onChange={(e) => {
                setFilters({ ...filters, status: e.target.value });
                setPagination({ ...pagination, offset: 0 });
              }}
              className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
            </select>
          </div>
        </div>

        {/* Logs Table */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Job Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Started At
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Message
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-sm text-slate-200">
                        <code className="text-emerald-400">{log.job_name}</code>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                            log.status
                          )}`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {formatDate(log.started_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {formatDuration(log.duration_ms)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {log.message || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <details className="cursor-pointer">
                          <summary className="text-emerald-400 hover:text-emerald-300">
                            View
                          </summary>
                          <div className="mt-2 p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-xs">
                            {log.error_details && (
                              <div className="mb-2">
                                <strong className="text-red-400">Error:</strong>
                                <pre className="mt-1 text-red-300 whitespace-pre-wrap break-words">
                                  {log.error_details}
                                </pre>
                              </div>
                            )}
                            {log.execution_data && Object.keys(log.execution_data).length > 0 && (
                              <div>
                                <strong className="text-slate-300">Execution Data:</strong>
                                <pre className="mt-1 text-slate-400 whitespace-pre-wrap break-words">
                                  {JSON.stringify(log.execution_data, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {pagination.total > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-slate-400">
              Showing {pagination.offset + 1} to{' '}
              {Math.min(pagination.offset + pagination.limit, pagination.total)} of{' '}
              {pagination.total} logs
            </div>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setPagination({ ...pagination, offset: Math.max(0, pagination.offset - pagination.limit) })
                }
                disabled={pagination.offset === 0}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination({ ...pagination, offset: pagination.offset + pagination.limit })}
                disabled={!pagination.hasMore}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

