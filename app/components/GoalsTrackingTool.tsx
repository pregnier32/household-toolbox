'use client';

import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { createPortal } from 'react-dom';
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

const API_BASE = '/api/tools/goals-tracking';

type GoalAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

type AttachmentTarget = { kind: 'goal' | 'update'; id: 'add' | string };

// --- Types (exported for dashboard / context) ---
export type Category = {
  id: string;
  name: string;
  card_color: string;
  isStock?: boolean;
};

type Priority = 'High' | 'Medium' | 'Low';
type GoalStatus = 'Not Started' | 'In Progress' | 'Delayed' | 'Completed';

type Task = {
  id: string;
  phaseId: string;
  title: string;
  completed: boolean;
};

type Phase = {
  id: string;
  goalId: string;
  name: string;
  order: number;
};

type UpdateNote = {
  id: string;
  goalId: string;
  noteDate: string;
  note: string;
  attachments: GoalAttachment[];
};

export type Goal = {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  targetDate: string;
  priority: Priority;
  status: GoalStatus;
  percentComplete: number;
  showOnDashboard: boolean;
  reminderDays: number | null;
  lastUpdateDate: string | null;
  useTaskProgressForPercent: boolean;
  addToDashboard: boolean;
  phases: Phase[];
  tasks: Task[];
  updateNotes: UpdateNote[];
  attachments: GoalAttachment[];
};

const DEFAULT_CATEGORY_NAMES = ['Home', 'Finance', 'Health', 'Career', 'Personal'];
const DEFAULT_CATEGORY_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899'];

function isStockCategoryName(name: string): boolean {
  const normalized = (name ?? '').trim().toLowerCase();
  return DEFAULT_CATEGORY_NAMES.some((stock) => stock.toLowerCase() === normalized);
}

function isStockCategory(cat: Pick<Category, 'name' | 'isStock'>): boolean {
  return cat.isStock === true || isStockCategoryName(cat.name);
}

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

function formatReportDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function compareGoalsForExport(a: Goal, b: Goal): number {
  const aOpen = a.status !== 'Completed';
  const bOpen = b.status !== 'Completed';
  if (aOpen !== bOpen) return aOpen ? -1 : 1;
  if (a.targetDate && b.targetDate) {
    const byDate = a.targetDate.localeCompare(b.targetDate);
    if (byDate !== 0) return byDate;
  } else if (a.targetDate) {
    return -1;
  } else if (b.targetDate) {
    return 1;
  }
  return a.title.localeCompare(b.title);
}

// --- Default categories (in-memory) ---
function getDefaultCategories(): Category[] {
  return DEFAULT_CATEGORY_NAMES.map((name, i) => ({
    id: `cat-${name.toLowerCase()}-${i}`,
    name,
    card_color: DEFAULT_CATEGORY_COLORS[i] ?? '#10b981',
  }));
}

function pickOpenCategoryId(list: { id: string }[], currentId: string | null): string | null {
  if (list.length === 0) return null;
  if (currentId && list.some((c) => c.id === currentId)) return currentId;
  return list[0].id;
}

function normalizeGoal(goal: Goal): Goal {
  return {
    ...goal,
    addToDashboard: goal.addToDashboard === true,
    attachments: goal.attachments || [],
    updateNotes: (goal.updateNotes || []).map((note) => ({
      ...note,
      attachments: note.attachments || [],
    })),
  };
}

