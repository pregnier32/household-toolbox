'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { asOfMonthLabel, DEFAULT_AS_OF_DATE } from '@/lib/admin-overview-stats';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function AdminOverviewPanel() {
  const [adminStatusCount, setAdminStatusCount] = useState<number | null>(null);
  const [guestUserCount, setGuestUserCount] = useState<number | null>(null);
  const [activeTrialToolsCount, setActiveTrialToolsCount] = useState<number | null>(null);
  const [avgToolsPerAdmin, setAvgToolsPerAdmin] = useState<number | null>(null);
  const [usersByMonth, setUsersByMonth] = useState<{ month: string; count: number }[]>([]);
  const [toolsByName, setToolsByName] = useState<{ id?: string; name: string; value: number }[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<number | null>(null);
  const [lifetimeRevenue, setLifetimeRevenue] = useState<number | null>(null);
  const [revenueByDay, setRevenueByDay] = useState<{ day: string; revenue: number }[]>([]);
  const [documentCount, setDocumentCount] = useState<number | null>(null);
  const [storageUsedLabel, setStorageUsedLabel] = useState<string | null>(null);
  const [asOfDate, setAsOfDate] = useState(DEFAULT_AS_OF_DATE);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingStats(true);
    fetch(`/api/admin/stats?asOf=${encodeURIComponent(asOfDate)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.adminStatusCount !== undefined) setAdminStatusCount(data.adminStatusCount);
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
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Error fetching stats:', error);
        setIsLoadingStats(false);
      });
    return () => controller.abort();
  }, [asOfDate]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-semibold text-slate-50">System Stats</h1>
        <label className="flex items-center gap-2 text-sm text-slate-300" htmlFor="system-stats-as-of">
          From
          <input
            id="system-stats-as-of"
            type="date"
            value={asOfDate}
            onChange={(event) => {
              if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) setAsOfDate(event.target.value);
            }}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 [color-scheme:dark]"
          />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <p className="mb-2 text-2xl">👥</p>
          <h3 className="mb-2 text-sm font-semibold text-slate-100">Admin Users</h3>
          {isLoadingStats ? (
            <p className="text-xs text-slate-400">Loading...</p>
          ) : (
            <>
              <p className="mb-1 text-3xl font-semibold text-emerald-400">
                {adminStatusCount !== null ? adminStatusCount : '—'}
              </p>
              <p className="mb-4 text-xs text-slate-400">Users with admin status</p>
              <div className="border-t border-slate-800 pt-3">
                <p className="mb-1 text-2xl font-semibold text-purple-400">
                  {guestUserCount !== null ? guestUserCount : '—'}
                </p>
                <p className="text-xs text-slate-400">Users with guest status</p>
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
                {monthlyRevenue !== null ? currency.format(monthlyRevenue) : '—'}
              </p>
              <p className="mb-4 text-xs text-slate-400">Collected in {asOfMonthLabel(asOfDate)}</p>
              <div className="border-t border-slate-800 pt-3">
                <p className="mb-1 text-2xl font-semibold text-emerald-400">
                  {lifetimeRevenue !== null ? currency.format(lifetimeRevenue) : '—'}
                </p>
                <p className="text-xs text-slate-400">Collected since this date</p>
              </div>
            </>
          )}
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h3 className="mb-1 text-sm font-semibold text-slate-100">Revenue by Day</h3>
          <p className="text-xs text-slate-400">Expected from live subscriptions, by day of the month</p>
          {isLoadingStats ? (
            <p className="mt-4 text-xs text-slate-400">Loading...</p>
          ) : (
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="day"
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    interval={0}
                    height={32}
                  />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} tickFormatter={(value) => `$${value.toFixed(0)}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#e2e8f0',
                    }}
                    labelFormatter={(label) => `Day ${label}`}
                    formatter={(value) => {
                      const amount = typeof value === 'number' ? value : 0;
                      return [currency.format(amount), 'Expected'];
                    }}
                  />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
