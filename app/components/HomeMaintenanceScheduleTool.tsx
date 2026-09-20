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
  compareIso,
  emptyServiceProvider,
  expandOccurrences,
  formatCost,
  HmsAttachment,
  HmsCategory,
  HmsCompletion,
  HmsFrequency,
  HmsFrequencyKind,
  HmsLibraryItem,
  HmsScheduledTask,
  HmsScheduleData,
  HmsServiceProvider,
  isFrequencyValid,
  isProviderEmpty,
  MONTHS,
  parseLocalDate,
  seasonWindow,
  sumCosts,
  todayIso,
  yearWindow,
} from '@/lib/home-maintenance-schedule';

/**
 * Home Maintenance Schedule — persists via /api/tools/home-maintenance-schedule.
 * Occurrences are expanded in memory for the visible date window only.
 * Category icons may come later.
 */

const API_BASE = '/api/tools/home-maintenance-schedule';

export type {
  HmsAttachment,
  HmsCategory,
  HmsCompletion,
  HmsFrequency,
  HmsFrequencyKind,
  HmsLibraryItem,
  HmsScheduledTask,
  HmsServiceProvider,
};

type HomeMaintenanceScheduleToolProps = {
  toolId?: string;
};

type TabId = 'schedule' | 'library' | 'categories';
type RangeId =
  | 'overdue'
  | 'this_week'
  | 'this_month'
  | 'this_season'
  | 'next_3_months'
  | 'this_year'
  | 'all_active'
  | 'completed';
type SortId = 'nextDue' | 'name' | 'category' | 'frequency';
type LibraryFilter = 'all' | 'available' | 'scheduled' | 'hidden';
type OccurrenceStatus = 'Overdue' | 'Due today' | 'Due soon' | 'Upcoming' | 'Completed';

type FrequencyForm = {
  kind: HmsFrequencyKind;
  intervalCount: number;
  intervalUnit: 'days' | 'weeks' | 'months' | 'years';
  daysOfWeek: number[];
  dayOfMonth: number;
  months: number[];
  intervalYears: number;
};

type ItemForm = {
  name: string;
  categoryId: string;
  newCategoryName: string;
  creatingCategory: boolean;
  description: string;
  notes: string;
  defaultLocation: string;
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
  location: string;
  categoryName: string;
  frequencyLabel: string;
  status: OccurrenceStatus;
};

