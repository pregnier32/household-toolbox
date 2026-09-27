'use client';

import { useState, useEffect, useRef } from 'react';
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
import {
  QUARTER_GROUPS,
  isQuarterAnchorDate,
  monthIndexFromIso,
  quarterAnchorDate,
  quarterGroupLabel,
  quarterOffsetFromIso,
  quarterOffsetFromMonth,
} from '@/lib/subscription-schedule';

const API_BASE = '/api/tools/subscription-tracker';

type SubscriptionFrequency = 'monthly' | 'quarterly' | 'annual';

type Subscription = {
  id: string;
  name: string;
  category: string;
  frequency: SubscriptionFrequency;
  amount: number;
  dayOfMonth: number | null; // null for annual subscriptions
  billedDate: string | null; // annual bill date, or the quarterly billing-month anchor
  renewalDate: string | null; // only for annual subscriptions
  notes: string;
  isActive: boolean;
  dateAdded: string;
  dateInactivated?: string;
  addToDashboard: boolean;
  attachments: AttachmentItem[];
};

type SubscriptionFormState = {
  name: string;
  category: string;
  customCategory: string;
  frequency: SubscriptionFrequency;
  amount: string;
  dayOfMonth: string;
  billedDate: string;
  renewalDate: string;
  notes: string;
  addToDashboard: boolean;
};

function emptySubscriptionForm(): SubscriptionFormState {
  return {
    name: '',
    category: '',
    customCategory: '',
    frequency: 'monthly',
    amount: '',
    dayOfMonth: '',
    billedDate: '',
    renewalDate: '',
    notes: '',
    addToDashboard: false,
  };
}

function localTodayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function quarterAnchorFor(isoDate: string | null | undefined): string {
  const offset = quarterOffsetFromIso(isoDate) ?? quarterOffsetFromMonth(new Date().getMonth());
  return quarterAnchorDate(offset);
}

function billingMonthsLabel(billedDate: string | null | undefined, dateAdded?: string | null): string {
  const anchor = monthIndexFromIso(billedDate) ?? monthIndexFromIso(dateAdded);
  if (anchor == null) return '';
  return quarterGroupLabel(quarterOffsetFromMonth(anchor));
}

function applyFrequencyChange(
  current: SubscriptionFormState,
  newFrequency: SubscriptionFrequency
): SubscriptionFormState {
  if (newFrequency === 'annual') {
    const keepBilled = current.billedDate && !isQuarterAnchorDate(current.billedDate) ? current.billedDate : '';
    return {
      ...current,
      frequency: newFrequency,
      dayOfMonth: '',
      billedDate: keepBilled,
      renewalDate: current.renewalDate || '',
    };
  }
  if (newFrequency === 'quarterly') {
    const offsetSource = current.billedDate && !isQuarterAnchorDate(current.billedDate)
      ? current.billedDate
      : localTodayIso();
    return {
      ...current,
      frequency: newFrequency,
      dayOfMonth: current.dayOfMonth || '',
      billedDate: quarterAnchorFor(offsetSource),
      renewalDate: '',
    };
  }
  return {
    ...current,
    frequency: 'monthly',
    dayOfMonth: current.dayOfMonth || '',
    billedDate: '',
    renewalDate: '',
  };
}

