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
import { formatDisplayDate as formatPaddedDisplayDate } from '@/lib/format-display-date';

type Category = {
  id: string;
  name: string;
  card_color: string;
  showOnDashboard: boolean;
};

type Priority = 'Low' | 'Medium' | 'High';
type TaskStatus = 'Not Started' | 'In Progress' | 'Delayed' | 'Completed';

type TaskAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

type Task = {
  id: string;
  categoryId: string;
  taskName: string;
  dueDate: string;
  priority: Priority;
  notes: string;
  status: TaskStatus;
  addToDashboard: boolean;
  attachments: TaskAttachment[];
};

const emptyTaskDraft = (): Omit<Task, 'id' | 'categoryId'> => ({
  taskName: '',
  dueDate: '',
  priority: 'Medium',
  notes: '',
  status: 'Not Started',
  addToDashboard: false,
  attachments: [],
});

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
      title={disabled ? 'Set a due date to add this task to the dashboard calendar' : 'Add to dashboard calendar'}
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
        title={disabled ? 'Set a due date to add this task to the dashboard calendar' : 'Add to dashboard calendar'}
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

type ToDoListToolProps = {
  toolId?: string;
};

const DEFAULT_CATEGORY_NAMES = ['Home', 'Work', 'Kids', 'Errands'];
const PRIORITIES: Priority[] = ['Low', 'Medium', 'High'];
const STATUSES: TaskStatus[] = ['Not Started', 'In Progress', 'Delayed', 'Completed'];

function generateId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatPdfDate(isoDate: string): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  if (!m || !d) return isoDate;
  const month = parseInt(m, 10);
  const day = parseInt(d, 10);
  const year = y || '';
  return `${month}/${day}/${year}`;
}

function formatDateForDisplay(isoDate: string): string {
  if (!isoDate) return '';
  return formatPaddedDisplayDate(isoDate);
}

function formatReportDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function sortCategoriesByName(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name));
}

function compareTasksForReport(a: Task, b: Task): number {
  if (!a.dueDate && !b.dueDate) return a.taskName.localeCompare(b.taskName);
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate) || a.taskName.localeCompare(b.taskName);
}

function lastCategoryStorageKey(toolId: string) {
  return `tdl-last-category:${toolId}`;
}

function readLastCategoryId(toolId: string): string | null {
  try {
    return localStorage.getItem(lastCategoryStorageKey(toolId));
  } catch {
    return null;
  }
}

function writeLastCategoryId(toolId: string, categoryId: string) {
  try {
    localStorage.setItem(lastCategoryStorageKey(toolId), categoryId);
  } catch {
    /* ignore quota / private mode */
  }
}

const TASK_NAME_REQUIRED = 'Task name is required.';

function notifyTaskNameRequired(showError: (text: string) => void) {
  showError(TASK_NAME_REQUIRED);
}

function pickOpenCategoryId(list: Category[], prev: string | null, toolId?: string): string | null {
  if (!list.length) return null;
  const ids = new Set(list.map((c) => c.id));
  if (prev && ids.has(prev)) return prev;
  const lastUsed = toolId ? readLastCategoryId(toolId) : null;
  if (lastUsed && ids.has(lastUsed)) return lastUsed;
  const home = list.find((c) => c.name === 'Home');
  if (home) return home.id;
  return list[0].id;
}

