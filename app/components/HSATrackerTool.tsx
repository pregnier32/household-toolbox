'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from './AppThemeProvider';

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

function ReceiptNeededWarning({ isLight }: { isLight: boolean }) {
  return (
    <div
      className={`mt-2 flex items-center gap-2 text-xs font-medium ${isLight ? 'text-amber-700' : 'text-amber-300'}`}
      role="status"
      aria-label="Receipt still needed for this record"
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
      <span>Receipt still needed for this record.</span>
    </div>
  );
}

type DepositSource = 'Payroll' | 'Employer' | 'Personal' | 'Other';
type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

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
  receiptFileName: string | null;
  warnUntilReceipt: boolean;
  notes: string;
};

type HsaAccount = {
  id: string;
  name: string;
  card_color: string;
  deposits: DepositRecord[];
  expenses: ExpenseRecord[];
};

type MainTab = 'summary' | 'deposits' | 'expenses' | 'reports';

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

export function HSATrackerTool({ toolId }: HSATrackerToolProps) {
  const { resolvedTheme } = useTheme();
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
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setSaveMessage({ type, text });
    setTimeout(() => setSaveMessage(null), 3000);
  }, []);

  const loadHsaData = useCallback(async () => {
    if (!toolId) return;
    setIsLoadingData(true);
    try {
      const res = await fetch(`/api/tools/hsa-tracker?toolId=${encodeURIComponent(toolId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const loaded = (data.accounts ?? []) as HsaAccount[];
      setAccounts(loaded);
    } catch (e) {
      showMessage('error', e instanceof Error ? e.message : 'Failed to load HSA data');
    } finally {
      setIsLoadingData(false);
    }
  }, [toolId, showMessage]);

  useEffect(() => {
    if (toolId) loadHsaData();
  }, [toolId, loadHsaData]);

  useEffect(() => {
    if (accounts.length === 0) {
      setSelectedAccountId(null);
      return;
    }
    if (!selectedAccountId || !accounts.some((a) => a.id === selectedAccountId)) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

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

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null;

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(currentYear);
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
        balanceEndOfYear: 0,
        depositsYtd: 0,
        expensesYtd: 0,
        reimbursablePending: 0,
      };
    }
    const { deposits, expenses } = selectedAccount;
    const dec31 = `${summaryYear}-12-31`;
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
    return { balanceEndOfYear, depositsYtd, expensesYtd, reimbursablePending };
  }, [selectedAccount, summaryYear]);

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
    receiptFileName: null as string | null,
  });

  const [deleteDepositId, setDeleteDepositId] = useState<string | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);

  const [reportYear, setReportYear] = useState(currentYear);
  const [showReportModal, setShowReportModal] = useState(false);

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
      receiptFileName: null,
    });
  }, [summaryYear]);

  const selectAccount = (id: string) => {
    setSelectedAccountId(id);
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
      setAccounts((prev) => [...prev, acc]);
      setSelectedAccountId(acc.id);
      setIsCreatingAccount(false);
      showMessage('success', 'Account created');
      return;
    }

    const id = generateId();
    setAccounts((prev) => [...prev, { id, name, card_color: newAccountColor, deposits: [], expenses: [] }]);
    setSelectedAccountId(id);
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
      setSelectedAccountId(remaining[0]?.id ?? null);
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
      const row = data.expense as ExpenseRecord;
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
      showMessage('success', editingExpenseId ? 'Expense updated' : 'Expense saved');
      return;
    }

    const row: ExpenseRecord = {
      id: editingExpenseId ?? generateId(),
      ...payload,
      receiptFileName: expenseForm.receiptFileName,
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

  const startEditExpense = (e: ExpenseRecord) => {
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
      receiptFileName: e.receiptFileName,
    });
  };

  const removeExpense = async () => {
    if (!deleteExpenseId || !selectedAccountId) return;

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
  };

  const generateReportPdf = useCallback(async () => {
    if (!selectedAccount) return;
    const year = reportYear;
    const { deposits, expenses, name: accountName } = selectedAccount;

    let jsPDF: new (options?: { orientation?: string; unit?: string; format?: string }) => Record<string, unknown>;
    if ((window as unknown as { jspdf?: { jsPDF: typeof jsPDF } }).jspdf?.jsPDF) {
      jsPDF = (window as unknown as { jspdf: { jsPDF: typeof jsPDF } }).jspdf.jsPDF;
    } else {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load jsPDF'));
        document.head.appendChild(script);
      });
      jsPDF = (window as unknown as { jspdf: { jsPDF: typeof jsPDF } }).jspdf.jsPDF;
    }

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as unknown as {
      internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
      addPage: () => void;
      setFontSize: (n: number) => void;
      setFont: (family: string, style: string) => void;
      setTextColor: (...args: number[]) => void;
      text: (text: string | string[], x: number, y: number, options?: { align?: string }) => void;
      splitTextToSize: (text: string, maxWidth: number) => string[];
      line: (x1: number, y1: number, x2: number, y2: number) => void;
      setDrawColor: (...args: number[]) => void;
      save: (name: string) => void;
    };
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let y = margin;

    const checkPage = (need: number) => {
      if (y + need > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
    };

    const starting = balanceBeforeYear(deposits, expenses, year);

    type Line = { date: string; label: string; amount: number; kind: 'deposit' | 'expense' };
    const inYear = (iso: string) => iso.startsWith(String(year));
    const lines: Line[] = [
      ...deposits
        .filter((d) => inYear(d.date))
        .map((d) => ({
          date: d.date,
          label: `Deposit — ${d.name}`,
          amount: d.amount,
          kind: 'deposit' as const,
        })),
      ...expenses
        .filter((e) => inYear(e.date))
        .map((e) => ({
          date: e.date,
          label: `Expense — ${e.name}`,
          amount: -e.amount,
          kind: 'expense' as const,
        })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`HSA Tracker — ${accountName}`, margin, y);
    y += 8;
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Calendar year ${year}`, margin, y);
    y += 6;
    pdf.text(
      `Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      margin,
      y
    );
    y += 10;

    pdf.setFont('helvetica', 'bold');
    pdf.text('Starting balance (January 1)', margin, y);
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatMoney(starting), pageWidth - margin, y, { align: 'right' });
    y += 8;

    let running = starting;
    pdf.setFontSize(9);
    const descMax = pageWidth - margin * 2 - 52;
    for (const row of lines) {
      running += row.amount;
      checkPage(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(formatDateForDisplay(row.date), margin, y);
      pdf.setFont('helvetica', 'normal');
      const wrapped = pdf.splitTextToSize(row.label, descMax);
      const rowHeight = Math.max(5, wrapped.length * 4.5);
      checkPage(rowHeight + 2);
      wrapped.forEach((line: string, i: number) => {
        pdf.text(line, margin + 24, y + i * 4.5);
      });
      const changeStr =
        row.amount >= 0 ? `+${formatMoney(Math.abs(row.amount))}` : formatMoney(row.amount);
      pdf.text(changeStr, pageWidth - margin - 30, y, { align: 'right' });
      pdf.text(formatMoney(running), pageWidth - margin, y, { align: 'right' });
      y += rowHeight + 2;
    }

    checkPage(12);
    pdf.setDrawColor(180);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 6;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Ending balance (December 31)', margin, y);
    const ending = balanceThroughDate(deposits, expenses, `${year}-12-31`);
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatMoney(ending), pageWidth - margin, y, { align: 'right' });

    pdf.save(`HSA_Report_${accountName.replace(/\s+/g, '_')}_${year}.pdf`);
    setShowReportModal(false);
  }, [reportYear, selectedAccount]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpenAccountId(null);
        setShowReportModal(false);
        setDeleteConfirmAccountId(null);
        setDeleteDepositId(null);
        setDeleteExpenseId(null);
        setDeleteConfirmText('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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

      <div>
        <h2 className={titleClass}>HSA Tracker</h2>
        <p className={descClass}>
          Track HSA deposits and expenses across accounts. Your data is saved to your account when you use this tool
          from the dashboard.
        </p>
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

      {!selectedAccountId || !selectedAccount ? (
        <div className={cardClass}>
          <p className={`${mutedSmallClass} text-center py-6`}>Select or create an HSA account to continue.</p>
        </div>
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
                  { id: 'reports', label: 'Reports' },
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
              <div
                className={`flex flex-nowrap items-center gap-3 ${cardClass}`}
                role="group"
                aria-label="Summary year filter"
              >
                <label
                  htmlFor="hsa-summary-year"
                  className={`shrink-0 text-xs font-medium whitespace-nowrap ${isLight ? 'text-slate-700' : 'text-slate-300'}`}
                >
                  Summary year
                </label>
                <select
                  id="hsa-summary-year"
                  value={summaryYear}
                  onChange={(e) => setSummaryYear(Number(e.target.value))}
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
                    onClick={() => {
                      setEditingExpenseId(null);
                      resetExpenseForm();
                      setIsAddingExpense(true);
                    }}
                    className={primaryButtonClass}
                  >
                    + Add New Expense
                  </button>
                </div>
              ) : (
                <div className={cardClass}>
                  <h3 className={`text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-slate-50'} mb-4`}>
                    {editingExpenseId ? 'Edit expense' : 'New expense'}
                  </h3>
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
                    <div className="md:col-span-2">
                      <label className={labelClassSm}>Upload receipt</label>
                      <div className="relative">
                        <input
                          type="file"
                          id="expense-receipt"
                          accept="image/*,.pdf"
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            setExpenseForm((f) => ({
                              ...f,
                              receiptFileName: file ? file.name : null,
                            }));
                          }}
                        />
                        <label
                          htmlFor="expense-receipt"
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                            isLight
                              ? 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                              : 'border-slate-700 bg-slate-900/70 text-slate-100 hover:bg-slate-800'
                          }`}
                        >
                          <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          <span>{expenseForm.receiptFileName ?? 'Select file'}</span>
                        </label>
                      </div>
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
                          Shows a yellow warning on this expense until you upload a receipt (clears automatically when a
                          file is selected).
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
                      onClick={() => {
                        setIsAddingExpense(false);
                        setEditingExpenseId(null);
                        resetExpenseForm();
                      }}
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
                    const showWarning = ex.warnUntilReceipt && !ex.receiptFileName;
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
                            {ex.receiptFileName ? (
                              <p className={`${mutedSmallClass} mt-1`}>Receipt: {ex.receiptFileName}</p>
                            ) : null}
                            {showWarning ? <ReceiptNeededWarning isLight={isLight} /> : null}
                            {ex.notes ? (
                              <p className={`mt-2 text-sm whitespace-pre-line ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                {ex.notes}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5 ml-4">
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
                              onClick={() => setDeleteExpenseId(ex.id)}
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

          {mainTab === 'reports' && (
            <div className="space-y-6">
              <div className={cardClass}>
                <h3 className={`text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-slate-50'} mb-2`}>
                  Export HSA Tracker report
                </h3>
                <p className={`${mutedSmallClass} mb-4 max-w-prose`}>
                  Generate a PDF with starting balance, all deposits and expenses in date order for the year you choose,
                  running totals, and ending balance.
                </p>
                <button type="button" onClick={() => setShowReportModal(true)} className={primaryButtonClass}>
                  Generate PDF Report
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showReportModal && selectedAccount && (
        <div className={modalBackdropClass}>
          <div className={modalCardConfirmClass}>
            <h3 className={modalTitleClass}>Report options</h3>
            <p className={`${mutedSmallClass} mt-2 mb-4`}>Choose the calendar year to include in the PDF.</p>
            <label className={labelClassSm}>Year</label>
            <select
              value={reportYear}
              onChange={(e) => setReportYear(Number(e.target.value))}
              className={`${inputClassPad} mb-6`}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button type="button" onClick={() => void generateReportPdf()} className={`${primaryButtonClass} flex-1`}>
                Export to PDF
              </button>
              <button type="button" onClick={() => setShowReportModal(false)} className={secondaryButtonClass}>
                Cancel
              </button>
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
            <h3 className={modalTitleClass}>Delete expense?</h3>
            <p className={`${deleteInstructionTextClass} mt-2`}>This cannot be undone.</p>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={removeExpense} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-white font-semibold hover:bg-red-700">
                Delete
              </button>
              <button type="button" onClick={() => setDeleteExpenseId(null)} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
