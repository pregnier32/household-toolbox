'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';

// --- Types (exported for dashboard / context) ---
export type Category = {
  id: string;
  name: string;
  card_color: string;
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
  phases: Phase[];
  tasks: Task[];
  updateNotes: UpdateNote[];
};

const DEFAULT_CATEGORY_NAMES = ['Home', 'Finance', 'Health', 'Career', 'Personal'];
const DEFAULT_CATEGORY_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899'];

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

// --- Default categories (in-memory) ---
function getDefaultCategories(): Category[] {
  return DEFAULT_CATEGORY_NAMES.map((name, i) => ({
    id: `cat-${name.toLowerCase()}-${i}`,
    name,
    card_color: DEFAULT_CATEGORY_COLORS[i] ?? '#10b981',
  }));
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
        setGoals(data.goals ?? []);
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

type GoalsTrackingToolProps = {
  toolId?: string;
};

export function GoalsTrackingTool({ toolId }: GoalsTrackingToolProps) {
  const ctx = useGoalsContext();
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
      setGoals(data.goals ?? []);
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

  // Categories
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
  });

  // Edit goal
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [deleteConfirmGoalId, setDeleteConfirmGoalId] = useState<string | null>(null);
  const [deleteGoalConfirmText, setDeleteGoalConfirmText] = useState('');

  // Which goal tab is selected (null = none; viewing one goal per tab)
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  // Update note (when editing a goal)
  const [newUpdateNoteDate, setNewUpdateNoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [newUpdateNoteText, setNewUpdateNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteDate, setEditNoteDate] = useState('');
  const [editNoteText, setEditNoteText] = useState('');
  const [showAllUpdatesGoalId, setShowAllUpdatesGoalId] = useState<string | null>(null);

  // Filters
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const goalsInCategory = goals.filter((g) => g.categoryId === selectedCategoryId);
  const selectedGoal =
    selectedGoalId && !isAddingGoal
      ? goalsInCategory.find((g) => g.id === selectedGoalId) ?? null
      : null;

  // When category changes, select first goal or none and leave add form
  useEffect(() => {
    if (!selectedCategoryId) return;
    const inCategory = goals.filter((g) => g.categoryId === selectedCategoryId);
    const firstId = inCategory.length > 0 ? inCategory[0].id : null;
    setSelectedGoalId((prev) => {
      const stillInCategory = prev && inCategory.some((g) => g.id === prev);
      return stillInCategory ? prev : firstId;
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
    setEditingCategoryId(null);
  };

  const deleteCategory = async () => {
    if (!deleteConfirmCategoryId || deleteConfirmText.toLowerCase() !== 'delete') return;
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
    if (!selectedCategoryId) return;
    setSelectedGoalId(null);
    setIsAddingGoal(true);
    setNewGoal({
      title: '',
      description: '',
      targetDate: new Date().toISOString().split('T')[0],
      priority: 'Medium',
      status: 'Not Started',
    });
  };

  const cancelAddingGoal = () => {
    setIsAddingGoal(false);
    const first = goalsInCategory[0];
    setSelectedGoalId(first ? first.id : null);
  };

  const addGoal = async () => {
    if (!selectedCategoryId || !newGoal.title.trim()) return;
    if (toolId) {
      const data = await apiPost('goal', 'create', {
        categoryId: selectedCategoryId,
        title: newGoal.title.trim(),
        description: newGoal.description.trim(),
        targetDate: newGoal.targetDate,
        priority: newGoal.priority,
        status: newGoal.status,
      });
      if (!data?.goal) return;
      setGoals((prev) => [...prev, data.goal]);
      setSelectedGoalId(data.goal.id);
      showMessage('success', 'Goal created');
    } else {
      const id = generateId();
      const goal: Goal = {
        id,
        categoryId: selectedCategoryId,
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
        phases: [],
        tasks: [],
        updateNotes: [],
      };
      setGoals((prev) => [...prev, goal]);
      setSelectedGoalId(id);
    }
    setIsAddingGoal(false);
    setNewGoal({
      title: '',
      description: '',
      targetDate: new Date().toISOString().split('T')[0],
      priority: 'Medium',
      status: 'Not Started',
    });
  };

  const startEditingGoal = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setEditingGoal(JSON.parse(JSON.stringify(goal)));
    setNewUpdateNoteDate(new Date().toISOString().split('T')[0]);
    setNewUpdateNoteText('');
  };

  const cancelEditingGoal = () => {
    setEditingGoalId(null);
    setEditingGoal(null);
    setEditingNoteId(null);
  };

  const saveGoalEdit = async () => {
    if (!editingGoal) return;
    if (toolId) {
      const data = await apiPost('goal', 'update', {
        goalId: editingGoal.id,
        title: editingGoal.title,
        description: editingGoal.description,
        targetDate: editingGoal.targetDate || null,
        priority: editingGoal.priority,
        status: editingGoal.status,
        percentComplete: editingGoal.percentComplete,
        showOnDashboard: editingGoal.showOnDashboard,
        reminderDays: editingGoal.reminderDays,
        useTaskProgressForPercent: editingGoal.useTaskProgressForPercent,
      });
      if (!data?.goal) return;
      setGoals((prev) => prev.map((g) => (g.id === editingGoal.id ? data.goal : g)));
      showMessage('success', 'Goal updated');
      setEditingGoalId(null);
      setEditingGoal(null);
      setEditingNoteId(null);
      return;
    }
    setGoals((prev) => prev.map((g) => (g.id === editingGoal.id ? { ...editingGoal } : g)));
    setEditingGoalId(null);
    setEditingGoal(null);
    setEditingNoteId(null);
  };

  const updateEditingGoal = (updates: Partial<Goal>) => {
    if (editingGoal) setEditingGoal((prev) => (prev ? { ...prev, ...updates } : null));
  };

  const addUpdateNoteToEditingGoal = async () => {
    if (!editingGoal || !newUpdateNoteText.trim()) return;
    if (toolId) {
      const data = await apiPost('update_note', 'create', {
        goalId: editingGoal.id,
        noteDate: newUpdateNoteDate,
        note: newUpdateNoteText.trim(),
      });
      if (!data?.note) return;
      const note: UpdateNote = {
        id: data.note.id,
        goalId: data.note.goalId,
        noteDate: data.note.noteDate,
        note: data.note.note,
      };
      setEditingGoal((prev) =>
        prev ? { ...prev, updateNotes: [...prev.updateNotes, note], lastUpdateDate: newUpdateNoteDate } : null
      );
    } else {
      const note: UpdateNote = {
        id: generateId(),
        goalId: editingGoal.id,
        noteDate: newUpdateNoteDate,
        note: newUpdateNoteText.trim(),
      };
      setEditingGoal((prev) =>
        prev ? { ...prev, updateNotes: [...prev.updateNotes, note], lastUpdateDate: newUpdateNoteDate } : null
      );
    }
    setNewUpdateNoteText('');
    setNewUpdateNoteDate(new Date().toISOString().split('T')[0]);
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
    if (toolId) await apiPost('update_note', 'delete', { noteId });
    setEditingGoal((prev) =>
      prev ? { ...prev, updateNotes: prev.updateNotes.filter((n) => n.id !== noteId) } : null
    );
    if (editingNoteId === noteId) cancelEditingNote();
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
    setEditingGoal((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, completed: next } : t)),
          }
        : null
    );
    if (toolId) await apiPost('task', 'update', { taskId, completed: next });
  };

  const deleteTask = async (taskId: string) => {
    if (toolId) await apiPost('task', 'delete', { taskId });
    setEditingGoal((prev) => (prev ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== taskId) } : null));
  };

  // Escape to close modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpenCategoryId(null);
        if (showAllUpdatesGoalId) setShowAllUpdatesGoalId(null);
        if (deleteConfirmCategoryId) {
          setDeleteConfirmCategoryId(null);
          setDeleteConfirmText('');
        }
        if (deleteConfirmGoalId) {
          setDeleteConfirmGoalId(null);
          setDeleteGoalConfirmText('');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteConfirmCategoryId, deleteConfirmGoalId, showAllUpdatesGoalId]);

  return (
    <div className="space-y-6 relative">
      {toolId && isLoadingData && (
        <div className="absolute inset-0 bg-slate-950/60 z-10 flex items-center justify-center rounded-2xl">
          <span className="text-slate-400">Loading...</span>
        </div>
      )}
      {saveMessage && (
        <div
          className={`rounded-lg px-4 py-2 text-sm ${
            saveMessage.type === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
          }`}
        >
          {saveMessage.text}
        </div>
      )}
      {/* Title and description */}
      <div>
        <h2 className="text-2xl font-semibold text-slate-50 mb-2">Goals Tracking</h2>
        <p className="text-slate-400 text-sm">
          Create goals by category, track progress with phases and tasks, and get reminders when updates are due.
        </p>
      </div>

      {/* Category selector */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <label className="block text-sm font-medium text-slate-300 mb-3">Select your Category</label>

        {!isCreatingNewCategory ? (
          <div className="flex items-center gap-3 flex-wrap">
            {categories.map((cat) =>
              editingCategoryId === cat.id ? (
                <div
                  key={cat.id}
                  className="px-4 py-3 rounded-lg border border-slate-600 bg-slate-800 min-w-[200px]"
                  style={{ borderColor: editingCategoryColor, backgroundColor: `${editingCategoryColor}15` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      className="flex-1 px-2 py-1 rounded border border-slate-600 bg-slate-900 text-slate-100 text-sm focus:border-emerald-500/50 focus:outline-none"
                      placeholder="Category name"
                      autoFocus
                    />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs text-slate-400">Color:</label>
                    <input
                      type="color"
                      value={editingCategoryColor}
                      onChange={(e) => setEditingCategoryColor(e.target.value)}
                      className="h-6 w-12 rounded border border-slate-600 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveCategoryEdit}
                      disabled={!editingCategoryName.trim()}
                      className="flex-1 px-2 py-1 rounded bg-emerald-500 text-slate-950 text-xs font-medium hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingCategoryId(null)}
                      className="px-2 py-1 rounded border border-slate-600 bg-slate-700 text-slate-200 text-xs hover:bg-slate-600"
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
                      backgroundColor: selectedCategoryId === cat.id ? `${cat.card_color}15` : `${cat.card_color}08`,
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
                    className="absolute top-1 right-1 p-1 rounded hover:bg-slate-700/50 transition-colors"
                    title="Category options"
                    aria-label="Category options"
                  >
                    <svg className="h-4 w-4 text-slate-400 hover:text-slate-200" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                    </svg>
                  </button>
                  {menuOpenCategoryId === cat.id && (
                    <div className="absolute top-10 right-0 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-lg min-w-[160px] py-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingCategory(cat);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-2"
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
                        className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 transition-colors flex items-center gap-2"
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
                setIsCreatingNewCategory(true);
                setSelectedCategoryId(null);
                setEditingCategoryId(null);
                setNewCategoryColor('#10b981');
              }}
              className="px-4 py-3 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300 transition-all duration-200 flex items-center justify-center min-w-[60px]"
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
              <label className="block text-sm font-medium text-slate-300 mb-2">New Category Name</label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Enter category name"
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
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
              <label className="text-sm text-slate-400">Color:</label>
              <input
                type="color"
                value={newCategoryColor}
                onChange={(e) => setNewCategoryColor(e.target.value)}
                className="h-8 w-12 rounded border border-slate-600 cursor-pointer"
              />
            </div>
            <button
              onClick={createCategory}
              disabled={!newCategoryName.trim()}
              className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create
            </button>
            <button
              onClick={() => {
                setIsCreatingNewCategory(false);
                setNewCategoryName('');
              }}
              className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {menuOpenCategoryId && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpenCategoryId(null)} aria-hidden="true" />
      )}

      {/* Delete category confirmation */}
      {deleteConfirmCategoryId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-slate-50 mb-2">Delete Category</h3>
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4">
              <p className="text-red-300 font-semibold mb-2">⚠️ Warning: This action cannot be undone!</p>
              <p className="text-red-200 text-sm">
                All goals, phases, tasks, and update notes in this category will be permanently deleted.
              </p>
            </div>
            <p className="text-slate-300 mb-4">
              To confirm, type <strong className="text-slate-200">delete</strong> below:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={deleteCategory}
                disabled={deleteConfirmText.toLowerCase() !== 'delete'}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Category
              </button>
              <button
                onClick={() => {
                  setDeleteConfirmCategoryId(null);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {!selectedCategoryId && !isCreatingNewCategory && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
          <p className="text-slate-400">Select a category or create one to manage goals.</p>
        </div>
      )}

      {selectedCategoryId && selectedCategory && (
        <>
          {/* Category name + one tab per goal + Add Goal tab */}
          <div className="border-b border-slate-800">
            <div className="flex gap-2 items-center flex-wrap">
              <div className="px-4 py-2 text-[18px] font-medium text-slate-200 whitespace-nowrap border-b-2 border-transparent">
                {selectedCategory.name}:
              </div>
              {goalsInCategory.map((goal) => (
                <button
                  key={goal.id}
                  onClick={() => {
                    setSelectedGoalId(goal.id);
                    setIsAddingGoal(false);
                  }}
                  className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    selectedGoalId === goal.id && !isAddingGoal
                      ? 'border-b-2 border-emerald-500 text-emerald-300'
                      : 'border-b-2 border-transparent text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {goal.title}
                </button>
              ))}
              <button
                onClick={startAddingGoal}
                className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
                  isAddingGoal
                    ? 'border-emerald-500 text-emerald-300'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                + Add Goal
              </button>
            </div>
          </div>

          {/* Add goal form */}
          {isAddingGoal && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">New Goal</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Goal Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newGoal.title}
                    onChange={(e) => setNewGoal((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Save for vacation"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Description</label>
                  <textarea
                    value={newGoal.description}
                    onChange={(e) => setNewGoal((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Optional details"
                    rows={2}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Target Date</label>
                    <input
                      type="date"
                      value={newGoal.targetDate}
                      onChange={(e) => setNewGoal((p) => ({ ...p, targetDate: e.target.value }))}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Priority</label>
                    <select
                      value={newGoal.priority}
                      onChange={(e) => setNewGoal((p) => ({ ...p, priority: e.target.value as Priority }))}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Status</label>
                    <select
                      value={newGoal.status}
                      onChange={(e) => setNewGoal((p) => ({ ...p, status: e.target.value as GoalStatus }))}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    >
                      <option value="Not Started">Not Started</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Delayed">Delayed</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={addGoal}
                    disabled={!newGoal.title.trim()}
                    className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Goal
                  </button>
                  <button
                    onClick={cancelAddingGoal}
                    className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Single goal view (one record per tab) */}
          {!isAddingGoal && (
            <div className="mt-4">
              {!selectedGoal ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
                  <p className="text-slate-400 mb-4">No goal selected. Click &quot;+ Add Goal&quot; to create one.</p>
                  <button
                    onClick={startAddingGoal}
                    className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
                  >
                    + Add Goal
                  </button>
                </div>
              ) : (
                (() => {
                  const goal = selectedGoal;
                  const percent = getGoalPercent(goal);
                  const recentUpdates = [...goal.updateNotes]
                    .sort((a, b) => b.noteDate.localeCompare(a.noteDate))
                    .slice(0, 3);
                  const lastNote = goal.updateNotes.length > 0
                    ? [...goal.updateNotes].sort((a, b) => b.noteDate.localeCompare(a.noteDate))[0]
                    : null;
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const daysSinceLastUpdate = lastNote
                    ? Math.floor((today.getTime() - new Date(lastNote.noteDate).getTime()) / (1000 * 60 * 60 * 24))
                    : Infinity;
                  const showReminderWarning = goal.reminderDays != null && daysSinceLastUpdate >= goal.reminderDays;
                  return (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition-colors hover:border-slate-700">
                      <div className="flex flex-col md:flex-row items-stretch gap-6">
                        {/* Left 25%: Goal name, status bar, % complete */}
                        <div className="w-full md:w-1/4 min-w-0 flex flex-col pb-4 border-b border-slate-700 md:pb-0 md:border-b-0 md:pr-4 md:border-r text-center md:min-h-[180px]">
                          <div>
                            <div className="flex items-center justify-center gap-2 mb-3">
                              <h3 className="text-3xl font-semibold text-slate-50">{goal.title}</h3>
                              {showReminderWarning && (
                                <span
                                  className="inline-flex text-amber-400 shrink-0"
                                  title={`No update in ${goal.reminderDays} days — reminder overdue`}
                                  aria-label="Update reminder overdue"
                                >
                                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 9a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm0 7a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                                  </svg>
                                </span>
                              )}
                            </div>
                            <div className="mb-3 w-full">
                              <div className="text-xs text-slate-400 mb-1">Progress</div>
                              <div className="h-8 rounded-full bg-slate-800 overflow-hidden w-full">
                                <div
                                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 flex flex-col justify-center">
                            <div className="text-5xl font-semibold text-emerald-300">{percent}%</div>
                          </div>
                        </div>
                        {/* Right 75%: Priority/Status/Target row + Recent updates below */}
                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="rounded-lg border border-slate-700/70 overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-700 bg-slate-800/50">
                                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider py-2 px-3">Priority</th>
                                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider py-2 px-3">Status</th>
                                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider py-2 px-3">Target</th>
                                  <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider py-2 px-3">Tasks</th>
                                  <th className="text-right py-2 px-2 align-middle" scope="col">
                                    <div className="flex items-center justify-end gap-3">
                                      <label className="flex items-center gap-2 cursor-pointer" title="Show on Dashboard">
                                        <span className="text-xs text-slate-400 whitespace-nowrap">Dashboard</span>
                                        <button
                                          type="button"
                                          role="switch"
                                          aria-checked={goal.showOnDashboard}
                                          onClick={async () => {
                                            const next = !goal.showOnDashboard;
                                            setGoals((prev) =>
                                              prev.map((g) =>
                                                g.id === goal.id ? { ...g, showOnDashboard: next } : g
                                              )
                                            );
                                            if (toolId) {
                                              const data = await apiPost('goal', 'update', {
                                                goalId: goal.id,
                                                showOnDashboard: next,
                                              });
                                              if (!data?.goal) {
                                                setGoals((prev) =>
                                                  prev.map((g) =>
                                                    g.id === goal.id ? { ...g, showOnDashboard: goal.showOnDashboard } : g
                                                  )
                                                );
                                                showMessage('error', 'Failed to update');
                                              }
                                            }
                                          }}
                                          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                                            goal.showOnDashboard ? 'bg-emerald-500' : 'bg-slate-700'
                                          }`}
                                        >
                                          <span
                                            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform mt-0.5 ${
                                              goal.showOnDashboard ? 'translate-x-5' : 'translate-x-0.5'
                                            }`}
                                          />
                                        </button>
                                      </label>
                                      <button
                                        onClick={() => startEditingGoal(goal)}
                                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
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
                                          ? 'bg-red-500/20 text-red-300'
                                          : goal.priority === 'Medium'
                                            ? 'bg-amber-500/20 text-amber-300'
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
                                          ? 'bg-emerald-500/20 text-emerald-300'
                                          : goal.status === 'Delayed'
                                            ? 'bg-amber-500/20 text-amber-300'
                                            : goal.status === 'In Progress'
                                              ? 'bg-blue-500/20 text-blue-300'
                                              : 'bg-slate-500/20 text-slate-300'
                                      }`}
                                    >
                                      {goal.status}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-slate-300 align-top">
                                    {goal.targetDate ? formatDateForDisplay(goal.targetDate) : '—'}
                                  </td>
                                  <td className="py-2 px-3 text-slate-300 align-top">
                                    {goal.tasks.length > 0
                                      ? `${goal.tasks.filter((t) => t.completed).length}/${goal.tasks.length}`
                                      : '—'}
                                  </td>
                                  <td className="py-2 px-3" />
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <div className="mt-3 rounded-lg border border-slate-700/70 px-3 py-3 bg-slate-800/30">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Recent updates
                              </span>
                              {goal.updateNotes.length > 0 && (
                                <button
                                  onClick={() => setShowAllUpdatesGoalId(goal.id)}
                                  className="rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
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
                            {recentUpdates.length === 0 ? (
                              <p className="text-sm text-slate-500">No updates yet.</p>
                            ) : (
                              <ul className="space-y-2 text-sm text-slate-300">
                                {recentUpdates.map((n) => (
                                  <li key={n.id}>
                                    <span className="text-slate-500">{formatDateForDisplay(n.noteDate)}</span>
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
                })()
              )}
            </div>
          )}

          {/* View all updates popup */}
          {showAllUpdatesGoalId && (() => {
            const allUpdatesGoal = goals.find((g) => g.id === showAllUpdatesGoalId);
            if (!allUpdatesGoal) return null;
            const allNotes = [...allUpdatesGoal.updateNotes].sort((a, b) => b.noteDate.localeCompare(a.noteDate));
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
                  <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h3 className="text-lg font-semibold text-slate-50">Update history — {allUpdatesGoal.title}</h3>
                    <button
                      onClick={() => setShowAllUpdatesGoalId(null)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                      aria-label="Close"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="overflow-y-auto p-4 space-y-2">
                    {allNotes.length === 0 ? (
                      <p className="text-sm text-slate-500">No updates yet.</p>
                    ) : (
                      allNotes.map((n) => (
                        <div key={n.id} className="rounded-lg border border-slate-700/70 bg-slate-800/30 px-3 py-2 text-sm text-slate-300">
                          <span className="text-slate-500">{formatDateForDisplay(n.noteDate)}</span>
                          {' — '}
                          <span className="whitespace-pre-wrap">{n.note}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-4 border-t border-slate-700">
                    <button
                      onClick={() => setShowAllUpdatesGoalId(null)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Edit goal modal */}
          {editingGoalId && editingGoal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-slate-50">Edit Goal</h3>
                  <button
                    onClick={cancelEditingGoal}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                    aria-label="Close modal"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Goal Title</label>
                    <input
                      type="text"
                      value={editingGoal.title}
                      onChange={(e) => updateEditingGoal({ title: e.target.value })}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Description</label>
                    <textarea
                      value={editingGoal.description}
                      onChange={(e) => updateEditingGoal({ description: e.target.value })}
                      rows={2}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Target Date</label>
                      <input
                        type="date"
                        value={editingGoal.targetDate}
                        onChange={(e) => updateEditingGoal({ targetDate: e.target.value })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Priority</label>
                      <select
                        value={editingGoal.priority}
                        onChange={(e) => updateEditingGoal({ priority: e.target.value as Priority })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Status</label>
                      <select
                        value={editingGoal.status}
                        onChange={(e) => updateEditingGoal({ status: e.target.value as GoalStatus })}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      >
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Delayed">Delayed</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  </div>

                  {/* Phases & Tasks */}
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-slate-200">Phases & Tasks (Optional)</h4>
                      <button
                        onClick={addPhaseToEditingGoal}
                        className="px-2 py-1 rounded bg-emerald-500 text-slate-950 text-xs font-medium hover:bg-emerald-400"
                      >
                        + Phase
                      </button>
                    </div>
                    {editingGoal.phases.length === 0 ? (
                      <p className="text-slate-400 text-sm">No phases. Add a phase, then add tasks inside it.</p>
                    ) : (
                      <div className="space-y-4">
                        {editingGoal.phases
                          .slice()
                          .sort((a, b) => a.order - b.order)
                          .map((phase) => (
                            <div key={phase.id} className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <input
                                  type="text"
                                  value={phase.name}
                                  onChange={(e) => updatePhaseName(phase.id, e.target.value)}
                                  className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-100"
                                />
                                <button
                                  onClick={() => deletePhaseFromEditingGoal(phase.id)}
                                  className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-red-300"
                                  aria-label="Delete phase"
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
                                        className="rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                                      />
                                      <input
                                        type="text"
                                        value={task.title}
                                        onChange={(e) => updateTask(task.id, { title: e.target.value })}
                                        className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-100"
                                      />
                                      <button
                                        onClick={() => deleteTask(task.id)}
                                        className="rounded p-1 text-slate-400 hover:text-red-300"
                                        aria-label="Delete task"
                                      >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </li>
                                  ))}
                              </ul>
                              <button
                                onClick={() => addTaskToPhase(phase.id)}
                                className="mt-2 text-xs text-emerald-400 hover:text-emerald-300"
                              >
                                + Add task
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Completion % */}
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-slate-300">Completion %</label>
                      <span className="text-slate-200">{editingGoal.useTaskProgressForPercent ? 'From tasks' : editingGoal.percentComplete + '%'}</span>
                    </div>
                    {!editingGoal.useTaskProgressForPercent && (
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={editingGoal.percentComplete}
                        onChange={(e) => updateEditingGoal({ percentComplete: Number(e.target.value) })}
                        className="w-full h-2 rounded-full bg-slate-700 appearance-none accent-emerald-500"
                      />
                    )}
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingGoal.useTaskProgressForPercent}
                        onChange={(e) => updateEditingGoal({ useTaskProgressForPercent: e.target.checked })}
                        className="rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                      />
                      <span className="text-sm text-slate-300">Use task completion for progress (each task = equal share of 100%)</span>
                    </label>
                  </div>

                  {/* Update note */}
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                    <h4 className="text-sm font-medium text-slate-200 mb-2">Add update note</h4>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="date"
                        value={newUpdateNoteDate}
                        onChange={(e) => setNewUpdateNoteDate(e.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={newUpdateNoteText}
                        onChange={(e) => setNewUpdateNoteText(e.target.value)}
                        placeholder="What did you do?"
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none"
                      />
                      <button
                        onClick={addUpdateNoteToEditingGoal}
                        disabled={!newUpdateNoteText.trim()}
                        className="px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 text-sm font-medium hover:bg-emerald-400 disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                    {editingGoal.updateNotes.length > 0 && (
                      <ul className="mt-2 space-y-2 text-sm text-slate-300">
                        {editingGoal.updateNotes
                          .slice()
                          .sort((a, b) => b.noteDate.localeCompare(a.noteDate))
                          .map((n) => (
                            <li key={n.id} className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-2">
                              {editingNoteId === n.id ? (
                                <div className="space-y-2">
                                  <input
                                    type="date"
                                    value={editNoteDate}
                                    onChange={(e) => setEditNoteDate(e.target.value)}
                                    className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100 text-sm w-full"
                                  />
                                  <input
                                    type="text"
                                    value={editNoteText}
                                    onChange={(e) => setEditNoteText(e.target.value)}
                                    className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100 text-sm w-full"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={saveEditedNote}
                                      disabled={!editNoteText.trim()}
                                      className="px-2 py-1 rounded bg-emerald-500 text-slate-950 text-xs font-medium hover:bg-emerald-400 disabled:opacity-50"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={cancelEditingNote}
                                      className="px-2 py-1 rounded border border-slate-600 bg-slate-700 text-slate-200 text-xs hover:bg-slate-600"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-2">
                                  <span>
                                    <span className="text-slate-400">{formatDateForDisplay(n.noteDate)}:</span> {n.note}
                                  </span>
                                  <div className="flex items-center gap-0.5 shrink-0">
                                    <button
                                      onClick={() => startEditingNote(n)}
                                      className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                                      title="Edit note"
                                      aria-label="Edit note"
                                    >
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => deleteUpdateNote(n.id)}
                                      className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-red-300"
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
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-slate-300">Remind if no update in</label>
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
                        className="w-20 rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none"
                      />
                      <span className="text-sm text-slate-400">days</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 pt-4 mt-4 border-t border-slate-700">
                    <button
                      onClick={() => {
                        if (editingGoal) {
                          setDeleteConfirmGoalId(editingGoal.id);
                          setDeleteGoalConfirmText('');
                          setEditingGoalId(null);
                          setEditingGoal(null);
                        }
                      }}
                      className="px-4 py-2 rounded-lg bg-red-600/90 text-white text-sm font-medium hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
                    >
                      Delete goal
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={saveGoalEdit}
                        className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
                      >
                        Save changes
                      </button>
                      <button
                        onClick={cancelEditingGoal}
                        className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Delete goal confirmation */}
          {deleteConfirmGoalId && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4">
                <h3 className="text-xl font-semibold text-slate-50 mb-2">Delete Goal</h3>
                <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4">
                  <p className="text-red-300 font-semibold">This goal and all its phases, tasks, and notes will be permanently deleted.</p>
                </div>
                <p className="text-slate-300 mb-4">Type <strong className="text-slate-200">delete</strong> to confirm:</p>
                <input
                  type="text"
                  value={deleteGoalConfirmText}
                  onChange={(e) => setDeleteGoalConfirmText(e.target.value)}
                  placeholder="Type 'delete' to confirm"
                  className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 mb-4"
                />
                <div className="flex gap-3">
                  <button
                    onClick={deleteGoal}
                    disabled={deleteGoalConfirmText.toLowerCase() !== 'delete'}
                    className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete Goal
                  </button>
                  <button
                    onClick={() => {
                      setDeleteConfirmGoalId(null);
                      setDeleteGoalConfirmText('');
                    }}
                    className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
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
