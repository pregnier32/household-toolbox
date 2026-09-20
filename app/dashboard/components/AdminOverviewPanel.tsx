'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function AdminOverviewPanel() {
  const [activeUserCount, setActiveUserCount] = useState<number | null>(null);
  const [guestUserCount, setGuestUserCount] = useState<number | null>(null);
  const [activeTrialToolsCount, setActiveTrialToolsCount] = useState<number | null>(null);
  const [avgToolsPerAdmin, setAvgToolsPerAdmin] = useState<number | null>(null);
  const [usersByMonth, setUsersByMonth] = useState<{ month: string; count: number }[]>([]);
  const [toolsByName, setToolsByName] = useState<{ id?: string; name: string; value: number }[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<number | null>(null);
  const [lifetimeRevenue, setLifetimeRevenue] = useState<number | null>(null);
  const [revenueByDay, setRevenueByDay] = useState<{ date: string; revenue: number }[]>([]);
  const [documentCount, setDocumentCount] = useState<number | null>(null);
  const [storageUsedLabel, setStorageUsedLabel] = useState<string | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  useEffect(() => {
    setIsLoadingStats(true);
    fetch('/api/admin/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data.activeUserCount !== undefined) setActiveUserCount(data.activeUserCount);
        if (data.guestUserCount !== undefined) setGuestUserCount(data.guestUserCount);
        if (data.activeTrialToolsCount !== undefined) setActiveTrialToolsCount(data.activeTrialToolsCount);
        if (data.avgToolsPerAdmin !== undefined) setAvgToolsPerAdmin(data.avgToolsPerAdmin);
        if (data.usersByMonth) setUsersByMonth(data.usersByMonth);
        if (data.toolsByName) setToolsByName(data.toolsByName);
        if (data.monthlyRevenue !== undefined) setMonthlyRevenue(data.monthlyRevenue);
        if (data.lifetimeRevenue !== undefined) setLifetimeRevenue(data.lifetimeRevenue);
        if (data.revenueByDay) setRevenueByDay(data.revenueByDay);
        if (data.documentCount !== undefined) setDocumentCount(data.documentCount);
        if (data.storageUsedLabel !== undefined) setStorageUsedLabel(data.storageUsedLabel);
        setIsLoadingStats(false);
      })
      .catch((error) => {
        console.error('Error fetching stats:', error);
        setIsLoadingStats(false);
      });
  }, []);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-slate-50">System Stats</h1>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <p className="mb-2 text-2xl">👥</p>
          <h3 className="mb-2 text-sm font-semibold text-slate-100">Active Users</h3>
          {isLoadingStats ? (
            <p className="text-xs text-slate-400">Loading...</p>
          ) : (
            <>
              <p className="mb-1 text-3xl font-semibold text-emerald-400">
                {activeUserCount !== null ? activeUserCount : '—'}
              </p>
              <p className="mb-4 text-xs text-slate-400">Users with active status</p>
              <div className="border-t border-slate-800 pt-3">
                <p className="mb-1 text-2xl font-semibold text-purple-400">
                  {guestUserCount !== null ? guestUserCount : '—'}
                </p>
                <p className="text-xs text-slate-400">Guest users</p>
              </div>
            </>
          )}
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <p className="mb-2 text-2xl">🔧</p>
          <h3 className="mb-2 text-sm font-semibold text-slate-100">Active Tools</h3>
          {isLoadingStats ? (
            <p className="text-xs text-slate-400">Loading...</p>
          ) : (
            <>
              <p className="mb-1 text-3xl font-semibold text-emerald-400">
                {activeTrialToolsCount !== null ? activeTrialToolsCount : '—'}
              </p>
              <p className="mb-4 text-xs text-slate-400">Tools with active status</p>
              <div className="border-t border-slate-800 pt-3">
                <p className="mb-1 text-2xl font-semibold text-emerald-400">
                  {avgToolsPerAdmin !== null ? avgToolsPerAdmin.toFixed(2) : '—'}
                </p>
                <p className="text-xs text-slate-400">Average Tools per admin user</p>
              </div>
            </>
          )}
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <p className="mb-2 text-2xl">📄</p>
          <h3 className="mb-2 text-sm font-semibold text-slate-100">Documents</h3>
          {isLoadingStats ? (
            <p className="text-xs text-slate-400">Loading...</p>
          ) : (
            <>
              <p className="mb-1 text-3xl font-semibold text-emerald-400">
                {documentCount !== null ? documentCount.toLocaleString('en-US') : '—'}
              </p>
              <p className="mb-4 text-xs text-slate-400">Files stored in Supabase</p>
              <div className="border-t border-slate-800 pt-3">
                <p className="mb-1 text-2xl font-semibold text-emerald-400">
                  {storageUsedLabel ?? '—'}
                </p>
                <p className="text-xs text-slate-400">Total memory usage</p>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h3 className="mb-2 text-sm font-semibold text-slate-100">Users Created by Month</h3>
          {isLoadingStats ? (
            <p className="text-xs text-slate-400">Loading...</p>
          ) : usersByMonth.length > 0 ? (
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={usersByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#e2e8f0',
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-slate-400">No data available</p>
          )}
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h3 className="mb-2 text-sm font-semibold text-slate-100">Tools by Name</h3>
          {isLoadingStats ? (
            <p className="text-xs text-slate-400">Loading...</p>
          ) : toolsByName.length > 0 ? (
            <div className="mt-3 max-h-72 overflow-y-auto pr-5">
              <div className="mb-1 flex items-center gap-4 text-xs uppercase tracking-wide text-slate-500">
                <span className="w-12 shrink-0 text-right">Active</span>
                <span>Tool</span>
              </div>
              <ul className="divide-y divide-slate-800">
                {toolsByName.map((tool, index) => (
                  <li
                    key={tool.id || `${tool.name}-${index}`}
                    className="flex items-center gap-4 py-2"
                  >
                    <span className="w-12 shrink-0 text-right tabular-nums text-sm font-semibold text-slate-100">
                      {tool.value}
                    </span>
                    <span className="text-sm text-slate-200">{tool.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-slate-400">No data available</p>
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <p className="mb-2 text-2xl">💰</p>
          <h3 className="mb-2 text-sm font-semibold text-slate-100">Monthly Revenue</h3>
          {isLoadingStats ? (
            <p className="text-xs text-slate-400">Loading...</p>
          ) : (
            <>
              <p className="mb-1 text-3xl font-semibold text-emerald-400">
                {monthlyRevenue !== null
                  ? new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(monthlyRevenue)
                  : '—'}
              </p>
              <p className="mb-4 text-xs text-slate-400">Legacy billing removed</p>
              <div className="border-t border-slate-800 pt-3">
                <p className="mb-1 text-2xl font-semibold text-emerald-400">
                  {lifetimeRevenue !== null
                    ? new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(lifetimeRevenue)
                    : '—'}
                </p>
                <p className="text-xs text-slate-400">Lifetime Revenue</p>
              </div>
            </>
          )}
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h3 className="mb-2 text-sm font-semibold text-slate-100">Revenue by Day</h3>
          {isLoadingStats ? (
            <p className="text-xs text-slate-400">Loading...</p>
          ) : revenueByDay.length > 0 ? (
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    style={{ fontSize: '12px' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} tickFormatter={(value) => `$${value.toFixed(0)}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#e2e8f0',
                    }}
                    formatter={(value: number) => [
                      new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(value),
                      'Revenue',
                    ]}
                  />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-slate-400">No data available</p>
          )}
        </div>
      </div>
    </div>
  );
}
