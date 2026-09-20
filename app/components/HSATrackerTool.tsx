'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from './AppThemeProvider';
import { useAppNotice } from './AppNotice';
import { AttachmentButton } from './AttachmentButton';
import { AttachmentModal } from './AttachmentModal';
import { ExportPdfIconButton } from './ExportPdfIconButton';
import {
  canPreviewAttachment,
  createPendingAttachment,
  isImageAttachment,
  isPdfAttachment,
  type AttachmentItem,
} from '@/lib/attachments';

function generateId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatDateForDisplay(isoDate: string): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${Number(m)}/${Number(d)}/${y}`;
}

function formatMoney(n: number): string {
  const value = typeof n === 'number' && !Number.isNaN(n) ? n : 0;
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatReportDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function ReceiptNeededWarning({ isLight }: { isLight: boolean }) {
  return (
    <div
      className={`mt-2 flex items-center gap-2 text-xs font-medium ${isLight ? 'text-amber-700' : 'text-amber-300'}`}
      role="status"
      aria-label="Receipt still needed — attach a receipt. This is not Reimbursable pending."
    >
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-500/15 p-1 text-amber-500"
        aria-hidden
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </span>
      <span>Receipt still needed — attach a receipt. This is not Reimbursable pending.</span>
    </div>
  );
}

type DepositSource = 'Payroll' | 'Employer' | 'Personal' | 'Other';
type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

function recurrenceFrequencyLabel(frequency: RecurrenceFrequency | null): string {
  switch (frequency) {
    case 'weekly':
      return 'Weekly';
    case 'biweekly':
      return 'Biweekly';
    case 'monthly':
      return 'Monthly';
    case 'quarterly':
      return 'Quarterly';
    case 'yearly':
      return 'Yearly';
    default:
      return '';
  }
}

export type DepositRecord = {
  id: string;
  name: string;
  date: string;
  amount: number;
  source: DepositSource;
  taxYear: number;
  note: string;
  isRepeatable: boolean;
  recurrenceFrequency: RecurrenceFrequency | null;
  recurrenceStart: string | null;
  recurrenceEnd: string | null;
};

type ExpenseCategory = 'Doctor Visit' | 'Dental' | 'Vision' | 'Prescription' | 'Other';
type PaymentMethod = 'HSA Card' | 'Out of Pocket';

export type ExpenseRecord = {
  id: string;
  name: string;
  date: string;
  amount: number;
  providerOrStore: string;
  category: ExpenseCategory;
  paymentMethod: PaymentMethod;
  reimbursedYet: 'Yes' | 'No';
  reimbursementDate: string | null;
  attachments: Array<{ id: string; name: string; size: number; type: string }>;
  warnUntilReceipt: boolean;
  notes: string;
};

type HsaAccount = {
  id: string;
  name: string;
  card_color: string;
  contributionLimits: Record<string, number>;
  deposits: DepositRecord[];
  expenses: ExpenseRecord[];
};

type MainTab = 'summary' | 'deposits' | 'expenses';

function balanceBeforeYear(deposits: DepositRecord[], expenses: ExpenseRecord[], year: number): number {
  const boundary = `${year}-01-01`;
  let b = 0;
  for (const d of deposits) {
    if (d.date < boundary) b += d.amount;
  }
  for (const e of expenses) {
    if (e.date < boundary) b -= e.amount;
  }
  return b;
}

function balanceThroughDate(deposits: DepositRecord[], expenses: ExpenseRecord[], isoMaxDate: string): number {
  let b = 0;
  for (const d of deposits) {
    if (d.date <= isoMaxDate) b += d.amount;
  }
  for (const e of expenses) {
    if (e.date <= isoMaxDate) b -= e.amount;
  }
  return b;
}

function sumInCalendarYear<T extends { date: string; amount: number }>(rows: T[], year: number, sign: 1 | -1): number {
  const y = String(year);
  return rows
    .filter((r) => r.date.startsWith(y))
    .reduce((acc, r) => acc + sign * r.amount, 0);
}

type HSATrackerToolProps = {
  toolId?: string;
};

function lastAccountStorageKey(toolId: string) {
  return `hsa-last-account:${toolId}`;
}

function accountsCacheKey(toolId: string) {
  return `hsa-accounts-cache:${toolId}`;
}

function readLastAccountId(toolId: string): string | null {
  try {
    return localStorage.getItem(lastAccountStorageKey(toolId));
  } catch {
    return null;
  }
}

function writeLastAccountId(toolId: string, accountId: string) {
  try {
    localStorage.setItem(lastAccountStorageKey(toolId), accountId);
  } catch {
    /* ignore quota / private mode */
  }
}

function readAccountsCache(toolId: string): HsaAccount[] {
  try {
    const raw = sessionStorage.getItem(accountsCacheKey(toolId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HsaAccount[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a) => a && typeof a.id === 'string' && typeof a.name === 'string')
      .map((a) => ({ ...a, contributionLimits: a.contributionLimits ?? {} }));
  } catch {
    return [];
  }
}

function writeAccountsCache(toolId: string, list: HsaAccount[]) {
  try {
    sessionStorage.setItem(accountsCacheKey(toolId), JSON.stringify(list));
  } catch {
    /* ignore quota / private mode */
  }
}

function parseContributionLimitInput(raw: string): number | undefined {
  const t = raw.trim();
  if (t === '') return undefined;
  const n = parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100) / 100;
}

function getLimitForYear(limits: Record<string, number> | undefined, year: number): number | undefined {
  if (!limits) return undefined;
  const v = limits[String(year)];
  if (v == null) return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function pickOpenAccountId(list: HsaAccount[], prev: string | null, toolId?: string): string | null {
  if (!list.length) return null;
  const ids = new Set(list.map((a) => a.id));
  if (prev && ids.has(prev)) return prev;
  const lastUsed = toolId ? readLastAccountId(toolId) : null;
  if (lastUsed && ids.has(lastUsed)) return lastUsed;
  if (list.length === 1) return list[0].id;
  const self = list.find((a) => a.name === 'Self');
  if (self) return self.id;
  return list[0].id;
}

export function HSATrackerTool({ toolId }: HSATrackerToolProps) {
  const { resolvedTheme } = useTheme();
  const { showError } = useAppNotice();
  const isLight = resolvedTheme === 'light';

  const cardClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'
    : 'rounded-2xl border border-slate-800 bg-slate-900/70 p-4';
  const titleClass = isLight ? 'text-2xl font-semibold text-slate-900 mb-2' : 'text-2xl font-semibold text-slate-50 mb-2';
  const descClass = isLight ? 'text-slate-600 text-sm' : 'text-slate-400 text-sm';
  const labelClass = isLight ? 'block text-sm font-medium text-slate-700 mb-3' : 'block text-sm font-medium text-slate-300 mb-3';
  const labelClassSm = isLight ? 'block text-xs font-medium text-slate-700 mb-1.5' : 'block text-xs font-medium text-slate-300 mb-1.5';
  const inputClassPad = isLight
    ? 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const primaryButtonClass = isLight
    ? 'rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50'
    : 'rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50';
  const primaryButtonXsClass = isLight
    ? 'flex-1 rounded px-2 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed'
    : 'flex-1 rounded bg-emerald-500 px-2 py-1 text-xs font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed';
  const secondaryButtonClass = isLight
    ? 'px-4 py-2 rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors'
    : 'px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors';
  const secondaryButtonSmClass = isLight
    ? 'px-2 py-1 rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-800 text-xs hover:bg-slate-200'
    : 'px-2 py-1 rounded border border-slate-600 bg-slate-700 text-slate-200 text-xs hover:bg-slate-600';
  const tabActiveClass = isLight
    ? 'border-b-2 border-emerald-600 text-emerald-900 font-semibold'
    : 'border-b-2 border-emerald-500 text-emerald-300';
  const tabInactiveClass = isLight
    ? 'border-b-2 border-transparent text-slate-600 hover:text-slate-900'
    : 'border-b-2 border-transparent text-slate-400 hover:text-slate-300';
  const tabStripClass = isLight ? 'border-b border-slate-200' : 'border-b border-slate-800';
  const tabStripBorderClass = isLight ? 'border-slate-200' : 'border-slate-800';
  const mutedSmallClass = isLight ? 'text-xs text-slate-600' : 'text-xs text-slate-400';
  const addCategorySquareClass = isLight
    ? 'px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-700 hover:border-emerald-500/50 hover:bg-emerald-50 hover:text-emerald-800 transition-all duration-200 flex items-center justify-center min-w-[60px]'
    : 'px-4 py-3 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300 transition-all duration-200 flex items-center justify-center min-w-[60px]';
  const popupMenuClass = isLight
    ? 'absolute top-10 right-0 z-50 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5 min-w-[160px] py-1'
    : 'absolute top-10 right-0 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-lg min-w-[160px] py-1';
  const popupItemClass = isLight
    ? 'w-full px-4 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 flex items-center gap-2'
    : 'w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-2';
  const popupItemDangerClass = isLight
    ? 'w-full px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 flex items-center gap-2'
    : 'w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 transition-colors flex items-center gap-2';
  const modalBackdropClass = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4';
  const modalCardConfirmClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 max-w-md w-full mx-4 shadow-2xl'
    : 'rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4';
  const modalTitleClass = isLight ? 'text-xl font-semibold text-slate-900' : 'text-xl font-semibold text-slate-50';
  const deleteWarningBoxClass = isLight
    ? 'rounded-lg border border-red-300 bg-red-50 px-4 py-3 mb-4'
    : 'rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4';
  const deleteWarningTextClass = isLight ? 'text-red-700 font-semibold mb-2' : 'text-red-300 font-semibold mb-2';
  const deleteInstructionTextClass = isLight ? 'text-slate-700 mb-4' : 'text-slate-300 mb-4';
  const deleteConfirmInputClass = isLight
    ? 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4'
    : 'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4';
  const nestedRowCardClass = isLight
    ? 'rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm'
    : 'rounded-xl border border-slate-700/80 bg-slate-800/40 p-4';
  const kpiCardClass = isLight
    ? 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm'
    : 'rounded-xl border border-slate-800 bg-slate-900/60 p-4';
  const currencyFieldWrapClass = isLight
    ? 'flex items-stretch overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50'
    : 'flex items-stretch overflow-hidden rounded-lg border border-slate-700 bg-slate-900/70 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50';
  const currencyFieldPrefixClass = isLight
    ? 'flex shrink-0 items-center border-r border-slate-300 bg-slate-50 px-3 text-sm tabular-nums text-slate-700'
    : 'flex shrink-0 items-center border-r border-slate-600 bg-slate-800/80 px-3 text-sm tabular-nums text-slate-200';
  const currencyFieldInputClass = isLight
    ? 'min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm tabular-nums text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-0'
    : 'min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm tabular-nums text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-0';

  const rowIconEmeraldClass =
    resolvedTheme === 'light'
      ? 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-700 bg-white p-2 text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white'
      : 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-500/50 bg-slate-800/50 p-2 text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';
  const rowIconDangerClass =
    resolvedTheme === 'light'
      ? 'inline-flex items-center justify-center rounded-lg border-2 border-red-300 bg-white p-2 text-red-700 transition-colors hover:bg-red-50 hover:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2 focus:ring-offset-white'
      : 'inline-flex items-center justify-center rounded-lg border-2 border-red-500/50 bg-slate-800/50 p-2 text-red-400 transition-colors hover:border-red-400 hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';
  const successAlertClass = isLight
    ? 'rounded-lg px-4 py-2 text-sm bg-emerald-50 text-emerald-900 border border-emerald-200'
    : 'rounded-lg px-4 py-2 text-sm bg-emerald-500/20 text-emerald-300';
  const errorAlertClass = isLight
    ? 'rounded-lg px-4 py-2 text-sm bg-red-50 text-red-800 border border-red-200'
    : 'rounded-lg px-4 py-2 text-sm bg-red-500/20 text-red-300';

  const [accounts, setAccounts] = useState<HsaAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [accountsLoadOk, setAccountsLoadOk] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const accountsRef = useRef<HsaAccount[]>([]);
  const loadGenRef = useRef(0);
  accountsRef.current = accounts;

  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setSaveMessage({ type, text });
    setTimeout(() => setSaveMessage(null), 3000);
  }, []);

  const loadHsaData = useCallback(async () => {
    if (!toolId) return;
    const gen = ++loadGenRef.current;
    setIsLoadingData(true);
    try {
      const res = await fetch(`/api/tools/hsa-tracker?toolId=${encodeURIComponent(toolId)}`);
      const data = await res.json().catch(() => ({}));
      if (gen !== loadGenRef.current) return;
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to load');
      const loaded = ((data.accounts ?? []) as HsaAccount[]).map((a) => ({
        ...a,
        contributionLimits: a.contributionLimits ?? {},
        expenses: (a.expenses ?? []).map((expense) => ({
          ...expense,
          attachments: expense.attachments ?? [],
        })),
      }));
      setAccounts(loaded);
      writeAccountsCache(toolId, loaded);
      setAccountsLoadOk(true);
    } catch (e) {
      if (gen !== loadGenRef.current) return;
      const cached = readAccountsCache(toolId);
      const keep = accountsRef.current.length > 0 ? accountsRef.current : cached;
      if (keep.length > 0) {
        if (keep !== accountsRef.current) setAccounts(keep);
        setAccountsLoadOk(true);
        return;
      }
      showMessage('error', e instanceof Error ? e.message : 'Failed to load HSA data');
    } finally {
      if (gen === loadGenRef.current) setIsLoadingData(false);
    }
  }, [toolId, showMessage]);

  useEffect(() => {
    if (!toolId) return;
    const cached = readAccountsCache(toolId);
    if (cached.length > 0) {
      setAccounts(cached);
      const next = pickOpenAccountId(cached, readLastAccountId(toolId), toolId);
      if (next) setSelectedAccountId(next);
    }
    loadHsaData();
    return () => {
      loadGenRef.current += 1;
    };
  }, [toolId, loadHsaData]);

  useEffect(() => {
    if (accounts.length === 0) {
      return;
    }
    if (!selectedAccountId || !accounts.some((a) => a.id === selectedAccountId)) {
      const next = pickOpenAccountId(accounts, selectedAccountId, toolId);
      setSelectedAccountId(next);
      if (next && toolId) writeLastAccountId(toolId, next);
    }
  }, [accounts, selectedAccountId, toolId]);

  useEffect(() => {
    if (toolId && accountsLoadOk) writeAccountsCache(toolId, accounts);
  }, [toolId, accounts, accountsLoadOk]);

  const apiPost = useCallback(
    async (resource: 'account' | 'deposit' | 'expense', action: string, payload: Record<string, unknown>) => {
      if (!toolId) return null;
      const res = await fetch('/api/tools/hsa-tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource, action, toolId, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage('error', data.error || 'Request failed');
        return null;
      }
      return data;
    },
    [toolId, showMessage]
  );

  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountColor, setNewAccountColor] = useState('#10b981');

  const [menuOpenAccountId, setMenuOpenAccountId] = useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingAccountName, setEditingAccountName] = useState('');
  const [editingAccountColor, setEditingAccountColor] = useState('#10b981');

  const [deleteConfirmAccountId, setDeleteConfirmAccountId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [mainTab, setMainTab] = useState<MainTab>('summary');

  const currentYear = new Date().getFullYear();
  const [summaryYear, setSummaryYear] = useState<number>(currentYear);
  const [contributionLimitDraft, setContributionLimitDraft] = useState('');

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null;

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(currentYear);
    years.add(currentYear - 1);
    for (const a of accounts) {
      for (const d of a.deposits) {
        const y = parseInt(d.date.slice(0, 4), 10);
        if (!Number.isNaN(y)) years.add(y);
      }
      for (const e of a.expenses) {
        const y = parseInt(e.date.slice(0, 4), 10);
        if (!Number.isNaN(y)) years.add(y);
      }
    }
    return [...years].sort((a, b) => b - a);
  }, [accounts, currentYear]);

  const summaryMetrics = useMemo(() => {
    if (!selectedAccount) {
      return {
        startingBalance: 0,
        balanceEndOfYear: 0,
        depositsYtd: 0,
        expensesYtd: 0,
        reimbursablePending: 0,
      };
    }
    const { deposits, expenses } = selectedAccount;
    const dec31 = `${summaryYear}-12-31`;
    const startingBalance = balanceBeforeYear(deposits, expenses, summaryYear);
    const balanceEndOfYear = balanceThroughDate(deposits, expenses, dec31);
    const depositsYtd = sumInCalendarYear(deposits, summaryYear, 1);
    const expensesYtd = sumInCalendarYear(expenses, summaryYear, 1);
    const reimbursablePending = expenses
      .filter(
        (e) =>
          e.date.startsWith(String(summaryYear)) &&
          e.paymentMethod === 'Out of Pocket' &&
          e.reimbursedYet === 'No'
      )
      .reduce((s, e) => s + e.amount, 0);
    return { startingBalance, balanceEndOfYear, depositsYtd, expensesYtd, reimbursablePending };
  }, [selectedAccount, summaryYear]);

  const storedContributionLimit = getLimitForYear(selectedAccount?.contributionLimits, summaryYear);
  const draftContributionLimit = parseContributionLimitInput(contributionLimitDraft);
  const effectiveContributionLimit =
    contributionLimitDraft.trim() === ''
      ? storedContributionLimit
      : (draftContributionLimit ?? storedContributionLimit);

  useEffect(() => {
    setContributionLimitDraft(storedContributionLimit == null ? '' : String(storedContributionLimit));
  }, [selectedAccountId, summaryYear, storedContributionLimit]);

  const applyContributionLimits = (accountId: string, nextLimits: Record<string, number>) => {
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, contributionLimits: nextLimits } : a))
    );
  };

  const saveContributionLimit = async () => {
    if (!selectedAccountId || !selectedAccount) return;
    const raw = contributionLimitDraft.trim();
    if (raw === '' && storedContributionLimit == null) return;
    if (raw !== '' && storedContributionLimit != null && parseContributionLimitInput(raw) === storedContributionLimit) {
      return;
    }
    const nextLimits = { ...selectedAccount.contributionLimits };
    if (raw === '') {
      delete nextLimits[String(summaryYear)];
    } else {
      const n = parseContributionLimitInput(raw);
      if (n == null) {
        showError('Enter a valid contribution limit of 0 or more, or leave blank.');
        setContributionLimitDraft(storedContributionLimit == null ? '' : String(storedContributionLimit));
        return;
      }
      nextLimits[String(summaryYear)] = n;
    }

    applyContributionLimits(selectedAccountId, nextLimits);

    if (toolId) {
      const data = await apiPost('account', 'update', {
        accountId: selectedAccountId,
        contributionLimits: nextLimits,
      });
      const saved = (data?.account as { contributionLimits?: Record<string, number> } | undefined)
        ?.contributionLimits;
      if (saved && Object.keys(saved).length > 0) {
        applyContributionLimits(selectedAccountId, saved);
      }
    }
  };

  const [isAddingDeposit, setIsAddingDeposit] = useState(false);
  const [editingDepositId, setEditingDepositId] = useState<string | null>(null);
  const [depositForm, setDepositForm] = useState({
    name: '',
    date: `${currentYear}-01-15`,
    amount: '',
    source: 'Payroll' as DepositSource,
    taxYear: currentYear,
    note: '',
    isRepeatable: false,
    recurrenceFrequency: 'monthly' as RecurrenceFrequency,
    recurrenceStart: `${currentYear}-01-01`,
    recurrenceEnd: '',
  });

  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    name: '',
    date: `${currentYear}-01-15`,
    amount: '',
    providerOrStore: '',
    category: 'Doctor Visit' as ExpenseCategory,
    paymentMethod: 'HSA Card' as PaymentMethod,
    reimbursedYet: 'No' as 'Yes' | 'No',
    reimbursementDate: '',
    warnUntilReceipt: false,
    notes: '',
  });
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentItem[]>([]);
  const [attachmentModal, setAttachmentModal] = useState<null | 'add' | string>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [viewPreview, setViewPreview] = useState<AttachmentItem | null>(null);

  const [deleteDepositId, setDeleteDepositId] = useState<string | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [expenseDeleteConfirmText, setExpenseDeleteConfirmText] = useState('');

  const [reportYear, setReportYear] = useState(currentYear);
  const [exportAllAccounts, setExportAllAccounts] = useState(false);
  const [exportAccountId, setExportAccountId] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [csvExportMessage, setCsvExportMessage] = useState<string | null>(null);
  const expenseDeleteConfirmed = expenseDeleteConfirmText.trim().toLowerCase() === 'delete';

  const resetDepositForm = useCallback(() => {
    const y = summaryYear;
    setDepositForm({
      name: '',
      date: `${y}-01-15`,
      amount: '',
      source: 'Payroll',
      taxYear: y,
      note: '',
      isRepeatable: false,
      recurrenceFrequency: 'monthly',
      recurrenceStart: `${y}-01-01`,
      recurrenceEnd: '',
    });
  }, [summaryYear]);

  const resetExpenseForm = useCallback(() => {
    const y = summaryYear;
    setExpenseForm({
      name: '',
      date: `${y}-01-15`,
      amount: '',
      providerOrStore: '',
      category: 'Doctor Visit',
      paymentMethod: 'HSA Card',
      reimbursedYet: 'No',
      reimbursementDate: '',
      warnUntilReceipt: false,
      notes: '',
    });
  }, [summaryYear]);

  const revokePending = (items: AttachmentItem[]) => {
    items.forEach((item) => {
      if (item.url) URL.revokeObjectURL(item.url);
    });
  };

  const selectAccount = (id: string) => {
    setSelectedAccountId(id);
    if (toolId) writeLastAccountId(toolId, id);
    setMenuOpenAccountId(null);
    setEditingAccountId(null);
    setIsCreatingAccount(false);
  };

  const startCreatingAccount = () => {
    setIsCreatingAccount(true);
    setSelectedAccountId(null);
    setEditingAccountId(null);
    setNewAccountName('');
    setNewAccountColor('#10b981');
  };

  const saveNewAccount = async () => {
    const name = newAccountName.trim();
    if (!name) return;

    if (toolId) {
      const data = await apiPost('account', 'create', { name, card_color: newAccountColor });
      if (!data?.account) return;
      const acc = data.account as HsaAccount;
      setAccounts((prev) => [...prev, { ...acc, contributionLimits: acc.contributionLimits ?? {} }]);
      setSelectedAccountId(acc.id);
      writeLastAccountId(toolId, acc.id);
      setIsCreatingAccount(false);
      showMessage('success', 'Account created');
      return;
    }

    const id = generateId();
    setAccounts((prev) => [
      ...prev,
      { id, name, card_color: newAccountColor, contributionLimits: {}, deposits: [], expenses: [] },
    ]);
    setSelectedAccountId(id);
    if (toolId) writeLastAccountId(toolId, id);
    setIsCreatingAccount(false);
  };

  const startEditingAccount = (acc: HsaAccount) => {
    setEditingAccountId(acc.id);
    setEditingAccountName(acc.name);
    setEditingAccountColor(acc.card_color);
    setMenuOpenAccountId(null);
  };

  const saveAccountEdit = async () => {
    if (!editingAccountId) return;
    const name = editingAccountName.trim();
    if (!name) return;

    if (toolId) {
      const data = await apiPost('account', 'update', {
        accountId: editingAccountId,
        name,
        card_color: editingAccountColor,
      });
      if (!data?.account) return;
      const updated = data.account as { id: string; name: string; card_color: string };
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === editingAccountId
            ? { ...a, name: updated.name, card_color: updated.card_color }
            : a
        )
      );
      setEditingAccountId(null);
      showMessage('success', 'Account updated');
      return;
    }

    setAccounts((prev) =>
      prev.map((a) =>
        a.id === editingAccountId ? { ...a, name, card_color: editingAccountColor } : a
      )
    );
    setEditingAccountId(null);
  };

  const confirmDeleteAccount = async () => {
    if (!deleteConfirmAccountId || accounts.length <= 1) return;

    if (toolId) {
      const data = await apiPost('account', 'delete', { accountId: deleteConfirmAccountId });
      if (!data) return;
      await loadHsaData();
      setDeleteConfirmAccountId(null);
      setDeleteConfirmText('');
      showMessage('success', 'Account deleted');
      return;
    }

    setAccounts((prev) => prev.filter((a) => a.id !== deleteConfirmAccountId));
    if (selectedAccountId === deleteConfirmAccountId) {
      const remaining = accounts.filter((a) => a.id !== deleteConfirmAccountId);
      const next = remaining[0]?.id ?? null;
      setSelectedAccountId(next);
      if (next && toolId) writeLastAccountId(toolId, next);
    }
    setDeleteConfirmAccountId(null);
    setDeleteConfirmText('');
  };

  const saveDeposit = async () => {
    if (!selectedAccountId) return;
    const amount = parseFloat(depositForm.amount);
    if (!depositForm.name.trim() || Number.isNaN(amount) || amount <= 0) return;

    const payload = {
      accountId: selectedAccountId,
      name: depositForm.name.trim(),
      date: depositForm.date,
      amount,
      source: depositForm.source,
      taxYear: depositForm.taxYear,
      note: depositForm.note.trim(),
      isRepeatable: depositForm.isRepeatable,
      recurrenceFrequency: depositForm.isRepeatable ? depositForm.recurrenceFrequency : null,
      recurrenceStart: depositForm.isRepeatable ? depositForm.recurrenceStart : null,
      recurrenceEnd: depositForm.isRepeatable && depositForm.recurrenceEnd ? depositForm.recurrenceEnd : null,
    };

    if (toolId) {
      const action = editingDepositId ? 'update' : 'create';
      const data = await apiPost('deposit', action, {
        ...payload,
        ...(editingDepositId ? { depositId: editingDepositId } : {}),
      });
      if (!data?.deposit) return;
      const row = data.deposit as DepositRecord;
      setAccounts((prev) =>
        prev.map((a) => {
          if (a.id !== selectedAccountId) return a;
          if (editingDepositId) {
            return { ...a, deposits: a.deposits.map((d) => (d.id === editingDepositId ? row : d)) };
          }
          return { ...a, deposits: [...a.deposits, row] };
        })
      );
      setIsAddingDeposit(false);
      setEditingDepositId(null);
      resetDepositForm();
      showMessage('success', editingDepositId ? 'Deposit updated' : 'Deposit saved');
      return;
    }

    const row: DepositRecord = {
      id: editingDepositId ?? generateId(),
      ...payload,
      note: payload.note,
      isRepeatable: payload.isRepeatable,
      recurrenceFrequency: payload.recurrenceFrequency,
      recurrenceStart: payload.recurrenceStart,
      recurrenceEnd: payload.recurrenceEnd,
    };

    setAccounts((prev) =>
      prev.map((a) => {
        if (a.id !== selectedAccountId) return a;
        if (editingDepositId) {
          return { ...a, deposits: a.deposits.map((d) => (d.id === editingDepositId ? row : d)) };
        }
        return { ...a, deposits: [...a.deposits, row] };
      })
    );
    setIsAddingDeposit(false);
    setEditingDepositId(null);
    resetDepositForm();
  };

  const startEditDeposit = (d: DepositRecord) => {
    setEditingDepositId(d.id);
    setIsAddingDeposit(true);
    setDepositForm({
      name: d.name,
      date: d.date,
      amount: String(d.amount),
      source: d.source,
      taxYear: d.taxYear,
      note: d.note,
      isRepeatable: d.isRepeatable,
      recurrenceFrequency: d.recurrenceFrequency ?? 'monthly',
      recurrenceStart: d.recurrenceStart ?? `${currentYear}-01-01`,
      recurrenceEnd: d.recurrenceEnd ?? '',
    });
  };

  const removeDeposit = async () => {
    if (!deleteDepositId || !selectedAccountId) return;

    if (toolId) {
      const data = await apiPost('deposit', 'delete', { depositId: deleteDepositId });
      if (!data) return;
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === selectedAccountId
            ? { ...a, deposits: a.deposits.filter((d) => d.id !== deleteDepositId) }
            : a
        )
      );
      setDeleteDepositId(null);
      showMessage('success', 'Deposit deleted');
      return;
    }

    setAccounts((prev) =>
      prev.map((a) =>
        a.id === selectedAccountId
          ? { ...a, deposits: a.deposits.filter((d) => d.id !== deleteDepositId) }
          : a
      )
    );
    setDeleteDepositId(null);
  };

  const saveExpense = async () => {
    if (!selectedAccountId) return;
    const amount = parseFloat(expenseForm.amount);
    if (!expenseForm.name.trim() || Number.isNaN(amount) || amount <= 0) return;

    const reimbursementDate =
      expenseForm.reimbursedYet === 'Yes' && expenseForm.reimbursementDate
        ? expenseForm.reimbursementDate
        : null;

    const payload = {
      accountId: selectedAccountId,
      name: expenseForm.name.trim(),
      date: expenseForm.date,
      amount,
      providerOrStore: expenseForm.providerOrStore.trim(),
      category: expenseForm.category,
      paymentMethod: expenseForm.paymentMethod,
      reimbursedYet: expenseForm.reimbursedYet,
      reimbursementDate,
      warnUntilReceipt: expenseForm.warnUntilReceipt,
      notes: expenseForm.notes.trim(),
    };

    if (toolId) {
      const action = editingExpenseId ? 'update' : 'create';
      const data = await apiPost('expense', action, {
        ...payload,
        ...(editingExpenseId ? { expenseId: editingExpenseId } : {}),
      });
      if (!data?.expense) return;
      const row = { ...(data.expense as ExpenseRecord), attachments: (data.expense as ExpenseRecord).attachments ?? [] };
      const createdExpenseId = row.id;
      if (!editingExpenseId && createdExpenseId && pendingAttachments.length > 0) {
        try {
          for (const queued of pendingAttachments) {
            if (!queued.file) continue;
            const formData = new FormData();
            formData.append('toolId', toolId);
            formData.append('expenseId', createdExpenseId);
            formData.append('file', queued.file);
            const uploadResponse = await fetch('/api/tools/hsa-tracker/attachments', { method: 'POST', body: formData });
            if (!uploadResponse.ok) {
              const errorData = await uploadResponse.json().catch(() => ({}));
              throw new Error(errorData.error || 'Expense saved, but a file failed to upload.');
            }
          }
        } catch (uploadError) {
          revokePending(pendingAttachments);
          setPendingAttachments([]);
          setAttachmentModal(null);
          setViewPreview(null);
          resetExpenseForm();
          setIsAddingExpense(false);
          setEditingExpenseId(null);
          await loadHsaData();
          showMessage('error', uploadError instanceof Error ? uploadError.message : 'Expense saved, but a file failed to upload.');
          return;
        }
      }
      revokePending(pendingAttachments);
      setPendingAttachments([]);
      setAttachmentModal(null);
      setViewPreview(null);
      if (!editingExpenseId && pendingAttachments.length > 0) {
        await loadHsaData();
      } else {
        setAccounts((prev) =>
          prev.map((a) => {
            if (a.id !== selectedAccountId) return a;
            if (editingExpenseId) {
              return { ...a, expenses: a.expenses.map((e) => (e.id === editingExpenseId ? { ...row, attachments: e.attachments } : e)) };
            }
            return { ...a, expenses: [...a.expenses, row] };
          })
        );
      }
      setIsAddingExpense(false);
      setEditingExpenseId(null);
      resetExpenseForm();
      showMessage('success', editingExpenseId ? 'Expense updated' : 'Expense saved');
      return;
    }

    const row: ExpenseRecord = {
      id: editingExpenseId ?? generateId(),
      ...payload,
      attachments: pendingAttachments.map((item) => ({
        id: item.id,
        name: item.name,
        size: item.size,
        type: item.type,
      })),
      reimbursementDate,
    };

    setAccounts((prev) =>
      prev.map((a) => {
        if (a.id !== selectedAccountId) return a;
        if (editingExpenseId) {
          return { ...a, expenses: a.expenses.map((e) => (e.id === editingExpenseId ? row : e)) };
        }
        return { ...a, expenses: [...a.expenses, row] };
      })
    );
    setIsAddingExpense(false);
    setEditingExpenseId(null);
    resetExpenseForm();
  };

  const startAddingExpense = () => {
    revokePending(pendingAttachments);
    setPendingAttachments([]);
    setAttachmentModal(null);
    setViewPreview(null);
    setEditingExpenseId(null);
    resetExpenseForm();
    setIsAddingExpense(true);
  };

  const cancelExpenseForm = () => {
    revokePending(pendingAttachments);
    setPendingAttachments([]);
    setAttachmentModal(null);
    setViewPreview(null);
    setIsAddingExpense(false);
    setEditingExpenseId(null);
    resetExpenseForm();
  };

  const startEditExpense = (e: ExpenseRecord) => {
    revokePending(pendingAttachments);
    setPendingAttachments([]);
    setAttachmentModal(null);
    setViewPreview(null);
    setEditingExpenseId(e.id);
    setIsAddingExpense(true);
    setExpenseForm({
      name: e.name,
      date: e.date,
      amount: String(e.amount),
      providerOrStore: e.providerOrStore,
      category: e.category,
      paymentMethod: e.paymentMethod,
      reimbursedYet: e.reimbursedYet,
      reimbursementDate: e.reimbursementDate ?? '',
      warnUntilReceipt: e.warnUntilReceipt,
      notes: e.notes,
    });
  };

  const savedAttachmentExpense =
    attachmentModal && attachmentModal !== 'add'
      ? selectedAccount?.expenses.find((expense) => expense.id === attachmentModal) || null
      : null;

  const modalFiles: AttachmentItem[] =
    attachmentModal === 'add'
      ? pendingAttachments
      : savedAttachmentExpense
        ? (savedAttachmentExpense.attachments || []).map((item) => ({
            id: item.id,
            name: item.name,
            size: item.size,
            type: item.type,
          }))
        : [];

  const fetchHsaAttachmentBlob = async (attachmentId: string, inline = false) => {
    const query = inline ? '?inline=1' : '';
    const response = await fetch(`/api/tools/hsa-tracker/attachments/${attachmentId}${query}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to open file' }));
      throw new Error(errorData.error || 'Failed to open file');
    }
    return response.blob();
  };

  const handleViewAttachment = async (item: AttachmentItem) => {
    if (item.file && item.url) {
      if (isImageAttachment(item.type)) {
        setViewPreview(item);
        return;
      }
      if (isPdfAttachment(item.type, item.name)) {
        window.open(item.url, '_blank', 'noopener,noreferrer');
        return;
      }
      showError('This file type can’t be previewed in the browser. Use Download to save it.');
      return;
    }
    try {
      const blob = await fetchHsaAttachmentBlob(item.id, true);
      const type = blob.type || item.type || '';
      if (!canPreviewAttachment(type, item.name)) {
        showError('This file type can’t be previewed in the browser. Use Download to save it.');
        return;
      }
      const url = window.URL.createObjectURL(blob);
      if (isImageAttachment(type)) {
        setViewPreview({ ...item, type, url, size: item.size || blob.size });
        return;
      }
      if (isPdfAttachment(type, item.name)) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to open file');
    }
  };

  const handleDownloadAttachment = async (item: AttachmentItem): Promise<boolean> => {
    if (item.file) return false;
    try {
      const blob = await fetchHsaAttachmentBlob(item.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.name || 'attachment';
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      return true;
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to download file');
      return false;
    }
  };

  const addSavedExpenseFiles = async (expenseId: string, files: File[]) => {
    if (!toolId) return;
    setAttachmentBusy(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('toolId', toolId);
        formData.append('expenseId', expenseId);
        formData.append('file', file);
        const response = await fetch('/api/tools/hsa-tracker/attachments', { method: 'POST', body: formData });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Failed to add file');
      }
      await loadHsaData();
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to add file');
    } finally {
      setAttachmentBusy(false);
    }
  };

  const removeSavedExpenseFile = async (attachmentId: string) => {
    if (!toolId) return;
    setAttachmentBusy(true);
    try {
      const response = await fetch('/api/tools/hsa-tracker/attachments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, attachmentId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to remove file');
      await loadHsaData();
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to remove file');
    } finally {
      setAttachmentBusy(false);
    }
  };

  const removeExpense = async () => {
    if (!deleteExpenseId || !selectedAccountId) return;
    if (!expenseDeleteConfirmed) return;

    if (toolId) {
      const data = await apiPost('expense', 'delete', { expenseId: deleteExpenseId });
      if (!data) return;
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === selectedAccountId
            ? { ...a, expenses: a.expenses.filter((e) => e.id !== deleteExpenseId) }
            : a
        )
      );
      setDeleteExpenseId(null);
      setExpenseDeleteConfirmText('');
      showMessage('success', 'Expense deleted');
      return;
    }

    setAccounts((prev) =>
      prev.map((a) =>
        a.id === selectedAccountId
          ? { ...a, expenses: a.expenses.filter((e) => e.id !== deleteExpenseId) }
          : a
      )
    );
    setDeleteExpenseId(null);
    setExpenseDeleteConfirmText('');
  };

  const exportToPDF = async () => {
    if (isExportingPdf) return;
    const chosenAccount = accounts.find((account) => account.id === exportAccountId) ?? null;
    if (!exportAllAccounts && !chosenAccount) {
      showError('Select an HSA account, or choose All accounts.');
      return;
    }
    const useAllAccounts = exportAllAccounts;
    const accountsToExport = useAllAccounts
      ? accounts
      : chosenAccount
        ? [chosenAccount]
        : [];
    if (accountsToExport.length === 0) {
      showError('Select an HSA account, or choose All accounts.');
      return;
    }
    if (!reportYear) {
      showError('Select a calendar year.');
      return;
    }

    setIsExportingPdf(true);

    try {
      const year = reportYear;
      const inYear = (iso: string) => iso.startsWith(String(year));
      const accountLabel = useAllAccounts ? 'All accounts' : chosenAccount?.name || 'Selected account';

      const accountBlocks = accountsToExport.map((account) => {
        const yearDeposits = [...account.deposits]
          .filter((deposit) => inYear(deposit.date))
          .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
        const yearExpenses = [...account.expenses]
          .filter((expense) => inYear(expense.date))
          .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
        const starting = balanceBeforeYear(account.deposits, account.expenses, year);
        const ending = balanceThroughDate(account.deposits, account.expenses, `${year}-12-31`);
        const depositsYtd = yearDeposits.reduce((sum, deposit) => sum + deposit.amount, 0);
        const expensesYtd = yearExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        const reimbursablePending = yearExpenses
          .filter((expense) => expense.paymentMethod === 'Out of Pocket' && expense.reimbursedYet === 'No')
          .reduce((sum, expense) => sum + expense.amount, 0);
        const contributionLimit = getLimitForYear(account.contributionLimits, year);
        type LedgerLine =
          | { kind: 'deposit'; date: string; deposit: DepositRecord }
          | { kind: 'expense'; date: string; expense: ExpenseRecord };
        const lines: LedgerLine[] = [
          ...yearDeposits.map((deposit) => ({ kind: 'deposit' as const, date: deposit.date, deposit })),
          ...yearExpenses.map((expense) => ({ kind: 'expense' as const, date: expense.date, expense })),
        ].sort((a, b) =>
          a.date.localeCompare(b.date)
          || a.kind.localeCompare(b.kind)
          || (a.kind === 'deposit' ? a.deposit.name : a.expense.name)
            .localeCompare(b.kind === 'deposit' ? b.deposit.name : b.expense.name)
        );
        return {
          account,
          yearDeposits,
          yearExpenses,
          starting,
          ending,
          depositsYtd,
          expensesYtd,
          reimbursablePending,
          contributionLimit,
          lines,
        };
      });

      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let yPos = margin;

      const colors = {
        background: [255, 255, 255] as const,
        text: [15, 23, 42] as const,
        title: [15, 23, 42] as const,
        header: [241, 245, 249] as const,
        muted: [71, 85, 105] as const,
      };

      const fillPage = () => {
        pdf.setFillColor(colors.background[0], colors.background[1], colors.background[2]);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      };

      const checkNewPage = (requiredHeight: number) => {
        if (yPos + requiredHeight > pageHeight - margin) {
          pdf.addPage();
          fillPage();
          yPos = margin;
          return true;
        }
        return false;
      };

      const addSectionHeader = (title: string) => {
        checkNewPage(15);
        pdf.setFillColor(colors.header[0], colors.header[1], colors.header[2]);
        pdf.rect(margin, yPos, contentWidth, 10, 'F');
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(colors.title[0], colors.title[1], colors.title[2]);
        pdf.text(title, margin + 5, yPos + 7);
        yPos += 15;
      };

      const addText = (text: string, fontSize = 10, isBold = false, indent = 0, muted = false) => {
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
        const color = muted ? colors.muted : colors.text;
        pdf.setTextColor(color[0], color[1], color[2]);
        const maxWidth = contentWidth - indent - 5;
        const wrapped = pdf.splitTextToSize(text, maxWidth) as string[];
        const lineHeight = fontSize * 0.42;
        checkNewPage(wrapped.length * lineHeight + 2);
        wrapped.forEach((line) => {
          pdf.text(line, margin + indent, yPos);
          yPos += lineHeight;
        });
        yPos += 2;
      };

      fillPage();

      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.title[0], colors.title[1], colors.title[2]);
      const title = 'HSA Tracker Report';
      pdf.text(title, (pageWidth - pdf.getTextWidth(title)) / 2, yPos);
      yPos += 10;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
      pdf.text(`Generated on: ${formatReportDate(new Date())}`, margin, yPos);
      yPos += 6;
      pdf.text(`Calendar year ${year}  ·  ${accountLabel}`, margin, yPos);
      yPos += 10;

      accountBlocks.forEach((block) => {
        addSectionHeader(block.account.name);
        addText('Summary', 11, true, 5);
        addText(`Starting balance (January 1): ${formatMoney(block.starting)}`, 10, false, 5);
        addText(`Deposits: ${formatMoney(block.depositsYtd)} (${block.yearDeposits.length})`, 10, false, 5);
        addText(`Expenses: ${formatMoney(block.expensesYtd)} (${block.yearExpenses.length})`, 10, false, 5);
        addText(`Ending balance (December 31): ${formatMoney(block.ending)}`, 10, false, 5);
        addText(`Reimbursable pending: ${formatMoney(block.reimbursablePending)}`, 10, false, 5);
        if (block.contributionLimit != null) {
          addText(`Contribution limit: ${formatMoney(block.contributionLimit)}`, 10, false, 5);
          addText(
            `Remaining toward limit: ${formatMoney(block.contributionLimit - block.depositsYtd)}`,
            10,
            false,
            5
          );
        }
        yPos += 2;

        addText('Activity', 11, true, 5);
        if (block.lines.length === 0) {
          addText('No deposits or expenses for this year.', 10, false, 8, true);
        } else {
          let running = block.starting;
          block.lines.forEach((line) => {
            checkNewPage(28);
            if (line.kind === 'deposit') {
              const deposit = line.deposit;
              running += deposit.amount;
              addText(
                `${formatDateForDisplay(deposit.date)}  ·  Deposit — ${deposit.name}`,
                11,
                true,
                5
              );
              addText(`Amount: +${formatMoney(deposit.amount)}`, 9, false, 8);
              addText(`Source: ${deposit.source}`, 9, false, 8);
              addText(`Tax year: ${deposit.taxYear}`, 9, false, 8);
              if (deposit.note.trim()) {
                addText(`Note: ${deposit.note.trim()}`, 9, false, 8);
              }
              if (deposit.isRepeatable) {
                const frequency = recurrenceFrequencyLabel(deposit.recurrenceFrequency);
                addText(frequency ? `Recurring · ${frequency}` : 'Recurring', 9, false, 8);
              }
              addText(`Running balance: ${formatMoney(running)}`, 9, false, 8);
            } else {
              const expense = line.expense;
              running -= expense.amount;
              addText(
                `${formatDateForDisplay(expense.date)}  ·  Expense — ${expense.name}`,
                11,
                true,
                5
              );
              addText(`Amount: ${formatMoney(-expense.amount)}`, 9, false, 8);
              addText(`Category: ${expense.category}`, 9, false, 8);
              if (expense.providerOrStore.trim()) {
                addText(`Provider: ${expense.providerOrStore.trim()}`, 9, false, 8);
              }
              addText(`Payment method: ${expense.paymentMethod}`, 9, false, 8);
              addText(
                expense.reimbursementDate
                  ? `Reimbursed: ${expense.reimbursedYet} (${formatDateForDisplay(expense.reimbursementDate)})`
                  : `Reimbursed: ${expense.reimbursedYet}`,
                9,
                false,
                8
              );
              if (expense.notes.trim()) {
                addText(`Notes: ${expense.notes.trim()}`, 9, false, 8);
              }
              addText(`Running balance: ${formatMoney(running)}`, 9, false, 8);
            }
            yPos += 3;
          });
        }
        yPos += 3;
      });

      const attachmentRefs = accountBlocks.flatMap((block) =>
        block.yearExpenses.flatMap((expense) =>
          (expense.attachments || [])
            .map((file) => file.name?.trim())
            .filter((name): name is string => Boolean(name))
            .map((fileName) =>
              `${block.account.name} — ${expense.name} — ${formatDateForDisplay(expense.date)} — ${fileName}`
            )
        )
      );

      if (attachmentRefs.length > 0) {
        addSectionHeader('Attachments');
        addText('File names only. Files themselves are not included in this report.', 8, false, 5, true);
        attachmentRefs.forEach((line) => addText(line, 9, false, 8));
      }

      pdf.save(`HSA_Tracker_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      setShowReportModal(false);
    } catch (error) {
      console.error('Error exporting HSA tracker PDF:', error);
      showError(error instanceof Error ? error.message : 'Failed to generate PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const exportReportCsv = (year = summaryYear) => {
    if (!selectedAccount) return;
    const { deposits, expenses, name: accountName } = selectedAccount;
    const inYear = (iso: string) => iso.startsWith(String(year));
    const yearDeposits = deposits.filter((d) => inYear(d.date));
    const yearExpenses = expenses.filter((e) => inYear(e.date));
    if (yearDeposits.length === 0 && yearExpenses.length === 0) {
      setCsvExportMessage(`No deposits or expenses for ${year}.`);
      return;
    }
    setCsvExportMessage(null);

    type CsvLine = { date: string; type: 'Deposit' | 'Expense'; name: string; amount: number; categoryOrSource: string };
    const lines: CsvLine[] = [
      ...yearDeposits.map((d) => ({
        date: d.date,
        type: 'Deposit' as const,
        name: d.name,
        amount: d.amount,
        categoryOrSource: d.source,
      })),
      ...yearExpenses.map((e) => ({
        date: e.date,
        type: 'Expense' as const,
        name: e.name,
        amount: e.amount,
        categoryOrSource: e.category,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));

    let running = balanceBeforeYear(deposits, expenses, year);
    const escapeCsv = (value: string | number) => {
      const s = String(value);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const rows = [
      ['Type', 'Date', 'Name', 'Amount', 'Category/Source', 'Running balance'],
      ...lines.map((row) => {
        running += row.type === 'Deposit' ? row.amount : -row.amount;
        return [
          row.type,
          row.date,
          row.name,
          row.amount.toFixed(2),
          row.categoryOrSource,
          running.toFixed(2),
        ];
      }),
    ];
    const csv = rows.map((r) => r.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HSA_${accountName.replace(/\s+/g, '_')}_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpenAccountId(null);
        if (showReportModal && !isExportingPdf) setShowReportModal(false);
        setDeleteConfirmAccountId(null);
        setDeleteDepositId(null);
        setDeleteExpenseId(null);
        setExpenseDeleteConfirmText('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showReportModal, isExportingPdf]);

  const sortedDeposits = selectedAccount
    ? [...selectedAccount.deposits].sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const sortedExpenses = selectedAccount
    ? [...selectedAccount.expenses].sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const depositListEmpty = !selectedAccount || selectedAccount.deposits.length === 0;
  const expenseListEmpty = !selectedAccount || selectedAccount.expenses.length === 0;

  return (
    <div className="space-y-6 relative">
      {toolId && isLoadingData && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-black/20 backdrop-blur-[1px]">
          <span className={isLight ? 'text-sm font-medium text-slate-700' : 'text-sm font-medium text-slate-200'}>
            Loading…
          </span>
        </div>
      )}
      {saveMessage && (
        <div className={saveMessage.type === 'success' ? successAlertClass : errorAlertClass}>
          {saveMessage.text}
        </div>
      )}
      {menuOpenAccountId && (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default"
          aria-label="Close menu"
          onClick={() => setMenuOpenAccountId(null)}
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={titleClass}>HSA Tracker</h2>
          <p className={descClass}>
            Track HSA deposits and expenses across accounts. Your data is saved to your account when you use this tool
            from the dashboard.
          </p>
        </div>
        <ExportPdfIconButton
          title="Export HSA tracker to PDF"
          onClick={() => {
            const fallbackId = selectedAccount?.id || accounts[0]?.id || '';
            if (fallbackId && !exportAccountId) setExportAccountId(fallbackId);
            if (!fallbackId) setExportAllAccounts(true);
            setShowReportModal(true);
          }}
        />
      </div>

      {/* Account selector (Goals-style) */}
      <div className={cardClass}>
        <label className={labelClass}>Select your HSA account</label>

        {!isCreatingAccount ? (
          <div className="flex items-center gap-3 flex-wrap">
            {accounts.map((acc) =>
              editingAccountId === acc.id ? (
                <div
                  key={acc.id}
                  className={`px-4 py-3 rounded-lg border min-w-[200px] ${isLight ? 'bg-white' : 'border-slate-600 bg-slate-800'}`}
                  style={{
                    borderColor: editingAccountColor,
                    backgroundColor: isLight ? `${editingAccountColor}12` : `${editingAccountColor}15`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={editingAccountName}
                      onChange={(e) => setEditingAccountName(e.target.value)}
                      className={`flex-1 px-2 py-1 rounded border text-sm focus:border-emerald-500/50 focus:outline-none ${isLight ? 'border-slate-300 bg-white text-slate-900' : 'border-slate-600 bg-slate-900 text-slate-100'}`}
                      placeholder="Account name"
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={mutedSmallClass}>Color:</span>
                    <input
                      type="color"
                      value={editingAccountColor}
                      onChange={(e) => setEditingAccountColor(e.target.value)}
                      className={`h-6 w-12 rounded cursor-pointer ${isLight ? 'border border-slate-300' : 'border border-slate-600'}`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={saveAccountEdit}
                      disabled={!editingAccountName.trim()}
                      className={primaryButtonXsClass}
                    >
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingAccountId(null)} className={secondaryButtonSmClass}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div key={acc.id} className="relative">
                  <button
                    type="button"
                    onClick={() => selectAccount(acc.id)}
                    className={`px-4 py-3 rounded-lg border transition-all duration-200 min-w-[120px] relative ${
                      selectedAccountId === acc.id
                        ? 'shadow-lg'
                        : isLight
                          ? 'hover:border-slate-400'
                          : 'hover:border-slate-600'
                    }`}
                    style={{
                      borderColor: acc.card_color,
                      backgroundColor: selectedAccountId === acc.id ? `${acc.card_color}15` : `${acc.card_color}08`,
                      color: acc.card_color,
                    }}
                  >
                    <div className="font-medium text-center">{acc.name}</div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenAccountId(menuOpenAccountId === acc.id ? null : acc.id);
                    }}
                    className={`absolute top-1 right-1 p-1 rounded transition-colors ${isLight ? 'hover:bg-slate-200/80' : 'hover:bg-slate-700/50'}`}
                    title="Account options"
                    aria-label="Account options"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                  </button>
                  {menuOpenAccountId === acc.id && (
                    <div className={popupMenuClass}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingAccount(acc);
                        }}
                        className={popupItemClass}
                      >
                        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={accounts.length <= 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenAccountId(null);
                          setDeleteConfirmAccountId(acc.id);
                          setDeleteConfirmText('');
                        }}
                        className={`${popupItemDangerClass} disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )
            )}
            <button
              type="button"
              onClick={startCreatingAccount}
              className={addCategorySquareClass}
              title="Add New HSA account"
              aria-label="Add New HSA account"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className={labelClassSm}>Account name</label>
              <input
                type="text"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                className={inputClassPad}
                placeholder="e.g. Spouse"
                autoFocus
              />
            </div>
            <div>
              <label className={labelClassSm}>Color</label>
              <input
                type="color"
                value={newAccountColor}
                onChange={(e) => setNewAccountColor(e.target.value)}
                className={`h-10 w-14 rounded cursor-pointer ${isLight ? 'border border-slate-300' : 'border border-slate-600'}`}
              />
            </div>
            <button type="button" onClick={saveNewAccount} disabled={!newAccountName.trim()} className={primaryButtonClass}>
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreatingAccount(false);
                setSelectedAccountId(accounts[0]?.id ?? null);
              }}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {accountsLoadOk && accounts.length === 0 && !isCreatingAccount ? (
        <div className={cardClass}>
          <p className={`${mutedSmallClass} text-center py-6`}>Select or create an HSA account to continue.</p>
        </div>
      ) : !selectedAccount ? (
        null
      ) : (
        <>
          <div className={`border-b ${tabStripBorderClass}`}>
            <div className="flex gap-2 items-center flex-wrap">
              <div
                className={`px-4 py-2 text-[18px] font-medium whitespace-nowrap border-b-2 border-transparent ${
                  isLight ? 'text-slate-800' : 'text-slate-200'
                }`}
              >
                {selectedAccount.name}:
              </div>
              {(
                [
                  { id: 'summary', label: 'Summary' },
                  { id: 'deposits', label: 'Deposits' },
                  { id: 'expenses', label: 'Expenses' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMainTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    mainTab === tab.id ? tabActiveClass : tabInactiveClass
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {mainTab === 'summary' && (
            <div className="space-y-6">
              <div className={cardClass} role="group" aria-label="Summary year filter">
                <div className="flex flex-nowrap items-center gap-3">
                  <label
                    htmlFor="hsa-summary-year"
                    className={`shrink-0 text-xs font-medium whitespace-nowrap ${isLight ? 'text-slate-700' : 'text-slate-300'}`}
                  >
                    Summary year
                  </label>
                  <select
                    id="hsa-summary-year"
                    value={summaryYear}
                    onChange={(e) => {
                      setSummaryYear(Number(e.target.value));
                      setCsvExportMessage(null);
                    }}
                    className={
                      isLight
                        ? 'shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
                        : 'shrink-0 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
                    }
                  >
                    {availableYears.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <span className={`${mutedSmallClass} min-w-0 whitespace-nowrap`}>
                    KPI amounts use calendar year {summaryYear}. Balance is as of 12/31/{summaryYear}.
                  </span>
                  <button type="button" onClick={() => exportReportCsv(summaryYear)} className={`${secondaryButtonClass} shrink-0`}>
                    Export CSV
                  </button>
                </div>
                {csvExportMessage ? (
                  <p className={`mt-3 ${isLight ? 'text-sm text-slate-800' : 'text-sm text-slate-200'}`} role="status">
                    {csvExportMessage}
                  </p>
                ) : null}
              </div>

              <div className={cardClass} aria-label="Rollover balances">
                <p className={isLight ? 'text-sm text-slate-800' : 'text-sm text-slate-200'}>
                  Starting 1/1/{summaryYear}: {formatMoney(summaryMetrics.startingBalance)}
                </p>
                <p className={`mt-1 ${isLight ? 'text-sm text-slate-800' : 'text-sm text-slate-200'}`}>
                  Matches ending 12/31/{summaryYear - 1}: {formatMoney(summaryMetrics.startingBalance)}
                </p>
              </div>

              <div className={cardClass} aria-label="Annual contribution limit">
                <div className="max-w-xs">
                  <label htmlFor="hsa-contribution-limit" className={labelClassSm}>
                    Annual contribution limit (optional)
                  </label>
                  <div className={currencyFieldWrapClass}>
                    <span className={currencyFieldPrefixClass}>$</span>
                    <input
                      id="hsa-contribution-limit"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Leave blank"
                      value={contributionLimitDraft}
                      onChange={(e) => setContributionLimitDraft(e.target.value)}
                      onBlur={() => void saveContributionLimit()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                      className={currencyFieldInputClass}
                      aria-label="Annual contribution limit in USD"
                    />
                  </div>
                </div>
                {effectiveContributionLimit != null ? (
                  <p className={`mt-2 ${isLight ? 'text-sm text-slate-800' : 'text-sm text-slate-200'}`}>
                    Remaining: {formatMoney(effectiveContributionLimit - summaryMetrics.depositsYtd)}{' '}
                    (limit − Deposits YTD)
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className={kpiCardClass}>
                  <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isLight ? 'text-emerald-800' : 'text-emerald-300'}`}>
                    Current balance
                  </p>
                  <p
                    className={`mt-2 text-2xl font-semibold tabular-nums ${isLight ? 'text-slate-900' : 'text-slate-50'}`}
                  >
                    {formatMoney(summaryMetrics.balanceEndOfYear)}
                  </p>
                </div>
                <div className={kpiCardClass}>
                  <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isLight ? 'text-emerald-800' : 'text-emerald-300'}`}>
                    Deposits YTD
                  </p>
                  <p
                    className={`mt-2 text-2xl font-semibold tabular-nums ${isLight ? 'text-slate-900' : 'text-slate-50'}`}
                  >
                    {formatMoney(summaryMetrics.depositsYtd)}
                  </p>
                </div>
                <div className={kpiCardClass}>
                  <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isLight ? 'text-emerald-800' : 'text-emerald-300'}`}>
                    Expenses YTD
                  </p>
                  <p
                    className={`mt-2 text-2xl font-semibold tabular-nums ${isLight ? 'text-slate-900' : 'text-slate-50'}`}
                  >
                    {formatMoney(summaryMetrics.expensesYtd)}
                  </p>
                </div>
                <div className={kpiCardClass}>
                  <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isLight ? 'text-emerald-800' : 'text-emerald-300'}`}>
                    Reimbursable pending
                  </p>
                  <p
                    className={`mt-2 text-2xl font-semibold tabular-nums ${isLight ? 'text-slate-900' : 'text-slate-50'}`}
                  >
                    {formatMoney(summaryMetrics.reimbursablePending)}
                  </p>
                  <p className={`${mutedSmallClass} mt-2`}>
                    Unreimbursed out-of-pocket $ — not receipt status.
                  </p>
                </div>
              </div>
            </div>
          )}

          {mainTab === 'deposits' && (
            <div className="space-y-6">
              {!isAddingDeposit ? (
                <div className="flex justify-start">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDepositId(null);
                      resetDepositForm();
                      setIsAddingDeposit(true);
                    }}
                    className={primaryButtonClass}
                  >
                    + Add New Deposit
                  </button>
                </div>
              ) : (
                <div className={cardClass}>
                  <h3 className={`text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-slate-50'} mb-4`}>
                    {editingDepositId ? 'Edit deposit' : 'New deposit'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClassSm}>
                        Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={depositForm.name}
                        onChange={(e) => setDepositForm((f) => ({ ...f, name: e.target.value }))}
                        className={inputClassPad}
                      />
                    </div>
                    <div>
                      <label className={labelClassSm}>
                        Date <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="date"
                        value={depositForm.date}
                        onChange={(e) => setDepositForm((f) => ({ ...f, date: e.target.value }))}
                        className={inputClassPad}
                      />
                    </div>
                    <div>
                      <label className={labelClassSm}>
                        Amount <span className="text-red-400">*</span>
                      </label>
                      <div className={currencyFieldWrapClass}>
                        <span className={currencyFieldPrefixClass}>$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={depositForm.amount}
                          onChange={(e) => setDepositForm((f) => ({ ...f, amount: e.target.value }))}
                          className={currencyFieldInputClass}
                          aria-label="Amount in USD"
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClassSm}>Source</label>
                      <select
                        value={depositForm.source}
                        onChange={(e) =>
                          setDepositForm((f) => ({ ...f, source: e.target.value as DepositSource }))
                        }
                        className={inputClassPad}
                      >
                        {(['Payroll', 'Employer', 'Personal', 'Other'] as const).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClassSm}>Tax year</label>
                      <input
                        type="number"
                        value={depositForm.taxYear}
                        onChange={(e) =>
                          setDepositForm((f) => ({ ...f, taxYear: Number(e.target.value) || currentYear }))
                        }
                        className={inputClassPad}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelClassSm}>Note</label>
                      <textarea
                        value={depositForm.note}
                        onChange={(e) => setDepositForm((f) => ({ ...f, note: e.target.value }))}
                        rows={2}
                        className={`${inputClassPad} resize-none`}
                      />
                    </div>
                    <div className="md:col-span-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="deposit-repeat"
                        checked={depositForm.isRepeatable}
                        onChange={(e) => setDepositForm((f) => ({ ...f, isRepeatable: e.target.checked }))}
                        className="h-5 w-5 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500"
                      />
                      <label htmlFor="deposit-repeat" className={labelClassSm + ' mb-0'}>
                        Repeatable deposit
                      </label>
                    </div>
                    {depositForm.isRepeatable && (
                      <>
                        <div>
                          <label className={labelClassSm}>Frequency</label>
                          <select
                            value={depositForm.recurrenceFrequency}
                            onChange={(e) =>
                              setDepositForm((f) => ({
                                ...f,
                                recurrenceFrequency: e.target.value as RecurrenceFrequency,
                              }))
                            }
                            className={inputClassPad}
                          >
                            <option value="weekly">Weekly</option>
                            <option value="biweekly">Biweekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                            <option value="yearly">Yearly</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelClassSm}>Start date</label>
                          <input
                            type="date"
                            value={depositForm.recurrenceStart}
                            onChange={(e) =>
                              setDepositForm((f) => ({ ...f, recurrenceStart: e.target.value }))
                            }
                            className={inputClassPad}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className={labelClassSm}>End date (optional)</label>
                          <input
                            type="date"
                            value={depositForm.recurrenceEnd}
                            onChange={(e) =>
                              setDepositForm((f) => ({ ...f, recurrenceEnd: e.target.value }))
                            }
                            className={inputClassPad}
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button type="button" onClick={saveDeposit} className={primaryButtonClass}>
                      {editingDepositId ? 'Save changes' : 'Add deposit'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingDeposit(false);
                        setEditingDepositId(null);
                        resetDepositForm();
                      }}
                      className={secondaryButtonClass}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {depositListEmpty ? (
                  <div className={cardClass}>
                    <p className={`${mutedSmallClass} text-center py-6`}>No deposits yet. Add one to get started.</p>
                  </div>
                ) : (
                  sortedDeposits.map((d) => (
                    <div key={d.id} className={nestedRowCardClass}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-slate-50'}`}>
                              {d.name}
                            </span>
                            {d.isRepeatable && (
                              <span
                                className={
                                  isLight
                                    ? 'px-1.5 py-0.5 rounded text-xs font-medium border border-emerald-300 bg-emerald-50 text-emerald-800'
                                    : 'px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300'
                                }
                              >
                                Recurring
                              </span>
                            )}
                          </div>
                          <p className={mutedSmallClass}>
                            {formatDateForDisplay(d.date)} · {d.source} · Tax {d.taxYear}
                          </p>
                          <p className={`mt-1 tabular-nums ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                            {formatMoney(d.amount)}
                          </p>
                          {d.note ? (
                            <p className={`mt-2 text-sm whitespace-pre-line ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                              {d.note}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 ml-4">
                          <button
                            type="button"
                            onClick={() => startEditDeposit(d)}
                            className={rowIconEmeraldClass}
                            aria-label="Edit deposit"
                            title="Edit deposit"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteDepositId(d.id)}
                            className={rowIconDangerClass}
                            aria-label="Delete deposit"
                            title="Delete deposit"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {mainTab === 'expenses' && (
            <div className="space-y-6">
              {!isAddingExpense ? (
                <div className="flex justify-start">
                  <button
                    type="button"
                    onClick={startAddingExpense}
                    className={primaryButtonClass}
                  >
                    + Add New Expense
                  </button>
                </div>
              ) : (
                <div className={cardClass}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className={`text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-slate-50'}`}>
                      {editingExpenseId ? 'Edit expense' : 'New expense'}
                    </h3>
                    <AttachmentButton
                      count={
                        editingExpenseId
                          ? selectedAccount?.expenses.find((expense) => expense.id === editingExpenseId)?.attachments?.length || 0
                          : pendingAttachments.length
                      }
                      onClick={() => setAttachmentModal(editingExpenseId || 'add')}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClassSm}>
                        Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={expenseForm.name}
                        onChange={(e) => setExpenseForm((f) => ({ ...f, name: e.target.value }))}
                        className={inputClassPad}
                      />
                    </div>
                    <div>
                      <label className={labelClassSm}>
                        Date <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="date"
                        value={expenseForm.date}
                        onChange={(e) => setExpenseForm((f) => ({ ...f, date: e.target.value }))}
                        className={inputClassPad}
                      />
                    </div>
                    <div>
                      <label className={labelClassSm}>
                        Amount <span className="text-red-400">*</span>
                      </label>
                      <div className={currencyFieldWrapClass}>
                        <span className={currencyFieldPrefixClass}>$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={expenseForm.amount}
                          onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                          className={currencyFieldInputClass}
                          aria-label="Amount in USD"
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClassSm}>Provider or store</label>
                      <input
                        type="text"
                        value={expenseForm.providerOrStore}
                        onChange={(e) => setExpenseForm((f) => ({ ...f, providerOrStore: e.target.value }))}
                        className={inputClassPad}
                      />
                    </div>
                    <div>
                      <label className={labelClassSm}>Category</label>
                      <select
                        value={expenseForm.category}
                        onChange={(e) =>
                          setExpenseForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))
                        }
                        className={inputClassPad}
                      >
                        {(['Doctor Visit', 'Dental', 'Vision', 'Prescription', 'Other'] as const).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClassSm}>Payment method</label>
                      <select
                        value={expenseForm.paymentMethod}
                        onChange={(e) =>
                          setExpenseForm((f) => ({ ...f, paymentMethod: e.target.value as PaymentMethod }))
                        }
                        className={inputClassPad}
                      >
                        <option value="HSA Card">HSA Card</option>
                        <option value="Out of Pocket">Out of Pocket</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClassSm}>Reimbursed yet?</label>
                      <select
                        value={expenseForm.reimbursedYet}
                        onChange={(e) =>
                          setExpenseForm((f) => ({
                            ...f,
                            reimbursedYet: e.target.value as 'Yes' | 'No',
                          }))
                        }
                        className={inputClassPad}
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClassSm}>Reimbursement date</label>
                      <input
                        type="date"
                        disabled={expenseForm.reimbursedYet !== 'Yes'}
                        value={expenseForm.reimbursementDate}
                        onChange={(e) => setExpenseForm((f) => ({ ...f, reimbursementDate: e.target.value }))}
                        className={`${inputClassPad} disabled:opacity-50`}
                      />
                    </div>
                    <div className="md:col-span-2 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                      <input
                        type="checkbox"
                        id="warn-receipt"
                        checked={expenseForm.warnUntilReceipt}
                        onChange={(e) => setExpenseForm((f) => ({ ...f, warnUntilReceipt: e.target.checked }))}
                        className="mt-1 h-5 w-5 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500"
                      />
                      <div>
                        <label htmlFor="warn-receipt" className={`text-sm font-medium ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>
                          Add a warning on this expense until a receipt is attached
                        </label>
                        <p className={`${mutedSmallClass} mt-0.5`}>
                          Shows a yellow warning on this expense until a receipt is attached. The warning clears when a
                          file is saved on the paperclip.
                        </p>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelClassSm}>Notes</label>
                      <textarea
                        value={expenseForm.notes}
                        onChange={(e) => setExpenseForm((f) => ({ ...f, notes: e.target.value }))}
                        rows={2}
                        className={`${inputClassPad} resize-none`}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button type="button" onClick={saveExpense} className={primaryButtonClass}>
                      {editingExpenseId ? 'Save changes' : 'Add expense'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelExpenseForm}
                      className={secondaryButtonClass}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {expenseListEmpty ? (
                  <div className={cardClass}>
                    <p className={`${mutedSmallClass} text-center py-6`}>No expenses yet. Add one to get started.</p>
                  </div>
                ) : (
                  sortedExpenses.map((ex) => {
                    const showWarning = ex.warnUntilReceipt && (ex.attachments?.length ?? 0) === 0;
                    return (
                      <div key={ex.id} className={nestedRowCardClass}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className={`font-semibold ${isLight ? 'text-slate-900' : 'text-slate-50'}`}>{ex.name}</p>
                            <p className={`${mutedSmallClass} mt-0.5`}>
                              {ex.category} · {ex.paymentMethod}
                            </p>
                            <p className={`${mutedSmallClass} mt-1`}>
                              {formatDateForDisplay(ex.date)}
                              {ex.providerOrStore ? ` · ${ex.providerOrStore}` : ''}
                            </p>
                            <p className={`mt-1 tabular-nums ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                              {formatMoney(ex.amount)}
                            </p>
                            <p className={`${mutedSmallClass} mt-1`}>
                              Reimbursed: {ex.reimbursedYet}
                              {ex.reimbursementDate ? ` (${formatDateForDisplay(ex.reimbursementDate)})` : ''}
                            </p>
                            {showWarning ? <ReceiptNeededWarning isLight={isLight} /> : null}
                            {ex.notes ? (
                              <p className={`mt-2 text-sm whitespace-pre-line ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                {ex.notes}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5 ml-4">
                            <AttachmentButton
                              count={ex.attachments?.length || 0}
                              onClick={() => setAttachmentModal(ex.id)}
                            />
                            <button
                              type="button"
                              onClick={() => startEditExpense(ex)}
                              className={rowIconEmeraldClass}
                              aria-label="Edit expense"
                              title="Edit expense"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteExpenseId(ex.id);
                                setExpenseDeleteConfirmText('');
                              }}
                              className={rowIconDangerClass}
                              aria-label="Delete expense"
                              title="Delete expense"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

        </>
      )}

      {showReportModal && (
        <div className={modalBackdropClass}>
          <div className={modalCardConfirmClass} role="dialog" aria-modal="true" aria-labelledby="hsa-export-title">
            <div className="flex items-center justify-between mb-4">
              <h3 id="hsa-export-title" className={modalTitleClass}>
                Export Options
              </h3>
              <button
                type="button"
                onClick={() => !isExportingPdf && setShowReportModal(false)}
                disabled={isExportingPdf}
                className={isLight ? 'text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50' : 'text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50'}
                aria-label="Close"
                title="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <p className={descClass}>
                Attachment files are listed by name at the end.
              </p>

              <fieldset className="space-y-2" disabled={isExportingPdf}>
                <legend className={`${labelClass} mb-0`}>Accounts</legend>
                <label className={`flex items-start gap-3 ${isLight ? 'text-slate-700' : 'text-slate-300'} cursor-pointer`}>
                  <input
                    type="radio"
                    name="hsaExportAccounts"
                    checked={exportAllAccounts}
                    onChange={() => setExportAllAccounts(true)}
                    className={isLight
                      ? 'mt-0.5 h-4 w-4 border-slate-400 text-emerald-600 focus:ring-emerald-500'
                      : 'mt-0.5 h-4 w-4 border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500'}
                  />
                  <span>All accounts</span>
                </label>
                <label className={`flex items-start gap-3 ${isLight ? 'text-slate-700' : 'text-slate-300'} cursor-pointer`}>
                  <input
                    type="radio"
                    name="hsaExportAccounts"
                    checked={!exportAllAccounts}
                    onChange={() => {
                      setExportAllAccounts(false);
                      if (!exportAccountId) {
                        setExportAccountId(selectedAccount?.id || accounts[0]?.id || '');
                      }
                    }}
                    className={isLight
                      ? 'mt-0.5 h-4 w-4 border-slate-400 text-emerald-600 focus:ring-emerald-500'
                      : 'mt-0.5 h-4 w-4 border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500'}
                  />
                  <span>One account</span>
                </label>
                {!exportAllAccounts && (
                  <div className="ml-7">
                    <label className={labelClassSm} htmlFor="hsa-export-account">
                      Account
                    </label>
                    <select
                      id="hsa-export-account"
                      value={exportAccountId}
                      onChange={(e) => setExportAccountId(e.target.value)}
                      className={inputClassPad}
                    >
                      <option value="">Select an account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </fieldset>

              <div>
                <label className={labelClassSm} htmlFor="hsa-export-year">
                  Calendar year
                </label>
                <select
                  id="hsa-export-year"
                  value={reportYear}
                  onChange={(e) => setReportYear(Number(e.target.value))}
                  disabled={isExportingPdf}
                  className={inputClassPad}
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => void exportToPDF()}
                  disabled={isExportingPdf || accounts.length === 0 || (!exportAllAccounts && !exportAccountId)}
                  className={`flex-1 ${primaryButtonClass}`}
                >
                  {isExportingPdf ? 'Generating…' : 'Export to PDF'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  disabled={isExportingPdf}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmAccountId && (
        <div className={modalBackdropClass}>
          <div className={modalCardConfirmClass}>
            <div className={deleteWarningBoxClass}>
              <p className={deleteWarningTextClass}>⚠️ Warning</p>
              <p className={isLight ? 'text-red-600 text-sm' : 'text-red-200 text-sm'}>
                This will permanently remove this HSA account and all of its deposits and expenses from this session.
              </p>
            </div>
            <p className={deleteInstructionTextClass}>
              Type <span className="font-semibold">delete</span> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className={deleteConfirmInputClass}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmDeleteAccount}
                disabled={deleteConfirmText.trim().toLowerCase() !== 'delete'}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete account
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmAccountId(null);
                  setDeleteConfirmText('');
                }}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteDepositId && (
        <div className={modalBackdropClass}>
          <div className={modalCardConfirmClass}>
            <h3 className={modalTitleClass}>Delete deposit?</h3>
            <p className={`${deleteInstructionTextClass} mt-2`}>This cannot be undone.</p>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={removeDeposit} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-white font-semibold hover:bg-red-700">
                Delete
              </button>
              <button type="button" onClick={() => setDeleteDepositId(null)} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteExpenseId && (
        <div className={modalBackdropClass}>
          <div className={modalCardConfirmClass}>
            <div className={deleteWarningBoxClass}>
              <p className={deleteWarningTextClass}>⚠️ Warning</p>
              <p className={isLight ? 'text-red-600 text-sm' : 'text-red-200 text-sm'}>
                This will permanently remove this expense.
              </p>
            </div>
            <p className={deleteInstructionTextClass}>
              Type <span className="font-semibold">delete</span> to confirm.
            </p>
            <input
              key={`hsa-expense-delete-${deleteExpenseId}`}
              id={`hsa-expense-delete-confirm-${deleteExpenseId}`}
              name={`hsa-expense-delete-confirm-${deleteExpenseId}`}
              type="text"
              autoComplete="off"
              value={expenseDeleteConfirmText}
              onChange={(e) => setExpenseDeleteConfirmText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className={deleteConfirmInputClass}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={removeExpense}
                disabled={!expenseDeleteConfirmed}
                aria-disabled={!expenseDeleteConfirmed}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete Permanently
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteExpenseId(null);
                  setExpenseDeleteConfirmText('');
                }}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <AttachmentModal
        open={attachmentModal !== null}
        onClose={() => {
          setAttachmentModal(null);
          setViewPreview(null);
        }}
        previewItem={viewPreview}
        title={
          attachmentModal === 'add'
            ? expenseForm.name.trim() || 'New expense'
            : savedAttachmentExpense?.name || 'Expense'
        }
        files={modalFiles}
        busy={attachmentBusy}
        onAdd={(incoming) => {
          if (attachmentModal === 'add') {
            setPendingAttachments((prev) => [...prev, ...incoming.map(createPendingAttachment)]);
            return;
          }
          if (attachmentModal) {
            void addSavedExpenseFiles(attachmentModal, incoming);
          }
        }}
        onRemove={(id) => {
          if (attachmentModal === 'add') {
            setPendingAttachments((prev) => {
              const next = prev.filter((item) => item.id !== id);
              const removed = prev.find((item) => item.id === id);
              if (removed?.url) URL.revokeObjectURL(removed.url);
              return next;
            });
            return;
          }
          void removeSavedExpenseFile(id);
        }}
        onView={handleViewAttachment}
        onDownload={attachmentModal === 'add' ? undefined : handleDownloadAttachment}
      />
    </div>
  );
}
