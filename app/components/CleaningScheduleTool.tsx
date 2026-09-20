'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  addDays,
  addMonthsSetDay,
  asDateOnly,
  CleaningCategory,
  CleaningCompletion,
  CleaningFrequency,
  CleaningLibraryItem,
  CleaningScheduleData,
  CleaningScheduledTask,
  compareIso,
  expandOccurrences,
  FrequencyKind,
  parseLocalDate,
  toIso,
  todayIso,
} from '@/lib/cleaning-schedule';

/**
 * Cleaning Schedule — persists via /api/tools/cleaning-schedule.
 * Occurrences are expanded in memory for the visible date window only.
 * Category icons may come later.
 */

export type {
  CleaningCategory,
  CleaningCompletion,
  CleaningFrequency,
  CleaningLibraryItem,
  CleaningScheduledTask,
  FrequencyKind,
};

const API_BASE = '/api/tools/cleaning-schedule';

type CleaningScheduleToolProps = {
  toolId?: string;
};

type TabId = 'schedule' | 'library' | 'categories';
type RangeId = 'overdue' | 'this_week' | 'this_month' | 'next_3_months' | 'all_active';
type SortId = 'nextDue' | 'name' | 'category' | 'frequency';
type LibraryFilter = 'all' | 'available' | 'scheduled' | 'hidden';
type OccurrenceStatus = 'Overdue' | 'Due today' | 'Due soon' | 'Upcoming';

type FrequencyForm = {
  kind: FrequencyKind;
  intervalCount: number;
  intervalUnit: 'days' | 'weeks' | 'months';
  daysOfWeek: number[];
  dayOfMonth: number;
};

type ItemForm = {
  name: string;
  categoryId: string;
  newCategoryName: string;
  creatingCategory: boolean;
  description: string;
  notes: string;
};

type DeleteTarget =
  | { kind: 'item'; id: string }
  | { kind: 'category'; id: string }
  | { kind: 'schedule'; id: string };

type AttachmentTarget =
  | { kind: 'new-item' }
  | { kind: 'item'; itemId: string }
  | { kind: 'new-completion' }
  | { kind: 'completion'; completionId: string };

type OccurrenceRow = {
  taskId: string;
  itemId: string;
  date: string;
  name: string;
  categoryName: string;
  frequencyLabel: string;
  status: OccurrenceStatus;
};

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

const FREQUENCY_OPTIONS: { value: FrequencyKind; label: string }[] = [
  { value: 'every_day', label: 'Every day' },
  { value: 'every_x_days', label: 'Every X days' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'every_x_weeks', label: 'Every X weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'every_x_months', label: 'Every X months' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'every_6_months', label: 'Every 6 months' },
  { value: 'annually', label: 'Annually' },
  { value: 'custom', label: 'Custom' },
  { value: 'first_weekend', label: 'First weekend of each month' },
];

const RANGE_CHIPS: { id: RangeId; label: string }[] = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'this_week', label: 'This Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'next_3_months', label: 'Next 3 Months' },
  { id: 'all_active', label: 'All Active' },
];

function formatDateForDisplay(isoDate: string): string {
  if (!isoDate) return '—';
  const [year, month, day] = isoDate.split('T')[0].split('-');
  if (!year || !month || !day) return isoDate;
  return `${Number(month)}/${Number(day)}/${year}`;
}

function formatReportDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function startOfWeek(iso: string): string {
  const date = parseLocalDate(iso);
  date.setDate(date.getDate() - date.getDay());
  return toIso(date);
}

function endOfWeek(iso: string): string {
  return addDays(startOfWeek(iso), 6);
}

function startOfMonth(iso: string): string {
  const date = parseLocalDate(iso);
  return toIso(new Date(date.getFullYear(), date.getMonth(), 1));
}

