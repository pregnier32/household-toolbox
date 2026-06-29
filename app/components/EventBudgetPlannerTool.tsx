'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from './AppThemeProvider';

const API_BASE = '/api/tools/event-budget-planner';

type NamedRecord = {
  id: string;
  name: string;
  isActive: boolean;
  dateAdded: string;
  dateInactivated?: string;
};

type Vendor = NamedRecord & {
  contactPerson: string;
  phone: string;
  email: string;
  serviceProvided: string;
  notes: string;
};

type Expense = {
  id: string;
  categoryId: string;
  date: string;
  vendorId: string;
  amount: number;
  note: string;
};

type CategoryBudget = {
  categoryId: string;
  budgetAmount: number;
};

type EventRecord = {
  id: string;
  name: string;
  date: string;
  typeId: string;
  notes: string;
  categoryBudgets: CategoryBudget[];
  expenses: Expense[];
  isActive: boolean;
  dateAdded: string;
  dateInactivated?: string;
};

type EventBudgetPlannerToolProps = {
  toolId?: string;
};

type ApiData = {
  categories: NamedRecord[];
  types: NamedRecord[];
  vendors: Vendor[];
  events: EventRecord[];
};

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return 'N/A';
  const parts = isoDate.split('T')[0].split('-');
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;
  return `${Number(month)}/${Number(day)}/${year}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function parseAmount(value: string): number {
  const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeCurrencyInput(value: string): string {
  const numericValue = value.replace(/[^0-9.]/g, '');
  const parts = numericValue.split('.');
  if (parts.length > 2) {
    return `${parts[0]}.${parts.slice(1).join('')}`;
  }
  if (parts[1] && parts[1].length > 2) {
    return `${parts[0]}.${parts[1].substring(0, 2)}`;
  }
  return numericValue;
}

function formatDollarInputDisplay(amount: number): string {
  if (!amount) return '';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

type CurrencyInputProps = {
  value: number;
  onChange: (amount: number) => void;
  wrapClass: string;
  prefixClass: string;
  inputClass: string;
  widthClass?: string;
  ariaLabel?: string;
  placeholder?: string;
};

function CurrencyInput({
  value,
  onChange,
  wrapClass,
  prefixClass,
  inputClass,
  widthClass = 'w-full',
  ariaLabel,
  placeholder = '0.00',
}: CurrencyInputProps) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);

  const handleFocus = () => {
    setFocused(true);
    if (value > 0) {
      setText(value % 1 === 0 ? String(value) : value.toFixed(2));
    } else {
      setText('');
    }
  };

  const handleBlur = () => {
    setFocused(false);
    const amount = parseAmount(text);
    onChange(amount);
    setText('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = sanitizeCurrencyInput(e.target.value);
    setText(formatted);
    onChange(parseAmount(formatted));
  };

  return (
    <div className={`${wrapClass} ${widthClass}`}>
      <span className={prefixClass}>$</span>
      <input
        type="text"
        inputMode="decimal"
        value={focused ? text : formatDollarInputDisplay(value)}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={inputClass}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
    </div>
  );
}

function getEventTotals(event: EventRecord) {
  const totalBudgeted = event.categoryBudgets.reduce((sum, cb) => sum + cb.budgetAmount, 0);
  const totalActual = event.expenses.reduce((sum, e) => sum + e.amount, 0);
  return { totalBudgeted, totalActual, remaining: totalBudgeted - totalActual };
}

function EditIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function InactiveIndicator({ className }: { className: string }) {
  return (
    <span className={className} title="Inactive" aria-label="Inactive">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    </span>
  );
}

function sortByActiveThenName<T extends NamedRecord>(records: T[]): T[] {
  return [...records].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function EventBudgetPlannerTool({ toolId }: EventBudgetPlannerToolProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';

  const titleClass = isLight ? 'text-2xl font-semibold text-slate-900 mb-2' : 'text-2xl font-semibold text-slate-50 mb-2';
  const descClass = isLight ? 'text-slate-600 text-sm' : 'text-slate-400 text-sm';
  const cardClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'
    : 'rounded-2xl border border-slate-800 bg-slate-900/70 p-6';
  const nestedCardClass = isLight
    ? 'p-4 rounded-lg border border-slate-200 bg-slate-50'
    : 'p-4 rounded-lg border border-slate-700 bg-slate-800/50';
  const sectionTitleClass = isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50';
  const counterTextClass = isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400';
  const labelClass = isLight ? 'block text-sm font-medium text-slate-700 mb-2' : 'block text-sm font-medium text-slate-300 mb-2';
  const inputClass = isLight
    ? 'w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const currencyFieldWrapClass = isLight
    ? 'flex items-stretch overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50'
    : 'flex items-stretch overflow-hidden rounded-lg border border-slate-700 bg-slate-900/70 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50';
  const currencyFieldPrefixClass = isLight
    ? 'flex shrink-0 items-center border-r border-slate-300 bg-slate-50 px-3 text-sm tabular-nums text-slate-700'
    : 'flex shrink-0 items-center border-r border-slate-600 bg-slate-800/80 px-3 text-sm tabular-nums text-slate-200';
  const currencyFieldInputClass = isLight
    ? 'min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm tabular-nums text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-0'
    : 'min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm tabular-nums text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-0';
  const selectClass = isLight
    ? 'w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const primaryButtonClass = isLight
    ? 'px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50'
    : 'px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50';
  const secondaryButtonClass = isLight
    ? 'px-4 py-2 rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors'
    : 'px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors';
  const compactPrimaryClass = isLight
    ? 'rounded px-2 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50'
    : 'rounded bg-emerald-500 px-2 py-1 text-xs font-medium text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50';
  const tabStripClass = isLight ? 'border-b border-slate-200' : 'border-b border-slate-800';
  const tabActiveClass = isLight
    ? 'border-b-2 border-emerald-600 text-emerald-900 font-semibold'
    : 'border-b-2 border-emerald-500 text-emerald-300';
  const tabInactiveClass = isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-300';
  const modalCardClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 max-w-md w-full mx-4 shadow-xl'
    : 'rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4';
  const modalCardLgClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 max-w-lg w-full mx-4 shadow-xl'
    : 'rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-lg w-full mx-4';
  const deleteModalTitleClass = isLight ? 'text-xl font-semibold text-slate-900 mb-2' : 'text-xl font-semibold text-slate-50 mb-2';
  const deleteWarningBoxClass = isLight
    ? 'rounded-lg border border-red-300 bg-red-50 px-4 py-3 mb-4'
    : 'rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4';
  const deleteWarningTextClass = isLight ? 'text-red-700 font-semibold mb-2' : 'text-red-300 font-semibold mb-2';
  const deleteWarningDetailClass = isLight ? 'text-red-600 text-sm' : 'text-red-200 text-sm';
  const deleteInstructionClass = isLight ? 'text-slate-700 mb-4' : 'text-slate-300 mb-4';
  const deleteKeywordClass = isLight ? 'text-slate-900' : 'text-slate-200';
  const deleteInputClass = isLight
    ? 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4'
    : 'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4';
  const rowIconEmeraldClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-700 bg-white p-2 text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-500/50 bg-slate-800/50 p-2 text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';
  const rowIconSecondaryClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-slate-400 bg-slate-100 p-2 text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:ring-offset-2 focus:ring-offset-white'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-slate-600 bg-slate-800 p-2 text-slate-200 transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';
  const rowIconDangerClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-red-300 bg-white p-2 text-red-700 transition-colors hover:bg-red-50 hover:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2 focus:ring-offset-white'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-red-500/50 bg-slate-800/50 p-2 text-red-400 transition-colors hover:border-red-400 hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';
  const mutedTextClass = isLight ? 'text-slate-600' : 'text-slate-400';
  const bodyTextClass = isLight ? 'text-slate-900' : 'text-slate-100';
  const subTextClass = isLight ? 'text-slate-600 text-sm' : 'text-slate-400 text-sm';
  const summaryLabelClass = isLight ? 'text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700' : 'text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300';
  const usageBadgeClass = isLight
    ? 'px-2 py-1 rounded text-xs font-medium border border-slate-300 bg-white text-slate-800'
    : 'px-2 py-1 rounded text-xs font-medium bg-slate-700 text-slate-300';
  const inactiveIndicatorClass = isLight
    ? 'inline-flex items-center justify-center rounded-full border border-slate-300 bg-slate-100 p-1 text-slate-500'
    : 'inline-flex items-center justify-center rounded-full border border-slate-600 bg-slate-800 p-1 text-slate-400';
  const overBudgetClass = isLight ? 'text-red-700 font-semibold' : 'text-red-300 font-semibold';
  const underBudgetClass = isLight ? 'text-emerald-700 font-semibold' : 'text-emerald-300 font-semibold';
  const loadingClass = isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400';

  type TabId = 'events' | 'categories' | 'vendors' | 'types';
  const [activeTab, setActiveTab] = useState<TabId>('events');

  const [categories, setCategories] = useState<NamedRecord[]>([]);
  const [types, setTypes] = useState<NamedRecord[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const applyData = useCallback((data: ApiData) => {
    setCategories(data.categories ?? []);
    setTypes(data.types ?? []);
    setVendors(data.vendors ?? []);
    setEvents(data.events ?? []);
  }, []);

  const reloadData = useCallback(async () => {
    if (!toolId) return;
    const response = await fetch(`${API_BASE}?toolId=${toolId}`);
    if (!response.ok) {
      throw new Error('Failed to load event budget planner data');
    }
    const data = (await response.json()) as ApiData;
    applyData(data);
  }, [toolId, applyData]);

  const postMain = useCallback(
    async (body: Record<string, unknown>) => {
      if (!toolId) throw new Error('Tool ID is required');
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, ...body }),
      });
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }
      if (data.categories) {
        applyData(data as ApiData);
      }
      return data;
    },
    [toolId, applyData]
  );

  useEffect(() => {
    const loadData = async () => {
      if (!toolId) {
        setCategories([]);
        setTypes([]);
        setVendors([]);
        setEvents([]);
        return;
      }

      setIsLoading(true);
      try {
        await reloadData();
      } catch {
        setCategories([]);
        setTypes([]);
        setVendors([]);
        setEvents([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [toolId, reloadData]);

  const activeCategories = useMemo(() => categories.filter((c) => c.isActive), [categories]);
  const activeTypes = useMemo(() => types.filter((t) => t.isActive), [types]);
  const activeVendors = useMemo(() => vendors.filter((v) => v.isActive), [vendors]);
  const sortedCategories = useMemo(() => sortByActiveThenName(categories), [categories]);
  const sortedTypes = useMemo(() => sortByActiveThenName(types), [types]);
  const sortedVendors = useMemo(() => sortByActiveThenName(vendors), [vendors]);
  const activeEvents = useMemo(() => events.filter((e) => e.isActive), [events]);
  const inactiveEvents = useMemo(() => events.filter((e) => !e.isActive), [events]);

  const getTypeName = useCallback((typeId: string) => types.find((t) => t.id === typeId)?.name ?? 'Unknown', [types]);
  const getCategoryName = useCallback((categoryId: string) => categories.find((c) => c.id === categoryId)?.name ?? 'Unknown', [categories]);
  const getVendorName = useCallback((vendorId: string) => vendors.find((v) => v.id === vendorId)?.name ?? 'Unknown', [vendors]);

  const getCategoryUsageCount = useCallback(
    (categoryId: string) =>
      events.reduce((count, event) => {
        const inBudget = event.categoryBudgets.some((cb) => cb.categoryId === categoryId);
        const inExpenses = event.expenses.some((e) => e.categoryId === categoryId);
        return count + (inBudget || inExpenses ? 1 : 0);
      }, 0),
    [events]
  );

  const getTypeUsageCount = useCallback(
    (typeId: string) => events.filter((e) => e.typeId === typeId).length,
    [events]
  );

  const getVendorUsageCount = useCallback(
    (vendorId: string) => events.reduce((count, event) => count + event.expenses.filter((e) => e.vendorId === vendorId).length, 0),
    [events]
  );

  // Events tab state
  const [showHistory, setShowHistory] = useState(false);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState({ name: '', date: todayIso(), typeId: '', notes: '' });
  const [newCategoryBudget, setNewCategoryBudget] = useState({ categoryId: '', budgetAmount: 0 });
  const [expenseModal, setExpenseModal] = useState<{ categoryId: string; expenseId?: string } | null>(null);
  const [expenseForm, setExpenseForm] = useState({ date: todayIso(), vendorId: '', amount: 0, note: '' });
  const [categoryBudgetModalId, setCategoryBudgetModalId] = useState<string | null>(null);
  const [categoryBudgetForm, setCategoryBudgetForm] = useState({ categoryId: '', budgetAmount: 0 });
  const [deleteEventConfirmId, setDeleteEventConfirmId] = useState<string | null>(null);
  const [deleteEventConfirmText, setDeleteEventConfirmText] = useState('');
  const [removeCategoryBudgetConfirmId, setRemoveCategoryBudgetConfirmId] = useState<string | null>(null);
  const [removeCategoryBudgetConfirmText, setRemoveCategoryBudgetConfirmText] = useState('');
  const [removeExpenseConfirmId, setRemoveExpenseConfirmId] = useState<string | null>(null);
  const [removeExpenseConfirmText, setRemoveExpenseConfirmText] = useState('');

  // Named record tabs state
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [deleteCategoryConfirmId, setDeleteCategoryConfirmId] = useState<string | null>(null);
  const [deleteCategoryConfirmText, setDeleteCategoryConfirmText] = useState('');

  const [isAddingType, setIsAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeName, setEditingTypeName] = useState('');
  const [deleteTypeConfirmId, setDeleteTypeConfirmId] = useState<string | null>(null);
  const [deleteTypeConfirmText, setDeleteTypeConfirmText] = useState('');

  const [isAddingVendor, setIsAddingVendor] = useState(false);
  const [vendorForm, setVendorForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    serviceProvided: '',
    notes: '',
  });
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [editingVendorForm, setEditingVendorForm] = useState(vendorForm);
  const [deleteVendorConfirmId, setDeleteVendorConfirmId] = useState<string | null>(null);
  const [deleteVendorConfirmText, setDeleteVendorConfirmText] = useState('');

  const resetEventForm = () => {
    const defaultTypeId = activeTypes[0]?.id ?? '';
    setEventForm({ name: '', date: todayIso(), typeId: defaultTypeId, notes: '' });
  };

  const startAddingEvent = () => {
    resetEventForm();
    setIsAddingEvent(true);
    setEditingEventId(null);
  };

  const cancelEventForm = () => {
    setIsAddingEvent(false);
    setEditingEventId(null);
    closeExpenseModal();
    closeCategoryBudgetModal();
    resetEventForm();
  };

  const saveNewEvent = async () => {
    if (!eventForm.name.trim() || !eventForm.typeId || !toolId) return;
    setIsLoading(true);
    try {
      const data = await postMain({
        action: 'createEvent',
        name: eventForm.name,
        date: eventForm.date,
        typeId: eventForm.typeId,
        notes: eventForm.notes,
      });
      setIsAddingEvent(false);
      if (data.event?.id) {
        setEditingEventId(data.event.id);
      }
      resetEventForm();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to create event.');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditingEvent = (event: EventRecord) => {
    setEditingEventId(event.id);
    setIsAddingEvent(false);
    closeExpenseModal();
    closeCategoryBudgetModal();
    setEventForm({
      name: event.name,
      date: event.date,
      typeId: event.typeId,
      notes: event.notes,
    });
  };

  const saveEventEdit = async () => {
    if (!editingEventId || !eventForm.name.trim() || !eventForm.typeId || !toolId) return;
    setIsLoading(true);
    try {
      await postMain({
        action: 'updateEvent',
        eventId: editingEventId,
        name: eventForm.name,
        date: eventForm.date,
        typeId: eventForm.typeId,
        notes: eventForm.notes,
      });
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to save event.');
    } finally {
      setIsLoading(false);
    }
  };

  const moveEventToHistory = async (id: string) => {
    if (!toolId) return;
    setIsLoading(true);
    try {
      await postMain({ action: 'inactivateEvent', eventId: id });
      if (editingEventId === id) cancelEventForm();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to move event to history.');
    } finally {
      setIsLoading(false);
    }
  };

  const reactivateEvent = async (id: string) => {
    if (!toolId) return;
    setIsLoading(true);
    try {
      await postMain({ action: 'activateEvent', eventId: id });
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to reactivate event.');
    } finally {
      setIsLoading(false);
    }
  };

  const permanentlyDeleteEvent = async () => {
    if (!deleteEventConfirmId || deleteEventConfirmText.toLowerCase() !== 'delete' || !toolId) return;
    setIsLoading(true);
    try {
      await postMain({ action: 'deleteEvent', eventId: deleteEventConfirmId });
      setDeleteEventConfirmId(null);
      setDeleteEventConfirmText('');
      if (editingEventId === deleteEventConfirmId) cancelEventForm();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to delete event.');
    } finally {
      setIsLoading(false);
    }
  };

  const editingEvent = editingEventId ? events.find((e) => e.id === editingEventId) : null;

  const addCategoryBudget = async () => {
    if (!editingEventId || !newCategoryBudget.categoryId || !toolId) return;
    const amount = newCategoryBudget.budgetAmount;
    if (amount <= 0) return;
    setIsLoading(true);
    try {
      await postMain({
        action: 'addCategoryBudget',
        eventId: editingEventId,
        categoryId: newCategoryBudget.categoryId,
        budgetAmount: amount,
      });
      setNewCategoryBudget({ categoryId: '', budgetAmount: 0 });
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to add category budget.');
    } finally {
      setIsLoading(false);
    }
  };

  const removeCategoryBudget = async (categoryId: string) => {
    if (!editingEventId || !toolId) return;
    setIsLoading(true);
    try {
      await postMain({
        action: 'removeCategoryBudget',
        eventId: editingEventId,
        categoryId,
      });
      if (categoryBudgetModalId === categoryId) closeCategoryBudgetModal();
      if (expenseModal?.categoryId === categoryId) closeExpenseModal();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to remove category.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveExpense = async () => {
    if (!editingEventId || !expenseModal || !toolId) return;
    const amount = expenseForm.amount;
    if (amount <= 0 || !expenseForm.vendorId) return;

    setIsLoading(true);
    try {
      await postMain({
        action: expenseModal.expenseId ? 'updateExpense' : 'addExpense',
        eventId: editingEventId,
        expenseId: expenseModal.expenseId,
        categoryId: expenseModal.categoryId,
        vendorId: expenseForm.vendorId,
        amount,
        expenseDate: expenseForm.date,
        note: expenseForm.note,
      });
      closeExpenseModal();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to save expense.');
    } finally {
      setIsLoading(false);
    }
  };

  const closeExpenseModal = () => {
    setExpenseModal(null);
    setExpenseForm({ date: todayIso(), vendorId: '', amount: 0, note: '' });
  };

  const openExpenseModal = (categoryId: string) => {
    setExpenseModal({ categoryId });
    setExpenseForm({ date: todayIso(), vendorId: activeVendors[0]?.id ?? '', amount: 0, note: '' });
  };

  const openEditExpenseModal = (expense: Expense) => {
    setExpenseModal({ categoryId: expense.categoryId, expenseId: expense.id });
    setExpenseForm({
      date: expense.date,
      vendorId: expense.vendorId,
      amount: expense.amount,
      note: expense.note,
    });
  };

  const openCategoryBudgetModal = (categoryId: string) => {
    const budget = editingEvent?.categoryBudgets.find((cb) => cb.categoryId === categoryId);
    if (!budget) return;
    setCategoryBudgetModalId(categoryId);
    setCategoryBudgetForm({ categoryId: budget.categoryId, budgetAmount: budget.budgetAmount });
  };

  const closeCategoryBudgetModal = () => {
    setCategoryBudgetModalId(null);
    setCategoryBudgetForm({ categoryId: '', budgetAmount: 0 });
  };

  const saveCategoryBudgetModal = async () => {
    if (!editingEventId || !categoryBudgetModalId || !toolId) return;
    const { categoryId, budgetAmount } = categoryBudgetForm;
    if (!categoryId || budgetAmount <= 0) return;

    setIsLoading(true);
    try {
      await postMain({
        action: 'updateCategoryBudget',
        eventId: editingEventId,
        categoryId,
        previousCategoryId: categoryBudgetModalId,
        budgetAmount,
      });
      closeCategoryBudgetModal();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to update category budget.');
    } finally {
      setIsLoading(false);
    }
  };

  const removeExpense = async (expenseId: string) => {
    if (!editingEventId || !toolId) return;
    setIsLoading(true);
    try {
      await postMain({
        action: 'deleteExpense',
        eventId: editingEventId,
        expenseId,
      });
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to delete expense.');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmRemoveCategoryBudget = async () => {
    if (!removeCategoryBudgetConfirmId || removeCategoryBudgetConfirmText.toLowerCase() !== 'delete') return;
    const categoryId = removeCategoryBudgetConfirmId;
    setRemoveCategoryBudgetConfirmId(null);
    setRemoveCategoryBudgetConfirmText('');
    await removeCategoryBudget(categoryId);
  };

  const confirmRemoveExpense = async () => {
    if (!removeExpenseConfirmId || removeExpenseConfirmText.toLowerCase() !== 'delete') return;
    const expenseId = removeExpenseConfirmId;
    setRemoveExpenseConfirmId(null);
    setRemoveExpenseConfirmText('');
    await removeExpense(expenseId);
  };

  // Category CRUD
  const addCategory = async () => {
    if (!newCategoryName.trim() || !toolId) return;
    const trimmedName = newCategoryName.trim();
    if (categories.some((c) => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      alert('A category with this name already exists.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, name: trimmedName }),
      });
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add category.');
      }
      await reloadData();
      setNewCategoryName('');
      setIsAddingCategory(false);
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to add category.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveCategoryEdit = async () => {
    if (!editingCategoryId || !editingCategoryName.trim() || !toolId) return;
    const trimmedName = editingCategoryName.trim();
    if (
      categories.some(
        (c) => c.id !== editingCategoryId && c.name.toLowerCase() === trimmedName.toLowerCase()
      )
    ) {
      alert('A category with this name already exists.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, categoryId: editingCategoryId, name: trimmedName }),
      });
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update category.');
      }
      await reloadData();
      setEditingCategoryId(null);
      setEditingCategoryName('');
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to update category.');
    } finally {
      setIsLoading(false);
    }
  };

  const inactivateCategory = async (id: string) => {
    if (!toolId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, categoryId: id, action: 'inactivate' }),
      });
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to inactivate category.');
      }
      await reloadData();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to inactivate category.');
    } finally {
      setIsLoading(false);
    }
  };

  const activateCategory = async (id: string) => {
    if (!toolId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, categoryId: id, action: 'activate' }),
      });
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to activate category.');
      }
      await reloadData();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to activate category.');
    } finally {
      setIsLoading(false);
    }
  };

  const permanentlyDeleteCategory = async () => {
    if (!deleteCategoryConfirmId || deleteCategoryConfirmText.toLowerCase() !== 'delete' || !toolId) return;
    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/categories?categoryId=${deleteCategoryConfirmId}&toolId=${toolId}`,
        { method: 'DELETE' }
      );
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete category.');
      }
      await reloadData();
      setDeleteCategoryConfirmId(null);
      setDeleteCategoryConfirmText('');
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to delete category.');
    } finally {
      setIsLoading(false);
    }
  };

  // Type CRUD
  const addType = async () => {
    if (!newTypeName.trim() || !toolId) return;
    const trimmedName = newTypeName.trim();
    if (types.some((t) => t.name.toLowerCase() === trimmedName.toLowerCase())) {
      alert('A type with this name already exists.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, name: trimmedName }),
      });
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add type.');
      }
      await reloadData();
      setNewTypeName('');
      setIsAddingType(false);
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to add type.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveTypeEdit = async () => {
    if (!editingTypeId || !editingTypeName.trim() || !toolId) return;
    const trimmedName = editingTypeName.trim();
    if (types.some((t) => t.id !== editingTypeId && t.name.toLowerCase() === trimmedName.toLowerCase())) {
      alert('A type with this name already exists.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, typeId: editingTypeId, name: trimmedName }),
      });
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update type.');
      }
      await reloadData();
      setEditingTypeId(null);
      setEditingTypeName('');
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to update type.');
    } finally {
      setIsLoading(false);
    }
  };

  const inactivateType = async (id: string) => {
    if (!toolId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, typeId: id, action: 'inactivate' }),
      });
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to inactivate type.');
      }
      await reloadData();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to inactivate type.');
    } finally {
      setIsLoading(false);
    }
  };

  const activateType = async (id: string) => {
    if (!toolId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, typeId: id, action: 'activate' }),
      });
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to activate type.');
      }
      await reloadData();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to activate type.');
    } finally {
      setIsLoading(false);
    }
  };

  const permanentlyDeleteType = async () => {
    if (!deleteTypeConfirmId || deleteTypeConfirmText.toLowerCase() !== 'delete' || !toolId) return;
    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/types?typeId=${deleteTypeConfirmId}&toolId=${toolId}`,
        { method: 'DELETE' }
      );
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete type.');
      }
      await reloadData();
      setDeleteTypeConfirmId(null);
      setDeleteTypeConfirmText('');
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to delete type.');
    } finally {
      setIsLoading(false);
    }
  };

  // Vendor CRUD
  const emptyVendorForm = () => ({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    serviceProvided: '',
    notes: '',
  });

  const addVendor = async () => {
    if (!vendorForm.name.trim() || !toolId) return;
    const trimmedName = vendorForm.name.trim();
    if (vendors.some((v) => v.name.toLowerCase() === trimmedName.toLowerCase())) {
      alert('A vendor with this name already exists.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId,
          name: trimmedName,
          contactPerson: vendorForm.contactPerson,
          phone: vendorForm.phone,
          email: vendorForm.email,
          serviceProvided: vendorForm.serviceProvided,
          notes: vendorForm.notes,
        }),
      });
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add vendor.');
      }
      await reloadData();
      setVendorForm(emptyVendorForm());
      setIsAddingVendor(false);
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to add vendor.');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditingVendor = (vendor: Vendor) => {
    setEditingVendorId(vendor.id);
    setEditingVendorForm({
      name: vendor.name,
      contactPerson: vendor.contactPerson,
      phone: vendor.phone,
      email: vendor.email,
      serviceProvided: vendor.serviceProvided,
      notes: vendor.notes,
    });
  };

  const saveVendorEdit = async () => {
    if (!editingVendorId || !editingVendorForm.name.trim() || !toolId) return;
    const trimmedName = editingVendorForm.name.trim();
    if (
      vendors.some(
        (v) => v.id !== editingVendorId && v.name.toLowerCase() === trimmedName.toLowerCase()
      )
    ) {
      alert('A vendor with this name already exists.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId,
          vendorId: editingVendorId,
          name: trimmedName,
          contactPerson: editingVendorForm.contactPerson,
          phone: editingVendorForm.phone,
          email: editingVendorForm.email,
          serviceProvided: editingVendorForm.serviceProvided,
          notes: editingVendorForm.notes,
        }),
      });
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update vendor.');
      }
      await reloadData();
      setEditingVendorId(null);
      setEditingVendorForm(emptyVendorForm());
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to update vendor.');
    } finally {
      setIsLoading(false);
    }
  };

  const inactivateVendor = async (id: string) => {
    if (!toolId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, vendorId: id, action: 'inactivate' }),
      });
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to inactivate vendor.');
      }
      await reloadData();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to inactivate vendor.');
    } finally {
      setIsLoading(false);
    }
  };

  const activateVendor = async (id: string) => {
    if (!toolId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, vendorId: id, action: 'activate' }),
      });
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to activate vendor.');
      }
      await reloadData();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to activate vendor.');
    } finally {
      setIsLoading(false);
    }
  };

  const permanentlyDeleteVendor = async () => {
    if (!deleteVendorConfirmId || deleteVendorConfirmText.toLowerCase() !== 'delete' || !toolId) return;
    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/vendors?vendorId=${deleteVendorConfirmId}&toolId=${toolId}`,
        { method: 'DELETE' }
      );
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete vendor.');
      }
      await reloadData();
      setDeleteVendorConfirmId(null);
      setDeleteVendorConfirmText('');
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to delete vendor.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderDeleteModal = (
    title: string,
    itemLabel: string,
    confirmText: string,
    setConfirmText: (v: string) => void,
    onDelete: () => void,
    onCancel: () => void
  ) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className={modalCardClass}>
        <h3 className={deleteModalTitleClass}>{title}</h3>
        <div className={deleteWarningBoxClass}>
          <p className={deleteWarningTextClass}>Warning: This action cannot be undone.</p>
          <p className={deleteWarningDetailClass}>You are about to permanently delete {itemLabel}.</p>
        </div>
        <p className={deleteInstructionClass}>
          Type <span className={`font-semibold ${deleteKeywordClass}`}>delete</span> to confirm.
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="Type 'delete' to confirm"
          className={deleteInputClass}
          autoFocus
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onDelete}
            disabled={confirmText.toLowerCase() !== 'delete'}
            className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete Permanently
          </button>
          <button type="button" onClick={onCancel} className={secondaryButtonClass}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  const renderNamedRecordRow = (
    record: NamedRecord,
    usageCount: number,
    usageLabel: string,
    isEditing: boolean,
    editingName: string,
    setEditingName: (v: string) => void,
    onSaveEdit: () => void,
    onCancelEdit: () => void,
    onStartEdit: () => void,
    onInactivate: () => void,
    onActivate: () => void,
    onDelete: () => void
  ) => (
    <div key={record.id} className={`${nestedCardClass}${record.isActive ? '' : ' opacity-80'}`}>
      {isEditing ? (
        <div className="flex gap-3 items-center flex-wrap">
          <input
            type="text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            className={`flex-1 min-w-[200px] ${inputClass}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit();
              if (e.key === 'Escape') onCancelEdit();
            }}
            autoFocus
          />
          <button type="button" onClick={onSaveEdit} disabled={!editingName.trim()} className={compactPrimaryClass}>
            Save
          </button>
          <button type="button" onClick={onCancelEdit} className={secondaryButtonClass}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {!record.isActive && <InactiveIndicator className={inactiveIndicatorClass} />}
            <span className={`text-lg font-medium ${record.isActive ? bodyTextClass : mutedTextClass}`}>{record.name}</span>
            <span className={usageBadgeClass}>
              Used {usageCount} {usageLabel}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={onStartEdit} className={rowIconEmeraldClass} title="Edit" aria-label="Edit">
              <EditIcon />
            </button>
            {record.isActive ? (
              <button type="button" onClick={onInactivate} className={rowIconSecondaryClass} title="Inactivate" aria-label="Inactivate">
                <ArchiveIcon />
              </button>
            ) : (
              <>
                <button type="button" onClick={onActivate} className={rowIconEmeraldClass} title="Reactivate" aria-label="Reactivate">
                  <RestoreIcon />
                </button>
                <button type="button" onClick={onDelete} className={rowIconDangerClass} title="Delete permanently" aria-label="Delete permanently">
                  <DeleteIcon />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderEventFormFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={eventForm.name}
            onChange={(e) => setEventForm((f) => ({ ...f, name: e.target.value }))}
            className={inputClass}
            placeholder="Event name"
          />
        </div>
        <div>
          <label className={labelClass}>
            Date <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            value={eventForm.date}
            onChange={(e) => setEventForm((f) => ({ ...f, date: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>
            Type <span className="text-red-400">*</span>
          </label>
          <select
            value={eventForm.typeId}
            onChange={(e) => setEventForm((f) => ({ ...f, typeId: e.target.value }))}
            className={selectClass}
          >
            <option value="">Select a type</option>
            {activeTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>Notes</label>
        <textarea
          value={eventForm.notes}
          onChange={(e) => setEventForm((f) => ({ ...f, notes: e.target.value }))}
          rows={3}
          className={inputClass}
          placeholder="Optional notes about this event"
        />
      </div>
    </div>
  );

  const renderEventBudgetSection = () => {
    if (!editingEvent) return null;
    const totals = getEventTotals(editingEvent);
    const availableCategories = activeCategories.filter(
      (c) => !editingEvent.categoryBudgets.some((cb) => cb.categoryId === c.id)
    );

    return (
      <div className="space-y-6 mt-6 pt-6 border-t border-slate-700/50">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={nestedCardClass}>
            <p className={summaryLabelClass}>Total Budgeted</p>
            <p className={`text-2xl font-semibold mt-1 ${bodyTextClass}`}>{formatCurrency(totals.totalBudgeted)}</p>
          </div>
          <div className={nestedCardClass}>
            <p className={summaryLabelClass}>Total Actual</p>
            <p className={`text-2xl font-semibold mt-1 ${bodyTextClass}`}>{formatCurrency(totals.totalActual)}</p>
          </div>
          <div className={nestedCardClass}>
            <p className={summaryLabelClass}>Remaining</p>
            <p className={`text-2xl font-semibold mt-1 ${totals.remaining < 0 ? overBudgetClass : underBudgetClass}`}>
              {formatCurrency(totals.remaining)}
            </p>
          </div>
        </div>

        <div>
          <h4 className={`${sectionTitleClass} mb-4`}>Category Budgets & Expenses</h4>
          {availableCategories.length > 0 && (
            <div className={`${nestedCardClass} mb-4`}>
              <p className={`${labelClass} mb-3`}>Add category to this event</p>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[160px]">
                  <label className={labelClass}>Category</label>
                  <select
                    value={newCategoryBudget.categoryId}
                    onChange={(e) => setNewCategoryBudget((f) => ({ ...f, categoryId: e.target.value }))}
                    className={selectClass}
                  >
                    <option value="">Select category</option>
                    {availableCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-40">
                  <label className={labelClass}>Budget</label>
                  <CurrencyInput
                    value={newCategoryBudget.budgetAmount}
                    onChange={(amount) => setNewCategoryBudget((f) => ({ ...f, budgetAmount: amount }))}
                    wrapClass={currencyFieldWrapClass}
                    prefixClass={currencyFieldPrefixClass}
                    inputClass={currencyFieldInputClass}
                    ariaLabel="Category budget amount in USD"
                  />
                </div>
                <button
                  type="button"
                  onClick={addCategoryBudget}
                  disabled={!newCategoryBudget.categoryId || newCategoryBudget.budgetAmount <= 0}
                  className={primaryButtonClass}
                >
                  Add Category
                </button>
              </div>
            </div>
          )}

          {editingEvent.categoryBudgets.length === 0 ? (
            <p className={`${mutedTextClass} text-center py-6`}>No categories added yet. Add a category budget to start tracking expenses.</p>
          ) : (
            <div className="space-y-4">
              {editingEvent.categoryBudgets.map((cb) => {
                const categoryExpenses = editingEvent.expenses.filter((e) => e.categoryId === cb.categoryId);
                const categoryActual = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
                const categoryRemaining = cb.budgetAmount - categoryActual;

                return (
                  <div key={cb.categoryId} className={nestedCardClass}>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <h5 className={`font-semibold ${bodyTextClass}`}>{getCategoryName(cb.categoryId)}</h5>
                        <div className={`flex flex-wrap gap-x-4 gap-y-1 mt-1 ${subTextClass}`}>
                          <span>Budget: {formatCurrency(cb.budgetAmount)}</span>
                          <span>Actual: {formatCurrency(categoryActual)}</span>
                          <span className={categoryRemaining < 0 ? overBudgetClass : underBudgetClass}>
                            Remaining: {formatCurrency(categoryRemaining)}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openCategoryBudgetModal(cb.categoryId)}
                          className={rowIconEmeraldClass}
                          title="Edit category budget"
                          aria-label="Edit category budget"
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoveCategoryBudgetConfirmId(cb.categoryId)}
                          className={rowIconDangerClass}
                          title="Remove category from event"
                          aria-label="Remove category from event"
                        >
                          <DeleteIcon />
                        </button>
                      </div>
                    </div>

                    {categoryExpenses.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {categoryExpenses.map((expense) => (
                          <div
                            key={expense.id}
                            className={
                              isLight
                                ? 'flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-200 bg-white'
                                : 'flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-700 bg-slate-900/50'
                            }
                          >
                            <div className="flex-1 min-w-0">
                              <div className={`flex flex-wrap gap-x-4 gap-y-1 text-sm ${bodyTextClass}`}>
                                <span className="font-medium">{formatCurrency(expense.amount)}</span>
                                <span>{formatDisplayDate(expense.date)}</span>
                                <span>{getVendorName(expense.vendorId)}</span>
                              </div>
                              {expense.note && (
                                <p className={`text-xs mt-1 italic ${mutedTextClass}`}>{expense.note}</p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditExpenseModal(expense)}
                                className={rowIconEmeraldClass}
                                title="Edit expense"
                                aria-label="Edit expense"
                              >
                                <EditIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() => setRemoveExpenseConfirmId(expense.id)}
                                className={rowIconDangerClass}
                                title="Remove expense"
                                aria-label="Remove expense"
                              >
                                <DeleteIcon />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => openExpenseModal(cb.categoryId)}
                      disabled={activeVendors.length === 0}
                      className={secondaryButtonClass}
                    >
                      + Add Expense
                    </button>
                    {activeVendors.length === 0 && (
                      <p className={`text-xs mt-2 ${mutedTextClass}`}>Add vendors in the Vendors tab to record expenses.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderVendorFields = (
    form: typeof vendorForm,
    setForm: React.Dispatch<React.SetStateAction<typeof vendorForm>>
  ) => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Contact Person</label>
          <input
            type="text"
            value={form.contactPerson}
            onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>Service Provided</label>
          <input
            type="text"
            value={form.serviceProvided}
            onChange={(e) => setForm((f) => ({ ...f, serviceProvided: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className={titleClass}>Event Budget Planner</h2>
        <p className={descClass}>
          Organize and manage the financial side of any event by tracking planned and actual expenses in one place.
        </p>
      </div>

      {isLoading && <div className={loadingClass}>Loading...</div>}

      <div className={tabStripClass}>
        <div className="flex gap-2 overflow-x-auto">
          {(
            [
              { id: 'events', label: 'Events' },
              { id: 'categories', label: 'Categories' },
              { id: 'vendors', label: 'Vendors' },
              { id: 'types', label: 'Types' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id ? tabActiveClass : tabInactiveClass
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events Tab */}
      {activeTab === 'events' && (
        <div className="space-y-6">
          {!isAddingEvent && !editingEventId && (
            <div className="flex justify-start">
              <button type="button" onClick={startAddingEvent} className={primaryButtonClass}>
                + Add New Event
              </button>
            </div>
          )}

          {isAddingEvent && (
            <div className={cardClass}>
              <h3 className={`${sectionTitleClass} mb-4`}>Add New Event</h3>
              {renderEventFormFields()}
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={saveNewEvent}
                  disabled={!eventForm.name.trim() || !eventForm.typeId}
                  className={primaryButtonClass}
                >
                  Create Event
                </button>
                <button type="button" onClick={cancelEventForm} className={secondaryButtonClass}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {editingEventId && editingEvent && (
            <div className={cardClass}>
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <h3 className={sectionTitleClass}>Edit Event</h3>
                <button type="button" onClick={cancelEventForm} className={secondaryButtonClass}>
                  Close
                </button>
              </div>
              {renderEventFormFields()}
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={saveEventEdit}
                  disabled={!eventForm.name.trim() || !eventForm.typeId}
                  className={primaryButtonClass}
                >
                  Save Event Details
                </button>
              </div>
              {renderEventBudgetSection()}
            </div>
          )}

          {!editingEventId && (
            <div className={cardClass}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={sectionTitleClass}>Active Events</h3>
                <span className={counterTextClass}>
                  {activeEvents.length} {activeEvents.length === 1 ? 'event' : 'events'}
                </span>
              </div>
              {activeEvents.length > 0 ? (
                <div className="space-y-3">
                  {activeEvents.map((event) => {
                    const totals = getEventTotals(event);
                    return (
                      <div key={event.id} className={nestedCardClass}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-base font-semibold ${bodyTextClass}`}>{event.name}</h4>
                            <div className={`flex flex-wrap gap-x-4 gap-y-1 mt-1 ${subTextClass}`}>
                              <span>{formatDisplayDate(event.date)}</span>
                              <span>{getTypeName(event.typeId)}</span>
                              <span>Budgeted: {formatCurrency(totals.totalBudgeted)}</span>
                              <span>Actual: {formatCurrency(totals.totalActual)}</span>
                            </div>
                            {event.notes && (
                              <p className={`text-xs mt-1.5 italic ${mutedTextClass}`}>{event.notes}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEditingEvent(event)}
                              className={rowIconEmeraldClass}
                              title="Edit event"
                              aria-label="Edit event"
                            >
                              <EditIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveEventToHistory(event.id)}
                              className={rowIconSecondaryClass}
                              title="Move to history"
                              aria-label="Move to history"
                            >
                              <ArchiveIcon />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={`text-center py-8 ${mutedTextClass}`}>No active events. Add one to get started!</p>
              )}
            </div>
          )}

          {!editingEventId && (
            <div className={cardClass}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={sectionTitleClass}>History</h3>
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className={`text-sm ${mutedTextClass} hover:opacity-80 transition-colors`}
                >
                  {showHistory ? 'Hide' : 'Show'} ({inactiveEvents.length})
                </button>
              </div>
              {showHistory &&
                (inactiveEvents.length > 0 ? (
                  <div className="space-y-3">
                    {inactiveEvents.map((event) => {
                      const totals = getEventTotals(event);
                      return (
                        <div key={event.id} className={`${nestedCardClass} opacity-75`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className={`text-base font-semibold ${mutedTextClass}`}>{event.name}</h4>
                              <div className={`flex flex-wrap gap-x-4 gap-y-1 mt-1 ${subTextClass}`}>
                                <span>{formatDisplayDate(event.date)}</span>
                                <span>{getTypeName(event.typeId)}</span>
                                <span>Budgeted: {formatCurrency(totals.totalBudgeted)}</span>
                                <span>Actual: {formatCurrency(totals.totalActual)}</span>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => reactivateEvent(event.id)}
                                className={rowIconEmeraldClass}
                                title="Reactivate event"
                                aria-label="Reactivate event"
                              >
                                <RestoreIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteEventConfirmId(event.id)}
                                className={rowIconDangerClass}
                                title="Delete permanently"
                                aria-label="Delete permanently"
                              >
                                <DeleteIcon />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className={`text-center py-8 ${mutedTextClass}`}>No events in history.</p>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          {!isAddingCategory ? (
            <div className="flex justify-start">
              <button type="button" onClick={() => setIsAddingCategory(true)} className={primaryButtonClass}>
                + Add New Category
              </button>
            </div>
          ) : (
            <div className={cardClass}>
              <h3 className={`${sectionTitleClass} mb-4`}>Add New Category</h3>
              <div className="flex gap-4 flex-wrap">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name"
                  className={`flex-1 min-w-[200px] ${inputClass}`}
                  onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                />
                <button type="button" onClick={addCategory} disabled={!newCategoryName.trim()} className={primaryButtonClass}>
                  Add Category
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingCategory(false);
                    setNewCategoryName('');
                  }}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={sectionTitleClass}>Categories</h3>
              <span className={counterTextClass}>
                {categories.length} {categories.length === 1 ? 'category' : 'categories'}
              </span>
            </div>
            {sortedCategories.length > 0 ? (
              <div className="space-y-3">
                {sortedCategories.map((cat) =>
                  renderNamedRecordRow(
                    cat,
                    getCategoryUsageCount(cat.id),
                    getCategoryUsageCount(cat.id) === 1 ? 'event' : 'events',
                    editingCategoryId === cat.id,
                    editingCategoryName,
                    setEditingCategoryName,
                    saveCategoryEdit,
                    () => {
                      setEditingCategoryId(null);
                      setEditingCategoryName('');
                    },
                    () => {
                      setEditingCategoryId(cat.id);
                      setEditingCategoryName(cat.name);
                    },
                    () => inactivateCategory(cat.id),
                    () => activateCategory(cat.id),
                    () => setDeleteCategoryConfirmId(cat.id)
                  )
                )}
              </div>
            ) : (
              <p className={`text-center py-8 ${mutedTextClass}`}>No categories yet. Add one to get started!</p>
            )}
          </div>
        </div>
      )}

      {/* Vendors Tab */}
      {activeTab === 'vendors' && (
        <div className="space-y-6">
          {!isAddingVendor ? (
            <div className="flex justify-start">
              <button type="button" onClick={() => setIsAddingVendor(true)} className={primaryButtonClass}>
                + Add New Vendor
              </button>
            </div>
          ) : (
            <div className={cardClass}>
              <h3 className={`${sectionTitleClass} mb-4`}>Add New Vendor</h3>
              {renderVendorFields(vendorForm, setVendorForm)}
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={addVendor} disabled={!vendorForm.name.trim()} className={primaryButtonClass}>
                  Add Vendor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingVendor(false);
                    setVendorForm(emptyVendorForm());
                  }}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={sectionTitleClass}>Vendors</h3>
              <span className={counterTextClass}>
                {vendors.length} {vendors.length === 1 ? 'vendor' : 'vendors'}
              </span>
            </div>
            {sortedVendors.length > 0 ? (
              <div className="space-y-3">
                {sortedVendors.map((vendor) => (
                  <div key={vendor.id} className={`${nestedCardClass}${vendor.isActive ? '' : ' opacity-80'}`}>
                    {editingVendorId === vendor.id ? (
                      <div>
                        {renderVendorFields(editingVendorForm, setEditingVendorForm)}
                        <div className="flex gap-3 mt-4">
                          <button
                            type="button"
                            onClick={saveVendorEdit}
                            disabled={!editingVendorForm.name.trim()}
                            className={primaryButtonClass}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingVendorId(null);
                              setEditingVendorForm(emptyVendorForm());
                            }}
                            className={secondaryButtonClass}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {!vendor.isActive && <InactiveIndicator className={inactiveIndicatorClass} />}
                            <h4 className={`font-semibold ${vendor.isActive ? bodyTextClass : mutedTextClass}`}>{vendor.name}</h4>
                          </div>
                          <div className={`flex flex-wrap gap-x-4 gap-y-1 mt-1 ${subTextClass}`}>
                            {vendor.contactPerson && <span>{vendor.contactPerson}</span>}
                            {vendor.phone && <span>{vendor.phone}</span>}
                            {vendor.email && <span>{vendor.email}</span>}
                          </div>
                          {vendor.serviceProvided && (
                            <p className={`text-sm mt-1 ${mutedTextClass}`}>{vendor.serviceProvided}</p>
                          )}
                          {vendor.notes && (
                            <p className={`text-xs mt-1 italic ${mutedTextClass}`}>{vendor.notes}</p>
                          )}
                          <span className={`inline-block mt-2 ${usageBadgeClass}`}>
                            Used in {getVendorUsageCount(vendor.id)}{' '}
                            {getVendorUsageCount(vendor.id) === 1 ? 'expense' : 'expenses'}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEditingVendor(vendor)}
                            className={rowIconEmeraldClass}
                            title="Edit vendor"
                            aria-label="Edit vendor"
                          >
                            <EditIcon />
                          </button>
                          {vendor.isActive ? (
                            <button
                              type="button"
                              onClick={() => inactivateVendor(vendor.id)}
                              className={rowIconSecondaryClass}
                              title="Inactivate vendor"
                              aria-label="Inactivate vendor"
                            >
                              <ArchiveIcon />
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => activateVendor(vendor.id)}
                                className={rowIconEmeraldClass}
                                title="Reactivate vendor"
                                aria-label="Reactivate vendor"
                              >
                                <RestoreIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteVendorConfirmId(vendor.id)}
                                className={rowIconDangerClass}
                                title="Delete permanently"
                                aria-label="Delete permanently"
                              >
                                <DeleteIcon />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-center py-8 ${mutedTextClass}`}>No vendors yet. Add one to get started!</p>
            )}
          </div>
        </div>
      )}

      {/* Types Tab */}
      {activeTab === 'types' && (
        <div className="space-y-6">
          {!isAddingType ? (
            <div className="flex justify-start">
              <button type="button" onClick={() => setIsAddingType(true)} className={primaryButtonClass}>
                + Add New Type
              </button>
            </div>
          ) : (
            <div className={cardClass}>
              <h3 className={`${sectionTitleClass} mb-4`}>Add New Type</h3>
              <div className="flex gap-4 flex-wrap">
                <input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="Type name"
                  className={`flex-1 min-w-[200px] ${inputClass}`}
                  onKeyDown={(e) => e.key === 'Enter' && addType()}
                />
                <button type="button" onClick={addType} disabled={!newTypeName.trim()} className={primaryButtonClass}>
                  Add Type
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingType(false);
                    setNewTypeName('');
                  }}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={sectionTitleClass}>Types</h3>
              <span className={counterTextClass}>
                {types.length} {types.length === 1 ? 'type' : 'types'}
              </span>
            </div>
            {sortedTypes.length > 0 ? (
              <div className="space-y-3">
                {sortedTypes.map((type) =>
                  renderNamedRecordRow(
                    type,
                    getTypeUsageCount(type.id),
                    getTypeUsageCount(type.id) === 1 ? 'event' : 'events',
                    editingTypeId === type.id,
                    editingTypeName,
                    setEditingTypeName,
                    saveTypeEdit,
                    () => {
                      setEditingTypeId(null);
                      setEditingTypeName('');
                    },
                    () => {
                      setEditingTypeId(type.id);
                      setEditingTypeName(type.name);
                    },
                    () => inactivateType(type.id),
                    () => activateType(type.id),
                    () => setDeleteTypeConfirmId(type.id)
                  )
                )}
              </div>
            ) : (
              <p className={`text-center py-8 ${mutedTextClass}`}>No types yet. Add one to get started!</p>
            )}
          </div>
        </div>
      )}

      {expenseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={modalCardLgClass}>
            <h3 className={`${sectionTitleClass} mb-1`}>
              {expenseModal.expenseId ? 'Edit Expense' : 'Add Expense'}
            </h3>
            <p className={`${subTextClass} mb-6`}>{getCategoryName(expenseModal.categoryId)}</p>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>
                  Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, date: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Vendor <span className="text-red-400">*</span>
                </label>
                <select
                  value={expenseForm.vendorId}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, vendorId: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">Select vendor</option>
                  {activeVendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  Amount <span className="text-red-400">*</span>
                </label>
                <CurrencyInput
                  value={expenseForm.amount}
                  onChange={(amount) => setExpenseForm((f) => ({ ...f, amount }))}
                  wrapClass={currencyFieldWrapClass}
                  prefixClass={currencyFieldPrefixClass}
                  inputClass={currencyFieldInputClass}
                  ariaLabel="Expense amount in USD"
                />
              </div>
              <div>
                <label className={labelClass}>Note</label>
                <textarea
                  value={expenseForm.note}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, note: e.target.value }))}
                  rows={2}
                  className={inputClass}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={saveExpense}
                disabled={!expenseForm.vendorId || expenseForm.amount <= 0}
                className={`flex-1 ${primaryButtonClass}`}
              >
                {expenseModal.expenseId ? 'Save Changes' : 'Save Expense'}
              </button>
              <button type="button" onClick={closeExpenseModal} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {categoryBudgetModalId && editingEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={modalCardLgClass}>
            <h3 className={`${sectionTitleClass} mb-6`}>Edit Category Budget</h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>
                  Category <span className="text-red-400">*</span>
                </label>
                <select
                  value={categoryBudgetForm.categoryId}
                  onChange={(e) => setCategoryBudgetForm((f) => ({ ...f, categoryId: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">Select category</option>
                  {activeCategories
                    .filter(
                      (c) =>
                        c.id === categoryBudgetModalId ||
                        !editingEvent.categoryBudgets.some((cb) => cb.categoryId === c.id)
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  Budget <span className="text-red-400">*</span>
                </label>
                <CurrencyInput
                  value={categoryBudgetForm.budgetAmount}
                  onChange={(amount) => setCategoryBudgetForm((f) => ({ ...f, budgetAmount: amount }))}
                  wrapClass={currencyFieldWrapClass}
                  prefixClass={currencyFieldPrefixClass}
                  inputClass={currencyFieldInputClass}
                  ariaLabel="Category budget amount in USD"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={saveCategoryBudgetModal}
                disabled={!categoryBudgetForm.categoryId || categoryBudgetForm.budgetAmount <= 0}
                className={`flex-1 ${primaryButtonClass}`}
              >
                Save Changes
              </button>
              <button type="button" onClick={closeCategoryBudgetModal} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {removeCategoryBudgetConfirmId &&
        renderDeleteModal(
          'Remove Category',
          `the "${getCategoryName(removeCategoryBudgetConfirmId)}" category and all of its expenses from this event`,
          removeCategoryBudgetConfirmText,
          setRemoveCategoryBudgetConfirmText,
          confirmRemoveCategoryBudget,
          () => {
            setRemoveCategoryBudgetConfirmId(null);
            setRemoveCategoryBudgetConfirmText('');
          }
        )}

      {removeExpenseConfirmId &&
        renderDeleteModal(
          'Delete Expense',
          'this expense',
          removeExpenseConfirmText,
          setRemoveExpenseConfirmText,
          confirmRemoveExpense,
          () => {
            setRemoveExpenseConfirmId(null);
            setRemoveExpenseConfirmText('');
          }
        )}

      {deleteEventConfirmId &&
        renderDeleteModal(
          'Delete Event',
          'this event and all of its budget and expense data',
          deleteEventConfirmText,
          setDeleteEventConfirmText,
          permanentlyDeleteEvent,
          () => {
            setDeleteEventConfirmId(null);
            setDeleteEventConfirmText('');
          }
        )}

      {deleteCategoryConfirmId &&
        renderDeleteModal(
          'Delete Category',
          'this category',
          deleteCategoryConfirmText,
          setDeleteCategoryConfirmText,
          permanentlyDeleteCategory,
          () => {
            setDeleteCategoryConfirmId(null);
            setDeleteCategoryConfirmText('');
          }
        )}

      {deleteVendorConfirmId &&
        renderDeleteModal(
          'Delete Vendor',
          'this vendor',
          deleteVendorConfirmText,
          setDeleteVendorConfirmText,
          permanentlyDeleteVendor,
          () => {
            setDeleteVendorConfirmId(null);
            setDeleteVendorConfirmText('');
          }
        )}

      {deleteTypeConfirmId &&
        renderDeleteModal(
          'Delete Type',
          'this type',
          deleteTypeConfirmText,
          setDeleteTypeConfirmText,
          permanentlyDeleteType,
          () => {
            setDeleteTypeConfirmId(null);
            setDeleteTypeConfirmText('');
          }
        )}
    </div>
  );
}