type CompletedRow = {
  completionId: string;
  taskId: string;
  name: string;
  categoryName: string;
  scheduledDate: string;
  completedDate: string;
  lateness: HmsCompletion['lateness'];
  cost: number | null;
  notes: string;
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

const FREQUENCY_OPTIONS: { value: HmsFrequencyKind; label: string }[] = [
  { value: 'every_x_days', label: 'Every X days' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'every_x_weeks', label: 'Every X weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'every_x_months', label: 'Every X months' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'every_6_months', label: 'Every 6 months' },
  { value: 'annually', label: 'Annually' },
  { value: 'every_x_years', label: 'Every X years' },
  { value: 'specific_months', label: 'Specific months' },
  { value: 'custom', label: 'Custom' },
];

const RANGE_CHIPS: { id: RangeId; label: string }[] = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'this_week', label: 'This Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'this_season', label: 'This Season' },
  { id: 'next_3_months', label: 'Next 3 Months' },
  { id: 'this_year', label: 'This Year' },
  { id: 'all_active', label: 'All Active' },
  { id: 'completed', label: 'Completed' },
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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function endOfWeek(iso: string): string {
  return addDays(startOfWeek(iso), 6);
}

function startOfMonth(iso: string): string {
  const date = parseLocalDate(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function endOfMonth(iso: string): string {
  const date = parseLocalDate(iso);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}

function occurrenceStatus(date: string, today: string): OccurrenceStatus {
  if (compareIso(date, today) < 0) return 'Overdue';
  if (date === today) return 'Due today';
  if (compareIso(date, addDays(today, 14)) <= 0) return 'Due soon';
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
  return `${labels.slice(0, -1).join(', ')}, and ${labels.slice(-1)}`;
}

function monthNames(months: number[]): string {
  const labels = MONTHS.filter((month) => months.includes(month.value)).map((month) => month.label);
  if (labels.length === 0) return 'selected months';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels.slice(-1)}`;
}

function frequencyLabel(frequency: HmsFrequency): string {
  const count = Math.max(1, frequency.intervalCount ?? 1);
  switch (frequency.kind) {
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
    case 'every_x_years':
      return count === 1 ? 'Every year' : `Every ${count} years`;
    case 'specific_months': {
      const years = Math.max(1, frequency.intervalYears ?? 1);
      const months = monthNames(frequency.months ?? []);
      if (years === 1) return `Every ${months}`;
      return `Every ${years} years in ${months}`;
    }
    case 'custom':
      if (frequency.intervalUnit === 'weeks') return count === 1 ? 'Every week' : `Every ${count} weeks`;
      if (frequency.intervalUnit === 'months') return count === 1 ? 'Every month' : `Every ${count} months`;
      if (frequency.intervalUnit === 'years') return count === 1 ? 'Every year' : `Every ${count} years`;
      return count === 1 ? 'Every day' : `Every ${count} days`;
    default:
      return 'Custom';
  }
}

function emptyFrequencyForm(today: string): FrequencyForm {
  const date = parseLocalDate(today);
  return {
    kind: 'annually',
    intervalCount: 1,
    intervalUnit: 'days',
    daysOfWeek: [date.getDay()],
    dayOfMonth: date.getDate(),
    months: [date.getMonth() + 1],
    intervalYears: 1,
  };
}

function frequencyToForm(frequency: HmsFrequency, today: string): FrequencyForm {
  const fallback = emptyFrequencyForm(today);
  return {
    kind: frequency.kind,
    intervalCount: Math.max(1, frequency.intervalCount ?? 1),
    intervalUnit: frequency.intervalUnit ?? 'days',
    daysOfWeek: frequency.daysOfWeek?.length ? [...frequency.daysOfWeek] : fallback.daysOfWeek,
    dayOfMonth: frequency.dayOfMonth ?? fallback.dayOfMonth,
    months: frequency.months?.length ? [...frequency.months] : fallback.months,
    intervalYears: Math.max(1, frequency.intervalYears ?? 1),
  };
}

function formToFrequency(form: FrequencyForm, nextDueDate?: string): HmsFrequency {
  const frequency: HmsFrequency = { kind: form.kind };
  if (
    form.kind === 'every_x_days' ||
    form.kind === 'every_x_weeks' ||
    form.kind === 'every_x_months' ||
    form.kind === 'every_x_years' ||
    form.kind === 'custom'
  ) {
    frequency.intervalCount = Math.max(1, form.intervalCount);
  }
  if (form.kind === 'custom') frequency.intervalUnit = form.intervalUnit;
  if (form.kind === 'weekly') frequency.daysOfWeek = [...form.daysOfWeek];
  if (
    form.kind === 'monthly' ||
    form.kind === 'every_x_months' ||
    form.kind === 'quarterly' ||
    form.kind === 'every_6_months' ||
    form.kind === 'annually' ||
    form.kind === 'every_x_years' ||
    form.kind === 'custom'
  ) {
    frequency.dayOfMonth = form.dayOfMonth;
  }
  if (form.kind === 'specific_months') {
    frequency.months = [...form.months];
    frequency.intervalYears = Math.max(1, form.intervalYears);
    frequency.dayOfMonth = nextDueDate ? parseLocalDate(nextDueDate).getDate() : form.dayOfMonth;
  }
  return frequency;
}

function isFrequencyFormValid(form: FrequencyForm): boolean {
  return isFrequencyValid(formToFrequency(form));
}

function emptyItemForm(): ItemForm {
  return {
    name: '',
    categoryId: '',
    newCategoryName: '',
    creatingCategory: false,
    description: '',
    notes: '',
    defaultLocation: '',
  };
}

function rangeWindow(range: RangeId, today: string): { start: string; end: string } | null {
  if (range === 'overdue') return { start: '0001-01-01', end: addDays(today, -1) };
  if (range === 'this_week') return { start: startOfWeek(today), end: endOfWeek(today) };
  if (range === 'this_month') return { start: startOfMonth(today), end: endOfMonth(today) };
  if (range === 'this_season') return seasonWindow(today);
  if (range === 'next_3_months') return { start: today, end: addMonthsSetDay(today, 3) };
  if (range === 'this_year') return yearWindow(today);
  return null;
}

function snippet(text: string, max = 80): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

function parseCostInput(value: string): number | null | 'invalid' {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) return 'invalid';
  return amount;
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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
  idPrefix,
}: {
  form: FrequencyForm;
  onChange: (next: FrequencyForm) => void;
  classes: ThemeClasses;
  idPrefix: string;
}) {
  const { isLight, labelClass, inputClass, selectClass, mutedTextClass } = classes;
  const needsCount =
    form.kind === 'every_x_days' ||
    form.kind === 'every_x_weeks' ||
    form.kind === 'every_x_months' ||
    form.kind === 'every_x_years' ||
    form.kind === 'custom';
  const needsMonthDay = form.kind === 'monthly';

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-frequency-kind`}>
          Frequency <span className="text-red-400">*</span>
        </label>
        <select
          id={`${idPrefix}-frequency-kind`}
          value={form.kind}
          onChange={(e) => onChange({ ...form, kind: e.target.value as HmsFrequencyKind })}
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
            <label className={labelClass} htmlFor={`${idPrefix}-frequency-count`}>
              Repeat every <span className="text-red-400">*</span>
            </label>
            <input
              id={`${idPrefix}-frequency-count`}
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
              <label className={labelClass} htmlFor={`${idPrefix}-frequency-unit`}>
                Unit <span className="text-red-400">*</span>
              </label>
              <select
                id={`${idPrefix}-frequency-unit`}
                value={form.intervalUnit}
                onChange={(e) => onChange({ ...form, intervalUnit: e.target.value as FrequencyForm['intervalUnit'] })}
                className={selectClass}
              >
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
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
          <label className={labelClass} htmlFor={`${idPrefix}-frequency-dom`}>
            Day of month
          </label>
          <select
            id={`${idPrefix}-frequency-dom`}
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

      {form.kind === 'specific_months' && (
        <div className="space-y-4">
          <div>
            <p className={labelClass}>
              Months <span className="text-red-400">*</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {MONTHS.map((month) => {
                const selected = form.months.includes(month.value);
                return (
                  <button
                    key={month.value}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...form,
                        months: selected
                          ? form.months.filter((value) => value !== month.value)
                          : [...form.months, month.value],
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
                    {month.short}
                  </button>
                );
              })}
            </div>
            {form.months.length === 0 && <p className={`text-xs mt-1 ${mutedTextClass}`}>Select at least one month</p>}
          </div>
          <div>
            <label className={labelClass} htmlFor={`${idPrefix}-interval-years`}>
              Every X years
            </label>
            <input
              id={`${idPrefix}-interval-years`}
              type="number"
              min={1}
              step={1}
              value={form.intervalYears}
              onChange={(e) => onChange({ ...form, intervalYears: Math.max(1, Number(e.target.value) || 1) })}
              className={inputClass}
            />
            <p className={`text-xs mt-1 ${mutedTextClass}`}>Use 1 for every year in the selected months.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderFields({
  provider,
  onChange,
  classes,
  idPrefix,
}: {
  provider: HmsServiceProvider;
  onChange: (next: HmsServiceProvider) => void;
  classes: ThemeClasses;
  idPrefix: string;
}) {
  const { labelClass, inputClass } = classes;
  const textareaClass = `${inputClass} resize-none`;
  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-provider-name`}>
          Company / provider
        </label>
        <input
          id={`${idPrefix}-provider-name`}
          type="text"
          value={provider.name}
          onChange={(e) => onChange({ ...provider, name: e.target.value })}
          placeholder="e.g., ABC Heating"
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor={`${idPrefix}-provider-phone`}>
            Phone
          </label>
          <input
            id={`${idPrefix}-provider-phone`}
            type="text"
            value={provider.phone}
            onChange={(e) => onChange({ ...provider, phone: e.target.value })}
            placeholder="Optional"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor={`${idPrefix}-provider-website`}>
            Website
          </label>
          <input
            id={`${idPrefix}-provider-website`}
            type="text"
            value={provider.website}
            onChange={(e) => onChange({ ...provider, website: e.target.value })}
            placeholder="Optional"
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-provider-notes`}>
          Provider notes
        </label>
        <textarea
          id={`${idPrefix}-provider-notes`}
          value={provider.notes}
          onChange={(e) => onChange({ ...provider, notes: e.target.value })}
          rows={2}
          placeholder="Account number, preferred tech, etc."
          className={textareaClass}
        />
      </div>
    </div>
  );
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

export function HomeMaintenanceScheduleTool({ toolId }: HomeMaintenanceScheduleToolProps) {
  const { showError } = useAppNotice();

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
  const completeOverlayClass = `${overlayClass} overflow-y-auto p-4`;
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
  const optionalToggleClass = isLight
    ? 'text-sm font-medium text-emerald-800 hover:text-emerald-900'
    : 'text-sm font-medium text-emerald-300 hover:text-emerald-200';

  const frequencyClasses: ThemeClasses = { isLight, labelClass, inputClass, selectClass, mutedTextClass };

  const [categories, setCategories] = useState<HmsCategory[]>([]);
  const [libraryItems, setLibraryItems] = useState<HmsLibraryItem[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<HmsScheduledTask[]>([]);
  const [completions, setCompletions] = useState<HmsCompletion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<TabId>('schedule');
  const [range, setRange] = useState<RangeId>('this_month');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortId>('nextDue');
  const [showHistory, setShowHistory] = useState(false);
  const [libraryCategoryId, setLibraryCategoryId] = useState('');
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('all');

  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemForm, setEditItemForm] = useState<ItemForm>(emptyItemForm);

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  const [activateItemId, setActivateItemId] = useState<string | null>(null);
  const [activateForm, setActivateForm] = useState<FrequencyForm>(() => emptyFrequencyForm(todayIso()));
  const [activateNextDue, setActivateNextDue] = useState(todayIso);
  const [activateLocation, setActivateLocation] = useState('');
  const [activateNotes, setActivateNotes] = useState('');
  const [activateProvider, setActivateProvider] = useState<HmsServiceProvider>(emptyServiceProvider);
  const [activateReminderDays, setActivateReminderDays] = useState<number | null>(null);
  const [activateAddToDashboard, setActivateAddToDashboard] = useState(false);
  const [showActivateOptional, setShowActivateOptional] = useState(false);

  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [detailEditing, setDetailEditing] = useState(false);
  const [detailForm, setDetailForm] = useState<FrequencyForm>(() => emptyFrequencyForm(todayIso()));
  const [detailNextDue, setDetailNextDue] = useState(todayIso);
  const [detailItemForm, setDetailItemForm] = useState<ItemForm>(emptyItemForm);
  const [detailLocation, setDetailLocation] = useState('');
  const [detailNotes, setDetailNotes] = useState('');
  const [detailDescription, setDetailDescription] = useState('');
  const [detailProvider, setDetailProvider] = useState<HmsServiceProvider>(emptyServiceProvider);
  const [detailReminderDays, setDetailReminderDays] = useState<number | null>(null);
  const [detailAddToDashboard, setDetailAddToDashboard] = useState(false);

  const [completeOccurrence, setCompleteOccurrence] = useState<{ taskId: string; scheduledDate: string } | null>(null);
  const [completeBasis, setCompleteBasis] = useState<'today' | 'scheduled'>('today');
  const [completeNotes, setCompleteNotes] = useState('');
  const [completeCost, setCompleteCost] = useState('');
  const [showCompleteOptional, setShowCompleteOptional] = useState(false);
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

  const applyData = useCallback((data: HmsScheduleData) => {
    const nextCategories = data.categories ?? [];
    setCategories(nextCategories);
    setLibraryItems((data.items ?? []).map((item) => ({ ...item, attachments: item.attachments ?? [] })));
    setScheduledTasks(data.tasks ?? []);
    setCompletions((data.completions ?? []).map((row) => ({ ...row, attachments: row.attachments ?? [] })));
    setLibraryCategoryId((prev) => {
      if (prev && nextCategories.some((category) => category.id === prev)) return prev;
      return [...nextCategories].sort((a, b) => a.name.localeCompare(b.name))[0]?.id ?? '';
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
        throw new Error(data.error || 'Request failed');
      }
      if (data.categories) applyData(data as HmsScheduleData);
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
    const data = await response.json().catch(() => ({ error: 'Failed to load Home Maintenance Schedule' }));
    if (!response.ok) throw new Error(data.error || 'Failed to load Home Maintenance Schedule');
    applyData(data as HmsScheduleData);
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
        showBanner('error', error instanceof Error ? error.message : 'Failed to load Home Maintenance Schedule');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [toolId, refreshData]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (attachmentModal) {
        setAttachmentModal(null);
        setViewPreview(null);
        return;
      }
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
        setCompleteOccurrence(null);
        return;
      }
      if (activateItemId) {
        setActivateItemId(null);
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
  }, [attachmentModal, deleteTarget, completeOccurrence, pendingCompletionAttachments, activateItemId, detailTaskId, showExportPopup, isExportingPdf]);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  const categoryName = (categoryId: string) => categories.find((category) => category.id === categoryId)?.name ?? 'Uncategorized';
  const itemAttachmentCount = (itemId: string) =>
    libraryItems.find((item) => item.id === itemId)?.attachments?.length ?? 0;
  const completionAttachmentCount = (completionId: string) =>
    completions.find((row) => row.id === completionId)?.attachments?.length ?? 0;

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
      ? itemForm.name.trim() || 'New maintenance item'
      : attachmentModal?.kind === 'new-completion'
        ? 'This completion'
        : attachmentModal?.kind === 'item'
          ? savedItemForModal?.name || 'Maintenance item'
          : attachmentModal?.kind === 'completion'
            ? savedCompletionForModal
              ? `Completed ${formatDateForDisplay(savedCompletionForModal.completedDate)}`
              : 'Completion'
            : 'Attachments';

  const fetchHmsAttachmentBlob = async (attachmentId: string, inline = false) => {
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
      const blob = await fetchHmsAttachmentBlob(item.id, true);
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
      const blob = await fetchHmsAttachmentBlob(item.id);
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

  const uploadHmsFile = async (file: File, owner: { itemId?: string; completionId?: string }) => {
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

  const addSavedItemFiles = async (itemId: string, files: File[]) => {
    setAttachmentBusy(true);
    try {
      for (const file of files) {
        await uploadHmsFile(file, { itemId });
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

  const revokePending = (items: AttachmentItem[]) => {
    items.forEach((item) => {
      if (item.url) URL.revokeObjectURL(item.url);
    });
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
    const map = new Map<string, HmsScheduledTask>();
    scheduledTasks.filter((task) => task.isActive).forEach((task) => map.set(task.libraryItemId, task));
    return map;
  }, [scheduledTasks]);

  const scheduleByItem = useMemo(() => {
    const map = new Map<string, HmsScheduledTask>();
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
    const item = libraryItems.find((entry) => entry.id === itemId);
    setActivateItemId(itemId);
    setActivateForm(existing ? frequencyToForm(existing.frequency, today) : emptyFrequencyForm(today));
    setActivateNextDue(existing?.nextDueDate || today);
    setActivateLocation(existing?.location || item?.defaultLocation || '');
    setActivateNotes(existing?.notes || '');
    setActivateProvider(existing?.serviceProvider ? { ...existing.serviceProvider } : emptyServiceProvider());
    setActivateReminderDays(existing?.reminderDays ?? null);
    setActivateAddToDashboard(existing?.addToDashboard === true);
    setShowActivateOptional(false);
  };

  const saveActivation = async () => {
    if (!activateItemId || !activateNextDue || !isFrequencyFormValid(activateForm) || isSaving) return;
    const item = libraryItems.find((entry) => entry.id === activateItemId);
    if (!item) return;
    setIsSaving(true);
    try {
      await postAction({
        action: 'activateTask',
        itemId: activateItemId,
        frequency: formToFrequency(activateForm, activateNextDue),
        nextDueDate: activateNextDue,
        location: activateLocation.trim(),
        scheduleNotes: activateNotes.trim(),
        reminderDays: activateReminderDays,
        serviceProvider: activateProvider,
        addToDashboard: activateAddToDashboard,
      });
      setActivateItemId(null);
      showBanner('success', `${item.name} is now on the schedule.`);
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
    setDetailLocation(task.location);
    setDetailNotes(task.notes);
    setDetailDescription(item.isDefault ? task.descriptionOverride : item.description);
    setDetailProvider({ ...task.serviceProvider });
    setDetailReminderDays(task.reminderDays);
    setDetailAddToDashboard(task.addToDashboard === true);
    setDetailItemForm({
      name: item.name,
      categoryId: item.categoryId,
      newCategoryName: '',
      creatingCategory: false,
      description: item.description,
      notes: item.notes,
      defaultLocation: item.defaultLocation,
    });
  };

  const saveDetail = async () => {
    if (!detailTaskId || !detailNextDue || !isFrequencyFormValid(detailForm) || isSaving) return;
    const task = scheduledTasks.find((entry) => entry.id === detailTaskId);
    const item = task ? libraryItems.find((entry) => entry.id === task.libraryItemId) : undefined;
    if (!task || !item) return;
    if (!detailItemForm.name.trim()) return;
    setIsSaving(true);
    try {
      await postAction({
        action: 'updateSchedule',
        taskId: task.id,
        itemId: item.id,
        name: detailItemForm.name.trim(),
        description: detailItemForm.description.trim(),
        notes: detailItemForm.notes.trim(),
        defaultLocation: detailItemForm.defaultLocation.trim(),
        ...itemCategoryPayload(detailItemForm),
        frequency: formToFrequency(detailForm, detailNextDue),
        nextDueDate: detailNextDue,
        location: detailLocation.trim(),
        scheduleNotes: detailNotes.trim(),
        descriptionOverride: item.isDefault ? detailDescription.trim() : '',
        reminderDays: detailReminderDays,
        serviceProvider: detailProvider,
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
      showBanner('success', 'Moved to history.');
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Failed to move task to history');
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
      openDetail(taskId, false);
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Failed to reactivate task');
    } finally {
      setIsSaving(false);
    }
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
    setCompleteNotes('');
    setCompleteCost('');
    setShowCompleteOptional(false);
  };

  const confirmComplete = async () => {
    if (!completeOccurrence || isSaving) return;
    const task = scheduledTasks.find((entry) => entry.id === completeOccurrence.taskId);
    const item = task ? libraryItems.find((entry) => entry.id === task.libraryItemId) : undefined;
    if (!task) return;
    const cost = parseCostInput(completeCost);
    if (cost === 'invalid') {
      showBanner('error', 'Enter a valid cost or leave it blank.');
      return;
    }
    setIsSaving(true);
    try {
      const data = await postAction({
        action: 'completeTask',
        taskId: task.id,
        scheduledDate: completeOccurrence.scheduledDate,
        completeBasis,
        completedDate: completeBasis === 'today' ? today : undefined,
        completionNotes: completeNotes.trim(),
        cost,
      });
      const completionId = typeof data.completionId === 'string' ? data.completionId : '';
      if (completionId && pendingCompletionAttachments.length > 0) {
        try {
          for (const queued of pendingCompletionAttachments) {
            if (!queued.file) continue;
            await uploadHmsFile(queued.file, { completionId });
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
        defaultLocation: itemForm.defaultLocation.trim(),
        ...itemCategoryPayload(itemForm),
      });
      const createdItemId = typeof data.createdItemId === 'string' ? data.createdItemId : '';
      if (createdItemId && pendingItemAttachments.length > 0) {
        try {
          for (const queued of pendingItemAttachments) {
            if (!queued.file) continue;
            await uploadHmsFile(queued.file, { itemId: createdItemId });
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
      showBanner('success', 'Maintenance item added.');
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Failed to add item');
    } finally {
      setIsSaving(false);
    }
  };

  const startEditItem = (item: HmsLibraryItem) => {
    setEditingItemId(item.id);
    setEditItemForm({
      name: item.name,
      categoryId: item.categoryId,
      newCategoryName: '',
      creatingCategory: false,
      description: item.description,
      notes: item.notes,
      defaultLocation: item.defaultLocation,
    });
  };

  const saveEditItem = async () => {
    if (!editingItemId || !itemFormReady(editItemForm) || isSaving) return;
    setIsSaving(true);
    try {
      const data = await postAction({
        action: 'updateItem',
        itemId: editingItemId,
        name: editItemForm.name.trim(),
        description: editItemForm.description.trim(),
        notes: editItemForm.notes.trim(),
        defaultLocation: editItemForm.defaultLocation.trim(),
        ...itemCategoryPayload(editItemForm),
      });
      if (typeof data.createdCategoryId === 'string') setLibraryCategoryId(data.createdCategoryId);
      else if (!editItemForm.creatingCategory && editItemForm.categoryId) setLibraryCategoryId(editItemForm.categoryId);
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
      const created = (data.categories as HmsCategory[] | undefined)?.find(
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
        detail: 'This custom maintenance item and any schedule or completion history for it will be removed.',
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
    if (range === 'completed') return [];
    const active = scheduledTasks.filter((task) => task.isActive);
    const window = rangeWindow(range, today);
    const rows: OccurrenceRow[] = [];
    active.forEach((task) => {
      const item = libraryItems.find((entry) => entry.id === task.libraryItemId);
      if (!item) return;
      const dates = window ? expandOccurrences(task.nextDueDate, task.frequency, window.start, window.end) : [task.nextDueDate];
      dates.forEach((date) => {
        rows.push({
          taskId: task.id,
          itemId: item.id,
          date,
          name: item.name,
          location: task.location,
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
        row.frequencyLabel.toLowerCase().includes(query) ||
        row.location.toLowerCase().includes(query)
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

  const completedRows = useMemo(() => {
    if (range !== 'completed') return [];
    const year = parseLocalDate(today).getFullYear();
    const rows: CompletedRow[] = completions
      .filter((row) => parseLocalDate(row.completedDate).getFullYear() === year)
      .map((row) => {
        const task = scheduledTasks.find((entry) => entry.id === row.scheduledTaskId);
        const item = task ? libraryItems.find((entry) => entry.id === task.libraryItemId) : undefined;
        return {
          completionId: row.id,
          taskId: row.scheduledTaskId,
          name: item?.name ?? 'Maintenance task',
          categoryName: item ? categoryName(item.categoryId) : 'Uncategorized',
          scheduledDate: row.scheduledDate,
          completedDate: row.completedDate,
          lateness: row.lateness,
          cost: row.cost,
          notes: row.notes,
        };
      });
    const query = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (categoryFilter !== 'all') {
        const task = scheduledTasks.find((entry) => entry.id === row.taskId);
        const item = task ? libraryItems.find((entry) => entry.id === task.libraryItemId) : undefined;
        if (!item || item.categoryId !== categoryFilter) return false;
      }
      if (!query) return true;
      return (
        row.name.toLowerCase().includes(query) ||
        row.categoryName.toLowerCase().includes(query) ||
        row.notes.toLowerCase().includes(query)
      );
    });
    filtered.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name) || compareIso(b.completedDate, a.completedDate);
      if (sortBy === 'category') return a.categoryName.localeCompare(b.categoryName) || compareIso(b.completedDate, a.completedDate);
      return compareIso(b.completedDate, a.completedDate) || a.name.localeCompare(b.name);
    });
    return filtered;
  }, [range, completions, scheduledTasks, libraryItems, categories, search, categoryFilter, sortBy, today]);

  const historyTasks = scheduledTasks.filter((task) => !task.isActive);
  const historyCompletionRows = useMemo(() => {
    const rows: CompletedRow[] = completions.map((row) => {
      const task = scheduledTasks.find((entry) => entry.id === row.scheduledTaskId);
      const item = task ? libraryItems.find((entry) => entry.id === task.libraryItemId) : undefined;
      return {
        completionId: row.id,
        taskId: row.scheduledTaskId,
        name: item?.name ?? 'Maintenance task',
        categoryName: item ? categoryName(item.categoryId) : 'Uncategorized',
        scheduledDate: row.scheduledDate,
        completedDate: row.completedDate,
        lateness: row.lateness,
        cost: row.cost,
        notes: row.notes,
      };
    });
    rows.sort((a, b) => compareIso(b.completedDate, a.completedDate) || a.name.localeCompare(b.name));
    return rows;
  }, [completions, scheduledTasks, libraryItems, categories]);
  const historyCount = historyCompletionRows.length + historyTasks.length;
  const selectedLibraryCategory = categories.find((category) => category.id === libraryCategoryId) ?? sortedCategories[0];
  const libraryQuery = librarySearch.trim().toLowerCase();
  const libraryItemMatches = (item: HmsLibraryItem) => {
    if (!libraryQuery) return true;
    return (
      item.name.toLowerCase().includes(libraryQuery) ||
      item.description.toLowerCase().includes(libraryQuery) ||
      item.notes.toLowerCase().includes(libraryQuery) ||
      item.defaultLocation.toLowerCase().includes(libraryQuery) ||
      categoryName(item.categoryId).toLowerCase().includes(libraryQuery)
    );
  };
  const visibleLibraryCategories = libraryQuery
    ? sortedCategories.filter(
        (category) =>
          category.name.toLowerCase().includes(libraryQuery) ||
          libraryItems.some((item) => item.categoryId === category.id && libraryItemMatches(item))
      )
    : sortedCategories;
  const visibleLibraryItems = libraryItems
    .filter((item) => (libraryQuery ? libraryItemMatches(item) : item.categoryId === selectedLibraryCategory?.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const availableItems = visibleLibraryItems.filter((item) => !item.isHidden && !activeScheduleByItem.has(item.id));
  const scheduledItems = visibleLibraryItems.filter((item) => activeScheduleByItem.has(item.id));
  const hiddenItems = visibleLibraryItems.filter((item) => item.isDefault && item.isHidden);
  const libraryScopeHint = libraryQuery ? '.' : ' in this category.';

  const detailTask = scheduledTasks.find((task) => task.id === detailTaskId);
  const detailItem = detailTask ? libraryItems.find((item) => item.id === detailTask.libraryItemId) : undefined;
  const detailHistory = detailTask
    ? completions.filter((row) => row.scheduledTaskId === detailTask.id).sort((a, b) => compareIso(b.completedDate, a.completedDate))
    : [];
  const lifetimeCost = sumCosts(detailHistory);
  const thisYearCost = sumCosts(
    detailHistory.filter((row) => parseLocalDate(row.completedDate).getFullYear() === parseLocalDate(today).getFullYear())
  );
  const detailDescriptionDisplay = detailTask?.descriptionOverride.trim() || detailItem?.description || '';

  const statusBadgeClass = (status: OccurrenceStatus) => {
    if (status === 'Overdue') {
      return isLight
        ? 'px-1.5 py-0.5 rounded text-xs font-medium border border-red-300 bg-red-50 text-red-800'
        : 'px-1.5 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-300';
    }
    if (status === 'Due today') {
      return isLight
        ? 'px-1.5 py-0.5 rounded text-xs font-medium border border-amber-300 bg-amber-50 text-amber-900'
        : 'px-1.5 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-300';
    }
    if (status === 'Due soon') {
      return isLight
        ? 'px-1.5 py-0.5 rounded text-xs font-medium border border-sky-300 bg-sky-50 text-sky-800'
        : 'px-1.5 py-0.5 rounded text-xs font-medium bg-sky-500/20 text-sky-300';
    }
    if (status === 'Completed') {
      return isLight
        ? 'px-1.5 py-0.5 rounded text-xs font-medium border border-emerald-300 bg-emerald-50 text-emerald-800'
        : 'px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300';
    }
    return isLight
      ? 'px-1.5 py-0.5 rounded text-xs font-medium border border-slate-300 bg-slate-100 text-slate-700'
      : 'px-1.5 py-0.5 rounded text-xs font-medium bg-slate-700/50 text-slate-300';
  };

  const renderItemFields = (form: ItemForm, onChange: (next: ItemForm) => void, item?: HmsLibraryItem) => {
    const lockDescription = Boolean(item?.isDefault);
    return (
      <div className="space-y-4">
        <div>
          <label className={compactLabelClass} htmlFor={`hms-item-name-${item?.id ?? 'new'}`}>
            Name <span className="text-red-400">*</span>
          </label>
          <input
            id={`hms-item-name-${item?.id ?? 'new'}`}
            type="text"
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="e.g., Replace furnace/HVAC filter"
            className={inputClass}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={compactLabelClass} htmlFor={`hms-item-category-${item?.id ?? 'new'}`}>
              Category <span className="text-red-400">*</span>
            </label>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...form,
                  creatingCategory: !form.creatingCategory,
                  newCategoryName: '',
                  categoryId: form.creatingCategory ? form.categoryId : '',
                })
              }
              className={
                isLight
                  ? 'px-2 py-1 rounded-lg border-2 border-slate-400 bg-slate-100 text-xs font-medium text-slate-800 hover:bg-slate-200 transition-colors'
                  : 'px-2 py-1 rounded border border-slate-600 bg-slate-800 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors'
              }
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
              id={`hms-item-category-${item?.id ?? 'new'}`}
              value={form.categoryId}
              onChange={(e) => onChange({ ...form, categoryId: e.target.value })}
              className={selectClass}
            >
              <option value="">Select a category...</option>
              {sortedCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className={compactLabelClass} htmlFor={`hms-item-desc-${item?.id ?? 'new'}`}>
            Description / instructions
          </label>
          <textarea
            id={`hms-item-desc-${item?.id ?? 'new'}`}
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            rows={2}
            disabled={lockDescription}
            placeholder="Optional steps or reminders"
            className={textareaClass}
          />
          {lockDescription && (
            <p className={`text-xs mt-1 ${mutedTextClass}`}>
              Default descriptions stay on the template. Override them on an activated schedule.
            </p>
          )}
        </div>
        <div>
          <label className={compactLabelClass} htmlFor={`hms-item-notes-${item?.id ?? 'new'}`}>
            Item notes
          </label>
          <textarea
            id={`hms-item-notes-${item?.id ?? 'new'}`}
            value={form.notes}
            onChange={(e) => onChange({ ...form, notes: e.target.value })}
            rows={2}
            placeholder="Optional household notes"
            className={textareaClass}
          />
        </div>
        <div>
          <label className={compactLabelClass} htmlFor={`hms-item-location-${item?.id ?? 'new'}`}>
            Default location
          </label>
          <input
            id={`hms-item-location-${item?.id ?? 'new'}`}
            type="text"
            value={form.defaultLocation}
            onChange={(e) => onChange({ ...form, defaultLocation: e.target.value })}
            placeholder="e.g., Upstairs furnace"
            className={inputClass}
          />
        </div>
      </div>
    );
  };

  const renderLibrarySection = (title: string, items: HmsLibraryItem[], empty: string, mode: 'available' | 'scheduled' | 'hidden') => {
    if (libraryFilter !== 'all' && libraryFilter !== mode) return null;
    if (libraryFilter === 'all' && mode !== 'available' && items.length === 0) return null;
    return (
      <div className="mb-6 last:mb-0">
        <p className={isLight ? 'text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 mb-2' : 'text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300 mb-2'}>
          {title}
        </p>
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
                    <div
                      className={`min-w-0 ${mode === 'scheduled' && schedule ? 'cursor-pointer' : ''}`}
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
                      {item.defaultLocation && <p className={`${subTextClass} mt-1`}>{item.defaultLocation}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 ml-4">
                      <AttachmentButton
                        count={item.attachments?.length ?? 0}
                        onClick={() => setAttachmentModal({ kind: 'item', itemId: item.id })}
                        ariaLabel={`Library files for ${item.name}`}
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
          status: occurrenceStatus(task.nextDueDate.split('T')[0] || task.nextDueDate, today),
        }];
      });

      const sortRows = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
        compareIso(a.task.nextDueDate.split('T')[0] || a.task.nextDueDate, b.task.nextDueDate.split('T')[0] || b.task.nextDueDate)
        || a.item.name.localeCompare(b.item.name);

      const activeRows = rows.filter((row) => row.task.isActive).sort(sortRows);
      const inactiveRows = rows.filter((row) => !row.task.isActive).sort(sortRows);
      const exportedRows = includeHistory ? [...activeRows, ...inactiveRows] : activeRows;
      const overdueCount = activeRows.filter((row) => row.status === 'Overdue').length;

      const categoryIds = Array.from(new Set(exportedRows.map((row) => row.categoryId)));
      const categoriesToPrint = (useAllCategories
        ? sortedCategories
        : sortedCategories.filter((category) => category.id === exportCategoryId)
      ).filter((category) => categoryIds.includes(category.id));
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
        checkNewPage(28);
        addText(row.item.name, 11, true, 8);
        addText(`Frequency: ${frequencyLabel(row.task.frequency)}`, 9, false, 8);
        addText(`Next due: ${formatDateForDisplay(row.task.nextDueDate)}`, 9, false, 8);
        addText(`Status: ${row.status}`, 9, false, 8);
        if (row.task.lastCompletedDate) {
          addText(`Last completed: ${formatDateForDisplay(row.task.lastCompletedDate)}`, 9, false, 8);
        }
        const location = row.task.location.trim() || row.item.defaultLocation.trim();
        if (location) {
          addText(`Location: ${location}`, 9, false, 8);
        }
        const description = row.task.descriptionOverride.trim() || row.item.description.trim();
        if (description) {
          addText(`Description: ${description}`, 9, false, 8);
        }
        const notes = row.task.notes.trim() || row.item.notes.trim();
        if (notes) {
          addText(`Notes: ${notes}`, 9, false, 8);
        }
        if (!isProviderEmpty(row.task.serviceProvider)) {
          const provider = row.task.serviceProvider;
          if (provider.name.trim()) addText(`Provider: ${provider.name.trim()}`, 9, false, 8);
          if (provider.phone.trim()) addText(`Provider phone: ${provider.phone.trim()}`, 9, false, 8);
          if (provider.website.trim()) addText(`Provider website: ${provider.website.trim()}`, 9, false, 8);
          if (provider.notes.trim()) addText(`Provider notes: ${provider.notes.trim()}`, 9, false, 8);
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
      const title = 'Home Maintenance Schedule Report';
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

      pdf.save(`Home_Maintenance_Schedule_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      setShowExportPopup(false);
    } catch (error) {
      console.error('Error exporting home maintenance schedule PDF:', error);
      showError(error instanceof Error ? error.message : 'Failed to generate PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={titleClass}>Home Maintenance Schedule</h2>
          <p className={descClass}>Activate home, exterior, garage, and yard maintenance tasks, set a recurring schedule, and see what is due next.</p>
          {isLoading && <p className={`${descClass} mt-2`}>Loading...</p>}
        </div>
        <ExportPdfIconButton
          title="Export home maintenance to PDF"
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
                <label className={compactLabelClass} htmlFor="hms-search">
                  Search
                </label>
                <input
                  id="hms-search"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tasks..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={compactLabelClass} htmlFor="hms-category-filter">
                  Filter by category
                </label>
                <select id="hms-category-filter" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectClass}>
                  <option value="all">All</option>
                  {sortedCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={compactLabelClass} htmlFor="hms-sort">
                  Sort
                </label>
                <select id="hms-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortId)} className={selectClass}>
                  <option value="nextDue">Next due date</option>
                  <option value="name">Task name</option>
                  <option value="category">Category</option>
                  <option value="frequency">Frequency</option>
                </select>
              </div>
            </div>

            {range === 'completed' ? (
              completedRows.length === 0 ? (
                <p className={`${mutedTextClass} text-center py-8`}>No completed maintenance in this view yet.</p>
              ) : (
                <div className="space-y-3">
                  {completedRows.map((row) => (
                    <div key={row.completionId} className={nestedCardClass}>
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h4 className={headingSmClass}>{row.name}</h4>
                            <span className={chipNeutralClass}>{row.categoryName}</span>
                            <span className={statusBadgeClass('Completed')}>Completed</span>
                            {scheduledTasks.find((task) => task.id === row.taskId)?.addToDashboard && (
                              <OnCalendarChip isLight={isLight} />
                            )}
                          </div>
                          <p className={subTextClass}>
                            Scheduled {formatDateForDisplay(row.scheduledDate)} · Completed {formatDateForDisplay(row.completedDate)} · {row.lateness}
                            {row.cost != null ? ` · ${formatCost(row.cost)}` : ''}
                          </p>
                          {row.notes && <p className={`${subTextClass} italic mt-1`}>{snippet(row.notes)}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 ml-4">
                          <AttachmentButton
                            count={completionAttachmentCount(row.completionId)}
                            onClick={() => setAttachmentModal({ kind: 'completion', completionId: row.completionId })}
                            ariaLabel={`Completion files for ${row.name}`}
                          />
                          <button
                            type="button"
                            onClick={() => openDetail(row.taskId)}
                            className={rowIconEmeraldClass}
                            aria-label="View/Edit"
                            title="View/Edit"
                          >
                            <EditIcon />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : occurrences.length === 0 ? (
              <p className={`${mutedTextClass} text-center py-8`}>No maintenance tasks in this view. Activate items from the Library tab.</p>
            ) : (
              <div className="space-y-3">
                {occurrences.map((row) => (
                  <div key={`${row.taskId}-${row.date}`} className={nestedCardClass}>
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 className={headingSmClass}>{row.name}</h4>
                          {row.location && <span className={chipNeutralClass}>Location: {row.location}</span>}
                          <span className={chipNeutralClass}>Category: {row.categoryName}</span>
                          <span className={statusBadgeClass(row.status)}>{row.status}</span>
                          {scheduledTasks.find((task) => task.id === row.taskId)?.addToDashboard && (
                            <OnCalendarChip isLight={isLight} />
                          )}
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
                          aria-label="Move to history"
                          title="Move to history"
                        >
                          <ArchiveIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={sectionTitleClass}>History</h3>
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className={`text-sm ${mutedTextClass} hover:opacity-80 transition-colors`}
              >
                {showHistory ? 'Hide' : 'Show'} ({historyCount})
              </button>
            </div>
            {showHistory &&
              (historyCount === 0 ? (
                <p className={`${mutedTextClass} text-center py-8`}>No tasks in history.</p>
              ) : (
                <div className="space-y-3">
                  {historyCompletionRows.map((row) => (
                    <div key={row.completionId} className={`${nestedCardClass} ${isLight ? '' : 'opacity-80'}`}>
                      <div className="flex items-start justify-between">
                        <button type="button" onClick={() => openDetail(row.taskId)} className="text-left min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h4 className={headingSmClass}>{row.name}</h4>
                            <span className={chipNeutralClass}>{row.categoryName}</span>
                            <span className={statusBadgeClass('Completed')}>Completed</span>
                            {scheduledTasks.find((task) => task.id === row.taskId)?.addToDashboard && (
                              <OnCalendarChip isLight={isLight} />
                            )}
                          </div>
                          <p className={subTextClass}>
                            Scheduled {formatDateForDisplay(row.scheduledDate)} · Completed {formatDateForDisplay(row.completedDate)} · {row.lateness}
                            {row.cost != null ? ` · ${formatCost(row.cost)}` : ''}
                          </p>
                          {row.notes && <p className={`${subTextClass} italic mt-1`}>{snippet(row.notes)}</p>}
                        </button>
                        <div className="flex shrink-0 items-center gap-1.5 ml-4">
                          <AttachmentButton
                            count={completionAttachmentCount(row.completionId)}
                            onClick={() => setAttachmentModal({ kind: 'completion', completionId: row.completionId })}
                            ariaLabel={`Completion files for ${row.name}`}
                          />
                          <button
                            type="button"
                            onClick={() => openDetail(row.taskId)}
                            className={rowIconEmeraldClass}
                            aria-label="View/Edit"
                            title="View/Edit"
                          >
                            <EditIcon />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
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
                + Add New Maintenance Item
              </button>
            </div>
          )}
          {isAddingItem && (
            <div className={cardClass}>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className={sectionTitleClass}>Add New Maintenance Item</h3>
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

          <div className="max-w-md">
            <label className={compactLabelClass} htmlFor="hms-library-search">
              Search
            </label>
            <input
              id="hms-library-search"
              type="text"
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              placeholder="Search library items..."
              className={inputClass}
            />
          </div>

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
                <nav className="space-y-0.5" aria-label="Maintenance item categories">
                  {visibleLibraryCategories.length === 0 ? (
                    <p className={`px-3 py-2 text-sm ${mutedTextClass}`}>No matching categories.</p>
                  ) : (
                    visibleLibraryCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setLibraryCategoryId(category.id)}
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
                  ))
                  )}
                </nav>
              </div>
            </div>
            <div className="flex-1 min-w-0 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className={isLight ? 'text-lg font-semibold text-emerald-700' : 'text-lg font-semibold text-emerald-300'}>
                  {libraryQuery ? 'Search results' : selectedLibraryCategory?.name ?? 'Category'}
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
              {renderLibrarySection('Available', availableItems, `No available items${libraryScopeHint}`, 'available')}
              {renderLibrarySection('Scheduled', scheduledItems, `No scheduled items${libraryScopeHint}`, 'scheduled')}
              {renderLibrarySection('Hidden defaults', hiddenItems, `No hidden defaults${libraryScopeHint}`, 'hidden')}
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
                {categories.length} {categories.length === 1 ? 'category' : 'categories'}
              </span>
            </div>
            <div className="space-y-3">
              {sortedCategories.map((category) => {
                const used = categoryUsage(category.id);
                return (
                  <div key={category.id} className={nestedCardClass}>
                    {editingCategoryId === category.id ? (
                      <div className="flex gap-3 flex-wrap items-end">
                        <div className="flex-1 min-w-[200px]">
                          <label className={compactLabelClass} htmlFor="hms-rename-category">
                            Category name
                          </label>
                          <input
                            id="hms-rename-category"
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
                        <div className="flex shrink-0 items-center gap-1.5 ml-4">
                          {!category.isDefault && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategoryId(category.id);
                                setEditingCategoryName(category.name);
                              }}
                              className={rowIconEmeraldClass}
                              aria-label="Rename category"
                              title="Rename category"
                            >
                              <EditIcon />
                            </button>
                          )}
                          {!category.isDefault && used === 0 && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ kind: 'category', id: category.id })}
                              className={rowIconDangerClass}
                              aria-label="Delete category"
                              title="Delete category"
                            >
                              <DeleteIcon />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showExportPopup && (
        <div className={overlayClass}>
          <div className={modalCardClass} role="dialog" aria-modal="true" aria-labelledby="hms-export-title">
            <div className="flex items-center justify-between mb-4">
              <h3 id="hms-export-title" className={sectionTitleClass}>Export Options</h3>
              <button
                type="button"
                onClick={() => !isExportingPdf && setShowExportPopup(false)}
                disabled={isExportingPdf}
                aria-label="Close"
                title="Close"
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
                  id="hmsIncludeHistoryExport"
                  checked={includeHistory}
                  onChange={(e) => setIncludeHistory(e.target.checked)}
                  disabled={isExportingPdf}
                  className={isLight
                    ? 'mt-0.5 h-4 w-4 rounded border-slate-400 text-emerald-600 focus:ring-emerald-500'
                    : 'mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500'}
                />
                <label htmlFor="hmsIncludeHistoryExport" className={`${isLight ? 'text-slate-700' : 'text-slate-300'} cursor-pointer`}>
                  Include inactive scheduled tasks
                </label>
              </div>

              <fieldset className="space-y-2" disabled={isExportingPdf}>
                <legend className={`${labelClass} mb-0`}>Categories</legend>
                <label className={`flex items-start gap-3 ${isLight ? 'text-slate-700' : 'text-slate-300'} cursor-pointer`}>
                  <input
                    type="radio"
                    name="hmsExportScope"
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
                    name="hmsExportScope"
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
                    <label className={compactLabelClass} htmlFor="hms-export-category">
                      Category
                    </label>
                    <select
                      id="hms-export-category"
                      value={exportCategoryId}
                      onChange={(e) => setExportCategoryId(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Select a category</option>
                      {sortedCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
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

      {activateItemId && (
        <div className={overlayClass}>
          <div className={modalCardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={sectionTitleClass}>
                Activate {libraryItems.find((item) => item.id === activateItemId)?.name ?? 'item'}
              </h3>
              <button
                type="button"
                onClick={() => setActivateItemId(null)}
                aria-label="Close modal"
                title="Close modal"
                className={iconButtonClass}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="space-y-4">
              <FrequencyFields form={activateForm} onChange={setActivateForm} classes={frequencyClasses} idPrefix="hms-activate" />
              <div>
                <label className={labelClass} htmlFor="hms-activate-next-due">
                  Next due date <span className="text-red-400">*</span>
                </label>
                <input
                  id="hms-activate-next-due"
                  type="date"
                  value={activateNextDue}
                  onChange={(e) => setActivateNextDue(e.target.value)}
                  className={inputClass}
                />
              </div>
              <ReminderDaysFields
                id="hms-activate-reminder-days"
                value={activateReminderDays}
                onChange={setActivateReminderDays}
                labelClass={labelClass}
                inputClass={inputClass}
                hintClass={mutedTextClass}
              />
              <button
                type="button"
                onClick={() => setShowActivateOptional((open) => !open)}
                className={optionalToggleClass}
                aria-expanded={showActivateOptional}
              >
                {showActivateOptional
                  ? 'Hide optional schedule details'
                  : 'Show optional schedule details (location, notes, provider)'}
              </button>
              {showActivateOptional && (
                <div className="space-y-4">
                  <div>
                    <label className={labelClass} htmlFor="hms-activate-location">
                      Location
                    </label>
                    <input
                      id="hms-activate-location"
                      type="text"
                      value={activateLocation}
                      onChange={(e) => setActivateLocation(e.target.value)}
                      placeholder="e.g., Upstairs furnace"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="hms-activate-notes">
                      Schedule notes
                    </label>
                    <textarea
                      id="hms-activate-notes"
                      value={activateNotes}
                      onChange={(e) => setActivateNotes(e.target.value)}
                      rows={2}
                      placeholder="Optional"
                      className={textareaClass}
                    />
                  </div>
                  <ProviderFields provider={activateProvider} onChange={setActivateProvider} classes={frequencyClasses} idPrefix="hms-activate" />
                </div>
              )}
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
                <button type="button" onClick={() => setActivateItemId(null)} className={secondaryButtonClass}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {completeOccurrence && (
        <div className={completeOverlayClass}>
          <div className={`${modalCardClass} min-h-0`}>
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
            <div className="space-y-3 mb-4">
              <label className={radioLabelClass}>
                <input
                  type="radio"
                  name="hms-complete-basis"
                  checked={completeBasis === 'today'}
                  onChange={() => setCompleteBasis('today')}
                  className="rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                />
                Today ({formatDateForDisplay(today)})
              </label>
              <label className={radioLabelClass}>
                <input
                  type="radio"
                  name="hms-complete-basis"
                  checked={completeBasis === 'scheduled'}
                  onChange={() => setCompleteBasis('scheduled')}
                  className="rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                />
                Originally scheduled date ({formatDateForDisplay(completeOccurrence.scheduledDate)})
              </label>
            </div>
            <button type="button" onClick={() => setShowCompleteOptional((open) => !open)} className={`${optionalToggleClass} mb-4`}>
              {showCompleteOptional ? 'Hide optional details' : 'Optional details'}
            </button>
            {showCompleteOptional && (
              <div className="space-y-4 mb-4">
                <div>
                  <label className={labelClass} htmlFor="hms-complete-notes">
                    Completion notes
                  </label>
                  <textarea
                    id="hms-complete-notes"
                    value={completeNotes}
                    onChange={(e) => setCompleteNotes(e.target.value)}
                    rows={3}
                    placeholder="Changed filter — used Filtrete 1900."
                    className={textareaClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="hms-complete-cost">
                    Cost
                  </label>
                  <input
                    id="hms-complete-cost"
                    type="number"
                    min={0}
                    step="0.01"
                    value={completeCost}
                    onChange={(e) => setCompleteCost(e.target.value)}
                    placeholder="Optional"
                    className={inputClass}
                  />
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={confirmComplete}
                disabled={parseCostInput(completeCost) === 'invalid' || isSaving}
                className={`flex-1 ${primaryButtonClass}`}
              >
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
                {detailItem.isDefault && (
                  <div>
                    <label className={labelClass} htmlFor="hms-detail-description">
                      Description override
                    </label>
                    <textarea
                      id="hms-detail-description"
                      value={detailDescription}
                      onChange={(e) => setDetailDescription(e.target.value)}
                      rows={2}
                      placeholder="Optional override for this schedule"
                      className={textareaClass}
                    />
                  </div>
                )}
                <FrequencyFields form={detailForm} onChange={setDetailForm} classes={frequencyClasses} idPrefix="hms-detail" />
                <div>
                  <label className={labelClass} htmlFor="hms-detail-next-due">
                    Next due date <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="hms-detail-next-due"
                    type="date"
                    value={detailNextDue}
                    onChange={(e) => setDetailNextDue(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <ReminderDaysFields
                  id="hms-detail-reminder-days"
                  value={detailReminderDays}
                  onChange={setDetailReminderDays}
                  labelClass={labelClass}
                  inputClass={inputClass}
                  hintClass={mutedTextClass}
                />
                <div>
                  <label className={labelClass} htmlFor="hms-detail-location">
                    Location
                  </label>
                  <input
                    id="hms-detail-location"
                    type="text"
                    value={detailLocation}
                    onChange={(e) => setDetailLocation(e.target.value)}
                    placeholder="e.g., Main furnace"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="hms-detail-notes">
                    Schedule notes
                  </label>
                  <textarea
                    id="hms-detail-notes"
                    value={detailNotes}
                    onChange={(e) => setDetailNotes(e.target.value)}
                    rows={2}
                    placeholder="Optional"
                    className={textareaClass}
                  />
                </div>
                <ProviderFields provider={detailProvider} onChange={setDetailProvider} classes={frequencyClasses} idPrefix="hms-detail" />
                <DashboardCalendarSwitch
                  isOn={detailAddToDashboard}
                  isLight={isLight}
                  onToggle={() => setDetailAddToDashboard((prev) => !prev)}
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={saveDetail}
                    disabled={!detailNextDue || !isFrequencyFormValid(detailForm) || !detailItemForm.name.trim() || isSaving}
                    className={primaryButtonClass}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDetailAddToDashboard(detailTask.addToDashboard === true);
                      setDetailEditing(false);
                    }}
                    className={secondaryButtonClass}
                  >
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
                    <p className={compactLabelClass}>Location</p>
                    <p className={bodyTextClass}>{detailTask.location || '—'}</p>
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
                  <div>
                    <p className={compactLabelClass}>Lifetime cost</p>
                    <p className={bodyTextClass}>{formatCost(lifetimeCost)}</p>
                  </div>
                  <div>
                    <p className={compactLabelClass}>This year</p>
                    <p className={bodyTextClass}>{formatCost(thisYearCost)}</p>
                  </div>
                </div>
                <div>
                  <p className={compactLabelClass}>Description</p>
                  <p className={bodyTextClass}>{detailDescriptionDisplay || '—'}</p>
                </div>
                {detailTask.notes && (
                  <div>
                    <p className={compactLabelClass}>Schedule notes</p>
                    <p className={bodyTextClass}>{detailTask.notes}</p>
                  </div>
                )}
                {!isProviderEmpty(detailTask.serviceProvider) && (
                  <div>
                    <p className={compactLabelClass}>Service provider</p>
                    <p className={bodyTextClass}>{detailTask.serviceProvider.name || '—'}</p>
                    {detailTask.serviceProvider.phone && <p className={subTextClass}>{detailTask.serviceProvider.phone}</p>}
                    {detailTask.serviceProvider.website && <p className={subTextClass}>{detailTask.serviceProvider.website}</p>}
                    {detailTask.serviceProvider.notes && <p className={`${subTextClass} italic`}>{detailTask.serviceProvider.notes}</p>}
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
                      <button type="button" onClick={() => deactivateTask(detailTask.id)} className={secondaryButtonClass}>
                        Move to history
                      </button>
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
                        <th className="text-left px-3 py-2 font-medium">Notes</th>
                        <th className="text-left px-3 py-2 font-medium">Cost</th>
                        <th className="text-right px-3 py-2 font-medium">Files</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailHistory.map((row) => (
                        <tr key={row.id} className={isLight ? 'border-t border-slate-200' : 'border-t border-slate-700'}>
                          <td className={`px-3 py-2 ${bodyTextClass}`}>{formatDateForDisplay(row.scheduledDate)}</td>
                          <td className={`px-3 py-2 ${bodyTextClass}`}>{formatDateForDisplay(row.completedDate)}</td>
                          <td className={`px-3 py-2 ${bodyTextClass}`}>{row.lateness}</td>
                          <td className={`px-3 py-2 ${bodyTextClass}`}>{row.notes || '—'}</td>
                          <td className={`px-3 py-2 ${bodyTextClass}`}>{formatCost(row.cost)}</td>
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
