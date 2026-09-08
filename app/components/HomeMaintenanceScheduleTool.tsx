'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from './AppThemeProvider';
import {
  addDays,
  addMonthsSetDay,
  advanceFrom,
  compareIso,
  emptyServiceProvider,
  formatCost,
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

type TabId = 'schedule' | 'library' | 'categories' | 'export';
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

function expandOccurrences(nextDueDate: string, frequency: HmsFrequency, windowStart: string, windowEnd: string): string[] {
  const dates: string[] = [];
  let cursor = nextDueDate;
  let guard = 0;
  while (compareIso(cursor, windowEnd) <= 0 && guard < 200) {
    if (compareIso(cursor, windowStart) >= 0) dates.push(cursor);
    const next = advanceFrom(cursor, frequency);
    if (compareIso(next, cursor) <= 0) break;
    cursor = next;
    guard += 1;
  }
  return dates;
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

export function HomeMaintenanceScheduleTool({ toolId }: HomeMaintenanceScheduleToolProps) {

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

  const [completeOccurrence, setCompleteOccurrence] = useState<{ taskId: string; scheduledDate: string } | null>(null);
  const [completeBasis, setCompleteBasis] = useState<'today' | 'scheduled'>('today');
  const [completeNotes, setCompleteNotes] = useState('');
  const [completeCost, setCompleteCost] = useState('');
  const [showCompleteOptional, setShowCompleteOptional] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showExportPopup, setShowExportPopup] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const today = todayIso();

  const showBanner = (type: 'success' | 'error', text: string) => {
    setBanner({ type, text });
  };

  const applyData = useCallback((data: HmsScheduleData) => {
    const nextCategories = data.categories ?? [];
    setCategories(nextCategories);
    setLibraryItems(data.items ?? []);
    setScheduledTasks(data.tasks ?? []);
    setCompletions(data.completions ?? []);
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
        const response = await fetch(`${API_BASE}?toolId=${encodeURIComponent(toolId)}`);
        const data = await response.json().catch(() => ({ error: 'Failed to load Home Maintenance Schedule' }));
        if (!response.ok) throw new Error(data.error || 'Failed to load Home Maintenance Schedule');
        applyData(data as HmsScheduleData);
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
  }, [toolId, applyData]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (deleteTarget) {
        setDeleteTarget(null);
        setDeleteConfirmText('');
        return;
      }
      if (completeOccurrence) {
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
      if (showExportPopup) setShowExportPopup(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteTarget, completeOccurrence, activateItemId, detailTaskId, showExportPopup]);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  const categoryName = (categoryId: string) => categories.find((category) => category.id === categoryId)?.name ?? 'Uncategorized';

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
        serviceProvider: activateProvider,
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
        serviceProvider: detailProvider,
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
      openDetail(taskId, true);
    } catch (error) {
      showBanner('error', error instanceof Error ? error.message : 'Failed to reactivate task');
    } finally {
      setIsSaving(false);
    }
  };

  const openComplete = (taskId: string, scheduledDate: string) => {
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
        completionNotes: completeNotes.trim(),
        cost,
      });
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
  const selectedLibraryCategory = categories.find((category) => category.id === libraryCategoryId) ?? sortedCategories[0];
  const itemsInCategory = libraryItems
    .filter((item) => item.categoryId === selectedLibraryCategory?.id)
    .sort((a, b) => a.name.localeCompare(b.name));

  const availableItems = itemsInCategory.filter((item) => !item.isHidden && !activeScheduleByItem.has(item.id));
  const scheduledItems = itemsInCategory.filter((item) => activeScheduleByItem.has(item.id));
  const hiddenItems = itemsInCategory.filter((item) => item.isDefault && item.isHidden);

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
            Notes
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
                    <div className="flex gap-3 mt-4">
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
                      </div>
                      {item.description && <p className={subTextClass}>{item.description}</p>}
                      {item.notes && <p className={`${subTextClass} italic mt-1`}>{item.notes}</p>}
                      {item.defaultLocation && <p className={`${subTextClass} mt-1`}>{item.defaultLocation}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 ml-4">
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className={titleClass}>Home Maintenance Schedule</h2>
        <p className={descClass}>Activate home, exterior, garage, and yard maintenance tasks, set a recurring schedule, and see what is due next.</p>
        {isLoading && <p className={`${descClass} mt-2`}>Loading...</p>}
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
            { id: 'export', label: 'Export' },
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
                          </div>
                          <p className={subTextClass}>
                            Scheduled {formatDateForDisplay(row.scheduledDate)} · Completed {formatDateForDisplay(row.completedDate)} · {row.lateness}
                            {row.cost != null ? ` · ${formatCost(row.cost)}` : ''}
                          </p>
                          {row.notes && <p className={`${subTextClass} italic mt-1`}>{snippet(row.notes)}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 ml-4">
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
                          {row.location && <span className={chipNeutralClass}>{row.location}</span>}
                          <span className={chipNeutralClass}>{row.categoryName}</span>
                          <span className={statusBadgeClass(row.status)}>{row.status}</span>
                        </div>
                        <p className={subTextClass}>
                          {formatDateForDisplay(row.date)} · {row.frequencyLabel}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 ml-4">
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
                {showHistory ? 'Hide' : 'Show'} ({historyTasks.length})
              </button>
            </div>
            {showHistory &&
              (historyTasks.length === 0 ? (
                <p className={`${mutedTextClass} text-center py-8`}>No tasks in history.</p>
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
                            </div>
                            <p className={subTextClass}>
                              {frequencyLabel(task.frequency)}
                              {task.dateInactivated ? ` · Moved ${formatDateForDisplay(task.dateInactivated)}` : ''}
                            </p>
                          </button>
                          <div className="flex shrink-0 items-center gap-1.5 ml-4">
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
              <button type="button" onClick={() => setIsAddingItem(true)} className={primaryButtonClass}>
                + Add New Maintenance Item
              </button>
            </div>
          )}
          {isAddingItem && (
            <div className={cardClass}>
              <h3 className={`${sectionTitleClass} mb-4`}>Add New Maintenance Item</h3>
              {renderItemFields(itemForm, setItemForm)}
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={addLibraryItem} disabled={!itemFormReady(itemForm) || isSaving} className={primaryButtonClass}>
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingItem(false);
                    setItemForm(emptyItemForm());
                  }}
                  className={secondaryButtonClass}
                >
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
                <nav className="space-y-0.5" aria-label="Maintenance item categories">
                  {sortedCategories.map((category) => (
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

      {activeTab === 'export' && (
        <div className="space-y-6">
          <div className={cardClass}>
            <h3 className={`${sectionTitleClass} mb-4`}>Export Home Maintenance Schedule Report</h3>
            <p className={`${descClass} mb-4`}>
              Generate a comprehensive PDF report of all your maintenance tasks. The report will include scheduled items,
              completion history, summary statistics, and category breakdown.
            </p>
            <button type="button" onClick={() => setShowExportPopup(true)} className={primaryButtonClass}>
              Generate PDF Report
            </button>
          </div>
        </div>
      )}

      {showExportPopup && (
        <div className={overlayClass}>
          <div className={modalCardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={sectionTitleClass}>Export Options</h3>
              <button
                type="button"
                onClick={() => setShowExportPopup(false)}
                aria-label="Close modal"
                title="Close modal"
                className={iconButtonClass}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowExportPopup(false)} className={`flex-1 ${primaryButtonClass}`}>
                Export to PDF
              </button>
              <button type="button" onClick={() => setShowExportPopup(false)} className={secondaryButtonClass}>
                Cancel
              </button>
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
              <button type="button" onClick={() => setShowActivateOptional((open) => !open)} className={optionalToggleClass}>
                {showActivateOptional ? 'Hide optional details' : 'Optional details'}
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
                      Notes
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
        <div className={overlayClass}>
          <div className={modalCardClass}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={sectionTitleClass}>Complete task</h3>
              <button
                type="button"
                onClick={() => setCompleteOccurrence(null)}
                aria-label="Close modal"
                title="Close modal"
                className={iconButtonClass}
              >
                <CloseIcon />
              </button>
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
              <button type="button" onClick={() => setCompleteOccurrence(null)} className={secondaryButtonClass}>
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
                    Notes
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
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={saveDetail}
                    disabled={!detailNextDue || !isFrequencyFormValid(detailForm) || !detailItemForm.name.trim() || isSaving}
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
                    <p className={compactLabelClass}>Location</p>
                    <p className={bodyTextClass}>{detailTask.location || '—'}</p>
                  </div>
                  <div>
                    <p className={compactLabelClass}>Next due</p>
                    <p className={bodyTextClass}>{formatDateForDisplay(detailTask.nextDueDate)}</p>
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
                    <p className={compactLabelClass}>Notes</p>
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
    </div>
  );
}