function QuarterMonthsField({
  billedDate,
  onChange,
  labelClassName,
  selectClassName,
}: {
  billedDate: string;
  onChange: (billedDate: string) => void;
  labelClassName: string;
  selectClassName: string;
}) {
  const offset = quarterOffsetFromIso(billedDate);
  return (
    <div>
      <label className={labelClassName}>
        Billing months <span className="text-red-400">*</span>
      </label>
      <select
        value={offset == null ? '0' : String(offset)}
        onChange={(e) => onChange(quarterAnchorDate(Number(e.target.value)))}
        className={selectClassName}
      >
        {QUARTER_GROUPS.map((group) => (
          <option key={group.offset} value={group.offset}>
            {group.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function DashboardCalendarSwitch({
  isOn,
  onToggle,
  isLight,
}: {
  isOn: boolean;
  onToggle: () => void;
  isLight: boolean;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer" title="Add to dashboard calendar">
      <span className={`text-xs whitespace-nowrap ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
        Add to dashboard calendar
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label="Add to dashboard calendar"
        title="Add to dashboard calendar"
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 ${
          isLight ? 'focus:ring-offset-white' : 'focus:ring-offset-slate-900'
        } ${isOn ? 'bg-emerald-500' : isLight ? 'bg-slate-300' : 'bg-slate-700'}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
            isOn ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  );
}

function OnCalendarChip({ isLight }: { isLight: boolean }) {
  return (
    <span
      className={
        isLight
          ? 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800'
          : 'inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-300'
      }
    >
      On calendar
    </span>
  );
}

const DEFAULT_CATEGORIES = [
  'Auto',
  'Education',
  'Finance',
  'Food',
  'Health',
  'Home',
  'IT',
  'Media',
  'Retail',
  'Software',
  'Other'
];

// Date-only YYYY-MM-DD as local calendar day (not UTC midnight).
function parseLocalDate(isoDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatLocalDate(isoDate: string): string {
  const d = parseLocalDate(isoDate);
  return d ? d.toLocaleDateString() : isoDate;
}

function formatReportDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function localCalendarDayIso(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function monthlyEquivalent(subscription: Pick<Subscription, 'amount' | 'frequency'>): number {
  if (subscription.frequency === 'annual') return subscription.amount / 12;
  if (subscription.frequency === 'quarterly') return subscription.amount / 3;
  return subscription.amount;
}

function frequencyLabel(frequency: SubscriptionFrequency): string {
  if (frequency === 'annual') return 'Annual';
  if (frequency === 'quarterly') return 'Quarterly';
  return 'Monthly';
}

function sortSubscriptionsByName(subscriptions: Subscription[]): Subscription[] {
  return [...subscriptions].sort((a, b) => a.name.localeCompare(b.name));
}

function pickDefaultSubscriptionId(
  subscriptions: Subscription[],
  includeHistory: boolean,
  editingId: string | null
): string {
  if (editingId) {
    const editing = subscriptions.find((subscription) => subscription.id === editingId);
    if (editing && (editing.isActive || includeHistory)) return editing.id;
  }
  const active = sortSubscriptionsByName(subscriptions.filter((subscription) => subscription.isActive));
  if (active[0]) return active[0].id;
  if (!includeHistory) return '';
  return sortSubscriptionsByName(subscriptions.filter((subscription) => !subscription.isActive))[0]?.id || '';
}

function mapDbSubscription(sub: any): Subscription {
  return {
    id: sub.id,
    name: sub.name,
    category: sub.category,
    frequency: sub.frequency,
    amount: parseFloat(sub.amount),
    dayOfMonth: sub.day_of_month,
    billedDate: sub.billed_date,
    renewalDate: sub.renewal_date,
    notes: sub.notes || '',
    isActive: sub.is_active !== false,
    dateAdded: sub.date_added,
    dateInactivated: sub.date_inactivated,
    addToDashboard: sub.addToDashboard === true,
    attachments: Array.isArray(sub.attachments) ? sub.attachments : [],
  };
}

type SubscriptionTrackerToolProps = {
  toolId?: string;
};

export function SubscriptionTrackerTool({ toolId }: SubscriptionTrackerToolProps) {
  const { resolvedTheme } = useTheme();
  const { showError } = useAppNotice();
  const isLight = resolvedTheme === 'light';
  const titleClass = isLight ? 'text-2xl font-semibold text-slate-900 mb-2' : 'text-2xl font-semibold text-slate-50 mb-2';
  const descClass = isLight ? 'text-slate-600 text-sm' : 'text-slate-400 text-sm';
  const cardClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'
    : 'rounded-2xl border border-slate-800 bg-slate-900/70 p-6';
  const nestedCardClass = isLight
    ? 'p-4 rounded-lg border border-slate-300 bg-slate-50'
    : 'p-4 rounded-lg border border-slate-700 bg-slate-800/50';
  const labelClass = isLight ? 'block text-sm font-medium text-slate-700 mb-2' : 'block text-sm font-medium text-slate-300 mb-2';
  const inputClass = isLight
    ? 'w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const selectClass = isLight
    ? 'w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const textareaClass = isLight
    ? 'w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none'
    : 'w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none';
  const primaryButtonClass = isLight
    ? 'px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50'
    : 'px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50';
  const secondaryButtonClass = isLight
    ? 'px-4 py-2 rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors'
    : 'px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors';
  const rowIconEmeraldClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-700 bg-white p-2 text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-900'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-500/50 bg-slate-800/50 p-2 text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20';
  const rowIconSecondaryClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-slate-400 bg-slate-100 p-2 text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-900'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-slate-600 bg-slate-800 p-2 text-slate-200 transition-colors hover:bg-slate-700';
  const rowIconDangerClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-red-300 bg-white p-2 text-red-700 transition-colors hover:bg-red-50 hover:border-red-400'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-red-500/50 bg-slate-800/50 p-2 text-red-400 transition-colors hover:border-red-400 hover:bg-red-500/20';
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showExportPopup, setShowExportPopup] = useState(false);
  const [exportAllSubscriptions, setExportAllSubscriptions] = useState(false);
  const [exportSubscriptionId, setExportSubscriptionId] = useState('');
  const [includeHistory, setIncludeHistory] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  
  // Form state
  const [newSubscription, setNewSubscription] = useState<SubscriptionFormState>(emptySubscriptionForm());
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [extraCategories, setExtraCategories] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionFormState>(emptySubscriptionForm());
  const [showCustomCategoryEdit, setShowCustomCategoryEdit] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'renewal' | 'amount'>('name');

  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const deleteConfirmIdRef = useRef<string | null>(null);
  deleteConfirmIdRef.current = deleteConfirmId;
  const deleteInFlightIdsRef = useRef<Set<string>>(new Set());
  const subscriptionReloadSeqRef = useRef(0);
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentItem[]>([]);
  const [attachmentModal, setAttachmentModal] = useState<null | 'add' | string>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [viewPreview, setViewPreview] = useState<AttachmentItem | null>(null);

  const reloadSubscriptions = async () => {
    if (!toolId) return;
    const seq = ++subscriptionReloadSeqRef.current;
    const response = await fetch(`${API_BASE}?toolId=${toolId}`);
    if (!response.ok) return;
    const data = await response.json();
    if (seq !== subscriptionReloadSeqRef.current) return;
    setSubscriptions((data.subscriptions || []).map(mapDbSubscription));
  };

  const revokePending = (items: AttachmentItem[]) => {
    items.forEach((item) => {
      if (item.url) URL.revokeObjectURL(item.url);
    });
  };

  const closeAttachmentModal = () => {
    setAttachmentModal(null);
    setViewPreview(null);
  };

  const clearPendingAttachments = () => {
    revokePending(pendingAttachments);
    setPendingAttachments([]);
    if (attachmentModal === 'add') closeAttachmentModal();
  };

  const uploadSubscriptionFile = async (file: File, subscriptionId: string): Promise<AttachmentItem> => {
    if (!toolId) throw new Error('Tool ID is required');
    const formData = new FormData();
    formData.append('toolId', toolId);
    formData.append('subscriptionId', subscriptionId);
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/attachments`, { method: 'POST', body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Failed to add file');
    return data.attachment as AttachmentItem;
  };

  const fetchSubscriptionAttachmentBlob = async (attachmentId: string, inline = false) => {
    const query = inline ? '?inline=1' : '';
    const response = await fetch(`${API_BASE}/attachments/${attachmentId}${query}`);
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
      const blob = await fetchSubscriptionAttachmentBlob(item.id, true);
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
      showError(error instanceof Error ? error.message : 'Failed to open file');
    }
  };

  const handleDownloadAttachment = async (item: AttachmentItem): Promise<boolean> => {
    if (item.file) return false;
    try {
      const blob = await fetchSubscriptionAttachmentBlob(item.id);
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
      showError(error instanceof Error ? error.message : 'Failed to download file');
      return false;
    }
  };

  const addSavedSubscriptionFiles = async (subscriptionId: string, files: File[]) => {
    setAttachmentBusy(true);
    try {
      for (const file of files) {
        await uploadSubscriptionFile(file, subscriptionId);
      }
      await reloadSubscriptions();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to add file');
    } finally {
      setAttachmentBusy(false);
    }
  };

  const removeSavedSubscriptionFile = async (attachmentId: string) => {
    if (!toolId) return;
    setAttachmentBusy(true);
    try {
      const response = await fetch(`${API_BASE}/attachments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, attachmentId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to remove file');
      await reloadSubscriptions();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to remove file');
    } finally {
      setAttachmentBusy(false);
    }
  };

  // Load subscriptions from API
  useEffect(() => {
    const loadSubscriptions = async () => {
      if (!toolId) return;
      
      setIsLoading(true);
      try {
        await reloadSubscriptions();
      } catch (error) {
        console.error('Error loading subscriptions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSubscriptions();
  }, [toolId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showExportPopup && !isExportingPdf) {
        setShowExportPopup(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showExportPopup, isExportingPdf]);

  // Calculate monthly spend
  const calculateMonthlySpend = () => {
    return subscriptions
      .filter(sub => sub.isActive)
      .reduce((total, sub) => {
        let monthlyAmount = sub.amount;
        if (sub.frequency === 'annual') {
          monthlyAmount = sub.amount / 12;
        } else if (sub.frequency === 'quarterly') {
          monthlyAmount = sub.amount / 3;
        }
        return total + monthlyAmount;
      }, 0);
  };

  // Calculate category breakdown for pie chart
  const calculateCategoryBreakdown = () => {
    const categoryTotals: { [key: string]: number } = {};
    
    subscriptions
      .filter(sub => sub.isActive)
      .forEach(sub => {
        let monthlyAmount = sub.amount;
        if (sub.frequency === 'annual') {
          monthlyAmount = sub.amount / 12;
        } else if (sub.frequency === 'quarterly') {
          monthlyAmount = sub.amount / 3;
        }
        
        const category = sub.category;
        categoryTotals[category] = (categoryTotals[category] || 0) + monthlyAmount;
      });
    
    return Object.entries(categoryTotals).map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100
    }));
  };

  const handleCategoryChange = (value: string) => {
    if (value === 'Other') {
      setShowCustomCategory(true);
      setNewSubscription({ ...newSubscription, category: '', customCategory: '' });
    } else {
      setShowCustomCategory(false);
      setNewSubscription({ ...newSubscription, category: value, customCategory: '' });
    }
  };

  const handleCategoryChangeEdit = (value: string) => {
    if (value === 'Other') {
      setShowCustomCategoryEdit(true);
      setEditingSubscription({ ...editingSubscription, category: '', customCategory: '' });
    } else {
      setShowCustomCategoryEdit(false);
      setEditingSubscription({ ...editingSubscription, category: value, customCategory: '' });
    }
  };

  const commitCustomCategory = (rawName: string, target: 'new' | 'edit') => {
    const name = rawName.trim();
    if (!name) return;
    const builtIn = DEFAULT_CATEGORIES.find((c) => c.toLowerCase() === name.toLowerCase());
    const resolved = builtIn || name;
    if (!builtIn) {
      const known = [
        ...extraCategories,
        ...subscriptions.map((s) => s.category),
      ].some((c) => c.toLowerCase() === name.toLowerCase());
      if (!known) {
        setExtraCategories((prev) => [...prev, name]);
      }
    }
    if (target === 'new') {
      setShowCustomCategory(false);
      setNewSubscription({ ...newSubscription, category: resolved, customCategory: '' });
    } else {
      setShowCustomCategoryEdit(false);
      setEditingSubscription({ ...editingSubscription, category: resolved, customCategory: '' });
    }
  };

  const addSubscription = async () => {
    // Validation based on frequency
    if (!newSubscription.name.trim() || !newSubscription.amount) {
      return;
    }

    if (newSubscription.frequency === 'annual') {
      if (!newSubscription.billedDate) {
        return;
      }
    } else {
      if (!newSubscription.dayOfMonth) {
        return;
      }
    }

    const category = showCustomCategory && newSubscription.customCategory.trim()
      ? newSubscription.customCategory.trim()
      : newSubscription.category;

    if (!category) {
      return;
    }

    if (!toolId) {
      console.error('Tool ID is required');
      return;
    }

    setIsLoading(true);
    try {
      const subscriptionData = {
        name: newSubscription.name.trim(),
        category,
        frequency: newSubscription.frequency,
        amount: parseFloat(newSubscription.amount),
        day_of_month: newSubscription.frequency === 'annual' ? null : parseInt(newSubscription.dayOfMonth),
        billed_date: newSubscription.frequency === 'monthly' ? null : newSubscription.billedDate || null,
        renewal_date: newSubscription.frequency === 'annual' ? newSubscription.renewalDate : null,
        notes: newSubscription.notes.trim() || null,
        is_active: true
      };

      const response = await fetch('/api/tools/subscription-tracker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolId,
          subscriptionData,
          addToDashboard: newSubscription.addToDashboard === true,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const createdId = data.subscriptionId as string | undefined;
        if (createdId && pendingAttachments.length > 0) {
          try {
            for (const queued of pendingAttachments) {
              if (!queued.file) continue;
              await uploadSubscriptionFile(queued.file, createdId);
            }
          } catch (uploadError) {
            clearPendingAttachments();
            await reloadSubscriptions();
            setNewSubscription(emptySubscriptionForm());
            setShowCustomCategory(false);
            setIsAdding(false);
            showError(uploadError instanceof Error ? uploadError.message : 'Subscription saved, but a file failed to upload.');
            return;
          }
        }
        clearPendingAttachments();
        await reloadSubscriptions();
        
        // Reset form
        setNewSubscription(emptySubscriptionForm());
        setShowCustomCategory(false);
        setIsAdding(false);
      } else {
        console.error('Failed to add subscription:', data.error);
        showError('Failed to add subscription: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding subscription:', error);
      showError('Error adding subscription. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate renewal date from billed date (1 year later)
  const calculateRenewalDate = (billedDate: string): string => {
    if (!billedDate) return '';
    const date = new Date(billedDate);
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().split('T')[0];
  };

  const startEditing = (subscription: Subscription) => {
    setEditingId(subscription.id);
    setEditingSubscription({
      name: subscription.name,
      category: subscription.category,
      customCategory: '',
      frequency: subscription.frequency,
      amount: subscription.amount.toString(),
      dayOfMonth: subscription.dayOfMonth?.toString() || '',
      billedDate: subscription.frequency === 'quarterly'
        ? subscription.billedDate || quarterAnchorFor(subscription.dateAdded)
        : subscription.billedDate || '',
      renewalDate: subscription.renewalDate || '',
      notes: subscription.notes,
      addToDashboard: subscription.addToDashboard === true,
    });
    setShowCustomCategoryEdit(false);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingSubscription(emptySubscriptionForm());
    setShowCustomCategoryEdit(false);
  };

  const saveEdit = async () => {
    if (!editingId || !editingSubscription.name.trim() || !editingSubscription.amount) {
      return;
    }

    // Validation based on frequency
    if (editingSubscription.frequency === 'annual') {
      if (!editingSubscription.billedDate) {
        return;
      }
    } else {
      if (!editingSubscription.dayOfMonth) {
        return;
      }
    }

    const category = showCustomCategoryEdit && editingSubscription.customCategory.trim()
      ? editingSubscription.customCategory.trim()
      : editingSubscription.category;

    if (!category) {
      return;
    }

    if (!toolId) {
      console.error('Tool ID is required');
      return;
    }

    setIsLoading(true);
    try {
      const subscriptionData = {
        name: editingSubscription.name.trim(),
        category,
        frequency: editingSubscription.frequency,
        amount: parseFloat(editingSubscription.amount),
        day_of_month: editingSubscription.frequency === 'annual' ? null : parseInt(editingSubscription.dayOfMonth),
        billed_date: editingSubscription.frequency === 'monthly' ? null : editingSubscription.billedDate || null,
        renewal_date: editingSubscription.frequency === 'annual' ? editingSubscription.renewalDate : null,
        notes: editingSubscription.notes.trim() || null,
        is_active: subscriptions.find(sub => sub.id === editingId)?.isActive !== false
      };

      const response = await fetch('/api/tools/subscription-tracker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: editingId,
          toolId,
          subscriptionData,
          addToDashboard: editingSubscription.addToDashboard === true,
        }),
      });

      if (response.ok) {
        await reloadSubscriptions();
        cancelEditing();
      } else {
        const errorData = await response.json();
        console.error('Failed to update subscription:', errorData.error);
        showError('Failed to update subscription: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
      showError('Error updating subscription. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inactivateSubscription = async (id: string) => {
    if (!toolId) {
      console.error('Tool ID is required');
      return;
    }

    setIsLoading(true);
    try {
      const subscription = subscriptions.find(sub => sub.id === id);
      if (!subscription) {
        console.error('Subscription not found');
        return;
      }

      const subscriptionData = {
        name: subscription.name,
        category: subscription.category,
        frequency: subscription.frequency,
        amount: subscription.amount,
        day_of_month: subscription.dayOfMonth,
        billed_date: subscription.billedDate,
        renewal_date: subscription.renewalDate,
        notes: subscription.notes || null,
        is_active: false,
        date_inactivated: localCalendarDayIso()
      };

      const response = await fetch('/api/tools/subscription-tracker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: id,
          toolId,
          subscriptionData
        }),
      });

      if (response.ok) {
        await reloadSubscriptions();
      } else {
        const errorData = await response.json();
        console.error('Failed to inactivate subscription:', errorData.error);
        showError('Failed to inactivate subscription: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error inactivating subscription:', error);
      showError('Error inactivating subscription. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const reactivateSubscription = async (id: string) => {
    if (!toolId) {
      console.error('Tool ID is required');
      return;
    }

    setIsLoading(true);
    try {
      const subscription = subscriptions.find(sub => sub.id === id);
      if (!subscription) {
        console.error('Subscription not found');
        return;
      }

      const subscriptionData = {
        name: subscription.name,
        category: subscription.category,
        frequency: subscription.frequency,
        amount: subscription.amount,
        day_of_month: subscription.dayOfMonth,
        billed_date: subscription.billedDate,
        renewal_date: subscription.renewalDate,
        notes: subscription.notes || null,
        is_active: true,
        date_inactivated: null
      };

      const response = await fetch('/api/tools/subscription-tracker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: id,
          toolId,
          subscriptionData
        }),
      });

      if (response.ok) {
        await reloadSubscriptions();
      } else {
        const errorData = await response.json();
        console.error('Failed to reactivate subscription:', errorData.error);
        showError('Failed to reactivate subscription: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      showError('Error reactivating subscription. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSubscription = async () => {
    const subscriptionId = deleteConfirmId;
    if (!subscriptionId) return;

    if (deleteConfirmText.toLowerCase() !== 'delete') {
      return;
    }

    if (!toolId) {
      console.error('Tool ID is required');
      return;
    }

    if (deleteInFlightIdsRef.current.has(subscriptionId)) return;
    deleteInFlightIdsRef.current.add(subscriptionId);

    // Drop the row immediately and ignore any list reload already in flight
    // so a second click cannot resend this id after it is gone.
    subscriptionReloadSeqRef.current += 1;
    setSubscriptions((prev) => prev.filter((sub) => sub.id !== subscriptionId));
    setIsLoading(true);
    try {
      const response = await fetch(`/api/tools/subscription-tracker?subscriptionId=${subscriptionId}`, {
        method: 'DELETE',
      });

      const alreadyGone = response.status === 404;
      if (response.ok || alreadyGone) {
        await reloadSubscriptions();
        if (attachmentModal === subscriptionId) closeAttachmentModal();
        if (deleteConfirmIdRef.current === subscriptionId) {
          setDeleteConfirmId(null);
          setDeleteConfirmText('');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to delete subscription:', errorData.error);
        showError('Failed to delete subscription: ' + (errorData.error || 'Unknown error'));
        await reloadSubscriptions();
      }
    } catch (error) {
      console.error('Error deleting subscription:', error);
      showError('Error deleting subscription. Please try again.');
      await reloadSubscriptions();
    } finally {
      deleteInFlightIdsRef.current.delete(subscriptionId);
      if (deleteInFlightIdsRef.current.size === 0) setIsLoading(false);
    }
  };

  const exportSubscriptionChoices = [
    ...sortSubscriptionsByName(subscriptions.filter((subscription) => subscription.isActive)),
    ...(includeHistory
      ? sortSubscriptionsByName(subscriptions.filter((subscription) => !subscription.isActive))
      : []),
  ];

  const fetchExportSubscriptions = async (): Promise<Subscription[]> => {
    if (!toolId) throw new Error('Tool ID is missing.');
    const response = await fetch(`${API_BASE}?toolId=${encodeURIComponent(toolId)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Failed to load subscriptions');
    return (data.subscriptions || []).map(mapDbSubscription);
  };

  const exportToPDF = async () => {
    if (isExportingPdf) return;
    const chosenFromScreen = subscriptions.find((subscription) => subscription.id === exportSubscriptionId) ?? null;
    if (!exportAllSubscriptions && !chosenFromScreen) {
      showError('Select a subscription, or choose All subscriptions.');
      return;
    }

    setIsExportingPdf(true);
    try {
      const loaded = await fetchExportSubscriptions();
      const chosen = loaded.find((subscription) => subscription.id === exportSubscriptionId) ?? null;
      if (!exportAllSubscriptions && !chosen) {
        showError('Select a subscription, or choose All subscriptions.');
        return;
      }

      const active = sortSubscriptionsByName(loaded.filter((subscription) => subscription.isActive));
      const history = sortSubscriptionsByName(loaded.filter((subscription) => !subscription.isActive));
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
      const footerY = pageHeight - 10;
      const contentBottom = footerY - 4;
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
        if (yPos + requiredHeight > contentBottom) {
          pdf.addPage();
          fillPage();
          yPos = margin;
          return true;
        }
        return false;
      };

      const addSectionHeader = (title: string) => {
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        const lines = pdf.splitTextToSize(title, contentWidth - 10) as string[];
        const barHeight = Math.max(10, lines.length * 6 + 4);
        checkNewPage(barHeight + 5);
        pdf.setFillColor(colors.header[0], colors.header[1], colors.header[2]);
        pdf.rect(margin, yPos, contentWidth, barHeight, 'F');
        pdf.setTextColor(colors.title[0], colors.title[1], colors.title[2]);
        lines.forEach((line, index) => {
          pdf.text(line, margin + 5, yPos + 7 + index * 6);
        });
        yPos += barHeight + 5;
      };

      const addText = (text: string, fontSize = 10, isBold = false, indent = 0, muted = false) => {
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
        const color = muted ? colors.muted : colors.text;
        pdf.setTextColor(color[0], color[1], color[2]);
        const maxWidth = contentWidth - indent - 5;
        const lines = pdf.splitTextToSize(text, maxWidth) as string[];
        const lineHeight = fontSize * 0.42;
        checkNewPage(lines.length * lineHeight + 2);
        lines.forEach((line) => {
          pdf.text(line, margin + indent, yPos);
          yPos += lineHeight;
        });
        yPos += 2;
      };

      fillPage();
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.title[0], colors.title[1], colors.title[2]);
      const title = 'Subscription Tracker Report';
      pdf.text(title, (pageWidth - pdf.getTextWidth(title)) / 2, yPos);
      yPos += 10;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
      pdf.text(`Generated on: ${formatReportDate(new Date())}`, margin, yPos);
      yPos += 6;

      const scopeLabel = !exportAllSubscriptions
        ? chosen && !chosen.isActive
          ? `History subscription  ·  ${chosen.name}`
          : `Active subscriptions only  ·  One subscription  ·  ${chosen?.name || 'Selected subscription'}`
        : includeHistory
          ? 'Active and history subscriptions  ·  All subscriptions'
          : 'Active subscriptions only  ·  All subscriptions';
      const scopeLines = pdf.splitTextToSize(scopeLabel, contentWidth) as string[];
      scopeLines.forEach((line) => {
        pdf.text(line, margin, yPos);
        yPos += 5;
      });
      yPos += 5;

      const attachmentRefs: string[] = [];
      const printSubscription = (subscription: Subscription) => {
        addSectionHeader(subscription.name.trim() || 'Subscription');
        if ((subscription.category || '').trim()) addText(`Category: ${subscription.category.trim()}`, 9, false, 5);
        addText(`Frequency: ${frequencyLabel(subscription.frequency)}`, 9, false, 5);
        if (Number.isFinite(subscription.amount)) {
          addText(`Amount: ${formatMoney(subscription.amount)}`, 9, false, 5);
          addText(`Monthly equivalent: ${formatMoney(monthlyEquivalent(subscription))}`, 9, false, 5);
        }
        if (subscription.frequency === 'annual') {
          if (subscription.billedDate) addText(`Billed date: ${formatLocalDate(subscription.billedDate)}`, 9, false, 5);
          if (subscription.renewalDate) addText(`Renewal date: ${formatLocalDate(subscription.renewalDate)}`, 9, false, 5);
        } else if (subscription.dayOfMonth) {
          addText(`Day of month: ${subscription.dayOfMonth}`, 9, false, 5);
          if (subscription.frequency === 'quarterly') {
            const months = billingMonthsLabel(subscription.billedDate, subscription.dateAdded);
            if (months) addText(`Billing months: ${months}`, 9, false, 5);
          }
        }
        if (subscription.dateAdded) addText(`Date added: ${formatLocalDate(subscription.dateAdded)}`, 9, false, 5);
        if (!subscription.isActive && subscription.dateInactivated) {
          addText(`Date inactivated: ${formatLocalDate(subscription.dateInactivated)}`, 9, false, 5);
        }
        if (subscription.notes.trim()) addText(`Notes: ${subscription.notes.trim()}`, 9, false, 5);
        (subscription.attachments || []).forEach((file) => {
          const fileName = file.name?.trim();
          if (!fileName) return;
          attachmentRefs.push(`${subscription.name} — ${fileName}`);
        });
        yPos += 2;
      };

      if (!exportAllSubscriptions && chosen) {
        printSubscription(chosen);
      } else if (active.length === 0 && (!includeHistory || history.length === 0)) {
        addText('No subscriptions match the selected options.', 10, false, 5, true);
      } else {
        if (active.length > 0) {
          const totalMonthly = active.reduce((sum, subscription) => sum + monthlyEquivalent(subscription), 0);
          const categoryTotals = new Map<string, number>();
          active.forEach((subscription) => {
            const category = subscription.category.trim() || 'Other';
            categoryTotals.set(category, (categoryTotals.get(category) || 0) + monthlyEquivalent(subscription));
          });
          addSectionHeader('Summary');
          addText(`Total monthly spend: ${formatMoney(totalMonthly)}`, 11, true, 5);
          addText(`Active subscriptions: ${active.length}`, 10, false, 5);
          if (categoryTotals.size > 0) {
            addText('Monthly spend by category', 10, true, 5);
            [...categoryTotals.entries()]
              .sort((a, b) => a[0].localeCompare(b[0]))
              .forEach(([name, value]) => {
                addText(`${name}: ${formatMoney(Math.round(value * 100) / 100)}`, 9, false, 8);
              });
          }
          active.forEach(printSubscription);
        }
        if (includeHistory && history.length > 0) {
          addSectionHeader('History');
          history.forEach(printSubscription);
        }
      }

      if (attachmentRefs.length > 0) {
        addSectionHeader('Attachments');
        addText('File names only. Files themselves are not included in this report.', 8, false, 5, true);
        attachmentRefs.forEach((line) => addText(line, 9, false, 8));
      }

      const pageCount = pdf.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        pdf.setPage(page);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
        pdf.text('Household Toolbox', pageWidth / 2, footerY, { align: 'center' });
      }

      pdf.save(`Subscription_Tracker_Report_${localCalendarDayIso()}.pdf`);
      setShowExportPopup(false);
    } catch (error) {
      console.error('Error exporting subscription tracker PDF:', error);
      showError(error instanceof Error ? error.message : 'Failed to generate PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const categoryOptions = (() => {
    const seen = new Set(DEFAULT_CATEGORIES.map((c) => c.toLowerCase()));
    const customs: string[] = [];
    for (const name of [...subscriptions.map((s) => s.category), ...extraCategories]) {
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      customs.push(name);
    }
    customs.sort((a, b) => a.localeCompare(b));
    return [...DEFAULT_CATEGORIES, ...customs];
  })();

  const searchNeedle = searchQuery.trim().toLowerCase();
  const categorySpend = calculateCategoryBreakdown();
  const totalMonthlySpend = calculateMonthlySpend();
  const activeSubscriptions = subscriptions
    .filter(sub => sub.isActive)
    .filter(sub =>
      searchNeedle === '' ||
      sub.name.toLowerCase().includes(searchNeedle) ||
      sub.category.toLowerCase().includes(searchNeedle)
    )
    .sort((a, b) => {
      if (sortBy === 'amount') {
        return a.amount - b.amount || a.name.localeCompare(b.name);
      }
      if (sortBy === 'renewal') {
        const aDate = a.renewalDate || '';
        const bDate = b.renewalDate || '';
        if (!aDate && !bDate) return a.name.localeCompare(b.name);
        if (!aDate) return 1;
        if (!bDate) return -1;
        return aDate.localeCompare(bDate) || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
  const inactiveSubscriptions = subscriptions.filter(sub => !sub.isActive).sort((a, b) => a.name.localeCompare(b.name));
  const savedAttachmentSubscription =
    attachmentModal && attachmentModal !== 'add'
      ? subscriptions.find((sub) => sub.id === attachmentModal) || null
      : null;
  const modalFiles: AttachmentItem[] =
    attachmentModal === 'add'
      ? pendingAttachments
      : savedAttachmentSubscription
        ? (savedAttachmentSubscription.attachments || []).map((item) => ({
            id: item.id,
            name: item.name,
            size: item.size,
            type: item.type,
          }))
        : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={titleClass}>Subscription Tracker</h2>
          <p className={descClass}>
            Track and manage all your subscriptions in one place
          </p>
        </div>
        <ExportPdfIconButton
          title="Export subscriptions to PDF"
          onClick={() => {
            if (!exportAllSubscriptions) {
              setExportSubscriptionId(pickDefaultSubscriptionId(subscriptions, includeHistory, editingId));
            } else if (!exportSubscriptionId) {
              setExportSubscriptionId(pickDefaultSubscriptionId(subscriptions, includeHistory, editingId));
            }
            setShowExportPopup(true);
          }}
        />
      </div>

      <div className="space-y-6">
          {/* Add New Subscription Form */}
          {!isAdding ? (
            <div className="flex justify-start">
              <button
                onClick={() => setIsAdding(true)}
                className={primaryButtonClass}
              >
                + Add New Subscription
              </button>
            </div>
          ) : (
            <div className={cardClass}>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className={isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50'}>Add New Subscription</h3>
                <AttachmentButton
                  count={pendingAttachments.length}
                  onClick={() => setAttachmentModal('add')}
                />
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>
                      Subscription Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={newSubscription.name}
                      onChange={(e) => setNewSubscription({ ...newSubscription, name: e.target.value })}
                      placeholder="e.g., Netflix, Spotify"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Category <span className="text-red-400">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1 min-w-0">
                        <select
                          value={showCustomCategory ? 'Other' : newSubscription.category}
                          onChange={(e) => handleCategoryChange(e.target.value)}
                          className={selectClass}
                        >
                          <option value="">Select category</option>
                          {categoryOptions.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCustomCategory(true)}
                        className={secondaryButtonClass}
                      >
                        Add category
                      </button>
                    </div>
                    {showCustomCategory && (
                      <div className="flex gap-2 mt-2">
                        <input
                          type="text"
                          value={newSubscription.customCategory}
                          onChange={(e) => setNewSubscription({ ...newSubscription, customCategory: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitCustomCategory(newSubscription.customCategory, 'new');
                            }
                          }}
                          placeholder="Enter custom category"
                          className={inputClass}
                        />
                        <button
                          type="button"
                          onClick={() => commitCustomCategory(newSubscription.customCategory, 'new')}
                          disabled={!newSubscription.customCategory.trim()}
                          className={primaryButtonClass}
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>
                      Frequency <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={newSubscription.frequency}
                      onChange={(e) => {
                        const newFrequency = e.target.value as SubscriptionFrequency;
                        setNewSubscription(applyFrequencyChange(newSubscription, newFrequency));
                      }}
                      className={selectClass}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>
                      Amount ($) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newSubscription.amount}
                      onChange={(e) => setNewSubscription({ ...newSubscription, amount: e.target.value })}
                      placeholder="0.00"
                      className={inputClass}
                    />
                  </div>
                  {newSubscription.frequency === 'annual' ? (
                    <>
                      <div>
                        <label className={labelClass}>
                          Billed Date <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="date"
                          value={newSubscription.billedDate}
                          onChange={(e) => {
                            const billedDate = e.target.value;
                            const renewalDate = calculateRenewalDate(billedDate);
                            setNewSubscription({ ...newSubscription, billedDate, renewalDate });
                          }}
                          className={selectClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>
                          Renewal Date
                        </label>
                        <input
                          type="date"
                          value={newSubscription.renewalDate}
                          onChange={(e) => setNewSubscription({ ...newSubscription, renewalDate: e.target.value })}
                          className={selectClass}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className={labelClass}>
                          Day of Month <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={newSubscription.dayOfMonth}
                          onChange={(e) => setNewSubscription({ ...newSubscription, dayOfMonth: e.target.value })}
                          placeholder="1-31"
                          className={inputClass}
                        />
                      </div>
                      {newSubscription.frequency === 'quarterly' && (
                        <QuarterMonthsField
                          billedDate={newSubscription.billedDate}
                          onChange={(billedDate) => setNewSubscription({ ...newSubscription, billedDate })}
                          labelClassName={labelClass}
                          selectClassName={selectClass}
                        />
                      )}
                    </>
                  )}
                </div>
                <div>
                  <label className={labelClass}>
                    Notes (Optional)
                  </label>
                  <textarea
                    value={newSubscription.notes}
                    onChange={(e) => setNewSubscription({ ...newSubscription, notes: e.target.value })}
                    placeholder="Add any additional notes..."
                    rows={3}
                    className={textareaClass}
                  />
                </div>
                <DashboardCalendarSwitch
                  isOn={newSubscription.addToDashboard}
                  isLight={isLight}
                  onToggle={() => setNewSubscription((prev) => ({ ...prev, addToDashboard: !prev.addToDashboard }))}
                />
                <div className="flex gap-2">
                  <button
                    onClick={addSubscription}
                    disabled={
                      !newSubscription.name.trim() || 
                      !newSubscription.amount || 
                      (!showCustomCategory && !newSubscription.category) || 
                      (showCustomCategory && !newSubscription.customCategory.trim()) ||
                      (newSubscription.frequency === 'annual' ? !newSubscription.billedDate : !newSubscription.dayOfMonth)
                    }
                    className={primaryButtonClass}
                  >
                    Add Subscription
                  </button>
                  <button
                    onClick={() => {
                      setIsAdding(false);
                      setNewSubscription(emptySubscriptionForm());
                      setShowCustomCategory(false);
                      clearPendingAttachments();
                    }}
                    className={secondaryButtonClass}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className={cardClass}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Search Subscriptions</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or category..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="st-sort">Sort</label>
                <select
                  id="st-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'renewal' | 'amount')}
                  className={selectClass}
                >
                  <option value="name">Name</option>
                  <option value="renewal">Next renewal</option>
                  <option value="amount">Amount</option>
                </select>
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <h3 className={isLight ? 'text-lg font-semibold text-slate-900 mb-4' : 'text-lg font-semibold text-slate-50 mb-4'}>Monthly Spend by Category</h3>
            {categorySpend.length > 0 ? (
              <div className="space-y-2">
                {categorySpend.map((category) => (
                  <div key={category.name} className="flex items-center justify-between text-sm">
                    <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>{category.name}</span>
                    <span className={isLight ? 'text-slate-900' : 'text-slate-100'}>${category.value.toFixed(2)}</span>
                  </div>
                ))}
                <div className={`flex items-center justify-between text-sm pt-2 ${isLight ? 'border-t border-slate-200' : 'border-t border-slate-700'}`}>
                  <span className={isLight ? 'font-medium text-slate-900' : 'font-medium text-slate-50'}>Total Monthly Spend</span>
                  <span className={isLight ? 'font-medium text-slate-900' : 'font-medium text-slate-50'}>${totalMonthlySpend.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <p className={isLight ? 'text-slate-600 text-sm' : 'text-slate-400 text-sm'}>No active subscriptions.</p>
            )}
          </div>

          {/* Active Subscriptions */}
          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50'}>Active Subscriptions</h3>
              <span className={isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400'}>
                {activeSubscriptions.length} {activeSubscriptions.length === 1 ? 'subscription' : 'subscriptions'}
              </span>
            </div>
            {activeSubscriptions.length > 0 ? (
              <div className="space-y-4">
                {activeSubscriptions.map(subscription => (
                  <div key={subscription.id} className={nestedCardClass}>
                    {editingId === subscription.id ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className={isLight ? 'text-md font-semibold text-slate-900' : 'text-md font-semibold text-slate-50'}>
                            Edit Subscription
                          </h4>
                          <AttachmentButton
                            count={subscription.attachments?.length || 0}
                            onClick={() => setAttachmentModal(subscription.id)}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              Subscription Name <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="text"
                              value={editingSubscription.name}
                              onChange={(e) => setEditingSubscription({ ...editingSubscription, name: e.target.value })}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              Category <span className="text-red-400">*</span>
                            </label>
                            <div className="flex gap-2">
                              <div className="flex-1 min-w-0">
                                <select
                                  value={showCustomCategoryEdit ? 'Other' : editingSubscription.category}
                                  onChange={(e) => handleCategoryChangeEdit(e.target.value)}
                                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                >
                                  <option value="">Select category</option>
                                  {categoryOptions.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </select>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowCustomCategoryEdit(true)}
                                className={secondaryButtonClass}
                              >
                                Add category
                              </button>
                            </div>
                            {showCustomCategoryEdit && (
                              <div className="flex gap-2 mt-2">
                                <input
                                  type="text"
                                  value={editingSubscription.customCategory}
                                  onChange={(e) => setEditingSubscription({ ...editingSubscription, customCategory: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      commitCustomCategory(editingSubscription.customCategory, 'edit');
                                    }
                                  }}
                                  placeholder="Enter custom category"
                                  className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                />
                                <button
                                  type="button"
                                  onClick={() => commitCustomCategory(editingSubscription.customCategory, 'edit')}
                                  disabled={!editingSubscription.customCategory.trim()}
                                  className={primaryButtonClass}
                                >
                                  Add
                                </button>
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              Frequency <span className="text-red-400">*</span>
                            </label>
                            <select
                              value={editingSubscription.frequency}
                              onChange={(e) => {
                                const newFrequency = e.target.value as SubscriptionFrequency;
                                setEditingSubscription(applyFrequencyChange(editingSubscription, newFrequency));
                              }}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            >
                              <option value="monthly">Monthly</option>
                              <option value="quarterly">Quarterly</option>
                              <option value="annual">Annual</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              Amount ($) <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editingSubscription.amount}
                              onChange={(e) => setEditingSubscription({ ...editingSubscription, amount: e.target.value })}
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                            />
                          </div>
                          {editingSubscription.frequency === 'annual' ? (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  Billed Date <span className="text-red-400">*</span>
                                </label>
                                <input
                                  type="date"
                                  value={editingSubscription.billedDate}
                                  onChange={(e) => {
                                    const billedDate = e.target.value;
                                    const renewalDate = calculateRenewalDate(billedDate);
                                    setEditingSubscription({ ...editingSubscription, billedDate, renewalDate });
                                  }}
                                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  Renewal Date
                                </label>
                                <input
                                  type="date"
                                  value={editingSubscription.renewalDate}
                                  onChange={(e) => setEditingSubscription({ ...editingSubscription, renewalDate: e.target.value })}
                                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                />
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  Day of Month <span className="text-red-400">*</span>
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  max="31"
                                  value={editingSubscription.dayOfMonth}
                                  onChange={(e) => setEditingSubscription({ ...editingSubscription, dayOfMonth: e.target.value })}
                                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                />
                              </div>
                              {editingSubscription.frequency === 'quarterly' && (
                                <QuarterMonthsField
                                  billedDate={editingSubscription.billedDate}
                                  onChange={(billedDate) => setEditingSubscription({ ...editingSubscription, billedDate })}
                                  labelClassName="block text-sm font-medium text-slate-300 mb-2"
                                  selectClassName="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                />
                              )}
                            </>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Notes (Optional)
                          </label>
                          <textarea
                            value={editingSubscription.notes}
                            onChange={(e) => setEditingSubscription({ ...editingSubscription, notes: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                          />
                        </div>
                        <DashboardCalendarSwitch
                          isOn={editingSubscription.addToDashboard}
                          isLight={isLight}
                          onToggle={() => setEditingSubscription((prev) => ({ ...prev, addToDashboard: !prev.addToDashboard }))}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={saveEdit}
                            disabled={
                              !editingSubscription.name.trim() || 
                              !editingSubscription.amount || 
                              (!showCustomCategoryEdit && !editingSubscription.category) || 
                              (showCustomCategoryEdit && !editingSubscription.customCategory.trim()) ||
                              (editingSubscription.frequency === 'annual' ? !editingSubscription.billedDate : !editingSubscription.dayOfMonth)
                            }
                            className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-semibold text-slate-100">{subscription.name}</h4>
                            <span className={isLight ? 'px-2 py-1 rounded text-xs font-medium border border-emerald-300 bg-emerald-50 text-emerald-800' : 'px-2 py-1 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300'}>
                              {subscription.category}
                            </span>
                            {subscription.addToDashboard && <OnCalendarChip isLight={isLight} />}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-slate-400">Frequency:</span>
                              <span className="ml-2 text-slate-200 capitalize">{subscription.frequency}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Amount:</span>
                              <span className="ml-2 text-slate-200">${subscription.amount.toFixed(2)}</span>
                            </div>
                            {subscription.frequency === 'annual' ? (
                              <div>
                                <div>
                                  <span className="text-slate-400">Billed Date:</span>
                                  <span className="ml-2 text-slate-200">
                                    {subscription.billedDate ? formatLocalDate(subscription.billedDate) : 'N/A'}
                                  </span>
                                </div>
                                <div className="mt-1">
                                  <span className="text-slate-400">Renewal Date:</span>
                                  <span className="ml-2 text-slate-200">
                                    {subscription.renewalDate ? formatLocalDate(subscription.renewalDate) : 'N/A'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div>
                                  <span className="text-slate-400">Day of Month:</span>
                                  <span className="ml-2 text-slate-200">{subscription.dayOfMonth}</span>
                                </div>
                                {subscription.frequency === 'quarterly' && (
                                  <div className="mt-1">
                                    <span className="text-slate-400">Billing months:</span>
                                    <span className="ml-2 text-slate-200">
                                      {billingMonthsLabel(subscription.billedDate, subscription.dateAdded) || 'N/A'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="md:col-start-4">
                              <span className="text-slate-400">Monthly:</span>
                              <span className="ml-2 text-slate-200">
                                ${subscription.frequency === 'annual' 
                                  ? (subscription.amount / 12).toFixed(2)
                                  : subscription.frequency === 'quarterly'
                                  ? (subscription.amount / 3).toFixed(2)
                                  : subscription.amount.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          {subscription.notes && (
                            <div className="mt-3">
                              <span className="text-sm text-slate-400">Notes:</span>
                              <p className="text-sm text-slate-300 mt-1 italic">"{subscription.notes}"</p>
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 ml-4">
                          <AttachmentButton
                            count={subscription.attachments?.length || 0}
                            onClick={() => setAttachmentModal(subscription.id)}
                          />
                          <button
                            type="button"
                            onClick={() => startEditing(subscription)}
                            aria-label="Edit subscription"
                            title="Edit subscription"
                            className={rowIconEmeraldClass}
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => inactivateSubscription(subscription.id)}
                            aria-label="Move to history"
                            title="Move to history"
                            className={rowIconSecondaryClass}
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-8">
                {searchNeedle
                  ? 'No matching subscriptions.'
                  : 'No active subscriptions. Add one to get started!'}
              </p>
            )}
          </div>

          {/* History Section */}
          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50'}>History</h3>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={isLight ? 'text-sm text-slate-600 hover:text-slate-900 transition-colors' : 'text-sm text-slate-400 hover:text-slate-300 transition-colors'}
              >
                {showHistory ? 'Hide' : 'Show'} ({inactiveSubscriptions.length})
              </button>
            </div>
            {showHistory && (
              inactiveSubscriptions.length > 0 ? (
                <div className="space-y-4">
                  {inactiveSubscriptions.map(subscription => (
                    <div key={subscription.id} className={`${nestedCardClass} ${isLight ? '' : 'opacity-75'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-semibold text-slate-300">{subscription.name}</h4>
                            <span className={isLight ? 'px-2 py-1 rounded text-xs font-medium border border-slate-300 bg-slate-100 text-slate-700' : 'px-2 py-1 rounded text-xs font-medium bg-slate-600/50 text-slate-400'}>
                              {subscription.category}
                            </span>
                            {subscription.addToDashboard && <OnCalendarChip isLight={isLight} />}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-slate-500">Frequency:</span>
                              <span className="ml-2 text-slate-400 capitalize">{subscription.frequency}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Amount:</span>
                              <span className="ml-2 text-slate-400">${subscription.amount.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Inactivated:</span>
                              <span className="ml-2 text-slate-400">
                                {subscription.dateInactivated ? formatLocalDate(subscription.dateInactivated) : 'N/A'}
                              </span>
                            </div>
                          </div>
                          {subscription.notes && (
                            <div className="mt-3">
                              <span className="text-sm text-slate-500">Notes:</span>
                              <p className="text-sm text-slate-400 mt-1 italic">"{subscription.notes}"</p>
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 ml-4">
                          <AttachmentButton
                            count={subscription.attachments?.length || 0}
                            onClick={() => setAttachmentModal(subscription.id)}
                          />
                          <button
                            type="button"
                            onClick={() => reactivateSubscription(subscription.id)}
                            aria-label="Reactivate subscription"
                            title="Reactivate subscription"
                            className={rowIconEmeraldClass}
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(subscription.id)}
                            aria-label="Delete subscription"
                            title="Delete subscription"
                            className={rowIconDangerClass}
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-center py-8">No inactive subscriptions in history.</p>
              )
            )}
          </div>
      </div>

      {showExportPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className={isLight
              ? 'bg-white rounded-2xl border border-slate-200 p-6 max-w-md w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto'
              : 'bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto'}
            role="dialog"
            aria-modal="true"
            aria-labelledby="st-export-title"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="st-export-title" className={isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50'}>
                Export Options
              </h3>
              <button
                type="button"
                onClick={() => !isExportingPdf && setShowExportPopup(false)}
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
                <legend className={`${labelClass} mb-0`}>Subscriptions</legend>
                <label className={`flex items-start gap-3 ${isLight ? 'text-slate-700' : 'text-slate-300'} cursor-pointer`}>
                  <input
                    type="radio"
                    name="stExportScope"
                    checked={exportAllSubscriptions}
                    onChange={() => setExportAllSubscriptions(true)}
                    className={isLight
                      ? 'mt-0.5 h-4 w-4 border-slate-400 text-emerald-600 focus:ring-emerald-500'
                      : 'mt-0.5 h-4 w-4 border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500'}
                  />
                  <span>All subscriptions</span>
                </label>
                <label className={`flex items-start gap-3 ${isLight ? 'text-slate-700' : 'text-slate-300'} cursor-pointer`}>
                  <input
                    type="radio"
                    name="stExportScope"
                    checked={!exportAllSubscriptions}
                    onChange={() => {
                      setExportAllSubscriptions(false);
                      if (!exportSubscriptionId || !exportSubscriptionChoices.some((subscription) => subscription.id === exportSubscriptionId)) {
                        setExportSubscriptionId(pickDefaultSubscriptionId(subscriptions, includeHistory, editingId));
                      }
                    }}
                    className={isLight
                      ? 'mt-0.5 h-4 w-4 border-slate-400 text-emerald-600 focus:ring-emerald-500'
                      : 'mt-0.5 h-4 w-4 border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500'}
                  />
                  <span>One subscription</span>
                </label>
                {!exportAllSubscriptions && (
                  <div className="ml-7">
                    <label className={labelClass} htmlFor="st-export-subscription">
                      Subscription
                    </label>
                    <select
                      id="st-export-subscription"
                      value={exportSubscriptionId}
                      onChange={(e) => setExportSubscriptionId(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Select a subscription</option>
                      {exportSubscriptionChoices.map((subscription) => (
                        <option key={subscription.id} value={subscription.id}>
                          {subscription.isActive ? subscription.name : `${subscription.name} (history)`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </fieldset>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="stIncludeHistoryExport"
                  checked={includeHistory}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setIncludeHistory(next);
                    if (!next) {
                      const selected = subscriptions.find((subscription) => subscription.id === exportSubscriptionId);
                      if (!selected?.isActive) {
                        setExportSubscriptionId(pickDefaultSubscriptionId(subscriptions, false, editingId));
                      }
                    } else if (!exportSubscriptionId) {
                      setExportSubscriptionId(pickDefaultSubscriptionId(subscriptions, true, editingId));
                    }
                  }}
                  disabled={isExportingPdf}
                  className={isLight
                    ? 'mt-0.5 h-4 w-4 rounded border-slate-400 text-emerald-600 focus:ring-emerald-500'
                    : 'mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500'}
                />
                <label htmlFor="stIncludeHistoryExport" className={`${isLight ? 'text-slate-700' : 'text-slate-300'} cursor-pointer`}>
                  Include history
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={exportToPDF}
                  disabled={isExportingPdf || (!exportAllSubscriptions && !exportSubscriptionId)}
                  className={`flex-1 ${primaryButtonClass}`}
                >
                  {isExportingPdf ? 'Generating…' : 'Export to PDF'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowExportPopup(false)}
                  disabled={isExportingPdf}
                  className={`${secondaryButtonClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={isLight ? 'rounded-2xl border border-slate-200 bg-white p-6 max-w-md w-full mx-4 shadow-2xl' : 'rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4'}>
            <h3 className={isLight ? 'text-xl font-semibold text-slate-900 mb-2' : 'text-xl font-semibold text-slate-50 mb-2'}>Delete Subscription</h3>
            <div className={isLight ? 'rounded-lg border border-red-300 bg-red-50 px-4 py-3 mb-4' : 'rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4'}>
              <p className={isLight ? 'text-red-700 font-semibold mb-2' : 'text-red-300 font-semibold mb-2'}>
                ⚠️ Warning: This action cannot be undone!
              </p>
              <p className={isLight ? 'text-red-600 text-sm' : 'text-red-200 text-sm'}>
                This subscription will be permanently deleted.
              </p>
            </div>
            <p className={isLight ? 'text-slate-600 text-sm mb-4' : 'text-slate-400 text-sm mb-4'}>
              To confirm, please type <strong className={isLight ? 'text-slate-900' : 'text-slate-200'}>delete</strong> in the box below:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className={isLight ? 'w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4' : 'w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4'}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setDeleteConfirmId(null);
                  setDeleteConfirmText('');
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={deleteSubscription}
                disabled={deleteConfirmText.toLowerCase() !== 'delete' || isLoading}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Subscription
              </button>
              <button
                onClick={() => {
                  setDeleteConfirmId(null);
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

      <AttachmentModal
        open={attachmentModal !== null}
        onClose={closeAttachmentModal}
        previewItem={viewPreview}
        title={
          attachmentModal === 'add'
            ? newSubscription.name.trim() || 'New subscription'
            : savedAttachmentSubscription?.name || 'Subscription'
        }
        files={modalFiles}
        busy={attachmentBusy}
        readOnly={Boolean(savedAttachmentSubscription && !savedAttachmentSubscription.isActive)}
        onAdd={(incoming) => {
          if (attachmentModal === 'add') {
            setPendingAttachments((prev) => [...prev, ...incoming.map(createPendingAttachment)]);
            return;
          }
          if (attachmentModal) {
            void addSavedSubscriptionFiles(attachmentModal, incoming);
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
          void removeSavedSubscriptionFile(id);
        }}
        onView={handleViewAttachment}
        onDownload={attachmentModal === 'add' ? undefined : handleDownloadAttachment}
      />
    </div>
  );
}