export function ToDoListTool({ toolId }: ToDoListToolProps) {
  const { resolvedTheme } = useTheme();
  const { showError } = useAppNotice();
  const isLight = resolvedTheme === 'light';
  const titleClass = isLight ? 'text-2xl font-semibold text-slate-900 mb-2' : 'text-2xl font-semibold text-slate-50 mb-2';
  const descClass = isLight ? 'text-slate-600 text-sm' : 'text-slate-400 text-sm';
  const cardClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'
    : 'rounded-2xl border border-slate-800 bg-slate-900/70 p-6';
  const compactCardClass = isLight
    ? 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'
    : 'rounded-2xl border border-slate-800 bg-slate-900/70 p-4';
  const labelClass = isLight ? 'block text-sm font-medium text-slate-700 mb-2' : 'block text-sm font-medium text-slate-300 mb-2';
  const inputClass = isLight
    ? 'w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const selectClass = isLight
    ? 'w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'
    : 'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50';
  const textareaClass = isLight
    ? 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none'
    : 'w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none';
  const primaryButtonClass = isLight
    ? 'px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
    : 'px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const secondaryButtonClass = isLight
    ? 'px-4 py-2 rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors'
    : 'px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors';
  const popupMenuClass = isLight
    ? 'absolute top-10 right-0 z-50 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5 min-w-[180px] py-1'
    : 'absolute top-10 right-0 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-lg min-w-[180px] py-1';
  const popupMenuItemClass = isLight
    ? 'w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2'
    : 'w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2';
  const popupMenuDangerClass = isLight
    ? 'w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2'
    : 'w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2';
  const rowIconEmeraldClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-700 bg-white p-1.5 text-emerald-700 hover:bg-emerald-50 transition-colors'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-emerald-500/50 bg-slate-800/50 p-1.5 text-emerald-300 hover:bg-emerald-500/20 transition-colors';
  const rowIconDangerClass = isLight
    ? 'inline-flex items-center justify-center rounded-lg border-2 border-red-300 bg-white p-1.5 text-red-700 hover:bg-red-50 transition-colors'
    : 'inline-flex items-center justify-center rounded-lg border-2 border-red-500/50 bg-slate-800/50 p-1.5 text-red-400 hover:bg-red-500/20 transition-colors';
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#10b981');

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryColor, setEditingCategoryColor] = useState('#10b981');
  const [menuOpenCategoryId, setMenuOpenCategoryId] = useState<string | null>(null);

  const [deleteConfirmCategoryId, setDeleteConfirmCategoryId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskHasDueDate, setNewTaskHasDueDate] = useState(false);
  const [newTask, setNewTask] = useState<Omit<Task, 'id' | 'categoryId'>>(emptyTaskDraft());
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentItem[]>([]);
  const [attachmentModal, setAttachmentModal] = useState<null | 'add' | string>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [viewPreview, setViewPreview] = useState<AttachmentItem | null>(null);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null);

  // Sort: 'priority' | 'dueDate'
  const [sortBy, setSortBy] = useState<'priority' | 'dueDate'>('dueDate');
  // Filter: set of statuses to include (empty = match none)
  const [statusFilter, setStatusFilter] = useState<Set<TaskStatus>>(new Set(STATUSES));

  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  const [showExportPopup, setShowExportPopup] = useState(false);
  const [exportAllCategories, setExportAllCategories] = useState(false);
  const [exportCategoryId, setExportCategoryId] = useState('');
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const tasksForCategory = tasks.filter((t) => t.categoryId === selectedCategoryId);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setSaveMessage({ type, text });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const loadCategories = async () => {
    if (!toolId) return;
    setIsLoadingCategories(true);
    try {
      const res = await fetch(`/api/tools/to-do-list?toolId=${encodeURIComponent(toolId)}&resource=categories`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load categories');
      const list: Category[] = data.categories || [];
      setCategories(list);
      setSelectedCategoryId((prev) => {
        const next = pickOpenCategoryId(list, prev, toolId);
        if (next && toolId) writeLastCategoryId(toolId, next);
        return next;
      });
    } catch (e) {
      showMessage('error', e instanceof Error ? e.message : 'Failed to load categories');
      setCategories([]);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const loadTasks = async (categoryId: string | null | undefined) => {
    if (!toolId || !categoryId) return;
    setIsLoadingTasks(true);
    try {
      const res = await fetch(
        `/api/tools/to-do-list?toolId=${encodeURIComponent(toolId)}&resource=tasks&categoryId=${encodeURIComponent(categoryId)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load tasks');
      setTasks(
        (data.tasks || []).map((task: Task) => ({
          ...task,
          addToDashboard: task.addToDashboard === true,
          attachments: task.attachments || [],
        }))
      );
    } catch (e) {
      showMessage('error', e instanceof Error ? e.message : 'Failed to load tasks');
      setTasks([]);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  useEffect(() => {
    if (toolId) loadCategories();
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

  useEffect(() => {
    if (toolId && selectedCategoryId) loadTasks(selectedCategoryId);
    else setTasks([]);
  }, [toolId, selectedCategoryId]);

  useEffect(() => {
    setSortBy('dueDate');
    setStatusFilter(new Set(STATUSES));
    setFilterPopoverOpen(false);
  }, [selectedCategoryId]);

  useEffect(() => {
    if (!filterPopoverOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (filterPopoverRef.current?.contains(event.target as Node)) return;
      setFilterPopoverOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [filterPopoverOpen]);

  const toggleStatusFilter = (status: TaskStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  const hideCompleted = statusFilter.size > 0 && !statusFilter.has('Completed');

  const toggleHideCompleted = () => {
    setStatusFilter((prev) => {
      if (prev.size === 0) {
        return new Set(STATUSES.filter((s) => s !== 'Completed'));
      }
      const next = new Set(prev);
      if (next.has('Completed')) {
        next.delete('Completed');
      } else {
        next.add('Completed');
      }
      return next;
    });
  };

  const filteredAndSortedTasks = (() => {
    let list = tasksForCategory.filter((t) => statusFilter.has(t.status));
    const priorityOrder = { High: 0, Medium: 1, Low: 2 };
    if (sortBy === 'priority') {
      list = [...list].sort(
        (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
      );
    } else {
      list = [...list].sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    }
    return list;
  })();

  const createCategory = async () => {
    if (!newCategoryName.trim() || !toolId) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/tools/to-do-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource: 'category',
          action: 'create',
          toolId,
          name: newCategoryName.trim(),
          card_color: newCategoryColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create category');
      const newCat = data.category as Category;
      setCategories((prev) => [...prev, newCat]);
      setSelectedCategoryId(newCat.id);
      if (toolId) writeLastCategoryId(toolId, newCat.id);
      setIsCreatingCategory(false);
      setNewCategoryName('');
      setNewCategoryColor('#10b981');
      showMessage('success', 'Category created.');
    } catch (e) {
      showMessage('error', e instanceof Error ? e.message : 'Failed to create category');
    } finally {
      setIsSaving(false);
    }
  };

  const selectCategory = (id: string) => {
    setSelectedCategoryId(id);
    if (toolId) writeLastCategoryId(toolId, id);
    setEditingCategoryId(null);
    setMenuOpenCategoryId(null);
  };

  const startEditingCategory = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setEditingCategoryName(cat.name);
    setEditingCategoryColor(cat.card_color);
    setMenuOpenCategoryId(null);
  };

  const saveCategoryEdit = async () => {
    if (!editingCategoryId || !editingCategoryName.trim() || !toolId) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/tools/to-do-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource: 'category',
          action: 'update',
          toolId,
          categoryId: editingCategoryId,
          name: editingCategoryName.trim(),
          card_color: editingCategoryColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update category');
      const updated = data.category as Category;
      setCategories((prev) =>
        prev.map((c) => (c.id === editingCategoryId ? { ...c, ...updated } : c))
      );
      setEditingCategoryId(null);
      showMessage('success', 'Category updated.');
    } catch (e) {
      showMessage('error', e instanceof Error ? e.message : 'Failed to update category');
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEditingCategory = () => {
    setEditingCategoryId(null);
    setEditingCategoryName('');
    setEditingCategoryColor('#10b981');
    setMenuOpenCategoryId(null);
  };

  const deleteCategory = async () => {
    if (!deleteConfirmCategoryId || deleteConfirmText.toLowerCase() !== 'delete' || !toolId) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/tools/to-do-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource: 'category',
          action: 'delete',
          toolId,
          categoryId: deleteConfirmCategoryId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete category');
      await loadCategories();
      setTasks((prev) => prev.filter((t) => t.categoryId !== deleteConfirmCategoryId));
      setDeleteConfirmCategoryId(null);
      setDeleteConfirmText('');
      showMessage('success', 'Category deleted.');
    } catch (e) {
      showMessage('error', e instanceof Error ? e.message : 'Failed to delete category');
    } finally {
      setIsSaving(false);
    }
  };

  const startAddingTask = () => {
    if (!selectedCategoryId) {
      showMessage('error', 'Please select a category first.');
      return;
    }
    setIsAddingTask(true);
    setNewTaskHasDueDate(false);
    setNewTask(emptyTaskDraft());
    setPendingAttachments([]);
    setAttachmentModal(null);
  };

  const cancelAddingTask = () => {
    pendingAttachments.forEach((item) => {
      if (item.url) URL.revokeObjectURL(item.url);
    });
    setPendingAttachments([]);
    setAttachmentModal(null);
    setIsAddingTask(false);
    setNewTaskHasDueDate(false);
    setNewTask(emptyTaskDraft());
  };

  const saveNewTask = async () => {
    if (!selectedCategoryId || !newTask.taskName.trim() || !toolId) {
      if (!newTask.taskName.trim()) notifyTaskNameRequired(showError);
      return;
    }
    setIsSaving(true);
    try {
      const dueDate = newTaskHasDueDate ? (newTask.dueDate || new Date().toISOString().split('T')[0]) : undefined;
      const res = await fetch('/api/tools/to-do-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource: 'task',
          action: 'create',
          toolId,
          categoryId: selectedCategoryId,
          task_name: newTask.taskName.trim(),
          due_date: dueDate || undefined,
          priority: newTask.priority,
          notes: newTask.notes || undefined,
          status: newTask.status,
          addToDashboard: newTask.addToDashboard === true && Boolean(dueDate),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add task');
      const createdTaskId = data.task?.id as string | undefined;
      if (createdTaskId && pendingAttachments.length > 0) {
        for (const item of pendingAttachments) {
          if (!item.file) continue;
          const formData = new FormData();
          formData.append('toolId', toolId);
          formData.append('taskId', createdTaskId);
          formData.append('file', item.file);
          const uploadResponse = await fetch('/api/tools/to-do-list/attachments', { method: 'POST', body: formData });
          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json().catch(() => ({}));
            throw new Error(errorData.error || 'Task saved, but a file failed to upload.');
          }
        }
      }
      pendingAttachments.forEach((item) => {
        if (item.url) URL.revokeObjectURL(item.url);
      });
      setPendingAttachments([]);
      setAttachmentModal(null);
      await loadTasks(selectedCategoryId);
      setIsAddingTask(false);
      setNewTaskHasDueDate(false);
      setNewTask(emptyTaskDraft());
      showMessage('success', 'Task added.');
    } catch (e) {
      showMessage('error', e instanceof Error ? e.message : 'Failed to add task');
    } finally {
      setIsSaving(false);
    }
  };

  const startEditingTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingTask({ ...task });
  };

  const saveTaskEdit = async () => {
    if (!editingTask || !toolId) return;
    if (!editingTask.taskName.trim()) {
      notifyTaskNameRequired(showError);
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/tools/to-do-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource: 'task',
          action: 'update',
          toolId,
          taskId: editingTask.id,
          task_name: editingTask.taskName,
          due_date: editingTask.dueDate || null,
          priority: editingTask.priority,
          notes: editingTask.notes || undefined,
          status: editingTask.status,
          addToDashboard: editingTask.addToDashboard === true && Boolean(editingTask.dueDate),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update task');
      await loadTasks(selectedCategoryId ?? undefined);
      setEditingTaskId(null);
      setEditingTask(null);
      showMessage('success', 'Task updated.');
    } catch (e) {
      showMessage('error', e instanceof Error ? e.message : 'Failed to update task');
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEditingTask = () => {
    setEditingTaskId(null);
    setEditingTask(null);
  };

  const savedAttachmentTask =
    attachmentModal && attachmentModal !== 'add'
      ? tasks.find((task) => task.id === attachmentModal) || null
      : null;

  const modalFiles: AttachmentItem[] =
    attachmentModal === 'add'
      ? pendingAttachments
      : savedAttachmentTask
        ? savedAttachmentTask.attachments.map((item) => ({
            id: item.id,
            name: item.name,
            size: item.size,
            type: item.type,
          }))
        : [];

  const fetchTaskAttachmentBlob = async (attachmentId: string, inline = false) => {
    const query = inline ? '?inline=1' : '';
    const response = await fetch(`/api/tools/to-do-list/attachments/${attachmentId}${query}`);
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
      const blob = await fetchTaskAttachmentBlob(item.id, true);
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
      const blob = await fetchTaskAttachmentBlob(item.id);
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

  const addSavedTaskFiles = async (taskId: string, files: File[]) => {
    if (!toolId) return;
    setAttachmentBusy(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('toolId', toolId);
        formData.append('taskId', taskId);
        formData.append('file', file);
        const response = await fetch('/api/tools/to-do-list/attachments', { method: 'POST', body: formData });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Failed to add file');
        }
      }
      await loadTasks(selectedCategoryId);
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to add file');
    } finally {
      setAttachmentBusy(false);
    }
  };

  const removeSavedTaskFile = async (attachmentId: string) => {
    if (!toolId) return;
    setAttachmentBusy(true);
    try {
      const response = await fetch('/api/tools/to-do-list/attachments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, attachmentId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove file');
      }
      await loadTasks(selectedCategoryId);
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to remove file');
    } finally {
      setAttachmentBusy(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!toolId) return;
    try {
      const res = await fetch('/api/tools/to-do-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource: 'task',
          action: 'delete',
          toolId,
          taskId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete task');
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setDeleteConfirmTaskId(null);
      setDeleteConfirmText('');
      if (editingTaskId === taskId) {
        setEditingTaskId(null);
        setEditingTask(null);
      }
      showMessage('success', 'Task deleted.');
    } catch (e) {
      showMessage('error', e instanceof Error ? e.message : 'Failed to delete task');
    }
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    if (!toolId) return;
    try {
      const res = await fetch('/api/tools/to-do-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource: 'task',
          action: 'update',
          toolId,
          taskId,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status } : t))
      );
      if (editingTaskId === taskId && editingTask) {
        setEditingTask((p) => (p ? { ...p, status } : null));
      }
    } catch (e) {
      showMessage('error', e instanceof Error ? e.message : 'Failed to update status');
    }
  };

  const updateTaskPriority = async (taskId: string, priority: Priority) => {
    if (!toolId) return;
    try {
      const res = await fetch('/api/tools/to-do-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource: 'task',
          action: 'update',
          toolId,
          taskId,
          priority,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update priority');
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, priority } : t))
      );
      if (editingTaskId === taskId && editingTask) {
        setEditingTask((p) => (p ? { ...p, priority } : null));
      }
    } catch (e) {
      showMessage('error', e instanceof Error ? e.message : 'Failed to update priority');
    }
  };

  const exportCategoryChoices = sortCategoriesByName(categories);

  const fetchCategoryTasks = async (categoryId: string): Promise<Task[]> => {
    if (!toolId) throw new Error('Tool ID is missing.');
    const res = await fetch(
      `/api/tools/to-do-list?toolId=${encodeURIComponent(toolId)}&resource=tasks&categoryId=${encodeURIComponent(categoryId)}`
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load tasks');
    return (data.tasks || []).map((task: Task) => ({
      ...task,
      dueDate: task.dueDate || '',
      notes: task.notes || '',
      addToDashboard: task.addToDashboard === true,
      attachments: task.attachments || [],
    }));
  };

  const exportToPDF = async () => {
    if (isExportingPdf) return;
    const chosenFromScreen = categories.find((category) => category.id === exportCategoryId) ?? null;
    if (!exportAllCategories && !chosenFromScreen) {
      showError('Select a category, or choose All categories.');
      return;
    }

    const categoriesToExport = sortCategoriesByName(
      exportAllCategories ? categories : chosenFromScreen ? [chosenFromScreen] : []
    );
    if (categoriesToExport.length === 0) {
      showError('Select a category, or choose All categories.');
      return;
    }

    setIsExportingPdf(true);
    try {
      const tasksByCategory = new Map<string, Task[]>();
      await Promise.all(
        categoriesToExport.map(async (category) => {
          tasksByCategory.set(category.id, await fetchCategoryTasks(category.id));
        })
      );

      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      const footerY = pageHeight - 10;
      const contentBottom = footerY - 4;
      const checkboxSize = 3.2;
      const titleIndent = 5;
      const titleTextIndent = titleIndent + checkboxSize + 1.4;
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

      const textBlockHeight = (text: string, fontSize: number, isBold: boolean, indent: number) => {
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
        const maxWidth = contentWidth - indent - 5;
        const lines = pdf.splitTextToSize(text, maxWidth) as string[];
        return lines.length * fontSize * 0.42 + 2;
      };

      const paintTaskTitle = (name: string, completed: boolean) => {
        const fontSize = 11;
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
        const maxWidth = contentWidth - titleTextIndent - 5;
        const lines = pdf.splitTextToSize(name, maxWidth) as string[];
        const lineHeight = fontSize * 0.42;
        checkNewPage(lines.length * lineHeight + 2);
        const boxX = margin + titleIndent;
        const boxY = yPos - checkboxSize + 0.8;
        pdf.setDrawColor(colors.text[0], colors.text[1], colors.text[2]);
        pdf.setLineWidth(0.35);
        pdf.rect(boxX, boxY, checkboxSize, checkboxSize);
        if (completed) {
          pdf.setLineWidth(0.45);
          pdf.line(boxX + 0.55, boxY + 1.7, boxX + 1.25, boxY + 2.55);
          pdf.line(boxX + 1.25, boxY + 2.55, boxX + 2.65, boxY + 0.65);
        }
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
        lines.forEach((line) => {
          pdf.text(line, margin + titleTextIndent, yPos);
          yPos += lineHeight;
        });
        yPos += 2;
      };

      fillPage();
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(colors.title[0], colors.title[1], colors.title[2]);
      const title = 'To Do List Report';
      pdf.text(title, (pageWidth - pdf.getTextWidth(title)) / 2, yPos);
      yPos += 10;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
      pdf.text(`Generated on: ${formatReportDate(new Date())}`, margin, yPos);
      yPos += 6;

      const scopeLabel = exportAllCategories
        ? includeCompleted
          ? 'Open and completed tasks  ·  All categories'
          : 'Open tasks only  ·  All categories'
        : includeCompleted
          ? `Open and completed tasks  ·  One category  ·  ${chosenFromScreen?.name || 'Selected category'}`
          : `Open tasks only  ·  One category  ·  ${chosenFromScreen?.name || 'Selected category'}`;
      const scopeLines = pdf.splitTextToSize(scopeLabel, contentWidth) as string[];
      scopeLines.forEach((line) => {
        pdf.text(line, margin, yPos);
        yPos += 5;
      });
      yPos += 5;

      const attachmentRefs: string[] = [];
      const printTask = (category: Category, task: Task) => {
        const taskLabel = task.taskName.trim() || 'Task';
        const taskLines: { text: string; fontSize: number; isBold: boolean; indent: number }[] = [
          { text: `Status: ${task.status}`, fontSize: 9, isBold: false, indent: 8 },
          { text: `Priority: ${task.priority}`, fontSize: 9, isBold: false, indent: 8 },
        ];
        if (task.dueDate) {
          taskLines.push({
            text: `Due date: ${formatPdfDate(task.dueDate)}`,
            fontSize: 9,
            isBold: false,
            indent: 8,
          });
        }
        if (task.notes.trim()) {
          taskLines.push({ text: `Notes: ${task.notes.trim()}`, fontSize: 9, isBold: false, indent: 8 });
        }
        const blockHeight =
          textBlockHeight(taskLabel, 11, true, titleTextIndent) +
          taskLines.reduce(
            (sum, line) => sum + textBlockHeight(line.text, line.fontSize, line.isBold, line.indent),
            2,
          );
        if (yPos > margin && yPos + blockHeight > contentBottom) {
          pdf.addPage();
          fillPage();
          yPos = margin;
        }
        paintTaskTitle(taskLabel, task.status === 'Completed');
        taskLines.forEach((line) => addText(line.text, line.fontSize, line.isBold, line.indent));
        (task.attachments || []).forEach((file) => {
          const fileName = file.name?.trim();
          if (!fileName) return;
          const dateLabel = task.dueDate ? formatPdfDate(task.dueDate) : '';
          attachmentRefs.push(
            dateLabel
              ? `${category.name} — ${taskLabel} — ${dateLabel} — ${fileName}`
              : `${category.name} — ${taskLabel} — ${fileName}`
          );
        });
        yPos += 2;
      };

      let printedCategories = 0;
      categoriesToExport.forEach((category) => {
        const categoryTasks = tasksByCategory.get(category.id) || [];
        const openTasks = categoryTasks
          .filter((task) => task.status !== 'Completed')
          .sort(compareTasksForReport);
        const completedTasks = includeCompleted
          ? categoryTasks.filter((task) => task.status === 'Completed').sort(compareTasksForReport)
          : [];
        if (exportAllCategories && openTasks.length === 0 && completedTasks.length === 0) return;

        printedCategories += 1;
        addSectionHeader(category.name);
        if (openTasks.length === 0 && completedTasks.length === 0) {
          addText('No tasks match the selected options.', 10, false, 5, true);
          return;
        }
        openTasks.forEach((task) => printTask(category, task));
        if (completedTasks.length > 0) {
          addSectionHeader('Completed');
          completedTasks.forEach((task) => printTask(category, task));
        }
      });

      if (printedCategories === 0) {
        addText('No tasks match the selected options.', 10, false, 5, true);
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

      pdf.save(`To_Do_List_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      setShowExportPopup(false);
    } catch (error) {
      console.error('Error exporting to-do list PDF:', error);
      showError(error instanceof Error ? error.message : 'Failed to generate PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className={titleClass}>To Do List</h1>
          <p className={descClass}>
            Manage tasks by category. Add and edit categories, then add tasks with due date, priority, and status.
          </p>
        </div>
        <ExportPdfIconButton
          title="Export to-do list to PDF"
          onClick={() => {
            const fallback = sortCategoriesByName(categories)[0]?.id || '';
            if (!exportAllCategories) {
              setExportCategoryId(selectedCategoryId || exportCategoryId || fallback);
            } else if (!exportCategoryId) {
              setExportCategoryId(selectedCategoryId || fallback);
            }
            setShowExportPopup(true);
          }}
        />
      </div>

      {saveMessage && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            saveMessage.type === 'success'
              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/50 bg-red-500/10 text-red-300'
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      {/* Category selector */}
      <div className={compactCardClass}>
        <label className={`${labelClass} mb-3`}>
          Select a category
        </label>

        {!isCreatingCategory ? (
          <div className="flex items-center gap-3 flex-wrap">
            {categories.map((cat) => (
                <div key={cat.id} className="relative">
                  <button
                    onClick={() => selectCategory(cat.id)}
                    className={`px-4 py-3 rounded-lg border transition-all duration-200 min-w-[120px] relative ${
                      selectedCategoryId === cat.id ? 'shadow-lg' : 'hover:border-slate-600'
                    }`}
                    style={{
                      borderColor: cat.card_color,
                      backgroundColor:
                        selectedCategoryId === cat.id
                          ? `${cat.card_color}15`
                          : `${cat.card_color}08`,
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
                    className={isLight ? 'absolute top-1 right-1 p-1 rounded hover:bg-slate-200/80 transition-colors' : 'absolute top-1 right-1 p-1 rounded hover:bg-slate-700/50 transition-colors'}
                    title="Category options"
                    aria-label="Category options"
                  >
                    <svg
                      className={isLight ? 'h-4 w-4 text-slate-600 hover:text-slate-900' : 'h-4 w-4 text-slate-400 hover:text-slate-200'}
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                  </button>
                  {menuOpenCategoryId === cat.id && (
                    <div className={popupMenuClass}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingCategory(cat);
                        }}
                        className={popupMenuItemClass}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenCategoryId(null);
                          setDeleteConfirmCategoryId(cat.id);
                          setDeleteConfirmText('');
                        }}
                        className={popupMenuDangerClass}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
            ))}
            <button
              onClick={() => {
                setIsCreatingCategory(true);
                setNewCategoryName('');
                setNewCategoryColor('#10b981');
              }}
              className={isLight ? 'px-4 py-3 rounded-lg border-2 border-slate-400 bg-slate-100 text-slate-700 hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-800 transition-all duration-200 flex items-center justify-center min-w-[60px]' : 'px-4 py-3 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300 transition-all duration-200 flex items-center justify-center min-w-[60px]'}
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
              <label className={labelClass}>New category name</label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Enter category name"
                className={inputClass}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createCategory();
                  if (e.key === 'Escape') {
                    setIsCreatingCategory(false);
                    setNewCategoryName('');
                  }
                }}
                autoFocus
              />
            </div>
            <div>
              <label className={labelClass}>Color</label>
              <input
                type="color"
                value={newCategoryColor}
                onChange={(e) => setNewCategoryColor(e.target.value)}
                className={isLight ? 'h-10 w-14 rounded border border-slate-300 cursor-pointer bg-white' : 'h-10 w-14 rounded border border-slate-600 cursor-pointer'}
              />
            </div>
            <button
              onClick={createCategory}
              disabled={!newCategoryName.trim() || isSaving}
              className={primaryButtonClass}
            >
              Create
            </button>
            <button
              onClick={() => {
                setIsCreatingCategory(false);
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
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMenuOpenCategoryId(null)}
          aria-hidden="true"
        />
      )}

      {editingCategoryId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={isLight ? 'rounded-2xl border border-slate-200 bg-white p-6 max-w-md w-full mx-4 shadow-2xl' : 'rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4'}>
            <h3 className={isLight ? 'text-xl font-semibold text-slate-900 mb-4' : 'text-xl font-semibold text-slate-50 mb-4'}>Edit category</h3>
            <div className="flex items-end gap-2 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className={labelClass}>Category name</label>
                <input
                  type="text"
                  value={editingCategoryName}
                  onChange={(e) => setEditingCategoryName(e.target.value)}
                  placeholder="Enter category name"
                  className={inputClass}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveCategoryEdit();
                    if (e.key === 'Escape') cancelEditingCategory();
                  }}
                />
              </div>
              <div>
                <label className={labelClass}>Color</label>
                <input
                  type="color"
                  value={editingCategoryColor}
                  onChange={(e) => setEditingCategoryColor(e.target.value)}
                  className={isLight ? 'h-10 w-14 rounded border border-slate-300 cursor-pointer bg-white' : 'h-10 w-14 rounded border border-slate-600 cursor-pointer'}
                />
              </div>
              <button
                onClick={saveCategoryEdit}
                disabled={!editingCategoryName.trim() || isSaving}
                className={primaryButtonClass}
              >
                Save
              </button>
              <button
                onClick={cancelEditingCategory}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete category confirmation */}
      {deleteConfirmCategoryId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={isLight ? 'rounded-2xl border border-slate-200 bg-white p-6 max-w-md w-full mx-4 shadow-2xl' : 'rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4'}>
            <h3 className={isLight ? 'text-xl font-semibold text-slate-900 mb-2' : 'text-xl font-semibold text-slate-50 mb-2'}>Delete category</h3>
            <div className={isLight ? 'rounded-lg border border-red-300 bg-red-50 px-4 py-3 mb-4' : 'rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4'}>
              <p className={isLight ? 'text-red-700 font-semibold mb-2' : 'text-red-300 font-semibold mb-2'}>⚠️ This action cannot be undone.</p>
              <p className={isLight ? 'text-red-600 text-sm' : 'text-red-200 text-sm'}>
                All tasks in this category will be permanently deleted.
              </p>
            </div>
            <p className={isLight ? 'text-slate-700 mb-4' : 'text-slate-300 mb-4'}>
              Type <strong className="text-slate-200">delete</strong> to confirm:
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
                  setDeleteConfirmCategoryId(null);
                  setDeleteConfirmText('');
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={deleteCategory}
                disabled={deleteConfirmText.toLowerCase() !== 'delete' || isSaving}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete category
              </button>
              <button
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

      {!isLoadingCategories && !selectedCategoryId && !isCreatingCategory && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
          <p className="text-slate-400">Select a category or create one to manage tasks.</p>
        </div>
      )}

      {selectedCategoryId && selectedCategory && (
        <>
          <style
            dangerouslySetInnerHTML={{
              __html: `
                .todo-print-status-text { display: none; }
                @media print {
                  body * { visibility: hidden; }
                  .todo-list-print, .todo-list-print * { visibility: visible; }
                  .todo-list-print {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    background: white;
                    color: black;
                    box-shadow: none;
                    border: none;
                  }
                  .todo-list-print .print-only-hidden { display: none !important; visibility: hidden !important; }
                  .todo-list-print .todo-print-status-text { display: inline !important; visibility: visible !important; }
                }
              `,
            }}
          />
          {/* Single card: category task list */}
          <div className={`${cardClass} todo-list-print`}>
            {/* Card header: category name + add task icon (left) | print + filter (right) */}
            <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
              <div className="flex items-center gap-3">
                <h2 className={isLight ? 'text-2xl sm:text-3xl font-semibold text-slate-900' : 'text-2xl sm:text-3xl font-semibold text-slate-50'}>
                  {selectedCategory.name}
                </h2>
                {!isAddingTask && (
                  <button
                    type="button"
                    onClick={startAddingTask}
                    className={`${isLight ? 'px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed' : 'px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 text-sm font-semibold hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'} print-only-hidden`}
                    aria-label="Add new task"
                    title="+ Add Task"
                  >
                    + Add Task
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 print-only-hidden">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hideCompleted}
                    onChange={toggleHideCompleted}
                    className={isLight ? 'rounded border-slate-400 bg-white text-emerald-600 focus:ring-emerald-500 focus:ring-offset-white w-4 h-4' : 'rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800 w-4 h-4'}
                  />
                  <span className={isLight ? 'text-sm text-slate-800' : 'text-sm text-slate-200'}>Hide completed</span>
                </label>
                <button
                  type="button"
                  onClick={() => typeof window !== 'undefined' && window.print()}
                  className={isLight ? 'rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors' : 'rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors'}
                  aria-label="Print list"
                  title="Print list (or save to PDF)"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                </button>
                <div className="relative" ref={filterPopoverRef}>
                  <button
                    type="button"
                    onClick={() => setFilterPopoverOpen((v) => !v)}
                    className={isLight ? 'rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors' : 'rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors'}
                    aria-label="Sort and filter options"
                    title="Sort and filter"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </button>
                  {filterPopoverOpen && (
                      <div className={isLight ? 'absolute right-0 bottom-full z-50 mb-1 w-72 rounded-lg border border-slate-200 bg-white py-3 px-4 shadow-lg ring-1 ring-slate-900/5' : 'absolute right-0 bottom-full z-50 mb-1 w-72 rounded-lg border border-slate-700 bg-slate-800 py-3 px-4 shadow-lg'}>
                        <div className="space-y-4">
                          <div>
                            <label className={isLight ? 'block text-xs font-medium text-slate-700 mb-1.5' : 'block text-xs font-medium text-slate-300 mb-1.5'}>Sort by</label>
                            <select
                              value={sortBy}
                              onChange={(e) => setSortBy(e.target.value as 'priority' | 'dueDate')}
                              className={inputClass}
                            >
                              <option value="dueDate">Due date</option>
                              <option value="priority">Priority</option>
                            </select>
                          </div>
                          <div>
                            <label className={isLight ? 'block text-xs font-medium text-slate-700 mb-1.5' : 'block text-xs font-medium text-slate-300 mb-1.5'}>Filter by status</label>
                            <div className="flex flex-wrap gap-2">
                              {STATUSES.map((status) => (
                                <label key={status} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={statusFilter.has(status)}
                                    onChange={() => toggleStatusFilter(status)}
                                    className={isLight ? 'rounded border-slate-400 bg-white text-emerald-600 focus:ring-emerald-500 focus:ring-offset-white w-4 h-4' : 'rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800 w-4 h-4'}
                                  />
                                  <span className={isLight ? 'text-sm text-slate-800' : 'text-sm text-slate-200'}>{status}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                  )}
                </div>
              </div>
            </div>

            {/* Add task form */}
            {isAddingTask && (
            <div className={`${isLight ? 'border-t border-slate-200 pt-6 mb-6' : 'border-t border-slate-700/70 pt-6 mb-6'} print-only-hidden`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className={isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50'}>New task</h3>
                <AttachmentButton
                  count={pendingAttachments.length}
                  onClick={() => setAttachmentModal('add')}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 space-y-4">
                <div className="md:col-span-2">
                  <label className={isLight ? 'block text-xs font-medium text-slate-700 mb-1.5' : 'block text-xs font-medium text-slate-300 mb-1.5'}>Task name <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={newTask.taskName}
                    onChange={(e) => setNewTask((p) => ({ ...p, taskName: e.target.value }))}
                    placeholder="Task name"
                    className={inputClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTaskHasDueDate}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setNewTaskHasDueDate(checked);
                        if (checked && !newTask.dueDate) {
                          setNewTask((p) => ({ ...p, dueDate: new Date().toISOString().split('T')[0] }));
                        } else if (!checked) {
                          setNewTask((p) => ({ ...p, dueDate: '', addToDashboard: false }));
                        }
                      }}
                      className={isLight ? 'rounded border-slate-400 bg-white text-emerald-600 focus:ring-emerald-500 focus:ring-offset-white w-5 h-5' : 'rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800 w-5 h-5'}
                    />
                    <span className={isLight ? 'text-sm text-slate-800' : 'text-sm text-slate-200'}>This task has a due date</span>
                  </label>
                  {newTaskHasDueDate && (
                    <div className="mt-2">
                      <label className={isLight ? 'block text-xs font-medium text-slate-700 mb-1.5' : 'block text-xs font-medium text-slate-300 mb-1.5'}>Due date</label>
                      <input
                        type="date"
                        value={newTask.dueDate}
                        onChange={(e) =>
                          setNewTask((p) => ({
                            ...p,
                            dueDate: e.target.value,
                            addToDashboard: e.target.value ? p.addToDashboard : false,
                          }))
                        }
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className={isLight ? 'block text-xs font-medium text-slate-700 mb-1.5' : 'block text-xs font-medium text-slate-300 mb-1.5'}>Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask((p) => ({ ...p, priority: e.target.value as Priority }))}
                    className={selectClass}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={isLight ? 'block text-xs font-medium text-slate-700 mb-1.5' : 'block text-xs font-medium text-slate-300 mb-1.5'}>Status</label>
                  <select
                    value={newTask.status}
                    onChange={(e) => setNewTask((p) => ({ ...p, status: e.target.value as TaskStatus }))}
                    className={selectClass}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={isLight ? 'block text-xs font-medium text-slate-700 mb-1.5' : 'block text-xs font-medium text-slate-300 mb-1.5'}>Notes</label>
                  <textarea
                    value={newTask.notes}
                    onChange={(e) => setNewTask((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Notes"
                    rows={3}
                    className={textareaClass}
                  />
                </div>
                <div className="md:col-span-2">
                  <DashboardCalendarSwitch
                    isOn={newTask.addToDashboard}
                    isLight={isLight}
                    disabled={!newTaskHasDueDate || !newTask.dueDate}
                    onToggle={() => setNewTask((p) => ({ ...p, addToDashboard: !p.addToDashboard }))}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={saveNewTask}
                  disabled={!newTask.taskName.trim() || isSaving}
                  className={primaryButtonClass}
                >
                  Save task
                </button>
                <button
                  onClick={cancelAddingTask}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
              </div>
            </div>
            )}

            {/* Edit task form */}
            {editingTaskId && editingTask && (
              <div className={`${isLight ? 'border-t border-slate-200 pt-6 mb-6' : 'border-t border-slate-700/70 pt-6 mb-6'} print-only-hidden`}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className={isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50'}>Edit task</h3>
                  <AttachmentButton
                    count={(tasks.find((task) => task.id === editingTask.id)?.attachments.length) ?? editingTask.attachments.length}
                    onClick={() => setAttachmentModal(editingTask.id)}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className={isLight ? 'block text-xs font-medium text-slate-700 mb-1.5' : 'block text-xs font-medium text-slate-300 mb-1.5'}>Task name</label>
                    <input
                      type="text"
                      value={editingTask.taskName}
                      onChange={(e) => setEditingTask((p) => p ? { ...p, taskName: e.target.value } : null)}
                      className={inputClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!editingTask.dueDate}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setEditingTask((p) =>
                            p
                              ? {
                                  ...p,
                                  dueDate: checked
                                    ? p.dueDate || new Date().toISOString().split('T')[0]
                                    : '',
                                  addToDashboard: checked ? p.addToDashboard : false,
                                }
                              : null
                          );
                        }}
                        className={isLight ? 'rounded border-slate-400 bg-white text-emerald-600 focus:ring-emerald-500 focus:ring-offset-white w-5 h-5' : 'rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800 w-5 h-5'}
                      />
                      <span className={isLight ? 'text-sm text-slate-800' : 'text-sm text-slate-200'}>This task has a due date</span>
                    </label>
                    {editingTask.dueDate && (
                      <div className="mt-2">
                        <label className={isLight ? 'block text-xs font-medium text-slate-700 mb-1.5' : 'block text-xs font-medium text-slate-300 mb-1.5'}>Due date</label>
                        <input
                          type="date"
                          value={editingTask.dueDate}
                          onChange={(e) =>
                            setEditingTask((p) =>
                              p
                                ? {
                                    ...p,
                                    dueDate: e.target.value,
                                    addToDashboard: e.target.value ? p.addToDashboard : false,
                                  }
                                : null
                            )
                          }
                          className={inputClass}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className={isLight ? 'block text-xs font-medium text-slate-700 mb-1.5' : 'block text-xs font-medium text-slate-300 mb-1.5'}>Priority</label>
                    <select
                      value={editingTask.priority}
                      onChange={(e) => setEditingTask((p) => p ? { ...p, priority: e.target.value as Priority } : null)}
                      className={selectClass}
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={isLight ? 'block text-xs font-medium text-slate-700 mb-1.5' : 'block text-xs font-medium text-slate-300 mb-1.5'}>Status</label>
                    <select
                      value={editingTask.status}
                      onChange={(e) => setEditingTask((p) => p ? { ...p, status: e.target.value as TaskStatus } : null)}
                      className={selectClass}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className={isLight ? 'block text-xs font-medium text-slate-700 mb-1.5' : 'block text-xs font-medium text-slate-300 mb-1.5'}>Notes</label>
                    <textarea
                      value={editingTask.notes}
                      onChange={(e) => setEditingTask((p) => p ? { ...p, notes: e.target.value } : null)}
                      rows={3}
                      className={textareaClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <DashboardCalendarSwitch
                      isOn={editingTask.addToDashboard}
                      isLight={isLight}
                      disabled={!editingTask.dueDate}
                      onToggle={() =>
                        setEditingTask((p) => (p ? { ...p, addToDashboard: !p.addToDashboard } : null))
                      }
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={saveTaskEdit}
                    disabled={isSaving}
                    className={primaryButtonClass}
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEditingTask}
                    className={secondaryButtonClass}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Task list: grid with headers */}
            {!isAddingTask && (
              <div className="min-w-0 md:overflow-x-auto">
                {filteredAndSortedTasks.length === 0 ? (
                  tasksForCategory.length > 0 ? (
                    <p className="text-slate-400 text-center py-8 text-sm">
                      No tasks match. Adjust filters.
                    </p>
                  ) : null
                ) : (
                  <table className="w-full border-collapse max-md:block md:min-w-[500px]">
                    <thead className="max-md:hidden">
                      <tr className={isLight ? 'border-b border-slate-300' : 'border-b border-slate-700'}>
                        <th className={isLight ? 'text-left text-xs font-semibold uppercase tracking-wider text-slate-600 py-3 px-2' : 'text-left text-xs font-semibold uppercase tracking-wider text-slate-400 py-3 px-2'}>Name</th>
                        <th className={isLight ? 'text-left text-xs font-semibold uppercase tracking-wider text-slate-600 py-3 px-2' : 'text-left text-xs font-semibold uppercase tracking-wider text-slate-400 py-3 px-2'}>Due Date</th>
                        <th className={isLight ? 'text-left text-xs font-semibold uppercase tracking-wider text-slate-600 py-3 px-2' : 'text-left text-xs font-semibold uppercase tracking-wider text-slate-400 py-3 px-2'}>Priority</th>
                        <th className={isLight ? 'text-left text-xs font-semibold uppercase tracking-wider text-slate-600 py-3 px-2' : 'text-left text-xs font-semibold uppercase tracking-wider text-slate-400 py-3 px-2'}>Status</th>
                        <th className={`${isLight ? 'w-36 text-right text-xs font-semibold uppercase tracking-wider text-slate-600 py-3 px-2' : 'w-36 text-right text-xs font-semibold uppercase tracking-wider text-slate-400 py-3 px-2'} print-only-hidden`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="max-md:block">
                      {filteredAndSortedTasks.map((task) => (
                        <tr
                          key={task.id}
                          className={isLight ? 'border-b border-slate-200 transition-colors hover:bg-slate-50 max-md:mb-3 max-md:block max-md:rounded-lg max-md:border max-md:border-slate-200 max-md:p-3 md:table-row' : 'border-b border-slate-800 transition-colors hover:bg-slate-800/30 max-md:mb-3 max-md:block max-md:rounded-lg max-md:border max-md:border-slate-700 max-md:p-3 md:table-row'}
                        >
                          <td className="block px-2 py-3 md:table-cell">
                            <div className={`mb-1 text-xs font-semibold uppercase tracking-wider md:hidden ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Name</div>
                            <div className="flex min-w-0 items-center gap-2">
                              <div className={`break-words ${isLight ? 'font-medium text-slate-900' : 'font-medium text-slate-100'}${task.status === 'Completed' ? ' line-through' : ''}`}>{task.taskName}</div>
                              {task.addToDashboard && <OnCalendarChip isLight={isLight} />}
                            </div>
                            {task.notes && (
                              <div className={isLight ? 'mt-0.5 line-clamp-2 break-words text-xs text-slate-600' : 'mt-0.5 line-clamp-2 break-words text-xs text-slate-400'}>{task.notes}</div>
                            )}
                          </td>
                          <td className={isLight ? 'block px-2 py-1 text-sm text-slate-700 md:table-cell md:py-3' : 'block px-2 py-1 text-sm text-slate-300 md:table-cell md:py-3'}>
                            <span className={`mr-2 text-xs font-semibold uppercase tracking-wider md:hidden ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Due date</span>
                            {task.dueDate ? formatDateForDisplay(task.dueDate) : '—'}
                          </td>
                          <td className="block px-2 py-1 md:table-cell md:py-3">
                            <div className={`mb-1 text-xs font-semibold uppercase tracking-wider md:hidden ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Priority</div>
                            <select
                              value={task.priority}
                              onChange={(e) => updateTaskPriority(task.id, e.target.value as Priority)}
                              className={`${isLight ? 'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50' : 'rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'} print-only-hidden`}
                              aria-label={`Update priority for ${task.taskName}`}
                            >
                              {PRIORITIES.map((p) => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                            <span className="todo-print-status-text">{task.priority}</span>
                          </td>
                          <td className="block px-2 py-1 md:table-cell md:py-3">
                            <div className={`mb-1 text-xs font-semibold uppercase tracking-wider md:hidden ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Status</div>
                            <select
                              value={task.status}
                              onChange={(e) => updateTaskStatus(task.id, e.target.value as TaskStatus)}
                              className={`${isLight ? 'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50' : 'rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'} print-only-hidden`}
                              aria-label={`Update status for ${task.taskName}`}
                            >
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                            <span className="todo-print-status-text">{task.status}</span>
                          </td>
                          <td className="block px-2 py-2 text-right print-only-hidden md:table-cell md:py-3">
                            <div className={`mb-1 text-left text-xs font-semibold uppercase tracking-wider md:hidden ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Actions</div>
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              <AttachmentButton
                                count={task.attachments?.length || 0}
                                onClick={() => setAttachmentModal(task.id)}
                              />
                              <button
                                onClick={() => startEditingTask(task)}
                                className={rowIconEmeraldClass}
                                aria-label="Edit task"
                                title="Edit task"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteConfirmText('');
                                  setDeleteConfirmTaskId(task.id);
                                }}
                                className={rowIconDangerClass}
                                aria-label="Delete task"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* Delete task confirmation */}
          {deleteConfirmTaskId && (() => {
            const taskToDelete = tasks.find((t) => t.id === deleteConfirmTaskId);
            const needsTypedConfirm = !!(taskToDelete?.notes.trim() || taskToDelete?.dueDate);
            return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className={isLight ? 'rounded-2xl border border-slate-200 bg-white p-6 max-w-md w-full mx-4 shadow-2xl' : 'rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4'}>
                <h3 className={isLight ? 'text-xl font-semibold text-slate-900 mb-2' : 'text-xl font-semibold text-slate-50 mb-2'}>Delete task</h3>
                {needsTypedConfirm ? (
                  <>
                    <div className={isLight ? 'rounded-lg border border-red-300 bg-red-50 px-4 py-3 mb-4' : 'rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4'}>
                      <p className={isLight ? 'text-red-700 font-semibold mb-2' : 'text-red-300 font-semibold mb-2'}>⚠️ This action cannot be undone.</p>
                      <p className={isLight ? 'text-red-600 text-sm' : 'text-red-200 text-sm'}>
                        {taskToDelete?.taskName} will be permanently deleted.
                      </p>
                    </div>
                    <p className={isLight ? 'text-slate-700 mb-4' : 'text-slate-300 mb-4'}>
                      Type <strong className="text-slate-200">delete</strong> to confirm:
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
                          setDeleteConfirmTaskId(null);
                          setDeleteConfirmText('');
                        }
                      }}
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => deleteTask(deleteConfirmTaskId)}
                        disabled={deleteConfirmText.toLowerCase() !== 'delete'}
                        className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => {
                          setDeleteConfirmTaskId(null);
                          setDeleteConfirmText('');
                        }}
                        className={secondaryButtonClass}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className={isLight ? 'text-slate-700 mb-4' : 'text-slate-300 mb-4'}>Are you sure you want to delete this task? This cannot be undone.</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => deleteTask(deleteConfirmTaskId)}
                        className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirmTaskId(null)}
                        className={secondaryButtonClass}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            );
          })()}
        </>
      )}

      {showExportPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className={isLight
              ? 'w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto'
              : 'w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto'}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tdl-export-title"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="tdl-export-title" className={isLight ? 'text-lg font-semibold text-slate-900' : 'text-lg font-semibold text-slate-50'}>
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
              <p className={descClass}>
                Attachment files are listed by name at the end.
              </p>

              <fieldset className="space-y-2" disabled={isExportingPdf}>
                <legend className={`${labelClass} mb-0`}>Categories</legend>
                <label className={`flex items-start gap-3 ${isLight ? 'text-slate-700' : 'text-slate-300'} cursor-pointer`}>
                  <input
                    type="radio"
                    name="tdlExportScope"
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
                    name="tdlExportScope"
                    checked={!exportAllCategories}
                    onChange={() => {
                      setExportAllCategories(false);
                      if (!exportCategoryId) {
                        setExportCategoryId(selectedCategoryId || sortCategoriesByName(categories)[0]?.id || '');
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
                    <label className={labelClass} htmlFor="tdl-export-category">
                      Category
                    </label>
                    <select
                      id="tdl-export-category"
                      value={exportCategoryId}
                      onChange={(e) => setExportCategoryId(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">Select a category</option>
                      {exportCategoryChoices.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </fieldset>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="tdlIncludeCompletedExport"
                  checked={includeCompleted}
                  onChange={(e) => setIncludeCompleted(e.target.checked)}
                  disabled={isExportingPdf}
                  className={isLight
                    ? 'mt-0.5 h-4 w-4 rounded border-slate-400 text-emerald-600 focus:ring-emerald-500'
                    : 'mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500'}
                />
                <label htmlFor="tdlIncludeCompletedExport" className={`${isLight ? 'text-slate-700' : 'text-slate-300'} cursor-pointer`}>
                  Include completed
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={exportToPDF}
                  disabled={isExportingPdf || categories.length === 0 || (!exportAllCategories && !exportCategoryId)}
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

      <AttachmentModal
        open={attachmentModal !== null}
        onClose={() => {
          setAttachmentModal(null);
          setViewPreview(null);
        }}
        previewItem={viewPreview}
        title={
          attachmentModal === 'add'
            ? newTask.taskName.trim() || 'New task'
            : savedAttachmentTask?.taskName || 'Task'
        }
        files={modalFiles}
        busy={attachmentBusy}
        onAdd={(incoming) => {
          if (attachmentModal === 'add') {
            setPendingAttachments((prev) => [...prev, ...incoming.map(createPendingAttachment)]);
            return;
          }
          if (attachmentModal) {
            void addSavedTaskFiles(attachmentModal, incoming);
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
          void removeSavedTaskFile(id);
        }}
        onView={handleViewAttachment}
        onDownload={attachmentModal === 'add' ? undefined : handleDownloadAttachment}
      />
    </div>
  );
}
