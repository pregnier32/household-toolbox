'use client';

import { useState, useMemo, useEffect } from 'react';

const DEFAULT_ITEM_CATEGORIES = [
  'Bakery & Bread',
  'Beverages',
  'Dairy & Refrigerated',
  'Frozen Foods',
  'Meat & Seafood',
  'Pantry Staples',
  'Paper & Disposable Goods',
  'Produce',
  'Snacks',
  'Spices & Seasonings',
];

type MasterItem = {
  id: string;
  name: string;
  category: string;
};

type MealType = {
  id: string;
  name: string;
};

type Meal = {
  id: string;
  name: string;
  mealTypeId: string;
  description: string;
  instructions: string;
  ingredientIds: string[];
  prepTimeMinutes: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | '';
  rating: number; // 0-5
  isActive?: boolean;
};

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type DayAssignments = Record<DayKey, string[]>; // meal ids per day

type MealPlanRecord = {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD (Monday)
  assignments: DayAssignments;
  isActive: boolean;
};

/** Parse YYYY-MM-DD as local date (avoids UTC midnight shifting the day in some timezones). */
function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Format YYYY-MM-DD to local M/D/YYYY. */
function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return '';
  const d = parseLocalDate(isoDate);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const y = d.getFullYear();
  return `${m}/${day}/${y}`;
}

function getNextMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayStr = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayStr}`;
}

function getDatesForWeek(startMonday: string): { key: DayKey; date: string; label: string }[] {
  const base = parseLocalDate(startMonday);
  const keys: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  return keys.map((key, i) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${dayStr}`;
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return { key, date: dateStr, label: labels[i] };
  });
}

type MealPlannerToolProps = {
  toolId?: string;
};

const API_BASE = '/api/tools/meal-planner';