function endOfMonth(iso: string): string {
  const date = parseLocalDate(iso);
  return toIso(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function occurrenceStatus(date: string, today: string): OccurrenceStatus {
  if (compareIso(date, today) < 0) return 'Overdue';
  if (date === today) return 'Due today';
  if (compareIso(date, addDays(today, 3)) <= 0) return 'Due soon';
  return 'Upcoming';
}

function ordinal(day: number): string {
  const remainder = day % 100;
  if (remainder >= 11 && remainder <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function weekdayNames(days: number[]): string {
  const labels = DAYS_OF_WEEK.filter((day) => days.includes(day.value)).map((day) => day.label);
  if (labels.length === 0) return 'week';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

function frequencyLabel(frequency: CleaningFrequency): string {
  const count = Math.max(1, frequency.intervalCount ?? 1);
  switch (frequency.kind) {
    case 'every_day':
      return 'Every day';
    case 'every_x_days':
      return count === 1 ? 'Every day' : `Every ${count} days`;
    case 'weekly':
      return `Every ${weekdayNames(frequency.daysOfWeek ?? [])}`;
    case 'every_x_weeks':
      return count === 1 ? 'Every week' : `Every ${count} weeks`;
    case 'monthly':
      return frequency.dayOfMonth ? `Monthly on the ${ordinal(frequency.dayOfMonth)}` : 'Monthly';
    case 'every_x_months':
      return count === 1 ? 'Every month' : `Every ${count} months`;
    case 'quarterly':
      return 'Quarterly';
    case 'every_6_months':
      return 'Every 6 months';
    case 'annually':
      return 'Annually';
    case 'custom':
      if (frequency.intervalUnit === 'weeks') return count === 1 ? 'Every week' : `Every ${count} weeks`;
      if (frequency.intervalUnit === 'months') return count === 1 ? 'Every month' : `Every ${count} months`;
      return count === 1 ? 'Every day' : `Every ${count} days`;
    case 'first_weekend':
      return 'First weekend of each month';
    default:
      return 'Custom';
  }
}

function emptyFrequencyForm(today: string): FrequencyForm {
  return {
    kind: 'weekly',
    intervalCount: 1,
    intervalUnit: 'days',
    daysOfWeek: [parseLocalDate(today).getDay()],
    dayOfMonth: parseLocalDate(today).getDate(),
  };
}

function frequencyToForm(frequency: CleaningFrequency, today: string): FrequencyForm {
  const fallback = emptyFrequencyForm(today);
  return {
    kind: frequency.kind,
    intervalCount: Math.max(1, frequency.intervalCount ?? 1),
    intervalUnit: frequency.intervalUnit ?? 'days',
    daysOfWeek: frequency.daysOfWeek?.length ? [...frequency.daysOfWeek] : fallback.daysOfWeek,
    dayOfMonth: frequency.dayOfMonth ?? fallback.dayOfMonth,
  };
}

function formToFrequency(form: FrequencyForm): CleaningFrequency {
  const frequency: CleaningFrequency = { kind: form.kind };
  if (form.kind === 'every_x_days' || form.kind === 'every_x_weeks' || form.kind === 'every_x_months' || form.kind === 'custom') {
    frequency.intervalCount = Math.max(1, form.intervalCount);
  }
  if (form.kind === 'custom') frequency.intervalUnit = form.intervalUnit;
  if (form.kind === 'weekly') frequency.daysOfWeek = [...form.daysOfWeek];
  if (form.kind === 'monthly' || form.kind === 'every_x_months' || form.kind === 'quarterly' || form.kind === 'every_6_months' || form.kind === 'annually') {
    frequency.dayOfMonth = form.dayOfMonth;
  }
  return frequency;
}

function isFrequencyFormValid(form: FrequencyForm): boolean {
  if (form.kind === 'weekly') return form.daysOfWeek.length > 0;
  if (form.kind === 'every_x_days' || form.kind === 'every_x_weeks' || form.kind === 'every_x_months' || form.kind === 'custom') {
    return Number.isInteger(form.intervalCount) && form.intervalCount >= 1;
  }
  if (form.kind === 'monthly') return form.dayOfMonth >= 1 && form.dayOfMonth <= 31;
  return true;
}

function emptyItemForm(): ItemForm {
  return {
    name: '',
    categoryId: '',
    newCategoryName: '',
    creatingCategory: false,
    description: '',
    notes: '',
  };
}

function rangeWindow(range: RangeId, today: string): { start: string; end: string } | null {
  if (range === 'overdue') return { start: '0001-01-01', end: addDays(today, -1) };
  if (range === 'this_week') return { start: startOfWeek(today), end: endOfWeek(today) };
  if (range === 'this_month') return { start: startOfMonth(today), end: endOfMonth(today) };
  if (range === 'next_3_months') return { start: today, end: addMonthsSetDay(today, 3) };
  return null;
}

function toErrorText(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim() && error !== '[object Object]') return error;
  if (error instanceof Error && error.message.trim() && error.message !== '[object Object]') return error.message;
  if (error && typeof error === 'object') {
    const record = error as { error?: unknown; message?: unknown; details?: unknown };
    if (typeof record.error === 'string' && record.error.trim() && record.error !== '[object Object]') return record.error;
    if (typeof record.message === 'string' && record.message.trim() && record.message !== '[object Object]') {
      return record.message;
    }
    if (typeof record.details === 'string' && record.details.trim()) return record.details;
  }
  return fallback;
}

function ReminderDaysFields({
  id,
  value,
  onChange,
  labelClass,
  inputClass,
  hintClass,
}: {
  id: string;
  value: number | null;
  onChange: (next: number | null) => void;
  labelClass: string;
  inputClass: string;
  hintClass: string;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        Reminder
      </label>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-sm ${hintClass}`}>Remind me</span>
        <input
          id={id}
          type="number"
          min={1}
          max={365}
          value={value ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') {
              onChange(null);
              return;
            }
            const next = Number.parseInt(raw, 10);
            onChange(Number.isInteger(next) && next >= 1 ? Math.min(next, 365) : null);
          }}
          placeholder="Off"
          className={`${inputClass} w-24`}
        />
        <span className={`text-sm ${hintClass}`}>days before due</span>
      </div>
    </div>
  );
}

function reminderSummary(days: number | null | undefined): string {
  if (days == null) return 'Off';
  return `${days} day${days === 1 ? '' : 's'} before due`;
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

function datesForRange(range: RangeId, nextDueDate: string, frequency: CleaningFrequency, today: string): string[] {
  const nextDue = asDateOnly(nextDueDate) || nextDueDate;
  if (range === 'overdue') {
    return compareIso(nextDue, today) < 0 ? [nextDue] : [];
  }
  const window = rangeWindow(range, today);
  if (range === 'this_week' && window) {
    if (compareIso(nextDue, window.start) < 0 || compareIso(nextDue, window.end) > 0) return [];
    return expandOccurrences(nextDue, frequency, window.start, window.end);
  }
  return window ? expandOccurrences(nextDue, frequency, window.start, window.end) : [nextDue];
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

function CheckIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function HideIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

type ThemeClasses = {
  isLight: boolean;
  labelClass: string;
  inputClass: string;
  selectClass: string;
  mutedTextClass: string;
};

function FrequencyFields({
  form,
  onChange,
  classes,
}: {
  form: FrequencyForm;
  onChange: (next: FrequencyForm) => void;
  classes: ThemeClasses;
}) {
  const { isLight, labelClass, inputClass, selectClass, mutedTextClass } = classes;
  const needsCount = form.kind === 'every_x_days' || form.kind === 'every_x_weeks' || form.kind === 'every_x_months' || form.kind === 'custom';
  const needsMonthDay = form.kind === 'monthly';

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass} htmlFor="cs-frequency-kind">
          Frequency <span className="text-red-400">*</span>
        </label>
        <select
          id="cs-frequency-kind"
          value={form.kind}
          onChange={(e) => onChange({ ...form, kind: e.target.value as FrequencyKind })}
          className={selectClass}
        >
          {FREQUENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {needsCount && (
        <div className={form.kind === 'custom' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}>
          <div>
            <label className={labelClass} htmlFor="cs-frequency-count">
              Repeat every <span className="text-red-400">*</span>
            </label>
            <input
              id="cs-frequency-count"
              type="number"
              min={1}
              step={1}
              value={form.intervalCount}
              onChange={(e) => onChange({ ...form, intervalCount: Math.max(1, Number(e.target.value) || 1) })}
              className={inputClass}
            />
          </div>
          {form.kind === 'custom' && (
            <div>
              <label className={labelClass} htmlFor="cs-frequency-unit">
                Unit <span className="text-red-400">*</span>
              </label>
              <select
                id="cs-frequency-unit"
                value={form.intervalUnit}
                onChange={(e) => onChange({ ...form, intervalUnit: e.target.value as FrequencyForm['intervalUnit'] })}
                className={selectClass}
              >
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </div>
          )}
        </div>
      )}

      {form.kind === 'weekly' && (
        <div>
          <p className={labelClass}>Days of week</p>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((day) => {
              const selected = form.daysOfWeek.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...form,
                      daysOfWeek: selected
                        ? form.daysOfWeek.filter((value) => value !== day.value)
                        : [...form.daysOfWeek, day.value],
                    })
                  }
                  className={`px-3 py-2 rounded-lg border transition-colors ${
                    selected
                      ? isLight
                        ? 'border-emerald-400 bg-emerald-100 text-emerald-900'
                        : 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                      : isLight
                        ? 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                        : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {day.short}
                </button>
              );
            })}
          </div>
          {form.daysOfWeek.length === 0 && <p className={`text-xs mt-1 ${mutedTextClass}`}>Select at least one day</p>}
        </div>
      )}

      {needsMonthDay && (
        <div>
          <label className={labelClass} htmlFor="cs-frequency-dom">
            Day of month
          </label>
          <select
            id="cs-frequency-dom"
            value={form.dayOfMonth}
            onChange={(e) => onChange({ ...form, dayOfMonth: Number(e.target.value) })}
            className={selectClass}
          >
            {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

export function CleaningScheduleTool({ toolId }: CleaningScheduleToolProps) {
  const { resolvedTheme } = useTheme();
  const { showError } = useAppNotice();
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
  const labelClass = isLight ? 'block text-sm font-medium text-slate-700 mb-2' : 'block text-sm font-medium text-slate-300 mb-2';
  const compactLabelClass = isLight ? 'block text-xs font-medium text-slate-700 mb-1.5' : 'block text-xs font-medium text-slate-300 mb-1.5';
  const inputClass = isLight
    ? 'w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const selectClass = isLight
    ? 'w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const textareaClass = `${inputClass} resize-none`;
  const primaryButtonClass = isLight
    ? 'px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50'
    : 'px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50';
  const secondaryButtonClass = isLight
    ? 'px-4 py-2 rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors'
    : 'px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors';
  const compactPrimaryClass = isLight
    ? 'rounded-lg border-2 border-emerald-700 bg-white px-3 py-1 text-sm font-semibold text-emerald-900 shadow-sm transition-colors hover:border-emerald-800 hover:bg-emerald-50'
    : 'rounded-lg bg-emerald-500/20 px-3 py-1 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/30';
  const tabStripClass = isLight ? 'border-b border-slate-200' : 'border-b border-slate-800';
  const tabActiveClass = isLight
    ? 'border-b-2 border-emerald-600 text-emerald-900 font-semibold'
    : 'border-b-2 border-emerald-500 text-emerald-300';
  const tabInactiveClass = isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-300';
  const modalCardClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 max-w-md w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto'
    : 'rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto';
  const modalCardLgClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto'
    : 'rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto';
  const overlayClass = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm';
  const deleteWarningBoxClass = isLight
    ? 'rounded-lg border border-red-300 bg-red-50 px-4 py-3 mb-4'
    : 'rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4';
  const deleteWarningTextClass = isLight ? 'text-red-700 font-semibold mb-2' : 'text-red-300 font-semibold mb-2';
  const deleteWarningDetailClass = isLight ? 'text-red-600 text-sm' : 'text-red-200 text-sm';
  const deleteInputClass = isLight
    ? 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4'
    : 'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4';
  const deleteButtonClass = 'px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
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
  const headingSmClass = isLight ? 'text-base font-semibold text-slate-900' : 'text-base font-semibold text-slate-100';
  const chipNeutralClass = isLight
    ? 'px-1.5 py-0.5 rounded text-xs font-medium border border-slate-300 bg-slate-100 text-slate-700'
    : 'px-1.5 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300';
  const defaultBadgeClass = isLight
    ? 'px-1.5 py-0.5 rounded text-xs font-medium border border-emerald-300 bg-emerald-50 text-emerald-800'
    : 'px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300';
  const iconButtonClass = isLight
    ? 'rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors'
    : 'rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors';
  const successBannerClass = isLight
    ? 'rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'
    : 'rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300';
  const errorBannerClass = isLight
    ? 'rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700'
    : 'rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300';
  const radioLabelClass = isLight ? 'flex items-center gap-2 text-sm text-slate-800' : 'flex items-center gap-2 text-sm text-slate-200';

  const frequencyClasses: ThemeClasses = { isLight, labelClass, inputClass, selectClass, mutedTextClass };

  const [categories, setCategories] = useState<CleaningCategory[]>([]);
  const [libraryItems, setLibraryItems] = useState<CleaningLibraryItem[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<CleaningScheduledTask[]>([]);
  const [completions, setCompletions] = useState<CleaningCompletion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<TabId>('schedule');
  const [range, setRange] = useState<RangeId>('this_week');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortId>('nextDue');
  const [showHistory, setShowHistory] = useState(false);
  const [showCompletionHistory, setShowCompletionHistory] = useState(false);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<string[]>([]);
  const [libraryCategoryId, setLibraryCategoryId] = useState('');
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('all');

  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemForm, setEditItemForm] = useState<ItemForm>(emptyItemForm);

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  const [activateItemIds, setActivateItemIds] = useState<string[]>([]);
  const [activateForm, setActivateForm] = useState<FrequencyForm>(() => emptyFrequencyForm(todayIso()));
  const [activateNextDue, setActivateNextDue] = useState(todayIso);
  const [activateReminderDays, setActivateReminderDays] = useState<number | null>(null);
  const [activateAddToDashboard, setActivateAddToDashboard] = useState(false);
  const [selectedDefaultIds, setSelectedDefaultIds] = useState<string[]>([]);

  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [detailEditing, setDetailEditing] = useState(false);
  const [detailForm, setDetailForm] = useState<FrequencyForm>(() => emptyFrequencyForm(todayIso()));
  const [detailNextDue, setDetailNextDue] = useState(todayIso);
  const [detailReminderDays, setDetailReminderDays] = useState<number | null>(null);
  const [detailAddToDashboard, setDetailAddToDashboard] = useState(false);
  const [detailItemForm, setDetailItemForm] = useState<ItemForm>(emptyItemForm);

  const [completeOccurrence, setCompleteOccurrence] = useState<{ taskId: string; scheduledDate: string } | null>(null);
  const [completeBasis, setCompleteBasis] = useState<'today' | 'scheduled'>('today');
  const [pendingItemAttachments, setPendingItemAttachments] = useState<AttachmentItem[]>([]);
  const [pendingCompletionAttachments, setPendingCompletionAttachments] = useState<AttachmentItem[]>([]);
  const [attachmentModal, setAttachmentModal] = useState<AttachmentTarget | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [viewPreview, setViewPreview] = useState<AttachmentItem | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showExportPopup, setShowExportPopup] = useState(false);
  const [includeHistory, setIncludeHistory] = useState(false);
  const [exportAllCategories, setExportAllCategories] = useState(true);
  const [exportCategoryId, setExportCategoryId] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const today = todayIso();

  const showBanner = (type: 'success' | 'error', text: string) => {
    setBanner({ type, text });
  };

  const applyData = useCallback((data: CleaningScheduleData) => {
    const nextCategories = data.categories ?? [];
    setCategories(nextCategories);
    setLibraryItems((data.items ?? []).map((item) => ({ ...item, attachments: item.attachments ?? [] })));
    setScheduledTasks(
      (data.tasks ?? []).map((task) => ({
        ...task,
        nextDueDate: asDateOnly(task.nextDueDate) || task.nextDueDate,
        addToDashboard: !!task.addToDashboard,
      }))
    );
    setCompletions((data.completions ?? []).map((row) => ({ ...row, attachments: row.attachments ?? [] })));
    setLibraryCategoryId((prev) => {
      const active = nextCategories.filter((category) => category.isActive !== false);
      if (prev && active.some((category) => category.id === prev)) return prev;
      return [...active].sort((a, b) => a.name.localeCompare(b.name))[0]?.id ?? '';
    });
  }, []);

  const postAction = useCallback(
    async (body: Record<string, unknown>) => {
      if (!toolId) throw new Error('Tool ID is required');
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, ...body }),
      });
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (!response.ok) {
        throw new Error(toErrorText(data?.error ?? data, 'Request failed'));
      }
      if (data.categories) applyData(data as CleaningScheduleData);
      return data;
    },
    [toolId, applyData]
  );

  useEffect(() => {
    if (!banner) return undefined;
    if (banner.type !== 'success') return undefined;
    const timer = window.setTimeout(() => setBanner(null), 3000);
    return () => window.clearTimeout(timer);
  }, [banner]);

  const refreshData = useCallback(async () => {
    if (!toolId) {
      setCategories([]);
      setLibraryItems([]);
      setScheduledTasks([]);
      setCompletions([]);
      return;
    }
    const response = await fetch(`${API_BASE}?toolId=${encodeURIComponent(toolId)}`);
    const data = await response.json().catch(() => ({ error: 'Failed to load Cleaning Schedule' }));
    if (!response.ok) throw new Error(toErrorText(data?.error ?? data, 'Failed to load Cleaning Schedule'));
    applyData(data as CleaningScheduleData);
  }, [toolId, applyData]);

  useEffect(() => {
    const loadData = async () => {
      if (!toolId) {
        setCategories([]);
        setLibraryItems([]);
        setScheduledTasks([]);
        setCompletions([]);
        return;
      }
      setIsLoading(true);
      try {
        await refreshData();
      } catch (error) {
        setCategories([]);
        setLibraryItems([]);
        setScheduledTasks([]);
        setCompletions([]);
        showBanner('error', error instanceof Error ? error.message : 'Failed to load Cleaning Schedule');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [toolId, refreshData]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (deleteTarget) {
        setDeleteTarget(null);
        setDeleteConfirmText('');
        return;
      }
      if (completeOccurrence) {
        pendingCompletionAttachments.forEach((item) => {
          if (item.url) URL.revokeObjectURL(item.url);
        });
        setPendingCompletionAttachments([]);
        if (attachmentModal?.kind === 'new-completion') setAttachmentModal(null);
        setCompleteOccurrence(null);
        return;
      }
      if (activateItemIds.length > 0) {
        setActivateItemIds([]);
        return;
      }
      if (detailTaskId) {
        setDetailTaskId(null);
        setDetailEditing(false);
        return;
      }
      if (showExportPopup && !isExportingPdf) setShowExportPopup(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteTarget, completeOccurrence, pendingCompletionAttachments, attachmentModal, activateItemIds, detailTaskId, showExportPopup, isExportingPdf]);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );
  const activeCategories = useMemo(
    () => sortedCategories.filter((category) => category.isActive !== false),
    [sortedCategories]
  );
  const archivedCategories = useMemo(
    () => sortedCategories.filter((category) => category.isActive === false),
    [sortedCategories]
  );

  const categoryName = (categoryId: string) => categories.find((category) => category.id === categoryId)?.name ?? 'Uncategorized';
  const itemAttachmentCount = (itemId: string) =>
    libraryItems.find((item) => item.id === itemId)?.attachments?.length ?? 0;

  const savedItemForModal =
    attachmentModal?.kind === 'item' ? libraryItems.find((item) => item.id === attachmentModal.itemId) : undefined;
  const savedCompletionForModal =
    attachmentModal?.kind === 'completion'
      ? completions.find((row) => row.id === attachmentModal.completionId)
      : undefined;

  const modalFiles: AttachmentItem[] =
    attachmentModal?.kind === 'new-item'
      ? pendingItemAttachments
      : attachmentModal?.kind === 'new-completion'
        ? pendingCompletionAttachments
        : attachmentModal?.kind === 'item'
          ? (savedItemForModal?.attachments || []).map((item) => ({
              id: item.id,
              name: item.name,
              size: item.size,
              type: item.type,
            }))
          : attachmentModal?.kind === 'completion'
            ? (savedCompletionForModal?.attachments || []).map((item) => ({
                id: item.id,
                name: item.name,
                size: item.size,
                type: item.type,
              }))
            : [];

  const modalTitle =
    attachmentModal?.kind === 'new-item'
      ? itemForm.name.trim() || 'New cleaning item'
      : attachmentModal?.kind === 'new-completion'
        ? 'This completion'
        : attachmentModal?.kind === 'item'
          ? savedItemForModal?.name || 'Cleaning item'
          : attachmentModal?.kind === 'completion'
            ? savedCompletionForModal
              ? `Completed ${formatDateForDisplay(savedCompletionForModal.completedDate)}`
              : 'Completion'
            : 'Attachments';

  const fetchCleaningAttachmentBlob = async (attachmentId: string, inline = false) => {
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
      const blob = await fetchCleaningAttachmentBlob(item.id, true);
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
      showBanner('error', error instanceof Error ? error.message : 'Failed to open file');
    }
  };

  const handleDownloadAttachment = async (item: AttachmentItem): Promise<boolean> => {
    if (item.file) return false;
    try {
      const blob = await fetchCleaningAttachmentBlob(item.id);
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
      showBanner('error', error instanceof Error ? error.message : 'Failed to download file');
      return false;
    }
  };

  const addSavedItemFiles = async (itemId: string, files: File[]) => {
    setAttachmentBusy(true);
    try {
      for (const file of files) {
        await uploadCleaningFile(file, { itemId });
      }
      await refreshData();
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Failed to add file');
    } finally {
      setAttachmentBusy(false);
    }
  };

  const removeSavedItemFile = async (attachmentId: string) => {
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
      await refreshData();
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Failed to remove file');
    } finally {
      setAttachmentBusy(false);
    }
  };

  const startAddingItem = () => {
    revokePending(pendingItemAttachments);
    setPendingItemAttachments([]);
    setItemForm(emptyItemForm());
    setIsAddingItem(true);
  };

  const cancelAddingItem = () => {
    revokePending(pendingItemAttachments);
    setPendingItemAttachments([]);
    if (attachmentModal?.kind === 'new-item') {
      setAttachmentModal(null);
      setViewPreview(null);
    }
    setIsAddingItem(false);
    setItemForm(emptyItemForm());
  };

  const activeScheduleByItem = useMemo(() => {
    const map = new Map<string, CleaningScheduledTask>();
    scheduledTasks.filter((task) => task.isActive).forEach((task) => map.set(task.libraryItemId, task));
    return map;
  }, [scheduledTasks]);

  const scheduleByItem = useMemo(() => {
    const map = new Map<string, CleaningScheduledTask>();
    scheduledTasks.forEach((task) => {
      const existing = map.get(task.libraryItemId);
      if (!existing || task.isActive) map.set(task.libraryItemId, task);
    });
    return map;
  }, [scheduledTasks]);

  const itemCategoryPayload = (form: ItemForm) =>
    form.creatingCategory
      ? { newCategoryName: form.newCategoryName.trim() }
      : { categoryId: form.categoryId };

  const itemFormReady = (form: ItemForm) =>
    Boolean(form.name.trim() && (form.creatingCategory ? form.newCategoryName.trim() : form.categoryId));

  const openActivate = (itemId: string) => {
    const active = activeScheduleByItem.get(itemId);
    if (active) {
      openDetail(active.id, true);
      return;
    }
    const existing = scheduleByItem.get(itemId);
    setActivateItemIds([itemId]);
    setActivateForm(existing ? frequencyToForm(existing.frequency, today) : emptyFrequencyForm(today));
    setActivateNextDue(existing?.nextDueDate || today);
    setActivateReminderDays(existing?.reminderDays ?? null);
    setActivateAddToDashboard(existing?.addToDashboard === true);
  };

  const openBulkActivate = (itemIds: string[]) => {
    const ids = itemIds.filter((itemId) => {
      const item = libraryItems.find((entry) => entry.id === itemId);
      return Boolean(item?.isDefault && !item.isHidden && !activeScheduleByItem.has(itemId));
    });
    if (ids.length === 0) return;
    setActivateItemIds(ids);
    setActivateForm(emptyFrequencyForm(today));
    setActivateNextDue(today);
    setActivateReminderDays(null);
    setActivateAddToDashboard(false);
  };

  const saveActivation = async () => {
    if (activateItemIds.length === 0 || !activateNextDue || !isFrequencyFormValid(activateForm) || isSaving) return;
    const itemName = libraryItems.find((item) => item.id === activateItemIds[0])?.name ?? 'Task';
    setIsSaving(true);
    try {
      const frequency = formToFrequency(activateForm);
      for (const itemId of activateItemIds) {
        await postAction({
          action: 'activateTask',
          itemId,
          frequency,
          nextDueDate: activateNextDue,
          reminderDays: activateReminderDays,
          addToDashboard: activateAddToDashboard,
        });
      }
      const count = activateItemIds.length;
      setActivateItemIds([]);
      setSelectedDefaultIds((prev) => prev.filter((id) => !activateItemIds.includes(id)));
      showBanner(
        'success',
        count === 1 ? `${itemName} is now on the schedule.` : `${count} default items are now on the schedule.`
      );
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Failed to activate task');
    } finally {
      setIsSaving(false);
    }
  };

  const openDetail = (taskId: string, editing = false) => {
    const task = scheduledTasks.find((entry) => entry.id === taskId);
    const item = task ? libraryItems.find((entry) => entry.id === task.libraryItemId) : undefined;
    if (!task || !item) return;
    setDetailTaskId(taskId);
    setDetailEditing(editing);
    setDetailForm(frequencyToForm(task.frequency, today));
    setDetailNextDue(task.nextDueDate);
    setDetailReminderDays(task.reminderDays);
    setDetailAddToDashboard(task.addToDashboard);
    setDetailItemForm({
      name: item.name,
      categoryId: item.categoryId,
      newCategoryName: '',
      creatingCategory: false,
      description: item.description,
      notes: item.notes,
    });
  };

  const saveDetail = async () => {
    if (!detailTaskId || !detailNextDue || !isFrequencyFormValid(detailForm) || isSaving) return;
    const task = scheduledTasks.find((entry) => entry.id === detailTaskId);
    const item = task ? libraryItems.find((entry) => entry.id === task.libraryItemId) : undefined;
    if (!task || !item) return;
    if (!item.isDefault && !detailItemForm.name.trim()) return;
    if (!item.isDefault && !detailItemForm.creatingCategory && !detailItemForm.categoryId) {
      showBanner('error', 'Choose or create a category.');
      return;
    }
    setIsSaving(true);
    try {
      await postAction({
        action: 'updateSchedule',
        taskId: task.id,
        itemId: item.id,
        name: detailItemForm.name.trim(),
        description: detailItemForm.description.trim(),
        notes: detailItemForm.notes.trim(),
        ...itemCategoryPayload(detailItemForm),
        frequency: formToFrequency(detailForm),
        nextDueDate: detailNextDue,
        reminderDays: detailReminderDays,
        addToDashboard: detailAddToDashboard,
      });
      setDetailEditing(false);
      showBanner('success', 'Schedule updated.');
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Failed to update schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const deactivateTask = async (taskId: string) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await postAction({ action: 'deactivateTask', taskId });
      setDetailTaskId(null);
      setDetailEditing(false);
      showBanner('success', 'Moved to history (inactive).');
    } catch (error) {
      showBanner('error', toErrorText(error, 'Failed to move task to history'));
    } finally {
      setIsSaving(false);
    }
  };

  const reactivateTask = async (taskId: string) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await postAction({ action: 'reactivateTask', taskId });
      showBanner('success', 'Task reactivated.');
      openDetail(taskId, true);
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Failed to reactivate task');
    } finally {
      setIsSaving(false);
    }
  };

  const revokePending = (items: AttachmentItem[]) => {
    items.forEach((item) => {
      if (item.url) URL.revokeObjectURL(item.url);
    });
  };

  const closeCompleteDialog = () => {
    revokePending(pendingCompletionAttachments);
    setPendingCompletionAttachments([]);
    if (attachmentModal?.kind === 'new-completion') {
      setAttachmentModal(null);
      setViewPreview(null);
    }
    setCompleteOccurrence(null);
  };

  const openComplete = (taskId: string, scheduledDate: string) => {
    setDetailTaskId(null);
    setDetailEditing(false);
    revokePending(pendingCompletionAttachments);
    setPendingCompletionAttachments([]);
    setCompleteOccurrence({ taskId, scheduledDate });
    setCompleteBasis('today');
  };

  const uploadCleaningFile = async (file: File, owner: { itemId?: string; completionId?: string }) => {
    if (!toolId) throw new Error('Tool ID is required');
    const formData = new FormData();
    formData.append('toolId', toolId);
    if (owner.itemId) formData.append('itemId', owner.itemId);
    if (owner.completionId) formData.append('completionId', owner.completionId);
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/attachments`, { method: 'POST', body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Failed to add file');
  };

  const confirmComplete = async () => {
    if (!completeOccurrence || isSaving) return;
    const task = scheduledTasks.find((entry) => entry.id === completeOccurrence.taskId);
    const item = task ? libraryItems.find((entry) => entry.id === task.libraryItemId) : undefined;
    if (!task) return;
    setIsSaving(true);
    try {
      const data = await postAction({
        action: 'completeTask',
        taskId: task.id,
        scheduledDate: completeOccurrence.scheduledDate,
        completeBasis,
        completedDate: completeBasis === 'today' ? today : undefined,
      });
      const completionId = typeof data.completionId === 'string' ? data.completionId : '';
      if (completionId && pendingCompletionAttachments.length > 0) {
        try {
          for (const queued of pendingCompletionAttachments) {
            if (!queued.file) continue;
            await uploadCleaningFile(queued.file, { completionId });
          }
          await refreshData();
        } catch (uploadError) {
          revokePending(pendingCompletionAttachments);
          setPendingCompletionAttachments([]);
          if (attachmentModal?.kind === 'new-completion') {
            setAttachmentModal(null);
            setViewPreview(null);
          }
          setCompleteOccurrence(null);
          setShowCompletionHistory(true);
          showBanner('error', uploadError instanceof Error ? uploadError.message : 'Task completed, but a file failed to upload.');
          return;
        }
      }
      revokePending(pendingCompletionAttachments);
      setPendingCompletionAttachments([]);
      if (attachmentModal?.kind === 'new-completion') {
        setAttachmentModal(null);
        setViewPreview(null);
      }
      setCompleteOccurrence(null);
      setShowCompletionHistory(true);
      const nextDueDate = typeof data.nextDueDate === 'string' ? data.nextDueDate : '';
      showBanner(
        'success',
        `${item?.name ?? 'Task'} completed.${nextDueDate ? ` Next due ${formatDateForDisplay(nextDueDate)}.` : ''}`
      );
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Failed to complete task');
    } finally {
      setIsSaving(false);
    }
  };

  const addLibraryItem = async () => {
    if (!itemFormReady(itemForm) || isSaving) return;
    setIsSaving(true);
    try {
      const data = await postAction({
        action: 'createItem',
        name: itemForm.name.trim(),
        description: itemForm.description.trim(),
        notes: itemForm.notes.trim(),
        ...itemCategoryPayload(itemForm),
      });
      const createdItemId = typeof data.createdItemId === 'string' ? data.createdItemId : '';
      if (createdItemId && pendingItemAttachments.length > 0) {
        try {
          for (const queued of pendingItemAttachments) {
            if (!queued.file) continue;
            await uploadCleaningFile(queued.file, { itemId: createdItemId });
          }
          await refreshData();
        } catch (uploadError) {
          revokePending(pendingItemAttachments);
          setPendingItemAttachments([]);
          if (attachmentModal?.kind === 'new-item') {
            setAttachmentModal(null);
            setViewPreview(null);
          }
          if (typeof data.createdCategoryId === 'string') setLibraryCategoryId(data.createdCategoryId);
          else if (itemForm.categoryId) setLibraryCategoryId(itemForm.categoryId);
          setItemForm(emptyItemForm());
          setIsAddingItem(false);
          showBanner('error', uploadError instanceof Error ? uploadError.message : 'Item saved, but a file failed to upload.');
          return;
        }
      }
      revokePending(pendingItemAttachments);
      setPendingItemAttachments([]);
      if (attachmentModal?.kind === 'new-item') {
        setAttachmentModal(null);
        setViewPreview(null);
      }
      if (typeof data.createdCategoryId === 'string') setLibraryCategoryId(data.createdCategoryId);
      else if (itemForm.categoryId) setLibraryCategoryId(itemForm.categoryId);
      setItemForm(emptyItemForm());
      setIsAddingItem(false);
      showBanner('success', 'Cleaning item added.');
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Failed to add item');
    } finally {
      setIsSaving(false);
    }
  };

  const startEditItem = (item: CleaningLibraryItem) => {
    setEditingItemId(item.id);
    setEditItemForm({
      name: item.name,
      categoryId: item.categoryId,
      newCategoryName: '',
      creatingCategory: false,
      description: item.description,
      notes: item.notes,
    });
  };

  const saveEditItem = async () => {
    if (!editingItemId || !itemFormReady(editItemForm) || isSaving) return;
    setIsSaving(true);
    try {
      await postAction({
        action: 'updateItem',
        itemId: editingItemId,
        name: editItemForm.name.trim(),
        description: editItemForm.description.trim(),
        notes: editItemForm.notes.trim(),
        ...itemCategoryPayload(editItemForm),
      });
      setEditingItemId(null);
      showBanner('success', 'Item updated.');
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Failed to update item');
    } finally {
      setIsSaving(false);
    }
  };

  const hideDefault = async (itemId: string) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await postAction({ action: 'hideItem', itemId });
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Failed to hide item');
    } finally {
      setIsSaving(false);
    }
  };

  const restoreDefault = async (itemId: string) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await postAction({ action: 'restoreItem', itemId });
      showBanner('success', 'Default item restored.');
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Failed to restore item');
    } finally {
      setIsSaving(false);
    }
  };

  const addCategory = async () => {
    const name = newCategoryName.trim();
    if (!name || isSaving) return;
    if (categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
      showBanner('error', 'A category with that name already exists.');
      return;
    }
    setIsSaving(true);
    try {
      const data = await postAction({ action: 'createCategory', name });
      const created = (data.categories as CleaningCategory[] | undefined)?.find(
        (category) => category.name.toLowerCase() === name.toLowerCase()
      );
      if (created) setLibraryCategoryId(created.id);
      setNewCategoryName('');
      setIsAddingCategory(false);
      showBanner('success', 'Category added.');
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Failed to add category');
    } finally {
      setIsSaving(false);
    }
  };

  const saveCategoryEdit = async () => {
    const name = editingCategoryName.trim();
    if (!editingCategoryId || !name || isSaving) return;
    if (categories.some((category) => category.id !== editingCategoryId && category.name.toLowerCase() === name.toLowerCase())) {
      showBanner('error', 'A category with that name already exists.');
      return;
    }
    setIsSaving(true);
    try {
      await postAction({ action: 'updateCategory', categoryId: editingCategoryId, name });
      setEditingCategoryId(null);
      setEditingCategoryName('');
      showBanner('success', 'Category renamed.');
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Failed to rename category');
    } finally {
      setIsSaving(false);
    }
  };

  const archiveCategory = async (categoryId: string) => {
    const category = categories.find((entry) => entry.id === categoryId);
    if (!category || category.isDefault || isSaving) return;
    setIsSaving(true);
    try {
      await postAction({ action: 'archiveCategory', categoryId });
      showBanner('success', `${category.name} archived. Items and history were kept. Scheduled tasks moved to Archived.`);
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Failed to archive category');
    } finally {
      setIsSaving(false);
    }
  };

  const reactivateCategory = async (categoryId: string) => {
    const category = categories.find((entry) => entry.id === categoryId);
    if (!category || isSaving) return;
    setIsSaving(true);
    try {
      await postAction({ action: 'reactivateCategory', categoryId });
      showBanner('success', `${category.name} restored to active categories.`);
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Failed to restore category');
    } finally {
      setIsSaving(false);
    }
  };

  const categoryUsage = (categoryId: string) => libraryItems.filter((item) => item.categoryId === categoryId).length;

  const confirmDelete = async () => {
    if (!deleteTarget || deleteConfirmText.trim().toLowerCase() !== 'delete' || isSaving) return;
    setIsSaving(true);
    try {
      if (deleteTarget.kind === 'item') {
        const item = libraryItems.find((entry) => entry.id === deleteTarget.id);
        if (!item || item.isDefault) return;
        const taskIds = scheduledTasks.filter((task) => task.libraryItemId === item.id).map((task) => task.id);
        await postAction({ action: 'deleteItem', itemId: item.id });
        if (detailTaskId && taskIds.includes(detailTaskId)) setDetailTaskId(null);
      } else if (deleteTarget.kind === 'category') {
        const category = categories.find((entry) => entry.id === deleteTarget.id);
        if (!category || category.isDefault || categoryUsage(category.id) > 0) return;
        await postAction({ action: 'deleteCategory', categoryId: category.id });
      } else {
        const task = scheduledTasks.find((entry) => entry.id === deleteTarget.id);
        const item = task ? libraryItems.find((entry) => entry.id === task.libraryItemId) : undefined;
        if (!task || !item || item.isDefault) return;
        await postAction({ action: 'deleteTask', taskId: task.id });
        if (detailTaskId === task.id) setDetailTaskId(null);
      }
      setDeleteTarget(null);
      setDeleteConfirmText('');
      showBanner('success', 'Deleted permanently.');
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Failed to delete');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCopy = () => {
    if (!deleteTarget) return { title: '', detail: '' };
    if (deleteTarget.kind === 'item') {
      const item = libraryItems.find((entry) => entry.id === deleteTarget.id);
      return {
        title: `Delete ${item?.name ?? 'this item'} permanently?`,
        detail: 'This custom cleaning item and any schedule or completion history for it will be removed.',
      };
    }
    if (deleteTarget.kind === 'category') {
      const category = categories.find((entry) => entry.id === deleteTarget.id);
      return {
        title: `Delete ${category?.name ?? 'this category'} permanently?`,
        detail: 'This unused custom category will be removed. Defaults cannot be deleted.',
      };
    }
    const task = scheduledTasks.find((entry) => entry.id === deleteTarget.id);
    const item = task ? libraryItems.find((entry) => entry.id === task.libraryItemId) : undefined;
    return {
      title: `Delete ${item?.name ?? 'this scheduled task'} permanently?`,
      detail: 'This scheduled task and its completion history will be removed. The library item will remain.',
    };
  };

  const occurrences = useMemo(() => {
    const active = scheduledTasks.filter((task) => task.isActive);
    const rows: OccurrenceRow[] = [];
    active.forEach((task) => {
      const item = libraryItems.find((entry) => entry.id === task.libraryItemId);
      if (!item) return;
      const dates = datesForRange(range, task.nextDueDate, task.frequency, today);
      dates.forEach((date) => {
        rows.push({
          taskId: task.id,
          itemId: item.id,
          date,
          name: item.name,
          categoryName: categoryName(item.categoryId),
          frequencyLabel: frequencyLabel(task.frequency),
          status: occurrenceStatus(date, today),
        });
      });
    });
    const query = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (categoryFilter !== 'all') {
        const item = libraryItems.find((entry) => entry.id === row.itemId);
        if (!item || item.categoryId !== categoryFilter) return false;
      }
      if (!query) return true;
      return (
        row.name.toLowerCase().includes(query) ||
        row.categoryName.toLowerCase().includes(query) ||
        row.frequencyLabel.toLowerCase().includes(query)
      );
    });
    filtered.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name) || compareIso(a.date, b.date);
      if (sortBy === 'category') return a.categoryName.localeCompare(b.categoryName) || compareIso(a.date, b.date);
      if (sortBy === 'frequency') return a.frequencyLabel.localeCompare(b.frequencyLabel) || compareIso(a.date, b.date);
      return compareIso(a.date, b.date) || a.name.localeCompare(b.name);
    });
    return filtered;
  }, [scheduledTasks, libraryItems, categories, range, search, categoryFilter, sortBy, today]);

  const occurrenceGroups = useMemo(() => {
    const groups: { taskId: string; itemId: string; name: string; categoryName: string; frequencyLabel: string; rows: OccurrenceRow[] }[] = [];
    const indexByTask = new Map<string, number>();
    occurrences.forEach((row) => {
      const existing = indexByTask.get(row.taskId);
      if (existing != null) {
        groups[existing].rows.push(row);
        return;
      }
      indexByTask.set(row.taskId, groups.length);
      groups.push({
        taskId: row.taskId,
        itemId: row.itemId,
        name: row.name,
        categoryName: row.categoryName,
        frequencyLabel: row.frequencyLabel,
        rows: [row],
      });
    });
    return groups;
  }, [occurrences]);

  const toggleOccurrenceGroup = (taskId: string) => {
    setCollapsedGroupIds((prev) => (prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]));
  };

  const historyTasks = scheduledTasks.filter((task) => !task.isActive);
  const completionHistoryRows = useMemo(
    () =>
      [...completions]
        .sort((a, b) => compareIso(b.completedDate, a.completedDate) || compareIso(b.scheduledDate, a.scheduledDate))
        .map((row) => {
          const task = scheduledTasks.find((entry) => entry.id === row.scheduledTaskId);
          const item = task ? libraryItems.find((entry) => entry.id === task.libraryItemId) : undefined;
          return {
            ...row,
            name: item?.name ?? 'Task',
            categoryName: item ? categoryName(item.categoryId) : '',
          };
        }),
    [completions, scheduledTasks, libraryItems, categories]
  );
  const selectedLibraryCategory =
    activeCategories.find((category) => category.id === libraryCategoryId) ?? activeCategories[0];
  const itemsInCategory = libraryItems
    .filter((item) => item.categoryId === selectedLibraryCategory?.id)
    .sort((a, b) => a.name.localeCompare(b.name));

  const availableItems = itemsInCategory.filter((item) => !item.isHidden && !activeScheduleByItem.has(item.id));
  const scheduledItems = itemsInCategory.filter((item) => activeScheduleByItem.has(item.id));
  const hiddenItems = itemsInCategory.filter((item) => item.isDefault && item.isHidden);
  const selectableDefaultIds = availableItems.filter((item) => item.isDefault).map((item) => item.id);
  const selectedAvailableDefaultIds = selectedDefaultIds.filter((id) => selectableDefaultIds.includes(id));

  const toggleDefaultSelected = (itemId: string) => {
    setSelectedDefaultIds((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]));
  };

  const toggleSelectAllDefaults = () => {
    if (selectableDefaultIds.length === 0) return;
    const allSelected = selectableDefaultIds.every((id) => selectedDefaultIds.includes(id));
    setSelectedDefaultIds(allSelected ? [] : selectableDefaultIds);
  };

  const detailTask = scheduledTasks.find((task) => task.id === detailTaskId);
  const detailItem = detailTask ? libraryItems.find((item) => item.id === detailTask.libraryItemId) : undefined;
  const detailHistory = detailTask
    ? completions.filter((row) => row.scheduledTaskId === detailTask.id).sort((a, b) => compareIso(b.completedDate, a.completedDate))
    : [];

  const statusBadgeClass = (status: OccurrenceStatus) => {
    if (status === 'Overdue') {
      return isLight
        ? 'px-1.5 py-0.5 rounded text-xs font-semibold border border-red-600 bg-red-100 text-red-800'
        : 'px-1.5 py-0.5 rounded text-xs font-semibold border border-red-400 bg-red-500/40 text-red-100';
    }
    if (status === 'Due today') {
      return isLight
        ? 'px-1.5 py-0.5 rounded text-xs font-semibold border border-amber-500 bg-amber-100 text-amber-950'
        : 'px-1.5 py-0.5 rounded text-xs font-semibold border border-amber-400 bg-amber-500/40 text-amber-100';
    }
    if (status === 'Due soon') {
      return isLight
        ? 'px-1.5 py-0.5 rounded text-xs font-medium border border-sky-300 bg-sky-50 text-sky-800'
        : 'px-1.5 py-0.5 rounded text-xs font-medium bg-sky-500/20 text-sky-300';
    }
    return isLight
      ? 'px-1.5 py-0.5 rounded text-xs font-medium border border-slate-300 bg-slate-100 text-slate-700'
      : 'px-1.5 py-0.5 rounded text-xs font-medium bg-slate-700/50 text-slate-300';
  };

  const occurrenceRowClass = (status: OccurrenceStatus) => {
    if (status === 'Overdue') {
      return isLight
        ? `${nestedCardClass} border-l-4 border-l-red-600`
        : `${nestedCardClass} border-l-4 border-l-red-400`;
    }
    if (status === 'Due today') {
      return isLight
        ? `${nestedCardClass} border-l-4 border-l-amber-500`
        : `${nestedCardClass} border-l-4 border-l-amber-400`;
    }
    return nestedCardClass;
  };

  const renderOccurrenceRow = (row: OccurrenceRow) => (
    <div key={`${row.taskId}-${row.date}`} className={occurrenceRowClass(row.status)}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h4 className={headingSmClass}>{row.name}</h4>
            <span className={chipNeutralClass}>{row.categoryName}</span>
            <span className={statusBadgeClass(row.status)}>{row.status}</span>
            {scheduledTasks.find((task) => task.id === row.taskId)?.addToDashboard && <OnCalendarChip isLight={isLight} />}
          </div>
          <p className={subTextClass}>
            {formatDateForDisplay(row.date)} · {row.frequencyLabel}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 ml-4">
          <AttachmentButton
            count={itemAttachmentCount(row.itemId)}
            onClick={() => setAttachmentModal({ kind: 'item', itemId: row.itemId })}
            ariaLabel={`Library files for ${row.name}`}
          />
          <button
            type="button"
            onClick={() => openComplete(row.taskId, row.date)}
            className={rowIconEmeraldClass}
            aria-label="Complete"
            title="Complete"
          >
            <CheckIcon />
          </button>
          <button
            type="button"
            onClick={() => openDetail(row.taskId)}
            className={rowIconEmeraldClass}
            aria-label="View/Edit"
            title="View/Edit"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            onClick={() => deactivateTask(row.taskId)}
            className={rowIconSecondaryClass}
            aria-label="Move to history — archive this task (inactive). Not completion history."
            title="Move to history — archive this task (inactive). Not completion history."
          >
            <ArchiveIcon />
          </button>
        </div>
      </div>
    </div>
  );

  const renderItemFields = (form: ItemForm, onChange: (next: ItemForm) => void, item?: CleaningLibraryItem) => {
    const lockName = Boolean(item?.isDefault);
    return (
      <div className="space-y-4">
        <div>
          <label className={compactLabelClass} htmlFor={`cs-item-name-${item?.id ?? 'new'}`}>
            Name <span className="text-red-400">*</span>
          </label>
          <input
            id={`cs-item-name-${item?.id ?? 'new'}`}
            type="text"
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            disabled={lockName}
            placeholder="e.g., Wipe fridge shelves"
            className={inputClass}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={compactLabelClass} htmlFor={`cs-item-category-${item?.id ?? 'new'}`}>
              Category <span className="text-red-400">*</span>
            </label>
            <button
              type="button"
              onClick={() => onChange({ ...form, creatingCategory: !form.creatingCategory, newCategoryName: '', categoryId: form.creatingCategory ? form.categoryId : '' })}
              className={isLight ? 'px-2 py-1 rounded-lg border-2 border-slate-400 bg-slate-100 text-xs font-medium text-slate-800 hover:bg-slate-200 transition-colors' : 'px-2 py-1 rounded border border-slate-600 bg-slate-800 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors'}
            >
              {form.creatingCategory ? 'Select existing category' : '+ Create new category'}
            </button>
          </div>
          {form.creatingCategory ? (
            <input
              type="text"
              value={form.newCategoryName}
              onChange={(e) => onChange({ ...form, newCategoryName: e.target.value })}
              placeholder="Enter new category..."
              className={inputClass}
            />
          ) : (
            <select
              id={`cs-item-category-${item?.id ?? 'new'}`}
              value={form.categoryId}
              onChange={(e) => onChange({ ...form, categoryId: e.target.value })}
              className={selectClass}
            >
              <option value="">Select a category...</option>
              {sortedCategories
                .filter((category) => category.isActive !== false || category.id === form.categoryId)
                .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className={compactLabelClass} htmlFor={`cs-item-desc-${item?.id ?? 'new'}`}>
            Description / instructions
          </label>
          <textarea
            id={`cs-item-desc-${item?.id ?? 'new'}`}
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            rows={2}
            placeholder="Optional steps or reminders"
            className={textareaClass}
          />
        </div>
        <div>
          <label className={compactLabelClass} htmlFor={`cs-item-notes-${item?.id ?? 'new'}`}>
            Notes
          </label>
          <textarea
            id={`cs-item-notes-${item?.id ?? 'new'}`}
            value={form.notes}
            onChange={(e) => onChange({ ...form, notes: e.target.value })}
            rows={2}
            placeholder="Use stainless steel cleaner."
            className={textareaClass}
          />
        </div>
      </div>
    );
  };

  const renderLibrarySection = (title: string, items: CleaningLibraryItem[], empty: string, mode: 'available' | 'scheduled' | 'hidden') => {
    if (libraryFilter !== 'all' && libraryFilter !== mode) return null;
    if (libraryFilter === 'all' && mode !== 'available' && items.length === 0) return null;
    return (
      <div className="mb-6 last:mb-0">
        <p className={isLight ? 'text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 mb-2' : 'text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300 mb-2'}>
          {title}
        </p>
        {mode === 'available' && selectableDefaultIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button type="button" onClick={toggleSelectAllDefaults} className={compactPrimaryClass}>
              {selectableDefaultIds.every((id) => selectedDefaultIds.includes(id)) ? 'Clear selection' : 'Select all defaults'}
            </button>
            <button
              type="button"
              onClick={() => openBulkActivate(selectedAvailableDefaultIds)}
              disabled={selectedAvailableDefaultIds.length === 0 || isSaving}
              className={compactPrimaryClass}
            >
              Activate selected{selectedAvailableDefaultIds.length > 0 ? ` (${selectedAvailableDefaultIds.length})` : ''}
            </button>
          </div>
        )}
        {items.length === 0 ? (
          <p className={`${subTextClass} py-2`}>{empty}</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const schedule = activeScheduleByItem.get(item.id);
              if (editingItemId === item.id) {
                return (
                  <div key={item.id} className={nestedCardClass}>
                    {renderItemFields(editItemForm, setEditItemForm, item)}
                    <div className="flex flex-wrap items-center gap-3 mt-4">
                      <AttachmentButton
                        count={item.attachments?.length ?? 0}
                        onClick={() => setAttachmentModal({ kind: 'item', itemId: item.id })}
                      />
                      <button type="button" onClick={saveEditItem} disabled={!itemFormReady(editItemForm) || isSaving} className={primaryButtonClass}>
                        Save
                      </button>
                      <button type="button" onClick={() => setEditingItemId(null)} className={secondaryButtonClass}>
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={item.id} className={nestedCardClass}>
                  <div className="flex items-start justify-between">
                    {mode === 'available' && item.isDefault && (
                      <label className={`${radioLabelClass} mt-1 mr-3 shrink-0`} onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedDefaultIds.includes(item.id)}
                          onChange={() => toggleDefaultSelected(item.id)}
                          aria-label={`Select ${item.name}`}
                          className={
                            isLight
                              ? 'rounded border-slate-400 bg-white text-emerald-600 focus:ring-emerald-500'
                              : 'rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500'
                          }
                        />
                      </label>
                    )}
                    <div
                      className={`min-w-0 flex-1 ${mode === 'scheduled' && schedule ? 'cursor-pointer' : ''}`}
                      onClick={mode === 'scheduled' && schedule ? () => openDetail(schedule.id, true) : undefined}
                      onKeyDown={
                        mode === 'scheduled' && schedule
                          ? (event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                openDetail(schedule.id, true);
                              }
                            }
                          : undefined
                      }
                      role={mode === 'scheduled' && schedule ? 'button' : undefined}
                      tabIndex={mode === 'scheduled' && schedule ? 0 : undefined}
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className={headingSmClass}>{item.name}</h4>
                        {item.isDefault && <span className={defaultBadgeClass}>Default</span>}
                        {schedule && <span className={chipNeutralClass}>Next {formatDateForDisplay(schedule.nextDueDate)}</span>}
                        {schedule?.addToDashboard && <OnCalendarChip isLight={isLight} />}
                      </div>
                      {item.description && <p className={subTextClass}>{item.description}</p>}
                      {item.notes && <p className={`${subTextClass} italic mt-1`}>{item.notes}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 ml-4">
                      <AttachmentButton
                        count={item.attachments?.length ?? 0}
                        onClick={() => setAttachmentModal({ kind: 'item', itemId: item.id })}
                      />
                      {mode === 'available' && (
                        <>
                          <button type="button" onClick={() => openActivate(item.id)} className={compactPrimaryClass}>
                            Activate
                          </button>
                          <button type="button" onClick={() => startEditItem(item)} className={rowIconEmeraldClass} aria-label="Edit" title="Edit">
                            <EditIcon />
                          </button>
                          {item.isDefault ? (
                            <button type="button" onClick={() => hideDefault(item.id)} className={rowIconSecondaryClass} aria-label="Hide" title="Hide">
                              <HideIcon />
                            </button>
                          ) : (
                            <button type="button" onClick={() => setDeleteTarget({ kind: 'item', id: item.id })} className={rowIconDangerClass} aria-label="Delete" title="Delete">
                              <DeleteIcon />
                            </button>
                          )}
                        </>
                      )}
                      {mode === 'scheduled' && schedule && (
                        <button type="button" onClick={() => openDetail(schedule.id, true)} className={rowIconEmeraldClass} aria-label="View/Edit" title="View/Edit">
                          <EditIcon />
                        </button>
                      )}
                      {mode === 'hidden' && (
                        <button type="button" onClick={() => restoreDefault(item.id)} className={rowIconEmeraldClass} aria-label="Restore" title="Restore">
                          <RestoreIcon />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const exportToPDF = async () => {
    if (isExportingPdf) return;
    if (!exportAllCategories && !exportCategoryId) {
      showError('Select a category, or choose All categories.');
      return;
    }

    setIsExportingPdf(true);

    try {
      const useAllCategories = exportAllCategories || !exportCategoryId;
      const selectedCategory = categories.find((category) => category.id === exportCategoryId);
      const selectedCategoryName = selectedCategory?.name;

      const rows = scheduledTasks.flatMap((task) => {
        const item = libraryItems.find((entry) => entry.id === task.libraryItemId);
        if (!item) return [];
        if (!includeHistory && !task.isActive) return [];
        if (!useAllCategories && item.categoryId !== exportCategoryId) return [];
        return [{
          task,
          item,
          categoryId: item.categoryId,
          categoryLabel: categoryName(item.categoryId),
          status: occurrenceStatus(asDateOnly(task.nextDueDate) || task.nextDueDate, today),
        }];
      });

      const sortRows = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
        compareIso(asDateOnly(a.task.nextDueDate) || a.task.nextDueDate, asDateOnly(b.task.nextDueDate) || b.task.nextDueDate)
        || a.item.name.localeCompare(b.item.name);

      const activeRows = rows.filter((row) => row.task.isActive).sort(sortRows);
      const inactiveRows = rows.filter((row) => !row.task.isActive).sort(sortRows);
      const exportedRows = includeHistory ? [...activeRows, ...inactiveRows] : activeRows;
      const overdueCount = activeRows.filter((row) => row.status === 'Overdue').length;

      const categoryIds = Array.from(new Set(exportedRows.map((row) => row.categoryId)));
      const categoriesToPrint = (useAllCategories ? sortedCategories : sortedCategories.filter((category) => category.id === exportCategoryId))
        .filter((category) => categoryIds.includes(category.id));
      const uncategorizedRows = exportedRows.filter(
        (row) => !categories.some((category) => category.id === row.categoryId)
      );
      const categoryGroups = [
        ...categoriesToPrint.map((category) => ({
          label: category.name,
          active: activeRows.filter((row) => row.categoryId === category.id),
          inactive: inactiveRows.filter((row) => row.categoryId === category.id),
        })),
        ...(uncategorizedRows.length > 0
          ? [{
              label: 'Uncategorized',
              active: uncategorizedRows.filter((row) => row.task.isActive),
              inactive: uncategorizedRows.filter((row) => !row.task.isActive),
            }]
          : []),
      ].filter((group) => group.active.length > 0 || (includeHistory && group.inactive.length > 0));

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
        const lines = pdf.splitTextToSize(text, maxWidth) as string[];
        const lineHeight = fontSize * 0.42;
        checkNewPage(lines.length * lineHeight + 2);
        lines.forEach((line) => {
          pdf.text(line, margin + indent, yPos);
          yPos += lineHeight;
        });
        yPos += 2;
      };

      const writeTask = (row: (typeof rows)[number]) => {
        checkNewPage(24);
        addText(row.item.name, 11, true, 8);
        addText(`Frequency: ${frequencyLabel(row.task.frequency)}`, 9, false, 8);
        addText(`Next due: ${formatDateForDisplay(row.task.nextDueDate)}`, 9, false, 8);
        addText(`Status: ${row.status}`, 9, false, 8);
        if (row.task.lastCompletedDate) {
          addText(`Last completed: ${formatDateForDisplay(row.task.lastCompletedDate)}`, 9, false, 8);
        }
        if (row.item.description.trim()) {
          addText(`Description: ${row.item.description.trim()}`, 9, false, 8);
        }
        if (row.item.notes.trim()) {
          addText(`Notes: ${row.item.notes.trim()}`, 9, false, 8);
        }
        if (!row.task.isActive && row.task.dateInactivated) {
          addText(`Date inactivated: ${formatDateForDisplay(row.task.dateInactivated)}`, 9, false, 8);
        }
        yPos += 3;
      };

      fillPage();

      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.title[0], colors.title[1], colors.title[2]);
      const title = 'Cleaning Schedule Report';
      pdf.text(title, (pageWidth - pdf.getTextWidth(title)) / 2, yPos);
      yPos += 10;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
      pdf.text(`Generated on: ${formatReportDate(new Date())}`, margin, yPos);
      yPos += 6;

      const historyLabel = includeHistory ? 'Active and inactive tasks' : 'Active tasks only';
      const scopeLabel = useAllCategories ? 'All categories' : selectedCategoryName || 'Selected category';
      pdf.text(`${historyLabel}  ·  ${scopeLabel}`, margin, yPos);
      yPos += 10;

      addSectionHeader('Summary');
      addText(`Total scheduled tasks: ${exportedRows.length}`, 11, true, 5);
      addText(`Active tasks: ${activeRows.length}`, 10, false, 5);
      if (includeHistory) {
        addText(`Inactive tasks: ${inactiveRows.length}`, 10, false, 5);
      }
      addText(`Overdue: ${overdueCount}`, 10, false, 5);
      addText(`Categories: ${categoryGroups.length}`, 10, false, 5);
      if (categoryGroups.length > 0) {
        yPos += 1;
        addText('By category', 10, true, 5);
        categoryGroups.forEach((group) => {
          const count = includeHistory ? group.active.length + group.inactive.length : group.active.length;
          addText(`${group.label}: ${count}`, 9, false, 8);
        });
      }
      yPos += 4;

      if (exportedRows.length === 0) {
        addText('No scheduled tasks match the selected options.', 10, false, 5, true);
      }

      categoryGroups.forEach((group) => {
        addSectionHeader(group.label);
        if (group.active.length > 0) {
          group.active.forEach(writeTask);
        } else if (!includeHistory || group.inactive.length === 0) {
          addText('No active tasks.', 9, false, 8, true);
        }
        if (includeHistory && group.inactive.length > 0) {
          yPos += 2;
          addText('Inactive', 11, true, 5);
          yPos += 1;
          group.inactive.forEach(writeTask);
        }
        yPos += 3;
      });

      const attachmentRefs = exportedRows.flatMap((row) =>
        (row.item.attachments || [])
          .map((file) => file.name?.trim())
          .filter((name): name is string => Boolean(name))
          .map((fileName) => `${row.item.name} — ${fileName}`)
      );

      if (attachmentRefs.length > 0) {
        addSectionHeader('Attachments');
        addText('File names only. Files themselves are not included in this report.', 8, false, 5, true);
        attachmentRefs.forEach((line) => addText(line, 9, false, 8));
      }

      pdf.save(`Cleaning_Schedule_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      setShowExportPopup(false);
    } catch (error) {
      console.error('Error exporting cleaning schedule PDF:', error);
      showError(error instanceof Error ? error.message : 'Failed to generate PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={titleClass}>Cleaning Schedule</h2>
          <p className={descClass}>Activate household cleaning tasks, set a recurring schedule, and see what is due next.</p>
          {isLoading && <p className={`${descClass} mt-2`}>Loading...</p>}
        </div>
        <ExportPdfIconButton
          title="Export cleaning schedule to PDF"
          onClick={() => setShowExportPopup(true)}
        />
      </div>

      {banner && (
        <div className={banner.type === 'success' ? successBannerClass : errorBannerClass} role="status">
          {banner.text}
        </div>
      )}

      <div className={tabStripClass}>
        <div className="flex gap-2">
          {[
            { id: 'schedule', label: 'Schedule' },
            { id: 'library', label: 'Library' },
            { id: 'categories', label: 'Categories' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as TabId)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab.id ? tabActiveClass : tabInactiveClass}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'schedule' && (
        <div className="space-y-6">
          <div className={cardClass}>
            <div className="flex flex-wrap gap-2 mb-4">
              {RANGE_CHIPS.map((chip) => {
                const selected = range === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setRange(chip.id)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                      selected
                        ? isLight
                          ? 'border-emerald-400 bg-emerald-100 text-emerald-900'
                          : 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                        : isLight
                          ? 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                          : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className={compactLabelClass} htmlFor="cs-search">
                  Search
                </label>
                <input
                  id="cs-search"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tasks..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={compactLabelClass} htmlFor="cs-category-filter">
                  Filter by category
                </label>
                <select id="cs-category-filter" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectClass}>
                  <option value="all">All</option>
                  {sortedCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.isActive === false ? `${category.name} (archived)` : category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={compactLabelClass} htmlFor="cs-sort">
                  Sort
                </label>
                <select id="cs-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortId)} className={selectClass}>
                  <option value="nextDue">Next due date</option>
                  <option value="name">Task name</option>
                  <option value="category">Category</option>
                  <option value="frequency">Frequency</option>
                </select>
              </div>
            </div>

            {occurrences.length === 0 ? (
              <p className={`${mutedTextClass} text-center py-8`}>No cleaning tasks in this view. Activate items from the Library tab.</p>
            ) : range === 'next_3_months' ? (
              <div className="space-y-4">
                {occurrenceGroups.map((group) => {
                  const collapsed = collapsedGroupIds.includes(group.taskId);
                  return (
                    <div key={group.taskId}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className={headingSmClass}>{group.name}</h4>
                            {scheduledTasks.find((task) => task.id === group.taskId)?.addToDashboard && (
                              <OnCalendarChip isLight={isLight} />
                            )}
                          </div>
                          <p className={subTextClass}>
                            {group.categoryName} · {group.frequencyLabel} · {group.rows.length}{' '}
                            {group.rows.length === 1 ? 'occurrence' : 'occurrences'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleOccurrenceGroup(group.taskId)}
                          className={`text-sm shrink-0 ${mutedTextClass} hover:opacity-80 transition-colors`}
                        >
                          {collapsed ? 'Show' : 'Hide'} ({group.rows.length})
                        </button>
                      </div>
                      {!collapsed && <div className="space-y-3">{group.rows.map(renderOccurrenceRow)}</div>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">{occurrences.map(renderOccurrenceRow)}</div>
            )}
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={sectionTitleClass}>History</h3>
                <p className={`${subTextClass} mt-1`}>Completion records — same source as each task’s Completion history.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCompletionHistory(!showCompletionHistory)}
                className={`text-sm ${mutedTextClass} hover:opacity-80 transition-colors`}
              >
                {showCompletionHistory ? 'Hide' : 'Show'} ({completionHistoryRows.length})
              </button>
            </div>
            {showCompletionHistory &&
              (completionHistoryRows.length === 0 ? (
                <p className={`${mutedTextClass} text-center py-8`}>No completion records.</p>
              ) : (
                <div className="space-y-3">
                  {completionHistoryRows.map((row) => (
                    <div key={row.id} className={nestedCardClass}>
                      <div className="flex items-start justify-between gap-3">
                        <button type="button" onClick={() => openDetail(row.scheduledTaskId)} className="text-left min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h4 className={headingSmClass}>{row.name}</h4>
                            {row.categoryName && <span className={chipNeutralClass}>{row.categoryName}</span>}
                            <span className={chipNeutralClass}>{row.lateness}</span>
                          </div>
                          <p className={subTextClass}>
                            Scheduled {formatDateForDisplay(row.scheduledDate)} · Completed {formatDateForDisplay(row.completedDate)}
                          </p>
                        </button>
                        <AttachmentButton
                          count={row.attachments?.length ?? 0}
                          onClick={() => setAttachmentModal({ kind: 'completion', completionId: row.id })}
                          ariaLabel={`Completion files for ${row.name}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={sectionTitleClass}>Inactive history</h3>
                <p className={`${subTextClass} mt-1`}>Archived tasks. Completion records are in History above.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className={`text-sm ${mutedTextClass} hover:opacity-80 transition-colors`}
              >
                {showHistory ? 'Hide archived' : 'Archived'} ({historyTasks.length})
              </button>
            </div>
            {showHistory &&
              (historyTasks.length === 0 ? (
                <p className={`${mutedTextClass} text-center py-8`}>No archived tasks.</p>
              ) : (
                <div className="space-y-3">
                  {historyTasks.map((task) => {
                    const item = libraryItems.find((entry) => entry.id === task.libraryItemId);
                    if (!item) return null;
                    return (
                      <div key={task.id} className={`${nestedCardClass} ${isLight ? '' : 'opacity-80'}`}>
                        <div className="flex items-start justify-between">
                          <button type="button" onClick={() => openDetail(task.id)} className="text-left min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h4 className={headingSmClass}>{item.name}</h4>
                              <span className={chipNeutralClass}>{categoryName(item.categoryId)}</span>
                              {task.addToDashboard && <OnCalendarChip isLight={isLight} />}
                            </div>
                            <p className={subTextClass}>
                              {frequencyLabel(task.frequency)}
                              {task.dateInactivated ? ` · Moved ${formatDateForDisplay(task.dateInactivated)}` : ''}
                            </p>
                          </button>
                          <div className="flex shrink-0 items-center gap-1.5 ml-4">
                            <AttachmentButton
                              count={item.attachments?.length ?? 0}
                              onClick={() => setAttachmentModal({ kind: 'item', itemId: item.id })}
                              ariaLabel={`Library files for ${item.name}`}
                            />
                            <button
                              type="button"
                              onClick={() => reactivateTask(task.id)}
                              className={rowIconEmeraldClass}
                              aria-label="Reactivate"
                              title="Reactivate"
                            >
                              <RestoreIcon />
                            </button>
                            {!item.isDefault && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget({ kind: 'schedule', id: task.id })}
                                className={rowIconDangerClass}
                                aria-label="Delete permanently"
                                title="Delete permanently"
                              >
                                <DeleteIcon />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
          </div>
        </div>
      )}

      {activeTab === 'library' && (
        <div className="space-y-6">
          {!isAddingItem && (
            <div className="flex justify-start">
              <button type="button" onClick={startAddingItem} className={primaryButtonClass}>
                + Add New Cleaning Item
              </button>
            </div>
          )}
          {isAddingItem && (
            <div className={cardClass}>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className={sectionTitleClass}>Add New Cleaning Item</h3>
                <AttachmentButton
                  count={pendingItemAttachments.length}
                  onClick={() => setAttachmentModal({ kind: 'new-item' })}
                />
              </div>
              {renderItemFields(itemForm, setItemForm)}
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={addLibraryItem} disabled={!itemFormReady(itemForm) || isSaving} className={primaryButtonClass}>
                  Save
                </button>
                <button type="button" onClick={cancelAddingItem} className={secondaryButtonClass}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div
            className={`flex gap-4 rounded-2xl overflow-hidden ${
              isLight ? 'border border-slate-300 bg-white' : 'border border-slate-800 bg-slate-900/70'
            }`}
          >
            <div
              className={`w-1/4 min-w-0 flex-shrink-0 ${
                isLight ? 'border-r border-slate-200 bg-slate-50' : 'border-r border-slate-800 bg-slate-900/50'
              }`}
            >
              <div className="p-3">
                <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 px-2 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                  Categories
                </h3>
                <nav className="space-y-0.5" aria-label="Cleaning item categories">
                  {activeCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        setLibraryCategoryId(category.id);
                        setSelectedDefaultIds([]);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedLibraryCategory?.id === category.id
                          ? isLight
                            ? 'border border-emerald-300 bg-emerald-50 text-emerald-800'
                            : 'bg-emerald-500/20 text-emerald-300'
                          : isLight
                            ? 'text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
            <div className="flex-1 min-w-0 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className={isLight ? 'text-lg font-semibold text-emerald-700' : 'text-lg font-semibold text-emerald-300'}>
                  {selectedLibraryCategory?.name ?? 'Category'}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'available', label: 'Available' },
                      { id: 'scheduled', label: 'Scheduled' },
                      { id: 'hidden', label: 'Hidden defaults' },
                    ] as { id: LibraryFilter; label: string }[]
                  ).map((chip) => {
                    const selected = libraryFilter === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setLibraryFilter(chip.id)}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                          selected
                            ? isLight
                              ? 'border-emerald-400 bg-emerald-100 text-emerald-900'
                              : 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                            : isLight
                              ? 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                              : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {renderLibrarySection('Available', availableItems, 'No available items in this category.', 'available')}
              {renderLibrarySection('Scheduled', scheduledItems, 'No scheduled items in this category.', 'scheduled')}
              {renderLibrarySection('Hidden defaults', hiddenItems, 'No hidden defaults in this category.', 'hidden')}
            </div>
          </div>
        </div>
      )}

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
                <button type="button" onClick={addCategory} disabled={!newCategoryName.trim() || isSaving} className={primaryButtonClass}>
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
              <span className={subTextClass}>
                {activeCategories.length} active
                {archivedCategories.length > 0 ? ` · ${archivedCategories.length} archived` : ''}
              </span>
            </div>
            <div className="space-y-3">
              {activeCategories.map((category) => {
                const used = categoryUsage(category.id);
                return (
                  <div key={category.id} className={nestedCardClass}>
                    {editingCategoryId === category.id ? (
                      <div className="flex gap-3 flex-wrap items-end">
                        <div className="flex-1 min-w-[200px]">
                          <label className={compactLabelClass} htmlFor="cs-rename-category">
                            Category name
                          </label>
                          <input
                            id="cs-rename-category"
                            type="text"
                            value={editingCategoryName}
                            onChange={(e) => setEditingCategoryName(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <button type="button" onClick={saveCategoryEdit} disabled={!editingCategoryName.trim() || isSaving} className={primaryButtonClass}>
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategoryId(null);
                            setEditingCategoryName('');
                          }}
                          className={secondaryButtonClass}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h4 className={headingSmClass}>{category.name}</h4>
                            {category.isDefault && <span className={defaultBadgeClass}>Default</span>}
                            <span className={chipNeutralClass}>
                              {used} {used === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                        </div>
                        {!category.isDefault && (
                          <div className="flex shrink-0 items-center gap-2 ml-4">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategoryId(category.id);
                                setEditingCategoryName(category.name);
                              }}
                              className={compactPrimaryClass}
                              aria-label="Edit"
                              title="Edit category name"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => archiveCategory(category.id)}
                              disabled={isSaving}
                              className={secondaryButtonClass}
                              aria-label="Archive"
                              title="Archive category — keeps items and history"
                            >
                              Archive
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {archivedCategories.length > 0 && (
            <div className={cardClass}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={sectionTitleClass}>Archived categories</h3>
                  <p className={`${subTextClass} mt-1`}>Removed from active use. Items and history were kept.</p>
                </div>
              </div>
              <div className="space-y-3">
                {archivedCategories.map((category) => {
                  const used = categoryUsage(category.id);
                  return (
                    <div key={category.id} className={nestedCardClass}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h4 className={headingSmClass}>{category.name}</h4>
                            <span className={chipNeutralClass}>Archived</span>
                            <span className={chipNeutralClass}>
                              {used} {used === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => reactivateCategory(category.id)}
                          disabled={isSaving}
                          className={compactPrimaryClass}
                        >
                          Reactivate
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {showExportPopup && (
        <div className={overlayClass}>
          <div className={modalCardClass} role="dialog" aria-modal="true" aria-labelledby="cleaning-export-title">
            <div className="flex items-center justify-between mb-4">
              <h3 id="cleaning-export-title" className={sectionTitleClass}>Export Options</h3>
              <button
                type="button"
                onClick={() => !isExportingPdf && setShowExportPopup(false)}
                disabled={isExportingPdf}
                aria-label="Close modal"
                title="Close modal"
                className={iconButtonClass}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="space-y-4">
              <p className={descClass}>
                Attachment files are listed by name at the end.
              </p>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="includeHistoryExport"
                  checked={includeHistory}
                  onChange={(e) => setIncludeHistory(e.target.checked)}
                  disabled={isExportingPdf}
                  className={isLight
                    ? 'mt-0.5 h-4 w-4 rounded border-slate-400 text-emerald-600 focus:ring-emerald-500'
                    : 'mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500'}
                />
                <label htmlFor="includeHistoryExport" className={`${isLight ? 'text-slate-700' : 'text-slate-300'} cursor-pointer`}>
                  Include inactive scheduled tasks
                </label>
              </div>

              <fieldset className="space-y-2" disabled={isExportingPdf}>
                <legend className={`${labelClass} mb-0`}>Categories</legend>
                <label className={`flex items-start gap-3 ${isLight ? 'text-slate-700' : 'text-slate-300'} cursor-pointer`}>
                  <input
                    type="radio"
                    name="cleaningExportScope"
                    checked={exportAllCategories}
                    onChange={() => setExportAllCategories(true)}
                    className={isLight
                      ? 'mt-0.5 h-4 w-4 border-slate-400 text-emerald-600 focus:ring-emerald-500'
                      : 'mt-0.5 h-4 w-4 border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500'}
                  />
                  <span>All categories</span>
                </label>
                <label className={`flex items-start gap-3 ${isLight ? 'text-slate-700' : 'text-slate-300'} cursor-pointer`}>
                  <input
                    type="radio"
                    name="cleaningExportScope"
                    checked={!exportAllCategories}
                    onChange={() => {
                      setExportAllCategories(false);
                      if (!exportCategoryId && sortedCategories[0]) {
                        setExportCategoryId(sortedCategories[0].id);
                      }
                    }}
                    className={isLight
                      ? 'mt-0.5 h-4 w-4 border-slate-400 text-emerald-600 focus:ring-emerald-500'
                      : 'mt-0.5 h-4 w-4 border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500'}
                  />
                  <span>One category</span>
                </label>
                {!exportAllCategories && (
                  <div className="ml-7">
                    <label className={compactLabelClass} htmlFor="cleaning-export-category">
                      Category
                    </label>
                    <select
                      id="cleaning-export-category"
                      value={exportCategoryId}
                      onChange={(e) => setExportCategoryId(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Select a category</option>
                      {sortedCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.isActive === false ? `${category.name} (archived)` : category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </fieldset>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={exportToPDF}
                  disabled={isExportingPdf || (!exportAllCategories && !exportCategoryId)}
                  className={`flex-1 ${primaryButtonClass}`}
                >
                  {isExportingPdf ? 'Generating…' : 'Export to PDF'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowExportPopup(false)}
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

      {activateItemIds.length > 0 && (
        <div className={overlayClass}>
          <div className={modalCardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={sectionTitleClass}>
                {activateItemIds.length === 1
                  ? `Activate ${libraryItems.find((item) => item.id === activateItemIds[0])?.name ?? 'item'}`
                  : `Activate ${activateItemIds.length} default items`}
              </h3>
              <button
                type="button"
                onClick={() => setActivateItemIds([])}
                aria-label="Close modal"
                title="Close modal"
                className={iconButtonClass}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="space-y-4">
              <FrequencyFields form={activateForm} onChange={setActivateForm} classes={frequencyClasses} />
              <div>
                <label className={labelClass} htmlFor="cs-activate-next-due">
                  Next due date <span className="text-red-400">*</span>
                </label>
                <input
                  id="cs-activate-next-due"
                  type="date"
                  value={activateNextDue}
                  onChange={(e) => setActivateNextDue(e.target.value)}
                  className={inputClass}
                />
              </div>
              <ReminderDaysFields
                id="cs-activate-reminder-days"
                value={activateReminderDays}
                onChange={setActivateReminderDays}
                labelClass={labelClass}
                inputClass={inputClass}
                hintClass={mutedTextClass}
              />
              <DashboardCalendarSwitch
                isOn={activateAddToDashboard}
                isLight={isLight}
                onToggle={() => setActivateAddToDashboard((prev) => !prev)}
              />
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={saveActivation}
                  disabled={!activateNextDue || !isFrequencyFormValid(activateForm) || isSaving}
                  className={`flex-1 ${primaryButtonClass}`}
                >
                  Activate
                </button>
                <button type="button" onClick={() => setActivateItemIds([])} className={secondaryButtonClass}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {completeOccurrence && (
        <div className={overlayClass}>
          <div className={modalCardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={sectionTitleClass}>Complete task</h3>
              <div className="flex items-center gap-2">
                <AttachmentButton
                  count={pendingCompletionAttachments.length}
                  onClick={() => setAttachmentModal({ kind: 'new-completion' })}
                  ariaLabel="Files for this completion"
                />
                <button
                  type="button"
                  onClick={closeCompleteDialog}
                  aria-label="Close modal"
                  title="Close modal"
                  className={iconButtonClass}
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
            <p className={`${descClass} mb-4`}>Use today or the originally scheduled date as the completion date.</p>
            <div className="space-y-3 mb-6">
              <label className={radioLabelClass}>
                <input
                  type="radio"
                  name="cs-complete-basis"
                  checked={completeBasis === 'today'}
                  onChange={() => setCompleteBasis('today')}
                  className="rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                />
                Today ({formatDateForDisplay(today)})
              </label>
              <label className={radioLabelClass}>
                <input
                  type="radio"
                  name="cs-complete-basis"
                  checked={completeBasis === 'scheduled'}
                  onChange={() => setCompleteBasis('scheduled')}
                  className="rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                />
                Originally scheduled date ({formatDateForDisplay(completeOccurrence.scheduledDate)})
              </label>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={confirmComplete} disabled={isSaving} className={`flex-1 ${primaryButtonClass}`}>
                Complete
              </button>
              <button type="button" onClick={closeCompleteDialog} className={secondaryButtonClass}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {detailTask && detailItem && (
        <div className={overlayClass}>
          <div className={modalCardLgClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={sectionTitleClass}>{detailItem.name}</h3>
              <div className="flex items-center gap-2">
                <AttachmentButton
                  count={detailItem.attachments?.length ?? 0}
                  onClick={() => setAttachmentModal({ kind: 'item', itemId: detailItem.id })}
                  ariaLabel={`Library files for ${detailItem.name}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setDetailTaskId(null);
                    setDetailEditing(false);
                  }}
                  aria-label="Close modal"
                  title="Close modal"
                  className={iconButtonClass}
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            {detailEditing ? (
              <div className="space-y-4">
                {renderItemFields(detailItemForm, setDetailItemForm, detailItem)}
                <FrequencyFields form={detailForm} onChange={setDetailForm} classes={frequencyClasses} />
                <div>
                  <label className={labelClass} htmlFor="cs-detail-next-due">
                    Next due date <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="cs-detail-next-due"
                    type="date"
                    value={detailNextDue}
                    onChange={(e) => setDetailNextDue(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <ReminderDaysFields
                  id="cs-detail-reminder-days"
                  value={detailReminderDays}
                  onChange={setDetailReminderDays}
                  labelClass={labelClass}
                  inputClass={inputClass}
                  hintClass={mutedTextClass}
                />
                <DashboardCalendarSwitch
                  isOn={detailAddToDashboard}
                  isLight={isLight}
                  onToggle={() => setDetailAddToDashboard((prev) => !prev)}
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={saveDetail}
                    disabled={!detailNextDue || !isFrequencyFormValid(detailForm) || (!detailItem.isDefault && !detailItemForm.name.trim()) || isSaving}
                    className={primaryButtonClass}
                  >
                    Save
                  </button>
                  <button type="button" onClick={() => setDetailEditing(false)} className={secondaryButtonClass}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className={compactLabelClass}>Category</p>
                    <p className={bodyTextClass}>{categoryName(detailItem.categoryId)}</p>
                  </div>
                  <div>
                    <p className={compactLabelClass}>Frequency</p>
                    <p className={bodyTextClass}>{frequencyLabel(detailTask.frequency)}</p>
                  </div>
                  <div>
                    <p className={compactLabelClass}>Next due</p>
                    <p className={bodyTextClass}>{formatDateForDisplay(detailTask.nextDueDate)}</p>
                  </div>
                  <div>
                    <p className={compactLabelClass}>Reminder</p>
                    <p className={bodyTextClass}>{reminderSummary(detailTask.reminderDays)}</p>
                  </div>
                  <div>
                    <p className={compactLabelClass}>Dashboard calendar</p>
                    <p className={bodyTextClass}>{detailTask.addToDashboard ? 'On calendar' : 'Off'}</p>
                  </div>
                  <div>
                    <p className={compactLabelClass}>Last completed</p>
                    <p className={bodyTextClass}>{detailTask.lastCompletedDate ? formatDateForDisplay(detailTask.lastCompletedDate) : '—'}</p>
                  </div>
                </div>
                {detailItem.description && (
                  <div>
                    <p className={compactLabelClass}>Description</p>
                    <p className={bodyTextClass}>{detailItem.description}</p>
                  </div>
                )}
                {detailItem.notes && (
                  <div>
                    <p className={compactLabelClass}>Notes</p>
                    <p className={bodyTextClass}>{detailItem.notes}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setDetailEditing(true)} className={primaryButtonClass}>
                    Edit
                  </button>
                  {detailTask.isActive && (
                    <>
                      <button type="button" onClick={() => openComplete(detailTask.id, detailTask.nextDueDate)} className={primaryButtonClass}>
                        Complete
                      </button>
                      <button
                        type="button"
                        onClick={() => deactivateTask(detailTask.id)}
                        className={secondaryButtonClass}
                        title="Move to history — archive this task (inactive). Not completion history."
                      >
                        Move to history
                      </button>
                      <p className={`${subTextClass} w-full`}>
                        Move to history archives the task. It does not record a completion. Completion history is below.
                      </p>
                    </>
                  )}
                  {!detailTask.isActive && (
                    <button type="button" onClick={() => reactivateTask(detailTask.id)} className={primaryButtonClass}>
                      Reactivate
                    </button>
                  )}
                  {!detailItem.isDefault && !detailTask.isActive && (
                    <button type="button" onClick={() => setDeleteTarget({ kind: 'schedule', id: detailTask.id })} className={deleteButtonClass}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6">
              <h4 className={`${sectionTitleClass} mb-3`}>Completion history</h4>
              {detailHistory.length === 0 ? (
                <p className={subTextClass}>No completions yet.</p>
              ) : (
                <div className={`overflow-x-auto rounded-lg border ${isLight ? 'border-slate-200' : 'border-slate-700'}`}>
                  <table className="w-full text-sm">
                    <thead className={isLight ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-300'}>
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Scheduled date</th>
                        <th className="text-left px-3 py-2 font-medium">Completed date</th>
                        <th className="text-left px-3 py-2 font-medium">Lateness</th>
                        <th className="text-right px-3 py-2 font-medium">Files</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailHistory.map((row) => (
                        <tr key={row.id} className={isLight ? 'border-t border-slate-200' : 'border-t border-slate-700'}>
                          <td className={`px-3 py-2 ${bodyTextClass}`}>{formatDateForDisplay(row.scheduledDate)}</td>
                          <td className={`px-3 py-2 ${bodyTextClass}`}>{formatDateForDisplay(row.completedDate)}</td>
                          <td className={`px-3 py-2 ${bodyTextClass}`}>{row.lateness}</td>
                          <td className="px-3 py-2 text-right">
                            <AttachmentButton
                              count={row.attachments?.length ?? 0}
                              onClick={() => setAttachmentModal({ kind: 'completion', completionId: row.id })}
                              ariaLabel={`Completion files for ${formatDateForDisplay(row.completedDate)}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className={overlayClass}>
          <div className={modalCardClass}>
            <div className={deleteWarningBoxClass}>
              <p className={deleteWarningTextClass}>⚠️ This action cannot be undone</p>
              <p className={deleteWarningDetailClass}>{deleteCopy().detail}</p>
            </div>
            <h3 className={isLight ? 'text-xl font-semibold text-slate-900 mb-2' : 'text-xl font-semibold text-slate-50 mb-2'}>
              {deleteCopy().title}
            </h3>
            <p className={isLight ? 'text-slate-700 mb-4' : 'text-slate-300 mb-4'}>
              Type <strong className={isLight ? 'text-slate-900' : 'text-slate-200'}>delete</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className={deleteInputClass}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteConfirmText.trim().toLowerCase() !== 'delete' || isSaving}
                className={`flex-1 ${deleteButtonClass}`}
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
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
        onClose={() => {
          setAttachmentModal(null);
          setViewPreview(null);
        }}
        previewItem={viewPreview}
        title={modalTitle}
        files={modalFiles}
        busy={attachmentBusy}
        readOnly={attachmentModal?.kind === 'completion'}
        onAdd={(incoming) => {
          if (attachmentModal?.kind === 'new-item') {
            setPendingItemAttachments((prev) => [...prev, ...incoming.map(createPendingAttachment)]);
            return;
          }
          if (attachmentModal?.kind === 'new-completion') {
            setPendingCompletionAttachments((prev) => [...prev, ...incoming.map(createPendingAttachment)]);
            return;
          }
          if (attachmentModal?.kind === 'item') {
            void addSavedItemFiles(attachmentModal.itemId, incoming);
          }
        }}
        onRemove={(id) => {
          if (attachmentModal?.kind === 'new-item') {
            setPendingItemAttachments((prev) => {
              const next = prev.filter((item) => item.id !== id);
              const removed = prev.find((item) => item.id === id);
              if (removed?.url) URL.revokeObjectURL(removed.url);
              return next;
            });
            return;
          }
          if (attachmentModal?.kind === 'new-completion') {
            setPendingCompletionAttachments((prev) => {
              const next = prev.filter((item) => item.id !== id);
              const removed = prev.find((item) => item.id === id);
              if (removed?.url) URL.revokeObjectURL(removed.url);
              return next;
            });
            return;
          }
          if (attachmentModal?.kind === 'item') {
            void removeSavedItemFile(id);
          }
        }}
        onView={handleViewAttachment}
        onDownload={
          attachmentModal?.kind === 'new-item' || attachmentModal?.kind === 'new-completion'
            ? undefined
            : handleDownloadAttachment
        }
      />
    </div>
  );
}