function DashboardCalendarSwitch({
  isOn,
  onToggle,
  isLight,
  disabled = false,
}: {
  isOn: boolean;
  onToggle: () => void;
  isLight: boolean;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      title={disabled ? 'Set a target date to add this goal to the dashboard calendar' : 'Add to dashboard calendar'}
    >
      <span className={`text-xs whitespace-nowrap ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
        Add to dashboard calendar
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-disabled={disabled}
        aria-label="Add to dashboard calendar"
        title={disabled ? 'Set a target date to add this goal to the dashboard calendar' : 'Add to dashboard calendar'}
        disabled={disabled}
        onClick={() => {
          if (!disabled) onToggle();
        }}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 ${
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        } ${isLight ? 'focus:ring-offset-white' : 'focus:ring-offset-slate-900'} ${
          isOn ? 'bg-emerald-500' : isLight ? 'bg-slate-300' : 'bg-slate-700'
        }`}
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

// --- Shared context for dashboard to show goals ---
type GoalsContextValue = {
  goals: Goal[];
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
};

const GoalsContext = createContext<GoalsContextValue | null>(null);

export function GoalsProvider({
  children,
  goalsToolId = null,
}: {
  children: React.ReactNode;
  goalsToolId?: string | null;
}) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (!goalsToolId) return;
    let cancelled = false;
    fetch(`/api/tools/goals-tracking?toolId=${encodeURIComponent(goalsToolId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) return;
        setCategories(data.categories ?? []);
        setGoals(((data.goals ?? []) as Goal[]).map(normalizeGoal));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [goalsToolId]);

  return (
    <GoalsContext.Provider value={{ goals, setGoals, categories, setCategories }}>
      {children}
    </GoalsContext.Provider>
  );
}

export function useGoalsContext() {
  return useContext(GoalsContext);
}

// Helper to compute goal percent (exported for dashboard cards)
export function getGoalPercentExport(goal: Goal): number {
  if (goal.useTaskProgressForPercent && goal.tasks.length > 0) {
    const completed = goal.tasks.filter((t) => t.completed).length;
    return Math.round((completed / goal.tasks.length) * 100);
  }
  return goal.percentComplete;
}

function getPhasePercent(goal: Goal, phaseId: string): number {
  const phaseTasks = goal.tasks.filter((t) => t.phaseId === phaseId);
  if (phaseTasks.length === 0) return 0;
  const completed = phaseTasks.filter((t) => t.completed).length;
  return Math.round((completed / phaseTasks.length) * 100);
}

function isGoalReminderOverdue(goal: Goal): boolean {
  if (goal.reminderDays == null) return false;
  const lastNote =
    goal.updateNotes.length > 0
      ? [...goal.updateNotes].sort((a, b) => b.noteDate.localeCompare(a.noteDate))[0]
      : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysSinceLastUpdate = lastNote
    ? Math.floor((today.getTime() - new Date(lastNote.noteDate).getTime()) / (1000 * 60 * 60 * 24))
    : Infinity;
  return daysSinceLastUpdate >= goal.reminderDays;
}

type GoalsTrackingToolProps = {
  toolId?: string;
};

export function GoalsTrackingTool({ toolId }: GoalsTrackingToolProps) {
  const ctx = useGoalsContext();
  const { resolvedTheme } = useTheme();
  const { showError } = useAppNotice();
  const isLight = resolvedTheme === 'light';

  const cardClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'
    : 'rounded-2xl border border-slate-800 bg-slate-900/70 p-4';
  const cardMutedClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm'
    : 'rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center';
  const cardPad6Class = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'
    : 'rounded-2xl border border-slate-800 bg-slate-900/70 p-6';
  const titleClass = isLight ? 'text-2xl font-semibold text-slate-900 mb-2' : 'text-2xl font-semibold text-slate-50 mb-2';
  const descClass = isLight ? 'text-slate-600 text-sm' : 'text-slate-400 text-sm';
  const sectionTitleClass = isLight ? 'text-lg font-semibold text-slate-900 mb-4' : 'text-lg font-semibold text-slate-50 mb-4';
  const labelClass = isLight ? 'block text-sm font-medium text-slate-700 mb-3' : 'block text-sm font-medium text-slate-300 mb-3';
  const labelClassSm = isLight ? 'block text-xs font-medium text-slate-700 mb-1.5' : 'block text-xs font-medium text-slate-300 mb-1.5';
  const inputClass = isLight
    ? 'w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const inputClassPad = isLight
    ? 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const primaryButtonClass = isLight
    ? 'rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50'
    : 'rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50';
  const primaryButtonSmClass = isLight
    ? 'rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50'
    : 'rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50';
  const primaryButtonXsClass = isLight
    ? 'flex-1 rounded px-2 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed'
    : 'flex-1 rounded bg-emerald-500 px-2 py-1 text-xs font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed';
  const primaryButtonTinyClass = isLight
    ? 'px-2 py-1 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500'
    : 'px-2 py-1 rounded bg-emerald-500 text-slate-950 text-xs font-medium hover:bg-emerald-400';
  const secondaryButtonClass = isLight
    ? 'px-4 py-2 rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors'
    : 'px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors';
  const secondaryButtonSmClass = isLight
    ? 'px-2 py-1 rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-800 text-xs hover:bg-slate-200'
    : 'px-2 py-1 rounded border border-slate-600 bg-slate-700 text-slate-200 text-xs hover:bg-slate-600';
  const successAlertClass = isLight
    ? 'rounded-lg px-4 py-2 text-sm bg-emerald-50 text-emerald-900 border border-emerald-200'
    : 'rounded-lg px-4 py-2 text-sm bg-emerald-500/20 text-emerald-300';
  const errorAlertClass = isLight
    ? 'rounded-lg px-4 py-2 text-sm bg-red-50 text-red-800 border border-red-200'
    : 'rounded-lg px-4 py-2 text-sm bg-red-500/20 text-red-300';
  const loadingOverlayClass = isLight
    ? 'absolute inset-0 bg-white/80 z-10 flex items-center justify-center rounded-2xl'
    : 'absolute inset-0 bg-slate-950/60 z-10 flex items-center justify-center rounded-2xl';
  const loadingTextClass = isLight ? 'text-slate-600' : 'text-slate-400';
  const tabActiveClass = isLight
    ? 'border-b-2 border-emerald-600 text-emerald-900 font-semibold'
    : 'border-b-2 border-emerald-500 text-emerald-300';
  const tabInactiveClass = isLight
    ? 'border-b-2 border-transparent text-slate-600 hover:text-slate-900'
    : 'border-b-2 border-transparent text-slate-400 hover:text-slate-300';
  const goalSubTabActiveClass = isLight
    ? 'border-b-2 border-emerald-600 text-emerald-900 font-semibold'
    : 'border-b-2 border-emerald-500 text-emerald-300 font-semibold';
  const goalSubTabInactiveClass = isLight
    ? 'border-b-2 border-transparent text-slate-600 hover:text-slate-900'
    : 'border-b-2 border-transparent text-slate-400 hover:text-slate-300';
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
  const modalCardClass = isLight
    ? 'w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl'
    : 'w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl';
  const modalCardSmClass = isLight
    ? 'w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl'
    : 'w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl';
  const modalCardConfirmClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 max-w-md w-full mx-4 shadow-2xl'
    : 'rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4';
  const modalTitleClass = isLight ? 'text-xl font-semibold text-slate-900' : 'text-xl font-semibold text-slate-50';
  const deleteWarningBoxClass = isLight
    ? 'rounded-lg border border-red-300 bg-red-50 px-4 py-3 mb-4'
    : 'rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4';
  const deleteWarningTextClass = isLight ? 'text-red-700 font-semibold mb-2' : 'text-red-300 font-semibold mb-2';
  const deleteWarningDetailClass = isLight ? 'text-red-600 text-sm' : 'text-red-200 text-sm';
  const deleteInstructionTextClass = isLight ? 'text-slate-700 mb-4' : 'text-slate-300 mb-4';
  const deleteInstructionKeywordClass = isLight ? 'text-slate-900' : 'text-slate-200';
  const deleteConfirmInputClass = isLight
    ? 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4'
    : 'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4';
  const modalHeadingClass = isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50';
  const modalCloseClass = isLight
    ? 'rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors'
    : 'rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors';
  const nestedGoalCardClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-300'
    : 'rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition-colors hover:border-slate-700';
  const goalTitleHeroClass = isLight ? 'text-3xl font-semibold text-slate-900' : 'text-3xl font-semibold text-slate-50';
  const percentDisplayClass = isLight ? 'text-5xl font-semibold text-emerald-800' : 'text-5xl font-semibold text-emerald-300';
  const progressTrackClass = isLight ? 'h-8 rounded-full bg-slate-200 overflow-hidden w-full' : 'h-8 rounded-full bg-slate-800 overflow-hidden w-full';
  const tableWrapClass = isLight ? 'rounded-lg border border-slate-200 overflow-hidden' : 'rounded-lg border border-slate-700/70 overflow-hidden';
  const tableHeadClass = isLight ? 'border-b border-slate-200 bg-slate-100' : 'border-b border-slate-700 bg-slate-800/50';
  const tableThClass = isLight
    ? 'text-left text-xs font-medium text-slate-600 uppercase tracking-wider py-2 px-3'
    : 'text-left text-xs font-medium text-slate-400 uppercase tracking-wider py-2 px-3';
  const tableTdClass = isLight ? 'text-sm text-slate-800' : 'text-sm text-slate-200';
  const recentUpdatesBoxClass = isLight
    ? 'mt-3 rounded-lg border border-slate-200 px-3 py-3 bg-slate-50'
    : 'mt-3 rounded-lg border border-slate-700/70 px-3 py-3 bg-slate-800/30';
  const mutedSmallClass = isLight ? 'text-xs text-slate-600' : 'text-xs text-slate-400';
  const bodyMutedClass = isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-500';
  const bodyTextClass = isLight ? 'text-sm text-slate-700' : 'text-sm text-slate-300';
  const editGoalIconClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-700 bg-white p-2 text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-white'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-500/50 bg-slate-800/50 p-2 text-emerald-300 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';
  const iconGhostClass = isLight
    ? 'rounded p-0.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors'
    : 'rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors';
  const sectionPanelClass = isLight ? 'rounded-lg border border-slate-200 bg-slate-50 p-4' : 'rounded-lg border border-slate-700 bg-slate-800/50 p-4';
  const sectionPanelInnerClass = isLight ? 'rounded-lg border border-slate-200 bg-white p-3' : 'rounded-lg border border-slate-700 bg-slate-900/70 p-3';
  const borderDividerClass = isLight ? 'border-slate-200' : 'border-slate-700';
  const goalColumnBorderClass = isLight ? 'border-slate-200' : 'border-slate-700';
  const tabStripBorderClass = isLight ? 'border-slate-200' : 'border-slate-800';
  const inlineInputClass = isLight
    ? 'flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900'
    : 'flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-100';
  const rangeClass = isLight
    ? 'w-full h-2 rounded-full bg-slate-200 appearance-none accent-emerald-600'
    : 'w-full h-2 rounded-full bg-slate-700 appearance-none accent-emerald-500';
  const checkboxClass = isLight
    ? 'rounded border-slate-400 bg-white text-emerald-600 focus:ring-emerald-500 focus:ring-offset-white'
    : 'rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800';
  const addCategorySquareClass = isLight
    ? 'px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-700 hover:border-emerald-500/50 hover:bg-emerald-50 hover:text-emerald-800 transition-all duration-200 flex items-center justify-center min-w-[60px]'
    : 'px-4 py-3 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300 transition-all duration-200 flex items-center justify-center min-w-[60px]';
  const modalHeaderBorderClass = isLight ? 'border-slate-200' : 'border-slate-700';
  const modalFooterBtnClass = isLight
    ? 'w-full px-4 py-2 rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors'
    : 'w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors';
  const deleteGoalOutlineClass = isLight
    ? 'px-4 py-2 rounded-lg border-2 border-red-400 bg-white text-red-800 hover:bg-red-50 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2 focus:ring-offset-white'
    : 'px-4 py-2 rounded-lg bg-red-600/90 text-white text-sm font-medium hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-slate-900';
  const panelHeadingClass = isLight ? 'text-sm font-medium text-slate-800' : 'text-sm font-medium text-slate-200';
  const panelStrongTextClass = isLight ? 'text-slate-900' : 'text-slate-200';
  const addTaskLinkClass = isLight
    ? 'mt-2 text-xs font-medium text-emerald-700 hover:text-emerald-900'
    : 'mt-2 text-xs text-emerald-400 hover:text-emerald-300';

  const [localGoals, setLocalGoals] = useState<Goal[]>([]);
  const [localCategories, setLocalCategories] = useState<Category[]>([]);
  const goals = ctx ? ctx.goals : localGoals;
  const setGoals = ctx ? ctx.setGoals : setLocalGoals;
  const categories = ctx ? ctx.categories : localCategories;
  const setCategories = ctx ? ctx.setCategories : setLocalCategories;

  const [isLoadingData, setIsLoadingData] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadGoalsData = useCallback(async () => {
    if (!toolId) return;
    setIsLoadingData(true);
    try {
      const res = await fetch(`/api/tools/goals-tracking?toolId=${encodeURIComponent(toolId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setCategories(data.categories ?? []);
      setGoals(((data.goals ?? []) as Goal[]).map(normalizeGoal));
    } catch (e) {
      setSaveMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to load goals' });
    } finally {
      setIsLoadingData(false);
    }
  }, [toolId, setCategories, setGoals]);

  useEffect(() => {
    if (toolId) loadGoalsData();
  }, [toolId, loadGoalsData]);

  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setSaveMessage({ type, text });
    setTimeout(() => setSaveMessage(null), 3000);
  }, []);

  const apiPost = useCallback(
    async (resource: string, action: string, payload: Record<string, unknown>) => {
      if (!toolId) return false;
      const res = await fetch('/api/tools/goals-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource, action, toolId, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage('error', data.error || 'Request failed');
        return false;
      }
      return data;
    },
    [toolId, showMessage]
  );

  const refreshGoalsSilent = async () => {
    if (!toolId) return;
    try {
      const res = await fetch(`${API_BASE}?toolId=${encodeURIComponent(toolId)}`);
      const data = await res.json();
      if (!res.ok) return;
      const nextGoals = ((data.goals ?? []) as Goal[]).map(normalizeGoal);
      setGoals(nextGoals);
      setCategories(data.categories ?? []);
      setEditingGoal((prev) => {
        if (!prev) return prev;
        return nextGoals.find((goal) => goal.id === prev.id) ?? prev;
      });
    } catch {
      // Keep the current list if a silent refresh fails.
    }
  };

  const uploadGtFile = async (file: File, owner: { goalId?: string; noteId?: string }) => {
    if (!toolId) throw new Error('Tool ID is required');
    const formData = new FormData();
    formData.append('toolId', toolId);
    if (owner.goalId) formData.append('goalId', owner.goalId);
    if (owner.noteId) formData.append('noteId', owner.noteId);
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/attachments`, { method: 'POST', body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Failed to add file');
  };

  const fetchGtAttachmentBlob = async (attachmentId: string, inline = false) => {
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
      const blob = await fetchGtAttachmentBlob(item.id, true);
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
      const blob = await fetchGtAttachmentBlob(item.id);
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

  const addSavedFiles = async (owner: { goalId?: string; noteId?: string }, files: File[]) => {
    setAttachmentBusy(true);
    try {
      for (const file of files) {
        await uploadGtFile(file, owner);
      }
      await refreshGoalsSilent();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to add file');
    } finally {
      setAttachmentBusy(false);
    }
  };

  const removeSavedFile = async (attachmentId: string) => {
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
      await refreshGoalsSilent();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to remove file');
    } finally {
      setAttachmentBusy(false);
    }
  };

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#10b981');

  // Category edit/delete
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryColor, setEditingCategoryColor] = useState('#10b981');
  const [menuOpenCategoryId, setMenuOpenCategoryId] = useState<string | null>(null);
  const [deleteConfirmCategoryId, setDeleteConfirmCategoryId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Goal form
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    targetDate: new Date().toISOString().split('T')[0],
    priority: 'Medium' as Priority,
    status: 'Not Started' as GoalStatus,
    addToDashboard: false,
  });

  // Edit goal
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [deleteConfirmGoalId, setDeleteConfirmGoalId] = useState<string | null>(null);
  const [deleteGoalConfirmText, setDeleteGoalConfirmText] = useState('');

  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [completePrompt, setCompletePrompt] = useState<{ goalId: string; resumeSave?: boolean } | null>(null);

  // Update note (when editing a goal)
  const [newUpdateNoteDate, setNewUpdateNoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [newUpdateNoteText, setNewUpdateNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteDate, setEditNoteDate] = useState('');
  const [editNoteText, setEditNoteText] = useState('');
  const [showAllUpdatesGoalId, setShowAllUpdatesGoalId] = useState<string | null>(null);
  const promptedAt100GoalIdRef = useRef<string | null>(null);
  const [attachmentModal, setAttachmentModal] = useState<AttachmentTarget | null>(null);
  const [pendingGoalAttachments, setPendingGoalAttachments] = useState<AttachmentItem[]>([]);
  const [pendingUpdateAttachments, setPendingUpdateAttachments] = useState<AttachmentItem[]>([]);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [viewPreview, setViewPreview] = useState<AttachmentItem | null>(null);
  const [showExportPopup, setShowExportPopup] = useState(false);
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [exportAllCategories, setExportAllCategories] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const revokePending = (items: AttachmentItem[]) => {
    items.forEach((item) => {
      if (item.url) URL.revokeObjectURL(item.url);
    });
  };

  const closeAttachmentModal = () => {
    setAttachmentModal(null);
    setViewPreview(null);
  };

  const clearPendingGoalAttachments = () => {
    revokePending(pendingGoalAttachments);
    setPendingGoalAttachments([]);
  };

  const clearPendingUpdateAttachments = () => {
    revokePending(pendingUpdateAttachments);
    setPendingUpdateAttachments([]);
  };

  useEffect(() => {
    setNewUpdateNoteText('');
    setNewUpdateNoteDate(new Date().toISOString().split('T')[0]);
    clearPendingUpdateAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGoalId]);

  // Filters
  const resolvedCategoryId = isCreatingNewCategory
    ? null
    : pickOpenCategoryId(categories, selectedCategoryId);
  const selectedCategory = categories.find((c) => c.id === resolvedCategoryId);
  const goalsInCategory = goals.filter((g) => g.categoryId === resolvedCategoryId);
  const selectedGoal =
    selectedGoalId && !isAddingGoal
      ? goalsInCategory.find((g) => g.id === selectedGoalId) ?? null
      : null;

  // Persist first-in-list when categories arrive async; render already uses resolvedCategoryId
  useEffect(() => {
    if (isCreatingNewCategory) return;
    const next = pickOpenCategoryId(categories, selectedCategoryId);
    if (next !== selectedCategoryId) setSelectedCategoryId(next);
  }, [categories, selectedCategoryId, isCreatingNewCategory]);

  // When category changes, keep the open goal only if it still belongs here; otherwise show the list
  useEffect(() => {
    if (!selectedCategoryId) return;
    const inCategory = goals.filter((g) => g.categoryId === selectedCategoryId);
    setSelectedGoalId((prev) => {
      const stillInCategory = prev && inCategory.some((g) => g.id === prev);
      return stillInCategory ? prev : null;
    });
    setIsAddingGoal(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryId]);

  // Compute percent for a goal (either manual or from tasks)
  const getGoalPercent = useCallback((goal: Goal): number => {
    if (goal.useTaskProgressForPercent && goal.tasks.length > 0) {
      const completed = goal.tasks.filter((t) => t.completed).length;
      return Math.round((completed / goal.tasks.length) * 100);
    }
    return goal.percentComplete;
  }, []);

  // --- Category handlers ---
  const createCategory = async () => {
    if (!newCategoryName.trim()) return;
    if (toolId) {
      const data = await apiPost('category', 'create', {
        name: newCategoryName.trim(),
        card_color: newCategoryColor,
      });
      if (!data?.category) return;
      setCategories((prev) => [...prev, { id: data.category.id, name: data.category.name, card_color: data.category.card_color }]);
      setSelectedCategoryId(data.category.id);
      showMessage('success', 'Category created');
    } else {
      const id = generateId();
      setCategories((prev) => [...prev, { id, name: newCategoryName.trim(), card_color: newCategoryColor }]);
      setSelectedCategoryId(id);
    }
    setIsCreatingNewCategory(false);
    setNewCategoryName('');
    setNewCategoryColor('#10b981');
  };

  const selectCategory = (id: string) => {
    setSelectedCategoryId(id);
    setEditingCategoryId(null);
    setMenuOpenCategoryId(null);
  };

  const startEditingCategory = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setEditingCategoryName(cat.name);
    setEditingCategoryColor(cat.card_color);
    setMenuOpenCategoryId(null);
  };

  const cancelEditingCategory = () => {
    setEditingCategoryId(null);
    setEditingCategoryName('');
    setEditingCategoryColor('#10b981');
  };

  const saveCategoryEdit = async () => {
    if (!editingCategoryId || !editingCategoryName.trim()) return;
    if (toolId) {
      const data = await apiPost('category', 'update', {
        categoryId: editingCategoryId,
        name: editingCategoryName.trim(),
        card_color: editingCategoryColor,
      });
      if (!data?.category) return;
      setCategories((prev) =>
        prev.map((c) =>
          c.id === editingCategoryId
            ? { ...c, name: data.category.name, card_color: data.category.card_color }
            : c
        )
      );
      showMessage('success', 'Category updated');
    } else {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === editingCategoryId
            ? { ...c, name: editingCategoryName.trim(), card_color: editingCategoryColor }
            : c
        )
      );
    }
    cancelEditingCategory();
  };

  const deleteCategory = async () => {
    if (!deleteConfirmCategoryId || deleteConfirmText.toLowerCase() !== 'delete') return;
    const deleting = categories.find((c) => c.id === deleteConfirmCategoryId);
    if (deleting && isStockCategory(deleting)) return;
    if (toolId) {
      const ok = await apiPost('category', 'delete', { categoryId: deleteConfirmCategoryId });
      if (!ok) return;
      await loadGoalsData();
      showMessage('success', 'Category deleted');
    } else {
      setCategories((prev) => prev.filter((c) => c.id !== deleteConfirmCategoryId));
      setGoals((prev) => prev.filter((g) => g.categoryId !== deleteConfirmCategoryId));
    }
    if (selectedCategoryId === deleteConfirmCategoryId) {
      const remaining = categories.filter((c) => c.id !== deleteConfirmCategoryId);
      setSelectedCategoryId(remaining.length > 0 ? remaining[0].id : null);
    }
    setDeleteConfirmCategoryId(null);
    setDeleteConfirmText('');
  };

  // --- Goal handlers ---
  const startAddingGoal = () => {
    if (!resolvedCategoryId) return;
    setSelectedGoalId(null);
    setIsAddingGoal(true);
    clearPendingGoalAttachments();
    closeAttachmentModal();
    setNewGoal({
      title: '',
      description: '',
      targetDate: new Date().toISOString().split('T')[0],
      priority: 'Medium',
      status: 'Not Started',
      addToDashboard: false,
    });
  };

  const cancelAddingGoal = () => {
    setIsAddingGoal(false);
    setSelectedGoalId(null);
    clearPendingGoalAttachments();
    if (attachmentModal?.kind === 'goal' && attachmentModal.id === 'add') closeAttachmentModal();
  };

  const addGoal = async () => {
    if (!resolvedCategoryId || !newGoal.title.trim()) return;
    if (toolId) {
      const data = await apiPost('goal', 'create', {
        categoryId: resolvedCategoryId,
        title: newGoal.title.trim(),
        description: newGoal.description.trim(),
        targetDate: newGoal.targetDate,
        priority: newGoal.priority,
        status: newGoal.status,
        addToDashboard: newGoal.addToDashboard === true && Boolean(newGoal.targetDate),
      });
      if (!data?.goal) return;
      setGoals((prev) => [...prev, normalizeGoal({ ...data.goal, attachments: [] })]);
      try {
        for (const queued of pendingGoalAttachments) {
          if (!queued.file) continue;
          await uploadGtFile(queued.file, { goalId: data.goal.id });
        }
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Failed to add file');
      }
      await refreshGoalsSilent();
      setSelectedGoalId(data.goal.id);
      showMessage('success', 'Goal created');
    } else {
      const id = generateId();
      const goal: Goal = {
        id,
        categoryId: resolvedCategoryId,
        title: newGoal.title.trim(),
        description: newGoal.description.trim(),
        targetDate: newGoal.targetDate,
        priority: newGoal.priority,
        status: newGoal.status,
        percentComplete: 0,
        showOnDashboard: false,
        reminderDays: null,
        lastUpdateDate: null,
        useTaskProgressForPercent: false,
        addToDashboard: newGoal.addToDashboard === true && Boolean(newGoal.targetDate),
        phases: [],
        tasks: [],
        updateNotes: [],
        attachments: [],
      };
      setGoals((prev) => [...prev, goal]);
      setSelectedGoalId(id);
    }
    setIsAddingGoal(false);
    clearPendingGoalAttachments();
    if (attachmentModal?.kind === 'goal' && attachmentModal.id === 'add') closeAttachmentModal();
    setNewGoal({
      title: '',
      description: '',
      targetDate: new Date().toISOString().split('T')[0],
      priority: 'Medium',
      status: 'Not Started',
      addToDashboard: false,
    });
  };

  const startEditingGoal = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setEditingGoal(JSON.parse(JSON.stringify(goal)));
    setNewUpdateNoteDate(new Date().toISOString().split('T')[0]);
    setNewUpdateNoteText('');
    clearPendingUpdateAttachments();
    promptMarkCompletedIfAt100(getGoalPercent(goal), goal.status, goal.id, { allowAlreadyAt100: true });
  };

  const cancelEditingGoal = () => {
    setEditingGoalId(null);
    setEditingGoal(null);
    setEditingNoteId(null);
  };

  const persistGoalEdit = async (status: GoalStatus) => {
    if (!editingGoal) return;
    if (toolId) {
      const data = await apiPost('goal', 'update', {
        goalId: editingGoal.id,
        title: editingGoal.title,
        description: editingGoal.description,
        targetDate: editingGoal.targetDate || null,
        priority: editingGoal.priority,
        status,
        percentComplete: editingGoal.percentComplete,
        showOnDashboard: false,
        reminderDays: editingGoal.reminderDays,
        useTaskProgressForPercent: editingGoal.useTaskProgressForPercent,
        addToDashboard: editingGoal.addToDashboard === true && Boolean(editingGoal.targetDate),
      });
      if (!data?.goal) return;
      setGoals((prev) => prev.map((g) => (g.id === editingGoal.id ? normalizeGoal(data.goal) : g)));
      showMessage('success', 'Goal updated');
      setEditingGoalId(null);
      setEditingGoal(null);
      setEditingNoteId(null);
      return;
    }
    setGoals((prev) => prev.map((g) => (g.id === editingGoal.id ? { ...editingGoal, status } : g)));
    setEditingGoalId(null);
    setEditingGoal(null);
    setEditingNoteId(null);
  };

  const saveGoalEdit = async () => {
    if (!editingGoal) return;
    const percent = getGoalPercent(editingGoal);
    const status = editingGoal.status;
    if (percent >= 100 && status !== 'Completed') {
      if (promptMarkCompletedIfAt100(percent, status, editingGoal.id, { allowAlreadyAt100: true, resumeSave: true })) {
        return;
      }
    }
    await persistGoalEdit(status);
  };

  const updateEditingGoal = (updates: Partial<Goal>) => {
    if (editingGoal) setEditingGoal((prev) => (prev ? { ...prev, ...updates } : null));
  };

  const markGoalCompleted = async (goalId: string) => {
    setEditingGoal((prev) => (prev?.id === goalId ? { ...prev, status: 'Completed' } : prev));
    if (toolId) {
      const data = await apiPost('goal', 'update', { goalId, status: 'Completed' });
      if (!data?.goal) return;
      setGoals((prev) => prev.map((g) => (g.id === goalId ? normalizeGoal(data.goal) : g)));
      return;
    }
    setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, status: 'Completed' } : g)));
  };

  const promptMarkCompletedIfAt100 = (
    nextPercent: number,
    status: GoalStatus,
    goalId: string,
    options?: { prevPercent?: number; allowAlreadyAt100?: boolean; resumeSave?: boolean }
  ): boolean => {
    if (nextPercent < 100) {
      if (promptedAt100GoalIdRef.current === goalId) promptedAt100GoalIdRef.current = null;
      return false;
    }
    if (status === 'Completed') return false;
    if (!options?.allowAlreadyAt100 && options?.prevPercent !== undefined && options.prevPercent >= 100) {
      return false;
    }
    if (promptedAt100GoalIdRef.current === goalId) return false;
    promptedAt100GoalIdRef.current = goalId;
    setCompletePrompt({ goalId, resumeSave: options?.resumeSave });
    return true;
  };

  const confirmMarkGoalCompleted = () => {
    if (!completePrompt) return;
    const { goalId, resumeSave } = completePrompt;
    setCompletePrompt(null);
    if (resumeSave) {
      void persistGoalEdit('Completed');
      return;
    }
    void markGoalCompleted(goalId);
  };

  const cancelMarkGoalCompleted = () => {
    if (!completePrompt) return;
    const resumeSave = completePrompt.resumeSave;
    setCompletePrompt(null);
    if (resumeSave && editingGoal) {
      void persistGoalEdit(editingGoal.status);
    }
  };

  const promptMarkCompletedIfReached100 = (prevPercent: number, nextPercent: number, status: GoalStatus) => {
    if (!editingGoal) return;
    promptMarkCompletedIfAt100(nextPercent, status, editingGoal.id, { prevPercent });
  };

  const addUpdateNoteToGoal = async (goal: Goal | null) => {
    if (!goal || !newUpdateNoteText.trim()) return;
    let note: UpdateNote;
    if (toolId) {
      const data = await apiPost('update_note', 'create', {
        goalId: goal.id,
        noteDate: newUpdateNoteDate,
        note: newUpdateNoteText.trim(),
      });
      if (!data?.note) return;
      note = {
        id: data.note.id,
        goalId: data.note.goalId,
        noteDate: data.note.noteDate,
        note: data.note.note,
        attachments: [],
      };
      try {
        for (const queued of pendingUpdateAttachments) {
          if (!queued.file) continue;
          await uploadGtFile(queued.file, { noteId: note.id });
        }
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Failed to add file');
      }
      await refreshGoalsSilent();
    } else {
      note = {
        id: generateId(),
        goalId: goal.id,
        noteDate: newUpdateNoteDate,
        note: newUpdateNoteText.trim(),
        attachments: [],
      };
      const applyNote = (g: Goal) =>
        g.id === goal.id
          ? { ...g, updateNotes: [...g.updateNotes, note], lastUpdateDate: newUpdateNoteDate }
          : g;
      setGoals((prev) => prev.map(applyNote));
      if (editingGoal?.id === goal.id) {
        setEditingGoal((prev) => (prev ? applyNote(prev) : null));
      }
    }
    setNewUpdateNoteText('');
    setNewUpdateNoteDate(new Date().toISOString().split('T')[0]);
    clearPendingUpdateAttachments();
    if (attachmentModal?.kind === 'update' && attachmentModal.id === 'add') closeAttachmentModal();
  };

  const addUpdateNoteToEditingGoal = async () => {
    await addUpdateNoteToGoal(editingGoal);
  };

  const cancelAddingUpdateOnCard = () => {
    setNewUpdateNoteText('');
    setNewUpdateNoteDate(new Date().toISOString().split('T')[0]);
    clearPendingUpdateAttachments();
    if (attachmentModal?.kind === 'update' && attachmentModal.id === 'add') closeAttachmentModal();
  };

  const startEditingNote = (note: UpdateNote) => {
    setEditingNoteId(note.id);
    setEditNoteDate(note.noteDate);
    setEditNoteText(note.note);
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setEditNoteDate('');
    setEditNoteText('');
  };

  const saveEditedNote = async () => {
    if (!editingGoal || !editingNoteId || !editNoteText.trim()) return;
    if (toolId) {
      await apiPost('update_note', 'update', {
        noteId: editingNoteId,
        goalId: editingGoal.id,
        noteDate: editNoteDate,
        note: editNoteText.trim(),
      });
    }
    setEditingGoal((prev) =>
      prev
        ? {
            ...prev,
            updateNotes: prev.updateNotes.map((n) =>
              n.id === editingNoteId ? { ...n, noteDate: editNoteDate, note: editNoteText.trim() } : n
            ),
          }
        : null
    );
    cancelEditingNote();
  };

  const deleteUpdateNote = async (noteId: string) => {
    if (!editingGoal) return;
    if (toolId) {
      const ok = await apiPost('update_note', 'delete', { noteId });
      if (!ok) return;
    }
    const applyDelete = (g: Goal) =>
      g.id === editingGoal.id ? { ...g, updateNotes: g.updateNotes.filter((n) => n.id !== noteId) } : g;
    setGoals((prev) => prev.map(applyDelete));
    setEditingGoal((prev) => (prev ? applyDelete(prev) : null));
    if (editingNoteId === noteId) cancelEditingNote();
    if (attachmentModal?.kind === 'update' && attachmentModal.id === noteId) closeAttachmentModal();
  };

  const deleteGoal = async () => {
    if (!deleteConfirmGoalId || deleteGoalConfirmText.toLowerCase() !== 'delete') return;
    const categoryGoals = goals.filter((g) => g.categoryId === selectedCategoryId);
    const remaining = categoryGoals.filter((g) => g.id !== deleteConfirmGoalId);
    if (toolId) {
      const ok = await apiPost('goal', 'delete', { goalId: deleteConfirmGoalId });
      if (!ok) return;
      await loadGoalsData();
      showMessage('success', 'Goal deleted');
    } else {
      setGoals((prev) => prev.filter((g) => g.id !== deleteConfirmGoalId));
    }
    setDeleteConfirmGoalId(null);
    setDeleteGoalConfirmText('');
    setEditingGoalId(null);
    setEditingGoal(null);
    closeAttachmentModal();
    if (selectedGoalId === deleteConfirmGoalId) {
      setSelectedGoalId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const addPhaseToEditingGoal = async () => {
    if (!editingGoal) return;
    const order = editingGoal.phases.length;
    if (toolId) {
      const data = await apiPost('phase', 'create', {
        goalId: editingGoal.id,
        name: `Phase ${order + 1}`,
        display_order: order,
      });
      if (!data?.phase) return;
      const phase: Phase = {
        id: data.phase.id,
        goalId: data.phase.goalId,
        name: data.phase.name,
        order: data.phase.order,
      };
      setEditingGoal((prev) => (prev ? { ...prev, phases: [...prev.phases, phase] } : null));
    } else {
      const phase: Phase = { id: generateId(), goalId: editingGoal.id, name: `Phase ${order + 1}`, order };
      setEditingGoal((prev) => (prev ? { ...prev, phases: [...prev.phases, phase] } : null));
    }
  };

  const updatePhaseName = async (phaseId: string, name: string) => {
    setEditingGoal((prev) =>
      prev
        ? {
            ...prev,
            phases: prev.phases.map((p) => (p.id === phaseId ? { ...p, name } : p)),
          }
        : null
    );
    if (toolId) await apiPost('phase', 'update', { phaseId, name });
  };

  const deletePhaseFromEditingGoal = async (phaseId: string) => {
    if (!editingGoal) return;
    if (toolId) await apiPost('phase', 'delete', { phaseId });
    setEditingGoal((prev) =>
      prev
        ? {
            ...prev,
            phases: prev.phases.filter((p) => p.id !== phaseId),
            tasks: prev.tasks.filter((t) => {
              const phase = prev.phases.find((ph) => ph.id === phaseId);
              return phase ? t.phaseId !== phaseId : true;
            }),
          }
        : null
    );
  };

  const addTaskToPhase = async (phaseId: string) => {
    if (!editingGoal) return;
    if (toolId) {
      const data = await apiPost('task', 'create', { phaseId, goalId: editingGoal.id, title: 'New task' });
      if (!data?.task) return;
      const task: Task = {
        id: data.task.id,
        phaseId: data.task.phaseId,
        title: data.task.title,
        completed: data.task.completed,
      };
      setEditingGoal((prev) => (prev ? { ...prev, tasks: [...prev.tasks, task] } : null));
    } else {
      const task: Task = { id: generateId(), phaseId, title: 'New task', completed: false };
      setEditingGoal((prev) => (prev ? { ...prev, tasks: [...prev.tasks, task] } : null));
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    setEditingGoal((prev) =>
      prev
        ? { ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)) }
        : null
    );
    if (toolId) {
      if (updates.title !== undefined) await apiPost('task', 'update', { taskId, title: updates.title });
    }
  };

  const toggleTaskCompleted = async (taskId: string) => {
    const task = editingGoal?.tasks.find((t) => t.id === taskId);
    const next = task ? !task.completed : false;
    const nextGoal = editingGoal
      ? { ...editingGoal, tasks: editingGoal.tasks.map((t) => (t.id === taskId ? { ...t, completed: next } : t)) }
      : null;
    const prevPercent = editingGoal ? getGoalPercent(editingGoal) : 0;
    const nextPercent = nextGoal ? getGoalPercent(nextGoal) : 0;
    setEditingGoal(nextGoal);
    if (toolId) await apiPost('task', 'update', { taskId, completed: next });
    if (editingGoal) promptMarkCompletedIfReached100(prevPercent, nextPercent, editingGoal.status);
  };

  const deleteTask = async (taskId: string) => {
    const nextGoal = editingGoal
      ? { ...editingGoal, tasks: editingGoal.tasks.filter((t) => t.id !== taskId) }
      : null;
    const prevPercent = editingGoal ? getGoalPercent(editingGoal) : 0;
    const nextPercent = nextGoal ? getGoalPercent(nextGoal) : 0;
    if (toolId) await apiPost('task', 'delete', { taskId });
    setEditingGoal(nextGoal);
    if (editingGoal) promptMarkCompletedIfReached100(prevPercent, nextPercent, editingGoal.status);
  };

  // Escape to close modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (attachmentModal) return;
        if (showExportPopup) {
          if (!isExportingPdf) setShowExportPopup(false);
          return;
        }
        setMenuOpenCategoryId(null);
        if (showAllUpdatesGoalId) setShowAllUpdatesGoalId(null);
        if (deleteConfirmCategoryId) {
          setDeleteConfirmCategoryId(null);
          setDeleteConfirmText('');
        }
        if (completePrompt) {
          cancelMarkGoalCompleted();
          return;
        }
        if (deleteConfirmGoalId) {
          setDeleteConfirmGoalId(null);
          setDeleteGoalConfirmText('');
        }
        if (editingCategoryId) {
          cancelEditingCategory();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [attachmentModal, showExportPopup, isExportingPdf, deleteConfirmCategoryId, deleteConfirmGoalId, showAllUpdatesGoalId, editingCategoryId, completePrompt]);

  const savedGoalForAttachments =
    attachmentModal?.kind === 'goal' && attachmentModal.id !== 'add'
      ? goals.find((goal) => goal.id === attachmentModal.id) ||
        (editingGoal?.id === attachmentModal.id ? editingGoal : null)
      : null;
  const savedUpdateForAttachments =
    attachmentModal?.kind === 'update' && attachmentModal.id !== 'add'
      ? goals.flatMap((goal) => goal.updateNotes).find((note) => note.id === attachmentModal.id) ||
        editingGoal?.updateNotes.find((note) => note.id === attachmentModal.id) ||
        null
      : null;
  const modalFiles: AttachmentItem[] =
    attachmentModal?.kind === 'goal' && attachmentModal.id === 'add'
      ? pendingGoalAttachments
      : attachmentModal?.kind === 'update' && attachmentModal.id === 'add'
        ? pendingUpdateAttachments
        : savedGoalForAttachments
          ? (savedGoalForAttachments.attachments || []).map((item) => ({
              id: item.id,
              name: item.name,
              size: item.size,
              type: item.type,
            }))
          : savedUpdateForAttachments
            ? (savedUpdateForAttachments.attachments || []).map((item) => ({
                id: item.id,
                name: item.name,
                size: item.size,
                type: item.type,
              }))
            : [];
  const modalTitle =
    attachmentModal?.kind === 'goal' && attachmentModal.id === 'add'
      ? newGoal.title.trim() || 'New goal'
      : attachmentModal?.kind === 'update' && attachmentModal.id === 'add'
        ? newUpdateNoteText.trim() || 'New update'
        : savedGoalForAttachments?.title ||
          (savedUpdateForAttachments
            ? `${formatDateForDisplay(savedUpdateForAttachments.noteDate)}${
                savedUpdateForAttachments.note ? ` · ${savedUpdateForAttachments.note}` : ''
              }`
            : 'Attachments');

  const exportToPDF = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);

    try {
      const currentCategoryId = resolvedCategoryId;
      const useAllCategories = exportAllCategories || !currentCategoryId;
      const categoriesToExport = useAllCategories
        ? categories
        : categories.filter((category) => category.id === currentCategoryId);
      const selectedCategoryName = categories.find((category) => category.id === currentCategoryId)?.name;

      const matchesExport = (goal: Goal) => {
        if (!includeCompleted && goal.status === 'Completed') return false;
        if (!useAllCategories && goal.categoryId !== currentCategoryId) return false;
        return true;
      };

      const categoryIds = new Set(categories.map((category) => category.id));
      const goalsByCategory = categoriesToExport.map((category) => ({
        category,
        goals: goals.filter((goal) => goal.categoryId === category.id && matchesExport(goal)).sort(compareGoalsForExport),
      }));

      if (useAllCategories) {
        const uncategorized = goals
          .filter((goal) => !categoryIds.has(goal.categoryId) && matchesExport(goal))
          .sort(compareGoalsForExport);
        if (uncategorized.length > 0) {
          goalsByCategory.push({
            category: { id: 'uncategorized', name: 'Uncategorized', card_color: '#64748b' },
            goals: uncategorized,
          });
        }
      }

      const exportedGoals = goalsByCategory.flatMap((group) => group.goals);
      const groupsWithGoals = goalsByCategory.filter((group) => group.goals.length > 0);
      const statusCounts: Record<GoalStatus, number> = {
        'Not Started': 0,
        'In Progress': 0,
        Delayed: 0,
        Completed: 0,
      };
      exportedGoals.forEach((goal) => {
        statusCounts[goal.status] += 1;
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
        const lines = pdf.splitTextToSize(text, maxWidth) as string[];
        const lineHeight = fontSize * 0.42;
        checkNewPage(lines.length * lineHeight + 2);
        lines.forEach((line) => {
          pdf.text(line, margin + indent, yPos);
          yPos += lineHeight;
        });
        yPos += 2;
      };

      const writeGoal = (goal: Goal) => {
        checkNewPage(28);
        addText(goal.title, 12, true, 5);
        addText(`Status: ${goal.status}`, 9, false, 8);
        addText(`Priority: ${goal.priority}`, 9, false, 8);
        addText(`Target date: ${goal.targetDate ? formatDateForDisplay(goal.targetDate) : '—'}`, 9, false, 8);
        addText(`Percent complete: ${getGoalPercent(goal)}%`, 9, false, 8);
        if (goal.description.trim()) {
          addText(`Description: ${goal.description.trim()}`, 9, false, 8);
        }
        if (goal.lastUpdateDate) {
          addText(`Last update: ${formatDateForDisplay(goal.lastUpdateDate)}`, 9, false, 8);
        }

        const phases = [...goal.phases].sort((a, b) => a.order - b.order);
        if (phases.length > 0) {
          addText('Phases', 10, true, 8);
          phases.forEach((phase) => {
            const phaseTasks = goal.tasks.filter((task) => task.phaseId === phase.id);
            const done = phaseTasks.filter((task) => task.completed).length;
            addText(
              `${phase.name} (${done}/${phaseTasks.length} tasks · ${getPhasePercent(goal, phase.id)}%)`,
              9,
              true,
              10
            );
            if (phaseTasks.length === 0) {
              addText('No tasks.', 8, false, 12, true);
            }
            phaseTasks.forEach((task) => {
              addText(`${task.completed ? '[x]' : '[ ]'} ${task.title}`, 8, false, 12);
            });
          });
        }

        const orphanTasks = goal.tasks.filter((task) => !goal.phases.some((phase) => phase.id === task.phaseId));
        if (orphanTasks.length > 0) {
          addText('Tasks', 10, true, 8);
          orphanTasks.forEach((task) => {
            addText(`${task.completed ? '[x]' : '[ ]'} ${task.title}`, 8, false, 12);
          });
        }

        const notes = [...goal.updateNotes].sort((a, b) => b.noteDate.localeCompare(a.noteDate));
        if (notes.length > 0) {
          addText('Updates', 10, true, 8);
          notes.forEach((note) => {
            addText(`${formatDateForDisplay(note.noteDate)}: ${note.note}`, 8, false, 10);
          });
        }

        yPos += 3;
      };

      fillPage();

      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.title[0], colors.title[1], colors.title[2]);
      const title = 'Goals Tracking Report';
      pdf.text(title, (pageWidth - pdf.getTextWidth(title)) / 2, yPos);
      yPos += 10;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
      pdf.text(`Generated on: ${formatReportDate(new Date())}`, margin, yPos);
      yPos += 6;

      const scopeLabel = useAllCategories ? 'All categories' : selectedCategoryName || 'Selected category';
      const completedLabel = includeCompleted ? 'Open and completed goals' : 'Open goals only';
      pdf.text(`${completedLabel}  ·  ${scopeLabel}`, margin, yPos);
      yPos += 10;

      addSectionHeader('Summary');
      addText(`Goals: ${exportedGoals.length}`, 11, true, 5);
      addText(`Not Started: ${statusCounts['Not Started']}`, 10, false, 5);
      addText(`In Progress: ${statusCounts['In Progress']}`, 10, false, 5);
      addText(`Delayed: ${statusCounts.Delayed}`, 10, false, 5);
      if (includeCompleted) {
        addText(`Completed: ${statusCounts.Completed}`, 10, false, 5);
      }
      addText(`Categories: ${groupsWithGoals.length}`, 10, false, 5);
      yPos += 4;

      if (groupsWithGoals.length === 0) {
        addText('No goals match the selected options.', 10, false, 5, true);
      }

      groupsWithGoals.forEach(({ category, goals: categoryGoals }) => {
        addSectionHeader(category.name);
        const openGoals = categoryGoals.filter((goal) => goal.status !== 'Completed');
        const completedGoals = categoryGoals.filter((goal) => goal.status === 'Completed');

        if (openGoals.length > 0) {
          openGoals.forEach(writeGoal);
        } else if (!includeCompleted || completedGoals.length === 0) {
          addText('No open goals.', 9, false, 8, true);
        }

        if (includeCompleted && completedGoals.length > 0) {
          yPos += 2;
          addText('Completed', 11, true, 5);
          yPos += 1;
          completedGoals.forEach(writeGoal);
        }

        yPos += 3;
      });

      const attachmentRefs = exportedGoals.flatMap((goal) => {
        const goalFiles = (goal.attachments || [])
          .map((file) => file.name?.trim())
          .filter((name): name is string => Boolean(name))
          .map((fileName) => `${goal.title} — ${fileName}`);
        const noteFiles = (goal.updateNotes || []).flatMap((note) =>
          (note.attachments || [])
            .map((file) => file.name?.trim())
            .filter((name): name is string => Boolean(name))
            .map((fileName) => `${goal.title} — ${fileName}`)
        );
        return [...goalFiles, ...noteFiles];
      });

      if (attachmentRefs.length > 0) {
        addSectionHeader('Attachments');
        addText('File names only. Files themselves are not included in this report.', 8, false, 5, true);
        attachmentRefs.forEach((line) => addText(line, 9, false, 8));
      }

      pdf.save(`Goals_Tracking_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      setShowExportPopup(false);
    } catch (error) {
      console.error('Error exporting goals tracking PDF:', error);
      showError(error instanceof Error ? error.message : 'Failed to generate PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      {toolId && isLoadingData && (
        <div className={loadingOverlayClass}>
          <span className={loadingTextClass}>Loading...</span>
        </div>
      )}
      {saveMessage && (
        <div className={saveMessage.type === 'success' ? successAlertClass : errorAlertClass}>
          {saveMessage.text}
        </div>
      )}
      {/* Title and description */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={titleClass}>Goals Tracking</h2>
          <p className={descClass}>
            Create goals by category, track progress with phases and tasks, and get reminders when updates are due.
          </p>
        </div>
        <ExportPdfIconButton
          title="Export goals to PDF"
          onClick={() => setShowExportPopup(true)}
        />
      </div>

      {/* Category selector */}
      <div className={cardClass}>
        <label className={labelClass}>Select your Category</label>

        {!isCreatingNewCategory ? (
          <div className="flex items-center gap-3 flex-wrap">
            {categories.map((cat) => (
                <div key={cat.id} className="relative">
                  <button
                    onClick={() => selectCategory(cat.id)}
                    className={`px-4 py-3 rounded-lg border transition-all duration-200 min-w-[120px] relative ${
                      resolvedCategoryId === cat.id
                        ? 'shadow-lg'
                        : isLight
                          ? 'hover:border-slate-400'
                          : 'hover:border-slate-600'
                    }`}
                    style={{
                      borderColor: cat.card_color,
                      backgroundColor: resolvedCategoryId === cat.id ? `${cat.card_color}15` : `${cat.card_color}08`,
                      color: cat.card_color,
                    }}
                  >
                    <div className="font-medium text-center">{cat.name}</div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenCategoryId(menuOpenCategoryId === cat.id ? null : cat.id);
                    }}
                    className={`absolute top-1 right-1 p-1 rounded transition-colors ${isLight ? 'hover:bg-slate-200/80' : 'hover:bg-slate-700/50'}`}
                    title="Category options"
                    aria-label="Category options"
                  >
                    <svg
                      className={`h-4 w-4 ${isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                  </button>
                  {menuOpenCategoryId === cat.id && (
                    <div className={popupMenuClass}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingCategory(cat);
                        }}
                        className={popupItemClass}
                      >
                        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      {!isStockCategory(cat) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenCategoryId(null);
                            setDeleteConfirmCategoryId(cat.id);
                            setDeleteConfirmText('');
                          }}
                          className={popupItemDangerClass}
                        >
                          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setIsCreatingNewCategory(true);
                setSelectedCategoryId(null);
                setEditingCategoryId(null);
                setNewCategoryColor('#10b981');
              }}
              className={addCategorySquareClass}
              title="Add New Category"
              aria-label="Add New Category"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className={`block text-sm font-medium mb-2 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>New Category Name</label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Enter category name"
                className={inputClassPad}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createCategory();
                  if (e.key === 'Escape') {
                    setIsCreatingNewCategory(false);
                    setNewCategoryName('');
                  }
                }}
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <label className={isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400'}>Color:</label>
              <input
                type="color"
                value={newCategoryColor}
                onChange={(e) => setNewCategoryColor(e.target.value)}
                className={`h-8 w-12 rounded cursor-pointer ${isLight ? 'border border-slate-300' : 'border border-slate-600'}`}
              />
            </div>
            <button
              type="button"
              onClick={createCategory}
              disabled={!newCategoryName.trim()}
              className={primaryButtonClass}
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreatingNewCategory(false);
                setNewCategoryName('');
              }}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {menuOpenCategoryId && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpenCategoryId(null)} aria-hidden="true" />
      )}

      {editingCategoryId &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className={modalBackdropClass} role="presentation" onClick={cancelEditingCategory}>
            <div
              className={modalCardConfirmClass}
              role="dialog"
              aria-modal="true"
              aria-labelledby="gt-edit-category-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="gt-edit-category-title" className={`${modalTitleClass} mb-4`}>
                Edit Category
              </h3>
              <div className="flex items-end gap-2 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label className={`block text-sm font-medium mb-2 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    Category Name
                  </label>
                  <input
                    type="text"
                    value={editingCategoryName}
                    onChange={(e) => setEditingCategoryName(e.target.value)}
                    placeholder="Enter category name"
                    className={inputClassPad}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveCategoryEdit();
                      if (e.key === 'Escape') cancelEditingCategory();
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className={isLight ? 'text-sm text-slate-600' : 'text-sm text-slate-400'}>Color:</label>
                  <input
                    type="color"
                    value={editingCategoryColor}
                    onChange={(e) => setEditingCategoryColor(e.target.value)}
                    className={`h-8 w-12 rounded cursor-pointer ${isLight ? 'border border-slate-300' : 'border border-slate-600'}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={saveCategoryEdit}
                  disabled={!editingCategoryName.trim()}
                  className={primaryButtonClass}
                >
                  Save
                </button>
                <button type="button" onClick={cancelEditingCategory} className={secondaryButtonClass}>
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Delete category confirmation */}
      {deleteConfirmCategoryId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={modalCardConfirmClass}>
            <h3 className={`${modalTitleClass} mb-2`}>Delete Category</h3>
            <div className={deleteWarningBoxClass}>
              <p className={deleteWarningTextClass}>Warning: This action cannot be undone.</p>
              <p className={deleteWarningDetailClass}>
                All goals, phases, tasks, and update notes in this category will be permanently deleted.
              </p>
            </div>
            <p className={deleteInstructionTextClass}>
              To confirm, type <strong className={deleteInstructionKeywordClass}>delete</strong> below:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className={deleteConfirmInputClass}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={deleteCategory}
                disabled={deleteConfirmText.toLowerCase() !== 'delete'}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Category
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmCategoryId(null);
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

      {!isLoadingData && categories.length === 0 && !isCreatingNewCategory && (
        <div className={cardMutedClass}>
          <p className={isLight ? 'text-slate-600' : 'text-slate-400'}>Select a category or create one to manage goals.</p>
        </div>
      )}

      {resolvedCategoryId && selectedCategory && (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3
              className={`text-[18px] font-medium ${
                isLight ? 'text-slate-800' : 'text-slate-200'
              }`}
            >
              {selectedCategory.name}
            </h3>
            <button type="button" onClick={startAddingGoal} className={primaryButtonClass}>
              + Add Goal
            </button>
          </div>

          {goalsInCategory.length > 0 && (
            <ul className={`${tableWrapClass} mt-4`}>
              {goalsInCategory.map((goal, index) => {
                const percent = getGoalPercent(goal);
                const isOpen = selectedGoalId === goal.id;
                return (
                  <li
                    key={goal.id}
                    className={`flex items-center ${index > 0 ? `border-t ${borderDividerClass}` : ''} ${
                      isOpen
                        ? isLight
                          ? 'bg-slate-100'
                          : 'bg-slate-800/50'
                        : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGoalId(goal.id);
                        setIsAddingGoal(false);
                      }}
                      className={`min-w-0 flex-1 flex items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors ${
                        isOpen
                          ? isLight
                            ? 'text-slate-900'
                            : 'text-slate-100'
                          : isLight
                            ? 'text-slate-800 hover:bg-slate-50'
                            : 'text-slate-200 hover:bg-slate-800/30'
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{goal.title}</span>
                      {goal.addToDashboard && <OnCalendarChip isLight={isLight} />}
                      {isGoalReminderOverdue(goal) && (
                        <span
                          className="inline-flex text-amber-400 shrink-0"
                          title={`No update in ${goal.reminderDays} days — reminder overdue`}
                          aria-label="Update reminder overdue"
                        >
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 9a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm0 7a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                      <span className={`${panelStrongTextClass} shrink-0`}>{percent}%</span>
                    </button>
                    <div className="shrink-0 pr-3">
                      <AttachmentButton
                        count={(goal.attachments || []).length}
                        onClick={() => setAttachmentModal({ kind: 'goal', id: goal.id })}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Add goal form */}
          {isAddingGoal && (
            <div className={cardPad6Class}>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className={`${sectionTitleClass} mb-0`}>New Goal</h3>
                <AttachmentButton
                  count={pendingGoalAttachments.length}
                  onClick={() => setAttachmentModal({ kind: 'goal', id: 'add' })}
                />
              </div>
              <div className="space-y-4">
                <div>
                  <label className={labelClassSm}>
                    Goal Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newGoal.title}
                    onChange={(e) => setNewGoal((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Save for vacation"
                    className={inputClassPad}
                  />
                </div>
                <div>
                  <label className={labelClassSm}>Description</label>
                  <textarea
                    value={newGoal.description}
                    onChange={(e) => setNewGoal((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Optional details"
                    rows={2}
                    className={`${inputClassPad} resize-none`}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClassSm}>Target Date</label>
                    <input
                      type="date"
                      value={newGoal.targetDate}
                      onChange={(e) =>
                        setNewGoal((p) => ({
                          ...p,
                          targetDate: e.target.value,
                          addToDashboard: e.target.value ? p.addToDashboard : false,
                        }))
                      }
                      className={inputClassPad}
                    />
                  </div>
                  <div>
                    <label className={labelClassSm}>Priority</label>
                    <select
                      value={newGoal.priority}
                      onChange={(e) => setNewGoal((p) => ({ ...p, priority: e.target.value as Priority }))}
                      className={inputClassPad}
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClassSm}>Status</label>
                    <select
                      value={newGoal.status}
                      onChange={(e) => setNewGoal((p) => ({ ...p, status: e.target.value as GoalStatus }))}
                      className={inputClassPad}
                    >
                      <option value="Not Started">Not Started</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Delayed">Delayed</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>
                <DashboardCalendarSwitch
                  isOn={newGoal.addToDashboard}
                  isLight={isLight}
                  disabled={!newGoal.targetDate}
                  onToggle={() => setNewGoal((p) => ({ ...p, addToDashboard: !p.addToDashboard }))}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addGoal}
                    disabled={!newGoal.title.trim()}
                    className={primaryButtonClass}
                  >
                    Create Goal
                  </button>
                  <button type="button" onClick={cancelAddingGoal} className={secondaryButtonClass}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isAddingGoal && goalsInCategory.length === 0 && (
            <div className={`${cardMutedClass} mt-4`}>
              <p className={`mb-4 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                No goal selected. Click &quot;+ Add Goal&quot; to create one.
              </p>
              <button type="button" onClick={startAddingGoal} className={primaryButtonClass}>
                + Add Goal
              </button>
            </div>
          )}

          {/* Existing goal detail (opens from list row) */}
          {!isAddingGoal && selectedGoal && (
            <div className="mt-4">
              {(() => {
                  const goal = selectedGoal;
                  const percent = getGoalPercent(goal);
                  const recentUpdates = [...goal.updateNotes]
                    .sort((a, b) => b.noteDate.localeCompare(a.noteDate))
                    .slice(0, 3);
                  const showReminderWarning = isGoalReminderOverdue(goal);
                  return (
                    <div className={nestedGoalCardClass}>
                      <div className="flex flex-col md:flex-row items-stretch gap-6">
                        {/* Left 25%: Goal name, status bar, % complete */}
                        <div
                          className={`w-full md:w-1/4 min-w-0 flex flex-col pb-4 border-b md:pb-0 md:border-b-0 md:pr-4 md:border-r text-center md:min-h-[180px] ${goalColumnBorderClass}`}
                        >
                          <div>
                            <h3 className={`${goalTitleHeroClass} mb-3`}>{goal.title}</h3>
                            {goal.addToDashboard && (
                              <div className="flex justify-center mb-3">
                                <OnCalendarChip isLight={isLight} />
                              </div>
                            )}
                            {showReminderWarning && (
                              <div className="flex items-center justify-center gap-1.5 text-amber-400 mb-3">
                                <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 9a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm0 7a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm font-medium">Update overdue</span>
                              </div>
                            )}
                            <div className="mb-3 w-full">
                              <div className={`${mutedSmallClass} mb-1`}>Progress</div>
                              <div className={progressTrackClass}>
                                <div
                                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 flex flex-col justify-center">
                            <div className={percentDisplayClass}>{percent}%</div>
                          </div>
                        </div>
                        {/* Right 75%: Priority/Status/Target row + Recent updates below */}
                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className={tableWrapClass}>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className={tableHeadClass}>
                                  <th className={tableThClass}>Priority</th>
                                  <th className={tableThClass}>Status</th>
                                  <th className={tableThClass}>Target</th>
                                  <th className={tableThClass}>Tasks</th>
                                  <th className="text-right py-2 px-2 align-middle" scope="col">
                                    <div className="flex items-center justify-end gap-3">
                                      <AttachmentButton
                                        count={(goal.attachments || []).length}
                                        onClick={() => setAttachmentModal({ kind: 'goal', id: goal.id })}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => startEditingGoal(goal)}
                                        className={editGoalIconClass}
                                        title="Edit goal"
                                        aria-label="Edit goal"
                                      >
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      </button>
                                    </div>
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="py-2 px-3 align-top">
                                    <span
                                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                        goal.priority === 'High'
                                          ? isLight
                                            ? 'bg-red-100 text-red-800'
                                            : 'bg-red-500/20 text-red-300'
                                          : goal.priority === 'Medium'
                                            ? isLight
                                              ? 'bg-amber-100 text-amber-900'
                                              : 'bg-amber-500/20 text-amber-300'
                                            : isLight
                                              ? 'bg-slate-100 text-slate-700'
                                              : 'bg-slate-500/20 text-slate-300'
                                      }`}
                                    >
                                      {goal.priority}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 align-top">
                                    <span
                                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                        goal.status === 'Completed'
                                          ? isLight
                                            ? 'bg-emerald-100 text-emerald-900'
                                            : 'bg-emerald-500/20 text-emerald-300'
                                          : goal.status === 'Delayed'
                                            ? isLight
                                              ? 'bg-amber-100 text-amber-900'
                                              : 'bg-amber-500/20 text-amber-300'
                                            : goal.status === 'In Progress'
                                              ? isLight
                                                ? 'bg-blue-100 text-blue-900'
                                                : 'bg-blue-500/20 text-blue-300'
                                              : isLight
                                                ? 'bg-slate-100 text-slate-700'
                                                : 'bg-slate-500/20 text-slate-300'
                                      }`}
                                    >
                                      {goal.status}
                                    </span>
                                  </td>
                                  <td className={`py-2 px-3 align-top ${tableTdClass}`}>
                                    {goal.targetDate ? formatDateForDisplay(goal.targetDate) : '—'}
                                  </td>
                                  <td className={`py-2 px-3 align-top ${tableTdClass}`}>
                                    {goal.tasks.length > 0
                                      ? `${goal.tasks.filter((t) => t.completed).length}/${goal.tasks.length}`
                                      : '—'}
                                  </td>
                                  <td className="py-2 px-3" />
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <div className={recentUpdatesBoxClass}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`text-xs font-medium uppercase tracking-wider ${mutedSmallClass}`}>
                                Recent updates
                              </span>
                              {goal.updateNotes.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setShowAllUpdatesGoalId(goal.id)}
                                  className={iconGhostClass}
                                  title="View all update history"
                                  aria-label="View all update history"
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <input
                                type="date"
                                value={newUpdateNoteDate}
                                onChange={(e) => setNewUpdateNoteDate(e.target.value)}
                                className={`${inputClassPad} w-auto min-w-[140px]`}
                              />
                              <input
                                type="text"
                                value={newUpdateNoteText}
                                onChange={(e) => setNewUpdateNoteText(e.target.value)}
                                placeholder="What did you do?"
                                className={`${inputClassPad} flex-1 min-w-[160px]`}
                              />
                              <AttachmentButton
                                count={pendingUpdateAttachments.length}
                                onClick={() => setAttachmentModal({ kind: 'update', id: 'add' })}
                              />
                              <button
                                type="button"
                                onClick={() => addUpdateNoteToGoal(goal)}
                                disabled={!newUpdateNoteText.trim()}
                                className={primaryButtonSmClass}
                              >
                                Add update
                              </button>
                              <button
                                type="button"
                                onClick={cancelAddingUpdateOnCard}
                                className={secondaryButtonSmClass}
                              >
                                Cancel
                              </button>
                            </div>
                            {recentUpdates.length === 0 ? (
                              <p className={bodyMutedClass}>No updates yet.</p>
                            ) : (
                              <ul className={`space-y-2 ${bodyTextClass}`}>
                                {recentUpdates.map((n) => (
                                  <li key={n.id}>
                                    <span className={bodyMutedClass}>{formatDateForDisplay(n.noteDate)}</span>
                                    {' — '}
                                    {n.note}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
            </div>
          )}

          {/* View all updates popup */}
          {showAllUpdatesGoalId && (() => {
            const allUpdatesGoal = goals.find((g) => g.id === showAllUpdatesGoalId);
            if (!allUpdatesGoal) return null;
            const allNotes = [...allUpdatesGoal.updateNotes].sort((a, b) => b.noteDate.localeCompare(a.noteDate));
            return (
              <div className={modalBackdropClass}>
                <div className={modalCardSmClass}>
                  <div className={`flex items-center justify-between p-4 border-b ${modalHeaderBorderClass}`}>
                    <h3 className={modalHeadingClass}>Update history — {allUpdatesGoal.title}</h3>
                    <button
                      type="button"
                      onClick={() => setShowAllUpdatesGoalId(null)}
                      className={modalCloseClass}
                      aria-label="Close"
                      title="Close"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="overflow-y-auto p-4 space-y-2">
                    {allNotes.length === 0 ? (
                      <p className={bodyMutedClass}>No updates yet.</p>
                    ) : (
                      allNotes.map((n) => (
                        <div
                          key={n.id}
                          className={`flex items-start justify-between gap-2 rounded-lg px-3 py-2 text-sm border ${isLight ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-slate-700/70 bg-slate-800/30 text-slate-300'}`}
                        >
                          <div className="min-w-0">
                            <span className={bodyMutedClass}>{formatDateForDisplay(n.noteDate)}</span>
                            {' — '}
                            <span className="whitespace-pre-wrap">{n.note}</span>
                          </div>
                          <AttachmentButton
                            count={(n.attachments || []).length}
                            onClick={() => setAttachmentModal({ kind: 'update', id: n.id })}
                          />
                        </div>
                      ))
                    )}
                  </div>
                  <div className={`p-4 border-t ${modalHeaderBorderClass}`}>
                    <button type="button" onClick={() => setShowAllUpdatesGoalId(null)} className={modalFooterBtnClass}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Edit goal modal */}
          {editingGoalId && editingGoal && (
            <div className={modalBackdropClass}>
              <div className={modalCardClass}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={modalTitleClass}>Edit Goal</h3>
                  <div className="flex items-center gap-2">
                    <AttachmentButton
                      count={(editingGoal.attachments || []).length}
                      onClick={() => setAttachmentModal({ kind: 'goal', id: editingGoal.id })}
                    />
                    <button
                      type="button"
                      onClick={cancelEditingGoal}
                      className={modalCloseClass}
                      aria-label="Close modal"
                      title="Close modal"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={labelClassSm}>Goal Title</label>
                    <input
                      type="text"
                      value={editingGoal.title}
                      onChange={(e) => updateEditingGoal({ title: e.target.value })}
                      className={inputClassPad}
                    />
                  </div>
                  <div>
                    <label className={labelClassSm}>Description</label>
                    <textarea
                      value={editingGoal.description}
                      onChange={(e) => updateEditingGoal({ description: e.target.value })}
                      rows={2}
                      className={`${inputClassPad} resize-none`}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClassSm}>Target Date</label>
                      <input
                        type="date"
                        value={editingGoal.targetDate}
                        onChange={(e) =>
                          updateEditingGoal({
                            targetDate: e.target.value,
                            addToDashboard: e.target.value ? editingGoal.addToDashboard : false,
                          })
                        }
                        className={inputClassPad}
                      />
                    </div>
                    <div>
                      <label className={labelClassSm}>Priority</label>
                      <select
                        value={editingGoal.priority}
                        onChange={(e) => updateEditingGoal({ priority: e.target.value as Priority })}
                        className={inputClassPad}
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClassSm}>Status</label>
                      <select
                        value={editingGoal.status}
                        onChange={(e) => updateEditingGoal({ status: e.target.value as GoalStatus })}
                        className={inputClassPad}
                      >
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Delayed">Delayed</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  </div>

                  {/* Phases & Tasks */}
                  <div className={sectionPanelClass}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className={panelHeadingClass}>Phases & Tasks (Optional)</h4>
                      <button type="button" onClick={addPhaseToEditingGoal} className={primaryButtonTinyClass}>
                        + Phase
                      </button>
                    </div>
                    {editingGoal.phases.length === 0 ? (
                      <p className={bodyMutedClass}>No phases. Add a phase, then add tasks inside it.</p>
                    ) : (
                      <div className="space-y-4">
                        {editingGoal.phases
                          .slice()
                          .sort((a, b) => a.order - b.order)
                          .map((phase) => (
                            <div key={phase.id} className={sectionPanelInnerClass}>
                              <div className="flex items-center gap-2 mb-2">
                                <input
                                  type="text"
                                  value={phase.name}
                                  onChange={(e) => updatePhaseName(phase.id, e.target.value)}
                                  className={`${inlineInputClass} min-w-0`}
                                  aria-label="Phase name"
                                />
                                <span
                                  className={`${panelStrongTextClass} shrink-0 whitespace-nowrap tabular-nums text-sm font-semibold`}
                                  aria-label={`Phase progress ${getPhasePercent(editingGoal, phase.id)}%`}
                                >
                                  {getPhasePercent(editingGoal, phase.id)}%
                                </span>
                                <button
                                  type="button"
                                  onClick={() => deletePhaseFromEditingGoal(phase.id)}
                                  className={`shrink-0 rounded p-1 ${isLight ? 'text-slate-500 hover:bg-red-50 hover:text-red-700' : 'text-slate-400 hover:bg-slate-700 hover:text-red-300'}`}
                                  aria-label="Delete phase"
                                  title="Delete phase"
                                >
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                              <ul className="space-y-1 ml-2">
                                {editingGoal.tasks
                                  .filter((t) => t.phaseId === phase.id)
                                  .map((task) => (
                                    <li key={task.id} className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={task.completed}
                                        onChange={() => toggleTaskCompleted(task.id)}
                                        className={checkboxClass}
                                      />
                                      <input
                                        type="text"
                                        value={task.title}
                                        onChange={(e) => updateTask(task.id, { title: e.target.value })}
                                        className={inlineInputClass}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => deleteTask(task.id)}
                                        className={`rounded p-1 ${isLight ? 'text-slate-500 hover:text-red-700' : 'text-slate-400 hover:text-red-300'}`}
                                        aria-label="Delete task"
                                        title="Delete task"
                                      >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </li>
                                  ))}
                              </ul>
                              <button type="button" onClick={() => addTaskToPhase(phase.id)} className={addTaskLinkClass}>
                                + Add task
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Completion % */}
                  <div className={sectionPanelClass}>
                    <div className="flex items-center justify-between mb-2">
                      <label className={`text-sm font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Completion %</label>
                      <span className={panelStrongTextClass}>
                        {getGoalPercent(editingGoal)}%
                        {editingGoal.useTaskProgressForPercent ? (
                          <span className={`ml-2 font-normal ${mutedSmallClass}`}>From tasks</span>
                        ) : null}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={
                        editingGoal.useTaskProgressForPercent
                          ? getGoalPercent(editingGoal)
                          : editingGoal.percentComplete
                      }
                      onChange={(e) => {
                        if (editingGoal.useTaskProgressForPercent) return;
                        const percentComplete = Number(e.target.value);
                        const prevPercent = getGoalPercent(editingGoal);
                        updateEditingGoal({ percentComplete });
                        promptMarkCompletedIfReached100(
                          prevPercent,
                          getGoalPercent({ ...editingGoal, percentComplete }),
                          editingGoal.status
                        );
                      }}
                      disabled={editingGoal.useTaskProgressForPercent}
                      className={`${rangeClass} disabled:cursor-not-allowed disabled:opacity-70`}
                    />
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingGoal.useTaskProgressForPercent}
                        onChange={(e) => {
                          const useTaskProgressForPercent = e.target.checked;
                          const prevPercent = getGoalPercent(editingGoal);
                          updateEditingGoal({ useTaskProgressForPercent });
                          promptMarkCompletedIfReached100(
                            prevPercent,
                            getGoalPercent({ ...editingGoal, useTaskProgressForPercent }),
                            editingGoal.status
                          );
                        }}
                        className={checkboxClass}
                      />
                      <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        Use task completion for progress (each task = equal share of 100%)
                      </span>
                    </label>
                  </div>

                  {/* Update note */}
                  <div className={sectionPanelClass}>
                    <h4 className={`${panelHeadingClass} mb-2`}>Add update note</h4>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <input
                        type="date"
                        value={newUpdateNoteDate}
                        onChange={(e) => setNewUpdateNoteDate(e.target.value)}
                        className={`${inputClassPad} w-auto min-w-[140px]`}
                      />
                      <input
                        type="text"
                        value={newUpdateNoteText}
                        onChange={(e) => setNewUpdateNoteText(e.target.value)}
                        placeholder="What did you do?"
                        className={`${inputClassPad} flex-1 min-w-[160px]`}
                      />
                      <AttachmentButton
                        count={pendingUpdateAttachments.length}
                        onClick={() => setAttachmentModal({ kind: 'update', id: 'add' })}
                      />
                      <button
                        type="button"
                        onClick={addUpdateNoteToEditingGoal}
                        disabled={!newUpdateNoteText.trim()}
                        className={primaryButtonSmClass}
                      >
                        Add
                      </button>
                    </div>
                    {editingGoal.updateNotes.length > 0 && (
                      <ul className={`mt-2 space-y-2 ${bodyTextClass}`}>
                        {editingGoal.updateNotes
                          .slice()
                          .sort((a, b) => b.noteDate.localeCompare(a.noteDate))
                          .map((n) => (
                            <li
                              key={n.id}
                              className={`rounded-lg border p-2 ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700/50 bg-slate-800/30'}`}
                            >
                              {editingNoteId === n.id ? (
                                <div className="space-y-2">
                                  <input
                                    type="date"
                                    value={editNoteDate}
                                    onChange={(e) => setEditNoteDate(e.target.value)}
                                    className={`${inlineInputClass} w-full`}
                                  />
                                  <input
                                    type="text"
                                    value={editNoteText}
                                    onChange={(e) => setEditNoteText(e.target.value)}
                                    className={`${inlineInputClass} w-full`}
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={saveEditedNote}
                                      disabled={!editNoteText.trim()}
                                      className={`${primaryButtonTinyClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                      Save
                                    </button>
                                    <button type="button" onClick={cancelEditingNote} className={secondaryButtonSmClass}>
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-2">
                                  <span>
                                    <span className={mutedSmallClass}>{formatDateForDisplay(n.noteDate)}:</span> {n.note}
                                  </span>
                                  <div className="flex items-center gap-0.5 shrink-0">
                                    <AttachmentButton
                                      count={(n.attachments || []).length}
                                      onClick={() => setAttachmentModal({ kind: 'update', id: n.id })}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => startEditingNote(n)}
                                      className={iconGhostClass}
                                      title="Edit note"
                                      aria-label="Edit note"
                                    >
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteUpdateNote(n.id)}
                                      className={`rounded p-1 ${isLight ? 'text-slate-500 hover:bg-red-50 hover:text-red-700' : 'text-slate-400 hover:bg-slate-700 hover:text-red-300'}`}
                                      title="Delete note"
                                      aria-label="Delete note"
                                    >
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>

                  {/* Reminders */}
                  <div className={sectionPanelClass}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className={`text-sm ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Remind if no update in</label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={editingGoal.reminderDays ?? ''}
                        onChange={(e) =>
                          updateEditingGoal({
                            reminderDays: e.target.value === '' ? null : Math.max(1, parseInt(e.target.value, 10) || 1),
                          })
                        }
                        placeholder="Off"
                        className={`w-20 rounded-lg px-2 py-1 text-sm focus:border-emerald-500/50 focus:outline-none ${
                          isLight
                            ? 'border border-slate-300 bg-white text-slate-900'
                            : 'border border-slate-700 bg-slate-900/70 text-slate-100'
                        }`}
                      />
                      <span className={`text-sm ${mutedSmallClass}`}>days</span>
                    </div>
                  </div>

                  <DashboardCalendarSwitch
                    isOn={editingGoal.addToDashboard}
                    isLight={isLight}
                    disabled={!editingGoal.targetDate}
                    onToggle={() => updateEditingGoal({ addToDashboard: !editingGoal.addToDashboard })}
                  />

                  <div className={`flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 mt-4 border-t ${borderDividerClass}`}>
                    <button
                      type="button"
                      onClick={() => {
                        if (editingGoal) {
                          setDeleteConfirmGoalId(editingGoal.id);
                          setDeleteGoalConfirmText('');
                          setEditingGoalId(null);
                          setEditingGoal(null);
                        }
                      }}
                      className={deleteGoalOutlineClass}
                    >
                      Delete goal
                    </button>
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={saveGoalEdit} className={primaryButtonClass}>
                        Save changes
                      </button>
                      <button type="button" onClick={cancelEditingGoal} className={secondaryButtonClass}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {completePrompt && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
              <div className={modalCardConfirmClass} role="dialog" aria-modal="true" aria-labelledby="gt-complete-goal-title">
                <h3 id="gt-complete-goal-title" className={`${modalTitleClass} mb-2`}>
                  Mark goal completed?
                </h3>
                <p className={deleteInstructionTextClass}>
                  This goal is at 100%. Do you want to mark it Completed?
                </p>
                <div className="flex gap-3">
                  <button type="button" onClick={confirmMarkGoalCompleted} className={`flex-1 ${primaryButtonClass}`}>
                    Mark Completed
                  </button>
                  <button type="button" onClick={cancelMarkGoalCompleted} className={secondaryButtonClass}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete goal confirmation */}
          {deleteConfirmGoalId && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className={modalCardConfirmClass}>
                <h3 className={`${modalTitleClass} mb-2`}>Delete Goal</h3>
                <div className={deleteWarningBoxClass}>
                  <p className={deleteWarningTextClass}>Warning: This action cannot be undone.</p>
                  <p className={deleteWarningDetailClass}>
                    This goal and all its phases, tasks, notes, and files will be permanently deleted.
                  </p>
                </div>
                <p className={deleteInstructionTextClass}>
                  Type <strong className={deleteInstructionKeywordClass}>delete</strong> to confirm:
                </p>
                <input
                  type="text"
                  value={deleteGoalConfirmText}
                  onChange={(e) => setDeleteGoalConfirmText(e.target.value)}
                  placeholder="Type 'delete' to confirm"
                  className={deleteConfirmInputClass}
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={deleteGoal}
                    disabled={deleteGoalConfirmText.toLowerCase() !== 'delete'}
                    className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete Goal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmGoalId(null);
                      setDeleteGoalConfirmText('');
                    }}
                    className={secondaryButtonClass}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {showExportPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className={
              isLight
                ? 'w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl mx-4'
                : 'w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl mx-4'
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby="gt-export-title"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="gt-export-title" className={isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50'}>
                Export Options
              </h3>
              <button
                type="button"
                onClick={() => !isExportingPdf && setShowExportPopup(false)}
                disabled={isExportingPdf}
                className={isLight ? 'text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50' : 'text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50'}
                title="Close"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <p className={`${descClass}`}>
                Attachment files are listed by name at the end.
              </p>

              <fieldset className="space-y-2" disabled={isExportingPdf}>
                <legend className={`${labelClass} mb-0`}>Categories</legend>
                <label className={`flex items-start gap-3 ${bodyTextClass} cursor-pointer`}>
                  <input
                    type="radio"
                    name="gtExportScope"
                    checked={exportAllCategories || !resolvedCategoryId}
                    onChange={() => setExportAllCategories(true)}
                    className={isLight
                      ? 'mt-0.5 h-4 w-4 border-slate-400 text-emerald-600 focus:ring-emerald-500'
                      : 'mt-0.5 h-4 w-4 border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500'}
                  />
                  <span>All categories</span>
                </label>
                <label
                  className={`flex items-start gap-3 ${
                    resolvedCategoryId
                      ? `${bodyTextClass} cursor-pointer`
                      : isLight
                        ? 'text-slate-400 cursor-not-allowed'
                        : 'text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <input
                    type="radio"
                    name="gtExportScope"
                    checked={!exportAllCategories && Boolean(resolvedCategoryId)}
                    onChange={() => setExportAllCategories(false)}
                    disabled={!resolvedCategoryId}
                    className={isLight
                      ? 'mt-0.5 h-4 w-4 border-slate-400 text-emerald-600 focus:ring-emerald-500'
                      : 'mt-0.5 h-4 w-4 border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500'}
                  />
                  <span>
                    Current category only
                    {selectedCategory ? ` (${selectedCategory.name})` : ''}
                  </span>
                </label>
              </fieldset>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="includeCompletedExport"
                  checked={includeCompleted}
                  onChange={(e) => setIncludeCompleted(e.target.checked)}
                  disabled={isExportingPdf}
                  className={isLight
                    ? 'mt-0.5 h-4 w-4 rounded border-slate-400 text-emerald-600 focus:ring-emerald-500'
                    : 'mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500'}
                />
                <label htmlFor="includeCompletedExport" className={`${bodyTextClass} cursor-pointer`}>
                  Include completed goals
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={exportToPDF}
                  disabled={isExportingPdf}
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

      <AttachmentModal
        open={attachmentModal !== null}
        onClose={closeAttachmentModal}
        previewItem={viewPreview}
        title={modalTitle}
        files={modalFiles}
        busy={attachmentBusy}
        onAdd={(incoming) => {
          if (attachmentModal?.kind === 'goal' && attachmentModal.id === 'add') {
            setPendingGoalAttachments((prev) => [...prev, ...incoming.map(createPendingAttachment)]);
            return;
          }
          if (attachmentModal?.kind === 'update' && attachmentModal.id === 'add') {
            setPendingUpdateAttachments((prev) => [...prev, ...incoming.map(createPendingAttachment)]);
            return;
          }
          if (attachmentModal?.kind === 'goal' && attachmentModal.id !== 'add') {
            void addSavedFiles({ goalId: attachmentModal.id }, incoming);
            return;
          }
          if (attachmentModal?.kind === 'update' && attachmentModal.id !== 'add') {
            void addSavedFiles({ noteId: attachmentModal.id }, incoming);
          }
        }}
        onRemove={(id) => {
          if (attachmentModal?.kind === 'goal' && attachmentModal.id === 'add') {
            setPendingGoalAttachments((prev) => {
              const next = prev.filter((item) => item.id !== id);
              const removed = prev.find((item) => item.id === id);
              if (removed?.url) URL.revokeObjectURL(removed.url);
              return next;
            });
            return;
          }
          if (attachmentModal?.kind === 'update' && attachmentModal.id === 'add') {
            setPendingUpdateAttachments((prev) => {
              const next = prev.filter((item) => item.id !== id);
              const removed = prev.find((item) => item.id === id);
              if (removed?.url) URL.revokeObjectURL(removed.url);
              return next;
            });
            return;
          }
          void removeSavedFile(id);
        }}
        onView={handleViewAttachment}
        onDownload={
          attachmentModal &&
          ((attachmentModal.kind === 'goal' && attachmentModal.id === 'add') ||
            (attachmentModal.kind === 'update' && attachmentModal.id === 'add'))
            ? undefined
            : handleDownloadAttachment
        }
      />
    </div>
  );
}