export function MealPlannerTool({ toolId }: MealPlannerToolProps) {
  const [activeTab, setActiveTab] = useState<'meal-plan' | 'meals' | 'meal-types' | 'items'>('meal-plan');

  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  const [itemCategories] = useState<string[]>(() => [...DEFAULT_ITEM_CATEGORIES]);
  const [mealTypes, setMealTypes] = useState<MealType[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlanRecord[]>([]);

  const [itemsLoading, setItemsLoading] = useState(false);
  const [mealTypesLoading, setMealTypesLoading] = useState(false);
  const [mealsLoading, setMealsLoading] = useState(false);
  const [plansLoading, setPlansLoading] = useState(false);

  const fetchItems = async () => {
    if (!toolId) return;
    setItemsLoading(true);
    try {
      const res = await fetch(`${API_BASE}?toolId=${encodeURIComponent(toolId)}&resource=items`);
      if (!res.ok) throw new Error('Failed to fetch items');
      const data = await res.json();
      setMasterItems(data.items ?? []);
    } catch (e) {
      console.error('Fetch items error:', e);
    } finally {
      setItemsLoading(false);
    }
  };

  const fetchMealTypes = async () => {
    if (!toolId) return;
    setMealTypesLoading(true);
    try {
      const res = await fetch(`${API_BASE}?toolId=${encodeURIComponent(toolId)}&resource=meal-types`);
      if (!res.ok) throw new Error('Failed to fetch meal types');
      const data = await res.json();
      setMealTypes(data.mealTypes ?? []);
    } catch (e) {
      console.error('Fetch meal types error:', e);
    } finally {
      setMealTypesLoading(false);
    }
  };

  const fetchMeals = async () => {
    if (!toolId) return;
    setMealsLoading(true);
    try {
      const res = await fetch(`${API_BASE}?toolId=${encodeURIComponent(toolId)}&resource=meals`);
      if (!res.ok) throw new Error('Failed to fetch meals');
      const data = await res.json();
      setMeals(data.meals ?? []);
    } catch (e) {
      console.error('Fetch meals error:', e);
    } finally {
      setMealsLoading(false);
    }
  };

  const fetchPlans = async () => {
    if (!toolId) return;
    setPlansLoading(true);
    try {
      const res = await fetch(`${API_BASE}?toolId=${encodeURIComponent(toolId)}&resource=plans`);
      if (!res.ok) throw new Error('Failed to fetch plans');
      const data = await res.json();
      setMealPlans(data.plans ?? []);
    } catch (e) {
      console.error('Fetch plans error:', e);
    } finally {
      setPlansLoading(false);
    }
  };

  useEffect(() => {
    if (!toolId) return;
    fetchItems();
    fetchMealTypes();
    fetchMeals();
    fetchPlans();
  }, [toolId]);

  // --- Items tab state ---
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState('');
  const [editingItemCategory, setEditingItemCategory] = useState('');
  const [deleteConfirmItemId, setDeleteConfirmItemId] = useState<string | null>(null);
  const [deleteConfirmItemText, setDeleteConfirmItemText] = useState('');
  const [selectedItemsCategory, setSelectedItemsCategory] = useState<string | null>(null);

  const getUniqueCategories = () => {
    const fromItems = new Set(masterItems.map((i) => i.category));
    const combined = new Set([...itemCategories, ...fromItems]);
    return Array.from(combined).sort();
  };

  const getItemsByCategory = (category: string) =>
    masterItems.filter((i) => i.category === category).sort((a, b) => a.name.localeCompare(b.name));

  const categories = getUniqueCategories();
  const displayCategory = selectedItemsCategory ?? categories[0] ?? null;
  const currentItems = displayCategory ? getItemsByCategory(displayCategory) : [];

  useEffect(() => {
    if (selectedItemsCategory && !categories.includes(selectedItemsCategory)) {
      setSelectedItemsCategory(categories[0] ?? null);
    }
  }, [masterItems, categories]);

  const addMasterItem = async () => {
    const cat = (isCreatingNewCategory ? newItemCategory.trim() : newItemCategory) || '';
    if (!newItemName.trim() || !cat || !toolId) return;
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createItem',
          toolId,
          name: newItemName.trim(),
          category: cat,
        }),
      });
      if (!res.ok) throw new Error('Failed to add item');
      await fetchItems();
      setNewItemName('');
      setNewItemCategory('');
      setIsAddingItem(false);
      setIsCreatingNewCategory(false);
    } catch (e) {
      console.error('Add item error:', e);
    }
  };

  const startEditingItem = (item: MasterItem) => {
    setEditingItemId(item.id);
    setEditingItemName(item.name);
    setEditingItemCategory(item.category);
  };

  const saveEditingItem = async () => {
    if (!editingItemId || !toolId) return;
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateItem',
          toolId,
          itemId: editingItemId,
          name: editingItemName.trim(),
          category: editingItemCategory.trim(),
        }),
      });
      if (!res.ok) throw new Error('Failed to update item');
      await fetchItems();
      setEditingItemId(null);
      setEditingItemName('');
      setEditingItemCategory('');
    } catch (e) {
      console.error('Update item error:', e);
    }
  };

  const cancelEditingItem = () => {
    setEditingItemId(null);
    setEditingItemName('');
    setEditingItemCategory('');
  };

  const deleteMasterItem = async () => {
    if (!deleteConfirmItemId || deleteConfirmItemText.toLowerCase() !== 'delete' || !toolId) return;
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteItem', toolId, itemId: deleteConfirmItemId }),
      });
      if (!res.ok) throw new Error('Failed to delete item');
      await fetchItems();
      setDeleteConfirmItemId(null);
      setDeleteConfirmItemText('');
    } catch (e) {
      console.error('Delete item error:', e);
    }
  };

  // --- Meal Types tab state ---
  const [isAddingMealType, setIsAddingMealType] = useState(false);
  const [newMealTypeName, setNewMealTypeName] = useState('');
  const [editingMealTypeId, setEditingMealTypeId] = useState<string | null>(null);
  const [editingMealTypeName, setEditingMealTypeName] = useState('');
  const [deleteConfirmMealTypeId, setDeleteConfirmMealTypeId] = useState<string | null>(null);
  const [deleteConfirmMealTypeText, setDeleteConfirmMealTypeText] = useState('');

  const addMealType = async () => {
    if (!newMealTypeName.trim() || !toolId) return;
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createMealType', toolId, name: newMealTypeName.trim() }),
      });
      if (!res.ok) throw new Error('Failed to add meal type');
      await fetchMealTypes();
      setNewMealTypeName('');
      setIsAddingMealType(false);
    } catch (e) {
      console.error('Add meal type error:', e);
    }
  };

  const saveEditingMealType = async () => {
    if (!editingMealTypeId || !toolId) return;
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateMealType',
          toolId,
          mealTypeId: editingMealTypeId,
          name: editingMealTypeName.trim(),
        }),
      });
      if (!res.ok) throw new Error('Failed to update meal type');
      await fetchMealTypes();
      setEditingMealTypeId(null);
      setEditingMealTypeName('');
    } catch (e) {
      console.error('Update meal type error:', e);
    }
  };

  const deleteMealType = async () => {
    if (!deleteConfirmMealTypeId || deleteConfirmMealTypeText.toLowerCase() !== 'delete' || !toolId) return;
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteMealType', toolId, mealTypeId: deleteConfirmMealTypeId }),
      });
      if (!res.ok) throw new Error('Failed to delete meal type');
      await fetchMealTypes();
      setDeleteConfirmMealTypeId(null);
      setDeleteConfirmMealTypeText('');
    } catch (e) {
      console.error('Delete meal type error:', e);
    }
  };

  // --- Meals tab state ---
  const [isAddingMeal, setIsAddingMeal] = useState(false);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [mealForm, setMealForm] = useState({
    name: '',
    mealTypeId: '',
    description: '',
    instructions: '',
    ingredientIds: [] as string[],
    prepTimeMinutes: '' as number | '',
    difficulty: '' as Meal['difficulty'],
    rating: 0,
  });
  const [selectedPickerCategory, setSelectedPickerCategory] = useState<string | null>(null);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [mealFilterType, setMealFilterType] = useState('');
  const [mealFilterDifficulty, setMealFilterDifficulty] = useState('');
  const [mealFilterRating, setMealFilterRating] = useState('');
  const [inactiveMealsExpanded, setInactiveMealsExpanded] = useState(false);
  const [deleteConfirmMealId, setDeleteConfirmMealId] = useState<string | null>(null);
  const [deleteConfirmMealText, setDeleteConfirmMealText] = useState('');

  const resetMealForm = () => {
    setMealForm({
      name: '',
      mealTypeId: '',
      description: '',
      instructions: '',
      ingredientIds: [],
      prepTimeMinutes: '',
      difficulty: '',
      rating: 0,
    });
  };

  const toggleMealIngredient = (itemId: string) => {
    setMealForm((f) =>
      f.ingredientIds.includes(itemId)
        ? { ...f, ingredientIds: f.ingredientIds.filter((id) => id !== itemId) }
        : { ...f, ingredientIds: [...f.ingredientIds, itemId] }
    );
  };

  const saveMeal = async () => {
    const prep = mealForm.prepTimeMinutes === '' ? null : Number(mealForm.prepTimeMinutes);
    const diff = mealForm.difficulty || '';
    if (!mealForm.name.trim() || !toolId) return;
    const prepVal = prep === null || isNaN(prep) ? null : prep;
    try {
      if (editingMealId) {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'updateMeal',
            toolId,
            mealId: editingMealId,
            name: mealForm.name.trim(),
            mealTypeId: mealForm.mealTypeId || null,
            description: mealForm.description.trim(),
            instructions: mealForm.instructions.trim(),
            ingredientIds: mealForm.ingredientIds,
            prepTimeMinutes: prepVal,
            difficulty: diff || null,
            rating: mealForm.rating,
          }),
        });
        if (!res.ok) throw new Error('Failed to update meal');
      } else {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'createMeal',
            toolId,
            name: mealForm.name.trim(),
            mealTypeId: mealForm.mealTypeId || null,
            description: mealForm.description.trim(),
            instructions: mealForm.instructions.trim(),
            ingredientIds: mealForm.ingredientIds,
            prepTimeMinutes: prepVal,
            difficulty: diff || null,
            rating: mealForm.rating,
          }),
        });
        if (!res.ok) throw new Error('Failed to create meal');
      }
      await fetchMeals();
      resetMealForm();
      setEditingMealId(null);
      setIsAddingMeal(false);
      setIngredientSearch('');
    } catch (e) {
      console.error('Save meal error:', e);
    }
  };

  const startEditingMeal = (meal: Meal) => {
    setEditingMealId(meal.id);
    setMealForm({
      name: meal.name,
      mealTypeId: meal.mealTypeId,
      description: meal.description,
      instructions: meal.instructions,
      ingredientIds: [...meal.ingredientIds],
      prepTimeMinutes: meal.prepTimeMinutes ?? '',
      difficulty: meal.difficulty,
      rating: meal.rating,
    });
    setIsAddingMeal(true);
  };

  const deleteMeal = async () => {
    if (!deleteConfirmMealId || deleteConfirmMealText.toLowerCase() !== 'delete' || !toolId) return;
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteMeal', toolId, mealId: deleteConfirmMealId }),
      });
      if (!res.ok) throw new Error('Failed to delete meal');
      await fetchMeals();
      setDeleteConfirmMealId(null);
      setDeleteConfirmMealText('');
    } catch (e) {
      console.error('Delete meal error:', e);
    }
  };

  const setMealActive = async (mealId: string, isActive: boolean) => {
    if (!toolId) return;
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setMealActive', toolId, mealId, isActive }),
      });
      if (!res.ok) throw new Error('Failed to update meal');
      await fetchMeals();
    } catch (e) {
      console.error('Set meal active error:', e);
    }
  };

  const activeMealsList = useMemo(
    () => meals.filter((m) => m.isActive !== false),
    [meals]
  );
  const inactiveMealsList = useMemo(
    () => meals.filter((m) => m.isActive === false),
    [meals]
  );

  const applyMealFilters = (list: Meal[]) => {
    let out = list;
    if (mealFilterType) {
      out = out.filter((m) => m.mealTypeId === mealFilterType);
    }
    if (mealFilterDifficulty) {
      out = out.filter((m) => (m.difficulty || '') === mealFilterDifficulty);
    }
    if (mealFilterRating) {
      const r = Number(mealFilterRating);
      if (!isNaN(r)) out = out.filter((m) => m.rating >= r);
    }
    return out;
  };

  const filteredActiveMeals = useMemo(
    () => applyMealFilters(activeMealsList),
    [activeMealsList, mealFilterType, mealFilterDifficulty, mealFilterRating]
  );
  const filteredInactiveMeals = useMemo(
    () => applyMealFilters(inactiveMealsList),
    [inactiveMealsList, mealFilterType, mealFilterDifficulty, mealFilterRating]
  );

  const renderMealRow = (meal: Meal, isActive: boolean) => {
    const typeName = mealTypes.find((t) => t.id === meal.mealTypeId)?.name ?? '—';
    return (
      <tr
        key={meal.id}
        className="border-b border-slate-700/50 bg-slate-800/50 hover:bg-slate-800 transition-colors text-sm"
      >
        <td className="px-3 py-2 font-medium text-slate-100 truncate max-w-0" title={meal.name}>
          {meal.name}
        </td>
        <td className="px-3 py-2 text-slate-300 truncate max-w-0">{typeName}</td>
        <td className="px-3 py-2 text-slate-300 whitespace-nowrap">
          {meal.prepTimeMinutes != null ? `${meal.prepTimeMinutes} min` : '—'}
        </td>
        <td className="px-3 py-2 text-slate-300 capitalize whitespace-nowrap">
          {meal.difficulty || '—'}
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={meal.rating >= star ? 'text-amber-400' : 'text-slate-600'}
                aria-hidden
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </span>
            ))}
          </div>
        </td>
        <td className="px-3 py-2 text-right whitespace-nowrap">
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => startEditingMeal(meal)}
              aria-label={`Edit ${meal.name}`}
              title="Edit"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setMealActive(meal.id, !isActive)}
              aria-label={isActive ? 'Move to inactive' : 'Move to active'}
              title={isActive ? 'Move to Inactive Meals' : 'Move to Active Meals'}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
            >
              {isActive ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleteConfirmMealId(meal.id);
                setDeleteConfirmMealText('');
              }}
              aria-label={`Delete ${meal.name}`}
              title="Delete"
              className="rounded-lg p-2 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
    );
  };

  // --- Meal Plan tab state ---
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanStartDate, setNewPlanStartDate] = useState(() => getNextMonday());
  const [newPlanAssignments, setNewPlanAssignments] = useState<DayAssignments>(() =>
    ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].reduce(
      (acc, k) => ({ ...acc, [k as DayKey]: [] }),
      {} as DayAssignments
    )
  );
  const [buildFromHistoryPlanId, setBuildFromHistoryPlanId] = useState('');
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editingPlanName, setEditingPlanName] = useState('');
  const [editingPlanStartDate, setEditingPlanStartDate] = useState('');
  const [editingPlanAssignments, setEditingPlanAssignments] = useState<DayAssignments | null>(null);
  const [mealPickerOpenFor, setMealPickerOpenFor] = useState<{ planId: string; day: DayKey } | null>(null);
  const [mealPickerSearch, setMealPickerSearch] = useState('');
  const [mealPickerTypeFilter, setMealPickerTypeFilter] = useState('');
  const [deleteConfirmPlanId, setDeleteConfirmPlanId] = useState<string | null>(null);
  const [deleteConfirmPlanText, setDeleteConfirmPlanText] = useState('');
  const [cartOpenPlanId, setCartOpenPlanId] = useState<string | null>(null);
  const [printingPlanId, setPrintingPlanId] = useState<string | null>(null);

  const activePlans = useMemo(() => mealPlans.filter((p) => p.isActive), [mealPlans]);
  const historyPlans = useMemo(() => mealPlans.filter((p) => !p.isActive), [mealPlans]);

  const getPlanAssignments = (plan: MealPlanRecord) =>
    editingPlanId === plan.id && editingPlanAssignments
      ? editingPlanAssignments
      : plan.assignments;

  const setPlanAssignment = (
    planId: string,
    day: DayKey,
    mealIds: string[],
    isEditing: boolean
  ) => {
    if (isEditing && editingPlanAssignments) {
      setEditingPlanAssignments({ ...editingPlanAssignments, [day]: mealIds });
    } else if (isEditing) {
      const plan = mealPlans.find((p) => p.id === planId);
      if (plan) setEditingPlanAssignments({ ...plan.assignments, [day]: mealIds });
    } else {
      setNewPlanAssignments((prev) => ({ ...prev, [day]: mealIds }));
    }
  };

  const addMealToDay = async (planId: string, day: DayKey, mealId: string, isEditing: boolean) => {
    const plan = mealPlans.find((p) => p.id === planId);
    const current = isEditing
      ? editingPlanAssignments?.[day] ?? plan?.assignments[day] ?? []
      : plan
        ? (plan.assignments[day] ?? [])
        : newPlanAssignments[day];
    if (current.includes(mealId)) return;
    const next = [...current, mealId];
    if (isEditing) {
      setPlanAssignment(planId, day, next, true);
    } else if (plan && toolId) {
      const newAssignments = { ...plan.assignments, [day]: next };
      try {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'updatePlan', toolId, planId, assignments: newAssignments }),
        });
        if (!res.ok) throw new Error('Failed to update plan');
        await fetchPlans();
      } catch (e) {
        console.error('Add meal to day error:', e);
      }
    } else {
      setPlanAssignment(planId, day, next, false);
    }
  };

  const removeMealFromDay = async (planId: string, day: DayKey, mealId: string, isEditing: boolean) => {
    const plan = mealPlans.find((p) => p.id === planId);
    const current = isEditing
      ? editingPlanAssignments?.[day] ?? plan?.assignments[day] ?? []
      : plan
        ? (plan.assignments[day] ?? [])
        : newPlanAssignments[day];
    const next = current.filter((id) => id !== mealId);
    if (isEditing) {
      setPlanAssignment(planId, day, next, true);
    } else if (plan && toolId) {
      const newAssignments = { ...plan.assignments, [day]: next };
      try {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'updatePlan', toolId, planId, assignments: newAssignments }),
        });
        if (!res.ok) throw new Error('Failed to update plan');
        await fetchPlans();
      } catch (e) {
        console.error('Remove meal from day error:', e);
      }
    } else {
      setPlanAssignment(planId, day, next, false);
    }
  };

  const createPlan = async () => {
    if (!newPlanName.trim() || !toolId) return;
    const assignments = buildFromHistoryPlanId
      ? (() => {
          const from = mealPlans.find((p) => p.id === buildFromHistoryPlanId);
          return from ? { ...from.assignments } : newPlanAssignments;
        })()
      : { ...newPlanAssignments };
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createPlan',
          toolId,
          name: newPlanName.trim(),
          startDate: newPlanStartDate,
          assignments,
          copyFromPlanId: buildFromHistoryPlanId || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to create plan');
      await fetchPlans();
      setNewPlanName('');
      setNewPlanStartDate(getNextMonday());
      setNewPlanAssignments(
        ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].reduce(
          (acc, k) => ({ ...acc, [k as DayKey]: [] }),
          {} as DayAssignments
        )
      );
      setBuildFromHistoryPlanId('');
      setIsCreatingPlan(false);
    } catch (e) {
      console.error('Create plan error:', e);
    }
  };

  const startEditingPlan = (plan: MealPlanRecord) => {
    setEditingPlanId(plan.id);
    setEditingPlanName(plan.name);
    setEditingPlanStartDate(plan.startDate);
    setEditingPlanAssignments({ ...plan.assignments });
  };

  const saveEditingPlan = async () => {
    if (!editingPlanId || !editingPlanAssignments || !toolId) return;
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updatePlan',
          toolId,
          planId: editingPlanId,
          name: editingPlanName.trim(),
          startDate: editingPlanStartDate,
          assignments: editingPlanAssignments,
        }),
      });
      if (!res.ok) throw new Error('Failed to update plan');
      await fetchPlans();
      setEditingPlanId(null);
      setEditingPlanName('');
      setEditingPlanStartDate('');
      setEditingPlanAssignments(null);
    } catch (e) {
      console.error('Update plan error:', e);
    }
  };

  const cancelEditingPlan = () => {
    setEditingPlanId(null);
    setEditingPlanName('');
    setEditingPlanStartDate('');
    setEditingPlanAssignments(null);
  };

  const movePlanToHistory = async (id: string) => {
    if (!toolId) return;
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'movePlanToHistory', toolId, planId: id }),
      });
      if (!res.ok) throw new Error('Failed to move plan to history');
      await fetchPlans();
    } catch (e) {
      console.error('Move to history error:', e);
    }
  };

  const deletePlan = async () => {
    if (!deleteConfirmPlanId || deleteConfirmPlanText.toLowerCase() !== 'delete' || !toolId) return;
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deletePlan', toolId, planId: deleteConfirmPlanId }),
      });
      if (!res.ok) throw new Error('Failed to delete plan');
      await fetchPlans();
      setDeleteConfirmPlanId(null);
      setDeleteConfirmPlanText('');
    } catch (e) {
      console.error('Delete plan error:', e);
    }
  };

  const startBuildFromHistory = (historyPlanId: string) => {
    const plan = mealPlans.find((p) => p.id === historyPlanId && !p.isActive);
    if (!plan) return;
    setBuildFromHistoryPlanId(historyPlanId);
    setNewPlanAssignments(
      Object.fromEntries(
        (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((k) => [k, [...plan.assignments[k]]])
      ) as DayAssignments
    );
    setNewPlanStartDate(plan.startDate);
  };

  // Consolidated shopping list for a plan (all ingredient item ids from assigned meals, with duplicate count and category)
  const getConsolidatedItems = (plan: MealPlanRecord) => {
    const dayKeys: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const assign = getPlanAssignments(plan);
    const countByItemId = new Map<string, number>();
    for (const day of dayKeys) {
      const mealIds = assign[day] ?? [];
      for (const mealId of mealIds) {
        const meal = meals.find((m) => m.id === mealId);
        if (meal) {
          for (const itemId of meal.ingredientIds) {
            countByItemId.set(itemId, (countByItemId.get(itemId) ?? 0) + 1);
          }
        }
      }
    }
    return Array.from(countByItemId.entries()).map(([itemId, count]) => {
      const item = masterItems.find((i) => i.id === itemId);
      return {
        itemId,
        name: item?.name ?? 'Unknown',
        count,
        category: item?.category ?? 'Other',
      };
    });
  };

  /** Group consolidated plan items by category for display (same layout as Shopping list app). */
  const groupConsolidatedItemsByCategory = (items: ReturnType<typeof getConsolidatedItems>) => {
    const byCategory = new Map<string, typeof items>();
    for (const row of items) {
      const cat = row.category || 'Other';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(row);
    }
    return Array.from(byCategory.entries())
      .map(([category, rows]) => ({
        category,
        items: [...rows].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  };

  useEffect(() => {
    if (!mealPickerOpenFor) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMealPickerOpenFor(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mealPickerOpenFor]);

  useEffect(() => {
    if (!cartOpenPlanId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCartOpenPlanId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cartOpenPlanId]);

  useEffect(() => {
    if (!printingPlanId) return;
    const onAfterPrint = () => setPrintingPlanId(null);
    window.addEventListener('afterprint', onAfterPrint);
    const id = requestAnimationFrame(() => {
      window.print();
    });
    return () => {
      window.removeEventListener('afterprint', onAfterPrint);
      cancelAnimationFrame(id);
    };
  }, [printingPlanId]);

  const filteredMealsForPicker = useMemo(() => {
    let list = meals.filter((m) => m.isActive !== false);
    if (mealPickerTypeFilter) {
      list = list.filter((m) => m.mealTypeId === mealPickerTypeFilter);
    }
    if (mealPickerSearch.trim()) {
      const q = mealPickerSearch.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          mealTypes.find((t) => t.id === m.mealTypeId)?.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [meals, mealPickerTypeFilter, mealPickerSearch, mealTypes]);

  const isLoading = toolId && (itemsLoading || mealTypesLoading || mealsLoading || plansLoading);

  return (
    <>
      {/* Print layout: landscape, meal plan on top, shopping list below — only visible when printing */}
      {printingPlanId && (() => {
        const plan = mealPlans.find((p) => p.id === printingPlanId);
        if (!plan) return null;
        const assignments = getPlanAssignments(plan);
        const dates = getDatesForWeek(plan.startDate);
        const printItems = getConsolidatedItems(plan);
        const printGroups = groupConsolidatedItemsByCategory(printItems);
        return (
          <>
            <style
              dangerouslySetInnerHTML={{
                __html: `
                  @media print {
                    @page { size: landscape; }
                    body * { visibility: hidden; }
                    .meal-plan-full-print, .meal-plan-full-print * { visibility: visible; }
                    .meal-plan-full-print {
                      position: absolute !important;
                      left: 0 !important;
                      top: 0 !important;
                      width: 100% !important;
                      background: white !important;
                      color: black !important;
                      padding: 16px !important;
                      font-size: 12px;
                    }
                    .meal-plan-full-print .print-meal-plan { margin-bottom: 20px; }
                    .meal-plan-full-print .print-week-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-top: 8px; }
                    .meal-plan-full-print .print-day-cell { border: 1px solid #ccc; padding: 6px; min-height: 60px; }
                    .meal-plan-full-print .print-day-label { font-weight: 700; text-transform: uppercase; }
                    .meal-plan-full-print .print-day-date { font-size: 10px; color: #555; margin-bottom: 4px; }
                    .meal-plan-full-print .print-meal-name { font-size: 11px; margin: 2px 0; }
                    .meal-plan-full-print .print-list-title { font-weight: 700; margin-top: 16px; margin-bottom: 8px; font-size: 14px; }
                    .meal-plan-full-print .print-category { font-weight: 600; text-transform: uppercase; margin-top: 10px; margin-bottom: 4px; font-size: 11px; }
                    .meal-plan-full-print .print-list-items { margin-left: 12px; list-style: disc; }
                    .meal-plan-full-print .print-list-items li { margin: 2px 0; }
                  }
                `,
              }}
            />
            <div
              className="meal-plan-full-print"
              style={{ visibility: 'hidden', position: 'absolute', left: '-9999px' }}
              aria-hidden
            >
              <div className="print-meal-plan">
                <h2 style={{ margin: 0, fontSize: '18px' }}>
                  {plan.name} — Week of {formatDateDisplay(plan.startDate)}
                </h2>
                <div className="print-week-grid">
                  {dates.map(({ key, date, label }) => (
                    <div key={key} className="print-day-cell">
                      <div className="print-day-label">{label}</div>
                      <div className="print-day-date">{formatDateDisplay(date)}</div>
                      {(assignments[key] ?? []).map((mealId) => {
                        const meal = meals.find((m) => m.id === mealId);
                        return meal ? (
                          <div key={mealId} className="print-meal-name">{meal.name}</div>
                        ) : null;
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div className="print-shopping-list">
                <div className="print-list-title">Shopping list</div>
                {printGroups.map(({ category, items: categoryItems }) => (
                  <div key={category}>
                    <div className="print-category">{category}</div>
                    <ul className="print-list-items">
                      {categoryItems.map(({ itemId, name, count }) => (
                        <li key={itemId}>
                          {name}
                          {count > 1 ? ` (×${count})` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      })()}

      <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-50 mb-2">Meal Planner</h2>
        <p className="text-slate-400 text-sm">
          Create a weekly meal plan, manage meals and ingredients, and generate a shopping list for the week.
        </p>
      </div>
      {isLoading && (
        <p className="text-slate-400 text-sm">Loading your meal planner data…</p>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex gap-2">
          {[
            { id: 'meal-plan', label: 'Meal Plan' },
            { id: 'meals', label: 'Meals' },
            { id: 'meal-types', label: 'Meal Types' },
            { id: 'items', label: 'Items' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-emerald-500 text-emerald-300'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Items Tab */}
      {activeTab === 'items' && (
        <div className="space-y-6">
          {!isAddingItem && (
            <div className="flex justify-start">
              <button
                onClick={() => setIsAddingItem(true)}
                className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                + Add New Item
              </button>
            </div>
          )}
          {isAddingItem && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-slate-50 mb-4">Add New Item</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-300">
                      Category <span className="text-red-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingNewCategory(!isCreatingNewCategory);
                        setNewItemCategory('');
                      }}
                      className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      {isCreatingNewCategory ? 'Select existing category' : '+ Create new category'}
                    </button>
                  </div>
                  {isCreatingNewCategory ? (
                    <input
                      type="text"
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                      placeholder="Enter new category..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  ) : (
                    <select
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    >
                      <option value="">Select a category...</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Item Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="e.g., Oat milk"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setIsAddingItem(false);
                      setNewItemName('');
                      setNewItemCategory('');
                      setIsCreatingNewCategory(false);
                    }}
                    className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addMasterItem}
                    disabled={!newItemName.trim() || !(isCreatingNewCategory ? newItemCategory.trim() : newItemCategory)}
                    className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save Item
                  </button>
                </div>
              </div>
            </div>
          )}
          {!isAddingItem && (
            <div className="flex gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden">
              <div className="w-1/4 min-w-0 flex-shrink-0 border-r border-slate-800 bg-slate-900/50">
                <div className="p-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 px-2">
                    Categories
                  </h3>
                  {categories.length === 0 ? (
                    <p className="text-slate-500 text-sm px-2 py-4">No categories yet.</p>
                  ) : (
                    <nav className="space-y-0.5" aria-label="Item categories">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedItemsCategory(cat)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            displayCategory === cat
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </nav>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0 p-6">
                {!displayCategory ? (
                  <p className="text-slate-500 text-sm">Select a category to view and manage items.</p>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold text-emerald-300 mb-4">{displayCategory}</h3>
                    {currentItems.length === 0 ? (
                      <p className="text-slate-500 text-sm">No items in this category. Use “Add New Item” above.</p>
                    ) : (
                      <ul className="space-y-2" role="list">
                        {currentItems.map((item) =>
                          editingItemId === item.id ? (
                            <li key={item.id} className="space-y-2 p-3 rounded-lg border border-slate-700 bg-slate-800/50">
                              <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">Category</label>
                                <select
                                  value={editingItemCategory}
                                  onChange={(e) => setEditingItemCategory(e.target.value)}
                                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                >
                                  {categories.map((cat) => (
                                    <option key={cat} value={cat}>
                                      {cat}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">Item Name</label>
                                <input
                                  type="text"
                                  value={editingItemName}
                                  onChange={(e) => setEditingItemName(e.target.value)}
                                  className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-100 text-sm focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEditingItem();
                                    if (e.key === 'Escape') cancelEditingItem();
                                  }}
                                  autoFocus
                                />
                              </div>
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={cancelEditingItem}
                                  className="px-3 py-1.5 rounded border border-slate-600 bg-slate-700 text-slate-200 text-xs hover:bg-slate-600"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={saveEditingItem}
                                  disabled={!editingItemName.trim() || !editingItemCategory.trim()}
                                  className="px-3 py-1.5 rounded bg-emerald-500 text-slate-950 text-xs font-medium hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Save
                                </button>
                              </div>
                            </li>
                          ) : (
                            <li key={item.id}>
                              <div className="flex items-center justify-between p-2 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition-colors">
                                <span className="text-sm text-slate-200">{item.name}</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => startEditingItem(item)}
                                    aria-label={`Edit ${item.name}`}
                                    title="Edit"
                                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleteConfirmItemId(item.id);
                                      setDeleteConfirmItemText('');
                                    }}
                                    aria-label={`Delete ${item.name}`}
                                    title="Delete"
                                    className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </li>
                          )
                        )}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Meal Types Tab */}
      {activeTab === 'meal-types' && (
        <div className="space-y-6">
          {!isAddingMealType && (
            <div className="flex justify-start">
              <button
                onClick={() => setIsAddingMealType(true)}
                className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                + Add New Meal Type
              </button>
            </div>
          )}
          {isAddingMealType && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 flex items-end gap-2 flex-wrap">
              <div className="min-w-[200px] flex-1">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Name</label>
                <input
                  type="text"
                  value={newMealTypeName}
                  onChange={(e) => setNewMealTypeName(e.target.value)}
                  placeholder="e.g., Quick & Easy"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <button
                onClick={addMealType}
                disabled={!newMealTypeName.trim()}
                className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setIsAddingMealType(false);
                  setNewMealTypeName('');
                }}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">Meal Types</h3>
            {mealTypes.length === 0 ? (
              <p className="text-slate-400 text-center py-6">No meal types yet. Add one above.</p>
            ) : (
              <ul className="space-y-2">
                {mealTypes.map((t) =>
                  editingMealTypeId === t.id ? (
                    <li key={t.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-700 bg-slate-800/50">
                      <input
                        type="text"
                        value={editingMealTypeName}
                        onChange={(e) => setEditingMealTypeName(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                      />
                      <button
                        onClick={saveEditingMealType}
                        className="px-3 py-1.5 rounded bg-emerald-500 text-slate-950 text-xs font-medium hover:bg-emerald-400"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingMealTypeId(null);
                          setEditingMealTypeName('');
                        }}
                        className="px-3 py-1.5 rounded border border-slate-600 bg-slate-700 text-slate-200 text-xs hover:bg-slate-600"
                      >
                        Cancel
                      </button>
                    </li>
                  ) : (
                    <li key={t.id}>
                      <div className="flex items-center justify-between p-2 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition-colors">
                        <span className="text-sm text-slate-200">{t.name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMealTypeId(t.id);
                              setEditingMealTypeName(t.name);
                            }}
                            aria-label={`Edit ${t.name}`}
                            title="Edit"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteConfirmMealTypeId(t.id);
                              setDeleteConfirmMealTypeText('');
                            }}
                            aria-label={`Delete ${t.name}`}
                            title="Delete"
                            className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                )}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Meals Tab - continued in next part */}
      {activeTab === 'meals' && (
        <div className="space-y-6">
          {!isAddingMeal && (
            <div className="flex justify-start">
              <button
                onClick={() => {
                  resetMealForm();
                  setEditingMealId(null);
                  setIsAddingMeal(true);
                }}
                className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                + Add New Meal
              </button>
            </div>
          )}
          {isAddingMeal && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-lg font-semibold text-slate-50">
                  {editingMealId ? 'Edit Meal' : 'New Meal'}
                </h3>
                <div className="flex items-center gap-1 flex-shrink-0" role="group" aria-label="Rate this meal">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setMealForm((f) => ({ ...f, rating: star }))}
                      aria-label={`${star} star${star > 1 ? 's' : ''}`}
                      title={`${star} star${star > 1 ? 's' : ''}`}
                      className="rounded p-0.5 text-slate-400 hover:text-amber-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    >
                      <svg
                        className={`h-8 w-8 ${mealForm.rating >= star ? 'text-amber-400' : ''}`}
                        fill={mealForm.rating >= star ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={mealForm.name}
                    onChange={(e) => setMealForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g., Chicken Stir Fry"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Meal Type</label>
                  <select
                    value={mealForm.mealTypeId}
                    onChange={(e) => setMealForm((f) => ({ ...f, mealTypeId: e.target.value }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  >
                    <option value="">Select type...</option>
                    {mealTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Description</label>
                <textarea
                  value={mealForm.description}
                  onChange={(e) => setMealForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Instructions</label>
                <textarea
                  value={mealForm.instructions}
                  onChange={(e) => setMealForm((f) => ({ ...f, instructions: e.target.value }))}
                  placeholder="Step-by-step instructions..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Estimated prep time (minutes)</label>
                  <input
                    type="number"
                    min={0}
                    value={mealForm.prepTimeMinutes === '' ? '' : mealForm.prepTimeMinutes}
                    onChange={(e) =>
                      setMealForm((f) => ({
                        ...f,
                        prepTimeMinutes: e.target.value === '' ? '' : Number(e.target.value),
                      }))
                    }
                    placeholder="e.g., 30"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Difficulty</label>
                  <select
                    value={mealForm.difficulty}
                    onChange={(e) =>
                      setMealForm((f) => ({ ...f, difficulty: e.target.value as Meal['difficulty'] }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  >
                    <option value="">Select...</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Ingredients</label>
                <input
                  type="text"
                  value={ingredientSearch}
                  onChange={(e) => setIngredientSearch(e.target.value)}
                  placeholder="Search items..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 mb-2"
                />
                <div className="flex gap-0 rounded-lg border border-slate-700 bg-slate-800/50 max-h-96 overflow-hidden">
                  <div className="w-[28%] min-w-0 flex-shrink-0 border-r border-slate-700 bg-slate-900/50 overflow-hidden flex flex-col">
                    <div className="px-2 py-1.5 border-b border-slate-700 bg-slate-800/70">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Category</span>
                    </div>
                    <div className="overflow-y-auto p-2 flex-1 min-h-0">
                      {categories.map((cat) => {
                        const isSelected = (selectedPickerCategory ?? categories[0] ?? null) === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setSelectedPickerCategory(cat)}
                            className={`w-full text-left px-2 py-1.5 rounded text-sm font-medium transition-colors ${
                              isSelected ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                            }`}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden flex flex-col border-r border-slate-700">
                    <div className="px-3 py-1.5 border-b border-slate-700 bg-slate-800/70">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Item</span>
                    </div>
                    <div className="overflow-y-auto p-2 flex-1 min-h-0">
                      {(() => {
                        const q = ingredientSearch.trim().toLowerCase();
                        let itemsToShow: MasterItem[];
                        if (q) {
                          itemsToShow = masterItems.filter((i) => i.name.toLowerCase().includes(q));
                        } else {
                          const ingredientsCategory = selectedPickerCategory ?? categories[0] ?? null;
                          itemsToShow = ingredientsCategory ? getItemsByCategory(ingredientsCategory) : [];
                        }
                        return itemsToShow.map((item) => {
                          const inList = mealForm.ingredientIds.includes(item.id);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => toggleMealIngredient(item.id)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                inList
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                                  : 'text-slate-200 hover:bg-slate-700 border border-transparent'
                              }`}
                            >
                              <span className="block truncate">{item.name}</span>
                              {q && (
                                <span className="block text-xs text-slate-500 truncate mt-0.5">{item.category}</span>
                              )}
                              {inList && ' ✓'}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>
                  <div className="w-[28%] min-w-0 flex-shrink-0 bg-slate-900/50 overflow-hidden flex flex-col">
                    <div className="px-2 py-1.5 border-b border-slate-700 bg-slate-800/70">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Selected</span>
                    </div>
                    <div className="overflow-y-auto p-2 flex-1 min-h-0">
                      {mealForm.ingredientIds.length === 0 ? (
                        <p className="text-xs text-slate-500 py-2">Click items to add</p>
                      ) : (
                        mealForm.ingredientIds.map((itemId) => {
                          const item = masterItems.find((i) => i.id === itemId);
                          return (
                            <div
                              key={itemId}
                              className="flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg bg-slate-700/50 text-slate-200 text-sm group"
                            >
                              <span className="truncate flex-1 min-w-0">{item?.name ?? 'Unknown'}</span>
                              <button
                                type="button"
                                onClick={() => toggleMealIngredient(itemId)}
                                aria-label={`Remove ${item?.name ?? 'item'}`}
                                title="Remove"
                                className="rounded p-0.5 text-slate-400 hover:bg-slate-600 hover:text-red-300 flex-shrink-0"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setIsAddingMeal(false);
                    setEditingMealId(null);
                    resetMealForm();
                    setIngredientSearch('');
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveMeal}
                  disabled={!mealForm.name.trim()}
                  className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingMealId ? 'Save Changes' : 'Save Meal'}
                </button>
              </div>
            </div>
          )}
          {!isAddingMeal && meals.length > 0 && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h3 className="text-lg font-semibold text-slate-50 mb-4">Active Meals</h3>
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400">Type</span>
                    <select
                      value={mealFilterType}
                      onChange={(e) => setMealFilterType(e.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    >
                      <option value="">All</option>
                      {mealTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400">Difficulty</span>
                    <select
                      value={mealFilterDifficulty}
                      onChange={(e) => setMealFilterDifficulty(e.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    >
                      <option value="">All</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400">Rating (min)</span>
                    <select
                      value={mealFilterRating}
                      onChange={(e) => setMealFilterRating(e.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    >
                      <option value="">Any</option>
                      {[1, 2, 3, 4, 5].map((r) => (
                        <option key={r} value={r}>
                          {r}+ stars
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-700 overflow-hidden">
                  <table className="w-full table-fixed border-collapse">
                    <thead>
                      <tr className="bg-slate-800/70 border-b border-slate-700 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        <th className="px-3 py-2 text-left w-[18%]">Name</th>
                        <th className="px-3 py-2 text-left w-[18%]">Type</th>
                        <th className="px-3 py-2 text-left w-[18%]">Duration</th>
                        <th className="px-3 py-2 text-left w-[18%]">Difficulty</th>
                        <th className="px-3 py-2 text-left w-[18%]">Rating</th>
                        <th className="px-3 py-2 text-right w-[10%]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredActiveMeals.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-slate-500 text-sm text-center">
                            No active meals match the filters.
                          </td>
                        </tr>
                      ) : (
                        filteredActiveMeals.map((meal) => renderMealRow(meal, true))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <button
                  type="button"
                  onClick={() => setInactiveMealsExpanded(!inactiveMealsExpanded)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <h3 className="text-lg font-semibold text-slate-50">
                    Inactive Meals
                    {inactiveMealsList.length > 0 && (
                      <span className="text-slate-400 font-normal ml-2">({inactiveMealsList.length})</span>
                    )}
                  </h3>
                  <svg
                    className={`h-5 w-5 text-slate-400 transition-transform ${inactiveMealsExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {inactiveMealsExpanded && (
                  <div className="mt-4 rounded-lg border border-slate-700 overflow-hidden">
                    {inactiveMealsList.length === 0 ? (
                      <p className="text-slate-500 text-sm py-4 px-3">No inactive meals.</p>
                    ) : (
                      <table className="w-full table-fixed border-collapse">
                        <thead>
                          <tr className="bg-slate-800/70 border-b border-slate-700 text-xs font-semibold uppercase tracking-wider text-slate-400">
                            <th className="px-3 py-2 text-left w-[18%]">Name</th>
                            <th className="px-3 py-2 text-left w-[18%]">Type</th>
                            <th className="px-3 py-2 text-left w-[18%]">Duration</th>
                            <th className="px-3 py-2 text-left w-[18%]">Difficulty</th>
                            <th className="px-3 py-2 text-left w-[18%]">Rating</th>
                            <th className="px-3 py-2 text-right w-[10%]">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredInactiveMeals.map((meal) => renderMealRow(meal, false))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          {!isAddingMeal && meals.length === 0 && (
            <p className="text-slate-400 text-center py-8">No meals yet. Add one to get started!</p>
          )}
        </div>
      )}

      {/* Meal Plan Tab */}
      {activeTab === 'meal-plan' && (
        <div className="space-y-6">
          {!isCreatingPlan && (
            <div className="flex justify-start">
              <button
                onClick={() => {
                  setNewPlanName('');
                  setNewPlanStartDate(getNextMonday());
                  setNewPlanAssignments(
                    ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].reduce(
                      (acc, k) => ({ ...acc, [k as DayKey]: [] }),
                      {} as DayAssignments
                    )
                  );
                  setBuildFromHistoryPlanId('');
                  setIsCreatingPlan(true);
                }}
                className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                + Add New Meal Plan
              </button>
            </div>
          )}
          {isCreatingPlan && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-slate-50">New Meal Plan</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Plan name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newPlanName}
                    onChange={(e) => setNewPlanName(e.target.value)}
                    placeholder="e.g., Week of Mar 3"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Start date (Monday)
                  </label>
                  <input
                    type="date"
                    value={newPlanStartDate}
                    onChange={(e) => setNewPlanStartDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
              </div>
              {historyPlans.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Or start from a plan in History
                  </label>
                  <select
                    value={buildFromHistoryPlanId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBuildFromHistoryPlanId(v);
                      if (v) startBuildFromHistory(v);
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  >
                    <option value="">Select a plan to copy...</option>
                    {historyPlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatDateDisplay(p.startDate)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <p className="text-xs text-slate-400">
                Assign meals to each day below after creating the plan.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setIsCreatingPlan(false);
                    setBuildFromHistoryPlanId('');
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createPlan}
                  disabled={!newPlanName.trim()}
                  className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Plan
                </button>
              </div>
            </div>
          )}

          {/* Active */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">Active</h3>
            {activePlans.length === 0 ? (
              <p className="text-slate-400 text-center py-6">
                No active meal plan. Create one above or select from History.
              </p>
            ) : (
              <div className="space-y-4">
                {activePlans.map((plan) => {
                  const isEditing = editingPlanId === plan.id;
                  const assignments = getPlanAssignments(plan);
                  const dates = getDatesForWeek(isEditing ? editingPlanStartDate : plan.startDate);
                  return (
                    <div
                      key={plan.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-2 flex-wrap min-w-0 w-full">
                          {isEditing ? (
                            <>
                              <input
                                type="text"
                                value={editingPlanName}
                                onChange={(e) => setEditingPlanName(e.target.value)}
                                className="flex-1 min-w-[160px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                              <input
                                type="date"
                                value={editingPlanStartDate}
                                onChange={(e) => setEditingPlanStartDate(e.target.value)}
                                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                              <button
                                onClick={saveEditingPlan}
                                className="px-3 py-1.5 rounded bg-emerald-500 text-slate-950 text-xs font-medium hover:bg-emerald-400"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEditingPlan}
                                className="px-3 py-1.5 rounded border border-slate-600 bg-slate-700 text-slate-200 text-xs hover:bg-slate-600"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <h4 className="text-base font-semibold text-slate-50">
                                {plan.name}
                                <span className="text-slate-400 font-normal">
                                  {' '}
                                  — Week of {formatDateDisplay(plan.startDate)}
                                </span>
                              </h4>
                              <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => startEditingPlan(plan)}
                                  aria-label="Edit plan"
                                  title="Edit plan"
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                                >
                                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPrintingPlanId(plan.id)}
                                  aria-label="Print meal plan"
                                  title="Print meal plan"
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                                >
                                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCartOpenPlanId(plan.id)}
                                  aria-label="View shopping list"
                                  title="View shopping list"
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                                >
                                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => movePlanToHistory(plan.id)}
                                  aria-label="Move to History"
                                  title="Move to History"
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                                >
                                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteConfirmPlanId(plan.id);
                                    setDeleteConfirmPlanText('');
                                  }}
                                  aria-label="Delete plan"
                                  title="Delete plan"
                                  className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                                >
                                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                        {dates.map(({ key, date, label }) => (
                          <div
                            key={key}
                            className="rounded-lg border border-slate-700 bg-slate-800/50 p-3"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                                  {label}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">{formatDateDisplay(date)}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setMealPickerOpenFor({ planId: plan.id, day: key })}
                                aria-label="Add meal"
                                title="Add meal"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors flex-shrink-0"
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                            </div>
                            <div className="space-y-1 min-h-[44px]">
                              {(assignments[key] ?? []).map((mealId) => {
                                const meal = meals.find((m) => m.id === mealId);
                                return meal ? (
                                  <div
                                    key={mealId}
                                    className="flex items-center justify-between gap-1 text-sm text-slate-200 bg-slate-700/50 rounded px-2 py-1"
                                  >
                                    <span className="truncate">{meal.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => removeMealFromDay(plan.id, key, mealId, isEditing)}
                                      aria-label={`Remove ${meal.name}`}
                                      title="Remove"
                                      className="rounded p-0.5 text-slate-400 hover:text-red-300 flex-shrink-0"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ) : null;
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* History */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">History</h3>
            {historyPlans.length === 0 ? (
              <p className="text-slate-400 text-center py-6">
                No meal plans in history yet. Move an active plan to History when done.
              </p>
            ) : (
              <div className="space-y-4">
                {historyPlans.map((plan) => {
                  const isEditing = editingPlanId === plan.id;
                  const assignments = getPlanAssignments(plan);
                  const dates = getDatesForWeek(isEditing ? editingPlanStartDate : plan.startDate);
                  return (
                    <div
                      key={plan.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-2 flex-wrap min-w-0 w-full">
                          {isEditing ? (
                            <>
                              <input
                                type="text"
                                value={editingPlanName}
                                onChange={(e) => setEditingPlanName(e.target.value)}
                                className="flex-1 min-w-[160px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                              <input
                                type="date"
                                value={editingPlanStartDate}
                                onChange={(e) => setEditingPlanStartDate(e.target.value)}
                                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              />
                              <button
                                onClick={saveEditingPlan}
                                className="px-3 py-1.5 rounded bg-emerald-500 text-slate-950 text-xs font-medium hover:bg-emerald-400"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEditingPlan}
                                className="px-3 py-1.5 rounded border border-slate-600 bg-slate-700 text-slate-200 text-xs hover:bg-slate-600"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <h4 className="text-base font-semibold text-slate-50">
                                {plan.name}
                                <span className="text-slate-400 font-normal">
                                  {' '}
                                  — Week of {formatDateDisplay(plan.startDate)}
                                </span>
                              </h4>
                              <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => startEditingPlan(plan)}
                                  aria-label="Edit plan"
                                  title="Edit plan"
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                                >
                                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPrintingPlanId(plan.id)}
                                  aria-label="Print meal plan"
                                  title="Print meal plan"
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                                >
                                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCartOpenPlanId(plan.id)}
                                  aria-label="View shopping list"
                                  title="View shopping list"
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                                >
                                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteConfirmPlanId(plan.id);
                                    setDeleteConfirmPlanText('');
                                  }}
                                  aria-label="Delete plan"
                                  title="Delete plan"
                                  className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                                >
                                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                        {dates.map(({ key, date, label }) => (
                          <div
                            key={key}
                            className="rounded-lg border border-slate-700 bg-slate-800/50 p-3"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                                  {label}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">{formatDateDisplay(date)}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setMealPickerOpenFor({ planId: plan.id, day: key })}
                                aria-label="Add meal"
                                title="Add meal"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors flex-shrink-0"
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                            </div>
                            <div className="space-y-1 min-h-[44px]">
                              {(assignments[key] ?? []).map((mealId) => {
                                const meal = meals.find((m) => m.id === mealId);
                                return meal ? (
                                  <div
                                    key={mealId}
                                    className="flex items-center justify-between gap-1 text-sm text-slate-200 bg-slate-700/50 rounded px-2 py-1"
                                  >
                                    <span className="truncate">{meal.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => removeMealFromDay(plan.id, key, mealId, isEditing)}
                                      aria-label={`Remove ${meal.name}`}
                                      title="Remove"
                                      className="rounded p-0.5 text-slate-400 hover:text-red-300 flex-shrink-0"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ) : null;
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Meal Picker Modal */}
      {mealPickerOpenFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setMealPickerOpenFor(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl mx-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-50">Pick a meal</h3>
              <button
                type="button"
                onClick={() => setMealPickerOpenFor(null)}
                aria-label="Close modal"
                title="Close modal"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-2 mb-4">
              <input
                type="text"
                value={mealPickerSearch}
                onChange={(e) => setMealPickerSearch(e.target.value)}
                placeholder="Search meals..."
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
              <select
                value={mealPickerTypeFilter}
                onChange={(e) => setMealPickerTypeFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              >
                <option value="">All meal types</option>
                {mealTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0 space-y-1">
              {filteredMealsForPicker.length === 0 ? (
                <p className="text-slate-500 text-sm py-4">No meals match. Add meals in the Meals tab.</p>
              ) : (
                filteredMealsForPicker.map((meal) => {
                  const typeName = mealTypes.find((t) => t.id === meal.mealTypeId)?.name ?? '';
                  return (
                    <button
                      key={meal.id}
                      type="button"
                      onClick={() => {
                        const plan = mealPlans.find((p) => p.id === mealPickerOpenFor.planId);
                        const isEditing = plan && editingPlanId === plan.id;
                        addMealToDay(mealPickerOpenFor.planId, mealPickerOpenFor.day, meal.id, !!isEditing);
                        setMealPickerOpenFor(null);
                      }}
                      className="w-full text-left px-4 py-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700 text-slate-200 transition-colors"
                    >
                      <span className="font-medium">{meal.name}</span>
                      {typeName && (
                        <span className="text-slate-400 text-sm block mt-0.5">{typeName}</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Shopping list (cart) modal — same layout as Shopping list app */}
      {cartOpenPlanId && (() => {
        const plan = mealPlans.find((p) => p.id === cartOpenPlanId);
        if (!plan) return null;
        const items = getConsolidatedItems(plan);
        const groups = groupConsolidatedItemsByCategory(items);
        return (
          <>
            <style
              dangerouslySetInnerHTML={{
                __html: `
                  @media print {
                    body * { visibility: hidden; }
                    .meal-plan-cart-print, .meal-plan-cart-print * { visibility: visible; }
                    .meal-plan-cart-print { position: absolute; left: 0; top: 0; width: 100%; background: white; color: black; padding: 1rem; }
                    .meal-plan-cart-print .print-only-hidden { display: none !important; }
                    .meal-plan-cart-print .print-title { display: block !important; }
                  }
                `,
              }}
            />
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setCartOpenPlanId(null)}
            >
              <div
                className="meal-plan-cart-print w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl mx-4 max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-4 mb-4 print-only-hidden">
                  <h3 className="text-lg font-semibold text-slate-50 min-w-0 truncate pr-2" title={`${plan.name} — ${formatDateDisplay(plan.startDate)}`}>
                    {plan.name}
                    <span className="text-slate-400 font-normal"> — {formatDateDisplay(plan.startDate)}</span>
                  </h3>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      aria-label="Print list"
                      title="Print list"
                      className="rounded-lg p-2 text-emerald-400 hover:bg-slate-800 hover:text-emerald-300 transition-colors shrink-0"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCartOpenPlanId(null)}
                      aria-label="Close modal"
                      title="Close modal"
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors shrink-0"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 min-h-0 pr-2">
                  <div className="print-title hidden mb-2 text-lg font-semibold">
                    {plan.name} — {formatDateDisplay(plan.startDate)}
                  </div>
                {items.length === 0 ? (
                  <p className="text-slate-500 text-sm py-4">No ingredients. Assign meals to days first.</p>
                ) : (
                  <div className="space-y-4">
                    {groups.map(({ category, items: categoryItems }) => (
                      <div key={category}>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300 mb-1">
                          {category}
                        </p>
                        <ul className="text-sm text-slate-200 list-disc list-inside ml-0 space-y-0.5">
                          {categoryItems.map(({ itemId, name, count }) => (
                            <li key={itemId}>
                              {name}
                              {count > 1 ? ` (×${count})` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          </>
        );
      })()}

      {/* Delete item confirmation */}
      {deleteConfirmItemId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-slate-50 mb-2">Delete Item</h3>
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4">
              <p className="text-red-300 font-semibold mb-2">⚠️ This action cannot be undone.</p>
              <p className="text-red-200 text-sm">This item will be removed from your list.</p>
            </div>
            <p className="text-slate-300 mb-4">Type <strong className="text-slate-200">delete</strong> to confirm:</p>
            <input
              type="text"
              value={deleteConfirmItemText}
              onChange={(e) => setDeleteConfirmItemText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setDeleteConfirmItemId(null);
                  setDeleteConfirmItemText('');
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={deleteMasterItem}
                disabled={deleteConfirmItemText.toLowerCase() !== 'delete'}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setDeleteConfirmItemId(null);
                  setDeleteConfirmItemText('');
                }}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete meal type confirmation */}
      {deleteConfirmMealTypeId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-slate-50 mb-2">Delete Meal Type</h3>
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4">
              <p className="text-red-300 font-semibold mb-2">⚠️ This action cannot be undone.</p>
            </div>
            <p className="text-slate-300 mb-4">Type <strong className="text-slate-200">delete</strong> to confirm:</p>
            <input
              type="text"
              value={deleteConfirmMealTypeText}
              onChange={(e) => setDeleteConfirmMealTypeText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setDeleteConfirmMealTypeId(null);
                  setDeleteConfirmMealTypeText('');
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={deleteMealType}
                disabled={deleteConfirmMealTypeText.toLowerCase() !== 'delete'}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setDeleteConfirmMealTypeId(null);
                  setDeleteConfirmMealTypeText('');
                }}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete meal confirmation */}
      {deleteConfirmMealId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-slate-50 mb-2">Delete Meal</h3>
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4">
              <p className="text-red-300 font-semibold mb-2">⚠️ This action cannot be undone.</p>
            </div>
            <p className="text-slate-300 mb-4">Type <strong className="text-slate-200">delete</strong> to confirm:</p>
            <input
              type="text"
              value={deleteConfirmMealText}
              onChange={(e) => setDeleteConfirmMealText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setDeleteConfirmMealId(null);
                  setDeleteConfirmMealText('');
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={deleteMeal}
                disabled={deleteConfirmMealText.toLowerCase() !== 'delete'}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setDeleteConfirmMealId(null);
                  setDeleteConfirmMealText('');
                }}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete plan confirmation */}
      {deleteConfirmPlanId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-slate-50 mb-2">Delete Meal Plan</h3>
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4">
              <p className="text-red-300 font-semibold mb-2">⚠️ This action cannot be undone.</p>
            </div>
            <p className="text-slate-300 mb-4">Type <strong className="text-slate-200">delete</strong> to confirm:</p>
            <input
              type="text"
              value={deleteConfirmPlanText}
              onChange={(e) => setDeleteConfirmPlanText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setDeleteConfirmPlanId(null);
                  setDeleteConfirmPlanText('');
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={deletePlan}
                disabled={deleteConfirmPlanText.toLowerCase() !== 'delete'}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setDeleteConfirmPlanId(null);
                  setDeleteConfirmPlanText('');
                }}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
