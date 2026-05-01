'use client';

import { useState, useEffect } from 'react';
import { useTheme } from './AppThemeProvider';

type Category = {
  id: string;
  name: string;
  card_color: string;
  showOnDashboard: boolean;
};

type Priority = 'Low' | 'Medium' | 'High';
type TaskStatus = 'Not Started' | 'In Progress' | 'Delayed' | 'Completed';

type Task = {
  id: string;
  categoryId: string;
  taskName: string;
  dueDate: string;
  priority: Priority;
  notes: string;
  status: TaskStatus;
};

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

function formatDateForDisplay(isoDate: string): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  if (!m || !d) return isoDate;
  const month = parseInt(m, 10);
  const day = parseInt(d, 10);
  const year = y || '';
  return `${month}/${day}/${year}`;
}

export function ToDoListTool({ toolId }: ToDoListToolProps) {
  const { resolvedTheme } = useTheme();
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
  const [newTask, setNewTask] = useState<Omit<Task, 'id' | 'categoryId'>>({
    taskName: '',
    dueDate: '',
    priority: 'Medium',
    notes: '',
    status: 'Not Started',
  });

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null);

  // Sort: 'priority' | 'dueDate'
  const [sortBy, setSortBy] = useState<'priority' | 'dueDate'>('dueDate');
  // Filter: set of statuses to include (empty = all)
  const [statusFilter, setStatusFilter] = useState<Set<TaskStatus>>(new Set(STATUSES));

  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);

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
      const list = data.categories || [];
      setCategories(list);
      if (list.length) {
        const ids = list.map((c: Category) => c.id);
        setSelectedCategoryId((prev) => (prev && ids.includes(prev) ? prev : list[0].id));
      } else {
        setSelectedCategoryId(null);
      }
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
      setTasks(data.tasks || []);
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
    if (toolId && selectedCategoryId) loadTasks(selectedCategoryId);
    else setTasks([]);
  }, [toolId, selectedCategoryId]);

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

  const filteredAndSortedTasks = (() => {
    let list = tasksForCategory.filter((t) =>
      statusFilter.size === 0 ? true : statusFilter.has(t.status)
    );
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
    setNewTask({
      taskName: '',
      dueDate: '',
      priority: 'Medium',
      notes: '',
      status: 'Not Started',
    });
  };

  const cancelAddingTask = () => {
    setIsAddingTask(false);
    setNewTaskHasDueDate(false);
    setNewTask({
      taskName: '',
      dueDate: '',
      priority: 'Medium',
      notes: '',
      status: 'Not Started',
    });
  };

  const saveNewTask = async () => {
    if (!selectedCategoryId || !newTask.taskName.trim() || !toolId) {
      if (!newTask.taskName.trim()) showMessage('error', 'Task name is required.');
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add task');
      await loadTasks(selectedCategoryId);
      setIsAddingTask(false);
      setNewTaskHasDueDate(false);
      setNewTask({
        taskName: '',
        dueDate: '',
        priority: 'Medium',
        notes: '',
        status: 'Not Started',
      });
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
          due_date: editingTask.dueDate || undefined,
          priority: editingTask.priority,
          notes: editingTask.notes || undefined,
          status: editingTask.status,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className={titleClass}>To Do List</h1>
        <p className={descClass}>
          Manage tasks by category. Add and edit categories, then add tasks with due date, priority, and status.
        </p>
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
            {categories.map((cat) =>
              editingCategoryId === cat.id ? (
                <div
                  key={cat.id}
                  className={isLight ? 'px-4 py-3 rounded-lg border-2 min-w-[200px] shadow-sm' : 'px-4 py-3 rounded-lg border border-slate-600 bg-slate-800 min-w-[200px]'}
                  style={{
                    borderColor: editingCategoryColor,
                    backgroundColor: `${editingCategoryColor}${isLight ? '12' : '15'}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      className={isLight ? 'flex-1 px-2 py-1 rounded border border-slate-300 bg-white text-slate-900 text-sm focus:border-emerald-500/50 focus:outline-none' : 'flex-1 px-2 py-1 rounded border border-slate-600 bg-slate-900 text-slate-100 text-sm focus:border-emerald-500/50 focus:outline-none'}
                      placeholder="Category name"
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className={isLight ? 'text-xs text-slate-700' : 'text-xs text-slate-400'}>Color:</label>
                    <input
                      type="color"
                      value={editingCategoryColor}
                      onChange={(e) => setEditingCategoryColor(e.target.value)}
                      className={isLight ? 'h-6 w-12 rounded border border-slate-300 cursor-pointer bg-white' : 'h-6 w-12 rounded border border-slate-600 cursor-pointer'}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveCategoryEdit}
                      disabled={!editingCategoryName.trim() || isSaving}
                      className={isLight ? 'flex-1 px-2 py-1 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed' : 'flex-1 px-2 py-1 rounded bg-emerald-500 text-slate-950 text-xs font-medium hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed'}
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEditingCategory}
                      className={isLight ? 'px-2 py-1 rounded border-2 border-slate-400 bg-slate-100 text-slate-800 text-xs hover:bg-slate-200' : 'px-2 py-1 rounded border border-slate-600 bg-slate-700 text-slate-200 text-xs hover:bg-slate-600'}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
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
              )
            )}
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

      {!selectedCategoryId && !isCreatingCategory && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
          <p className="text-slate-400">Select a category or create one to manage tasks.</p>
        </div>
      )}

      {selectedCategoryId && selectedCategory && (
        <>
          {/* Single card: category task list */}
          <div className={cardClass}>
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
                    className={isLight ? 'px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed' : 'px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 text-sm font-semibold hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'}
                    aria-label="Add new task"
                    title="+ Add Task"
                  >
                    + Add Task
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
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
                <div className="relative">
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
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setFilterPopoverOpen(false)}
                        aria-hidden="true"
                      />
                      <div className={isLight ? 'absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-slate-200 bg-white py-3 px-4 shadow-lg ring-1 ring-slate-900/5' : 'absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-slate-700 bg-slate-800 py-3 px-4 shadow-lg'}>
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
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Add task form */}
            {isAddingTask && (
            <div className={isLight ? 'border-t border-slate-200 pt-6 mb-6' : 'border-t border-slate-700/70 pt-6 mb-6'}>
              <h3 className={isLight ? 'text-lg font-semibold text-slate-900 mb-4' : 'text-lg font-semibold text-slate-50 mb-4'}>New task</h3>
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
                          setNewTask((p) => ({ ...p, dueDate: '' }));
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
                        onChange={(e) => setNewTask((p) => ({ ...p, dueDate: e.target.value }))}
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
              <div className={isLight ? 'border-t border-slate-200 pt-6 mb-6' : 'border-t border-slate-700/70 pt-6 mb-6'}>
                <h3 className={isLight ? 'text-lg font-semibold text-slate-900 mb-4' : 'text-lg font-semibold text-slate-50 mb-4'}>Edit task</h3>
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
                          onChange={(e) => setEditingTask((p) => (p ? { ...p, dueDate: e.target.value } : null))}
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
              <div className="overflow-x-auto">
                {filteredAndSortedTasks.length === 0 ? (
                  <p className="text-slate-400 text-center py-8 text-sm">
                    No tasks match. Add a task or adjust filters.
                  </p>
                ) : (
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className={isLight ? 'border-b border-slate-300' : 'border-b border-slate-700'}>
                        <th className={isLight ? 'text-left text-xs font-semibold uppercase tracking-wider text-slate-600 py-3 px-2' : 'text-left text-xs font-semibold uppercase tracking-wider text-slate-400 py-3 px-2'}>Name</th>
                        <th className={isLight ? 'text-left text-xs font-semibold uppercase tracking-wider text-slate-600 py-3 px-2' : 'text-left text-xs font-semibold uppercase tracking-wider text-slate-400 py-3 px-2'}>Due Date</th>
                        <th className={isLight ? 'text-left text-xs font-semibold uppercase tracking-wider text-slate-600 py-3 px-2' : 'text-left text-xs font-semibold uppercase tracking-wider text-slate-400 py-3 px-2'}>Priority</th>
                        <th className={isLight ? 'text-left text-xs font-semibold uppercase tracking-wider text-slate-600 py-3 px-2' : 'text-left text-xs font-semibold uppercase tracking-wider text-slate-400 py-3 px-2'}>Status</th>
                        <th className={isLight ? 'w-20 text-right text-xs font-semibold uppercase tracking-wider text-slate-600 py-3 px-2' : 'w-20 text-right text-xs font-semibold uppercase tracking-wider text-slate-400 py-3 px-2'}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndSortedTasks.map((task) => (
                        <tr
                          key={task.id}
                          className={isLight ? 'border-b border-slate-200 hover:bg-slate-50 transition-colors' : 'border-b border-slate-800 hover:bg-slate-800/30 transition-colors'}
                        >
                          <td className="py-3 px-2">
                            <div className={isLight ? 'font-medium text-slate-900' : 'font-medium text-slate-100'}>{task.taskName}</div>
                            {task.notes && (
                              <div className={isLight ? 'text-xs text-slate-600 mt-0.5 line-clamp-2' : 'text-xs text-slate-400 mt-0.5 line-clamp-2'}>{task.notes}</div>
                            )}
                          </td>
                          <td className={isLight ? 'py-3 px-2 text-sm text-slate-700' : 'py-3 px-2 text-sm text-slate-300'}>
                            {task.dueDate ? formatDateForDisplay(task.dueDate) : '—'}
                          </td>
                          <td className={isLight ? 'py-3 px-2 text-sm text-slate-700' : 'py-3 px-2 text-sm text-slate-300'}>{task.priority}</td>
                          <td className="py-3 px-2">
                            <select
                              value={task.status}
                              onChange={(e) => updateTaskStatus(task.id, e.target.value as TaskStatus)}
                              className={isLight ? 'rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50' : 'rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50'}
                              aria-label={`Update status for ${task.taskName}`}
                            >
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => startEditingTask(task)}
                                className={rowIconEmeraldClass}
                                aria-label="Edit task"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setDeleteConfirmTaskId(task.id)}
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
          {deleteConfirmTaskId && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className={isLight ? 'rounded-2xl border border-slate-200 bg-white p-6 max-w-md w-full mx-4 shadow-2xl' : 'rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4'}>
                <h3 className={isLight ? 'text-xl font-semibold text-slate-900 mb-2' : 'text-xl font-semibold text-slate-50 mb-2'}>Delete task</h3>
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
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}
