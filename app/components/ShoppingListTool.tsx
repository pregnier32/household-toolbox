'use client';

import { useState, useMemo, useEffect } from 'react';

type ShoppingListItemRef = {
  itemId: string;
  name: string; // denormalized for display
};

type ShoppingListRecord = {
  id: string;
  name: string;
  date: string;
  items: ShoppingListItemRef[];
  isActive: boolean;
  showOnDashboard?: boolean;
};

type MasterItem = {
  id: string;
  name: string;
  category: string;
};

type ShoppingListToolProps = {
  toolId?: string;
};

function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const y = d.getFullYear();
  return `${m}/${day}/${y}`;
}

export type ShoppingListDashboardSummary = { listId: string; name: string; date: string; itemCount: number };

export function ShoppingListTool({ toolId }: ShoppingListToolProps) {
  const [activeTab, setActiveTab] = useState<'lists' | 'items'>('lists');

  // Master items (loaded from API; defaults copied on first load if empty)
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [listsLoading, setListsLoading] = useState(false);

  // Shopping lists (Active vs History)
  const [shoppingLists, setShoppingLists] = useState<ShoppingListRecord[]>([]);

  // Create new list
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDate, setNewListDate] = useState(new Date().toISOString().split('T')[0]);
  const [newListItems, setNewListItems] = useState<ShoppingListItemRef[]>([]);
  const [buildFromHistoryId, setBuildFromHistoryId] = useState<string>('');

  // Edit list
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListName, setEditingListName] = useState('');
  const [editingListDate, setEditingListDate] = useState('');
  const [editingListItems, setEditingListItems] = useState<ShoppingListItemRef[]>([]);

  // Delete list confirmation
  const [deleteConfirmListId, setDeleteConfirmListId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // View full list modal
  const [viewListId, setViewListId] = useState<string | null>(null);

  const fetchItems = async () => {
    if (!toolId) return;
    setItemsLoading(true);
    try {
      const res = await fetch(`/api/tools/shopping-list?toolId=${encodeURIComponent(toolId)}&resource=items`);
      if (!res.ok) throw new Error('Failed to fetch items');
      const data = await res.json();
      setMasterItems(data.items ?? []);
    } catch (e) {
      console.error('Fetch items error:', e);
    } finally {
      setItemsLoading(false);
    }
  };

  const fetchLists = async () => {
    if (!toolId) return;
    setListsLoading(true);
    try {
      const res = await fetch(`/api/tools/shopping-list?toolId=${encodeURIComponent(toolId)}&resource=lists`);
      if (!res.ok) throw new Error('Failed to fetch lists');
      const data = await res.json();
      const lists = (data.lists ?? []).map(
        (l: { id: string; name: string; date: string; isActive: boolean; showOnDashboard?: boolean; items: { itemId: string; name: string }[] }) => ({
          id: l.id,
          name: l.name,
          date: l.date,
          items: l.items ?? [],
          isActive: l.isActive,
          showOnDashboard: l.showOnDashboard,
        })
      );
      setShoppingLists(lists);
    } catch (e) {
      console.error('Fetch lists error:', e);
    } finally {
      setListsLoading(false);
    }
  };

  useEffect(() => {
    if (!toolId) return;
    fetchItems();
    fetchLists();
  }, [toolId]);

  const isListOnDashboard = (listId: string) =>
    shoppingLists.some((l) => l.id === listId && l.showOnDashboard);
  const toggleListOnDashboard = async (list: ShoppingListRecord) => {
    if (!toolId) return;
    const next = !isListOnDashboard(list.id);
    try {
      const res = await fetch('/api/tools/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setShowOnDashboard', toolId, listId: list.id, showOnDashboard: next }),
      });
      if (!res.ok) throw new Error('Failed to update dashboard');
      await fetchLists();
    } catch (e) {
      console.error('Toggle dashboard error:', e);
    }
  };

  useEffect(() => {
    if (!viewListId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewListId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewListId]);

  // Keep selected Items tab category valid when categories change (e.g. category removed)
  useEffect(() => {
    const cats = getUniqueCategories();
    if (selectedItemsCategory && !cats.includes(selectedItemsCategory)) {
      setSelectedItemsCategory(null);
    }
  }, [masterItems]);

  // Items tab: add/edit item
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState('');
  const [editingItemCategory, setEditingItemCategory] = useState('');
  const [deleteConfirmItemId, setDeleteConfirmItemId] = useState<string | null>(null);
  const [deleteConfirmItemText, setDeleteConfirmItemText] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedItemsCategory, setSelectedItemsCategory] = useState<string | null>(null);
  const [selectedPickerCategory, setSelectedPickerCategory] = useState<string | null>(null);

  const getUniqueCategories = () => {
    const cats = new Set(masterItems.map((i) => i.category));
    return Array.from(cats).sort();
  };

  const getItemsByCategory = (category: string) => {
    return masterItems
      .filter((i) => i.category === category)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const getCategoryForItemId = (itemId: string): string => {
    return masterItems.find((i) => i.id === itemId)?.category ?? '';
  };

  /** Group list items by category; categories and items within each sorted alphabetically */
  const groupListItemsByCategory = (items: ShoppingListItemRef[]) => {
    const byCategory = new Map<string, ShoppingListItemRef[]>();
    for (const ref of items) {
      const cat = getCategoryForItemId(ref.itemId) || 'Other';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(ref);
    }
    return Array.from(byCategory.entries())
      .map(([category, refs]) => ({
        category,
        items: [...refs].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const isCategoryExpanded = (category: string) => expandedCategories.has(category);

  // Add item to current new list (single click from master list)
  const addItemToNewList = (item: MasterItem) => {
    if (newListItems.some((ref) => ref.itemId === item.id)) return;
    setNewListItems((prev) => [...prev, { itemId: item.id, name: item.name }]);
  };

  const removeItemFromNewList = (itemId: string) => {
    setNewListItems((prev) => prev.filter((ref) => ref.itemId !== itemId));
  };

  const createList = async () => {
    if (!newListName.trim() || !toolId) return;
    try {
      const res = await fetch('/api/tools/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createList',
          toolId,
          name: newListName.trim(),
          listDate: newListDate,
          itemIds: newListItems.map((r) => r.itemId),
        }),
      });
      if (!res.ok) throw new Error('Failed to create list');
      setNewListName('');
      setNewListDate(new Date().toISOString().split('T')[0]);
      setNewListItems([]);
      setBuildFromHistoryId('');
      setIsCreatingList(false);
      await fetchLists();
    } catch (e) {
      console.error('Create list error:', e);
    }
  };

  const startBuildFromHistory = (historyListId: string) => {
    const list = shoppingLists.find((l) => l.id === historyListId && !l.isActive);
    if (!list) return;
    setBuildFromHistoryId(historyListId);
    setNewListItems(list.items.map((ref) => ({ ...ref })));
  };

  const moveToHistory = async (id: string) => {
    if (!toolId) return;
    try {
      const res = await fetch('/api/tools/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'moveToHistory', toolId, listId: id }),
      });
      if (!res.ok) throw new Error('Failed to move list');
      await fetchLists();
    } catch (e) {
      console.error('Move to history error:', e);
    }
  };

  const startEditingList = (list: ShoppingListRecord) => {
    setEditingListId(list.id);
    setEditingListName(list.name);
    setEditingListDate(list.date);
    setEditingListItems(list.items.map((r) => ({ ...r })));
  };

  const saveEditingList = async () => {
    if (!editingListId || !toolId) return;
    const list = shoppingLists.find((l) => l.id === editingListId);
    const name = editingListName.trim() || list?.name || '';
    const date = editingListDate;
    try {
      const res = await fetch('/api/tools/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateList',
          toolId,
          listId: editingListId,
          name,
          listDate: date,
          itemIds: editingListItems.map((r) => r.itemId),
        }),
      });
      if (!res.ok) throw new Error('Failed to update list');
      setEditingListId(null);
      setEditingListName('');
      setEditingListDate('');
      setEditingListItems([]);
      await fetchLists();
    } catch (e) {
      console.error('Update list error:', e);
    }
  };

  const cancelEditingList = () => {
    setEditingListId(null);
    setEditingListName('');
    setEditingListDate('');
    setEditingListItems([]);
  };

  const deleteList = async () => {
    if (!deleteConfirmListId || deleteConfirmText.toLowerCase() !== 'delete' || !toolId) return;
    try {
      const res = await fetch('/api/tools/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteList', toolId, listId: deleteConfirmListId }),
      });
      if (!res.ok) throw new Error('Failed to delete list');
      setShoppingLists((prev) => prev.filter((l) => l.id !== deleteConfirmListId));
      setDeleteConfirmListId(null);
      setDeleteConfirmText('');
    } catch (e) {
      console.error('Delete list error:', e);
    }
  };

  const addItemToEditingList = (item: MasterItem) => {
    if (editingListItems.some((ref) => ref.itemId === item.id)) return;
    setEditingListItems((prev) => [...prev, { itemId: item.id, name: item.name }]);
  };

  const removeItemFromEditingList = (itemId: string) => {
    setEditingListItems((prev) => prev.filter((ref) => ref.itemId !== itemId));
  };

  const activeLists = useMemo(
    () => shoppingLists.filter((l) => l.isActive),
    [shoppingLists]
  );
  const historyLists = useMemo(
    () => shoppingLists.filter((l) => !l.isActive),
    [shoppingLists]
  );

  // Master items: add
  const addMasterItem = async () => {
    if (!newItemName.trim() || !newItemCategory.trim() || !toolId) return;
    try {
      const res = await fetch('/api/tools/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createItem',
          toolId,
          name: newItemName.trim(),
          category: newItemCategory.trim(),
        }),
      });
      if (!res.ok) throw new Error('Failed to add item');
      const data = await res.json();
      setMasterItems((prev) => [...prev, data.item]);
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
      const res = await fetch('/api/tools/shopping-list', {
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
      const res = await fetch('/api/tools/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteItem', toolId, itemId: deleteConfirmItemId }),
      });
      if (!res.ok) throw new Error('Failed to delete item');
      await fetchItems();
      await fetchLists();
      setDeleteConfirmItemId(null);
      setDeleteConfirmItemText('');
    } catch (e) {
      console.error('Delete item error:', e);
    }
  };

  const isLoading = toolId && (itemsLoading || listsLoading);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-50 mb-2">Shopping List</h2>
        <p className="text-slate-400 text-sm">
          Create shopping lists from your master list of items. Manage active lists and history.
        </p>
      </div>
      {isLoading && (
        <p className="text-slate-400 text-sm">Loading your lists and items…</p>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex gap-2">
          {[
            { id: 'lists', label: 'Shopping Lists' },
            { id: 'items', label: 'Items' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'lists' | 'items')}
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

      {/* Shopping Lists Tab */}
      {activeTab === 'lists' && (
        <div className="space-y-6">
          {!isCreatingList && (
            <div className="flex justify-start">
              <button
                onClick={() => {
                  setIsCreatingList(true);
                  setNewListItems([]);
                  setBuildFromHistoryId('');
                }}
                className="px-4 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                + Add New Shopping List
              </button>
            </div>
          )}

          {/* Create new list form */}
          {isCreatingList && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-slate-50">New Shopping List</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    List name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="e.g., Weekly groceries"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newListDate}
                    onChange={(e) => setNewListDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              {/* Build from history */}
              {historyLists.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Or build from a list in History
                  </label>
                  <select
                    value={buildFromHistoryId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBuildFromHistoryId(v);
                      if (v) startBuildFromHistory(v);
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  >
                    <option value="">Select a list to copy...</option>
                    {historyLists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({formatDateDisplay(l.date)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Click items below to add to this list
                </label>
                <div className="flex gap-0 rounded-lg border border-slate-700 bg-slate-800/50 max-h-64 overflow-hidden">
                  {/* Left: categories — 25% */}
                  <div className="w-1/4 min-w-0 flex-shrink-0 border-r border-slate-700 bg-slate-900/50 overflow-y-auto">
                    <div className="p-2">
                      {getUniqueCategories().map((cat) => {
                        const isSelected = (selectedPickerCategory ?? getUniqueCategories()[0] ?? null) === cat;
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
                  {/* Right: items in selected category — 75% */}
                  <div className="flex-1 min-w-0 overflow-y-auto p-2">
                    {(() => {
                      const cats = getUniqueCategories();
                      const displayCat = selectedPickerCategory ?? cats[0] ?? null;
                      const items = displayCat ? getItemsByCategory(displayCat) : [];
                      if (!displayCat || items.length === 0) {
                        return <p className="text-slate-500 text-sm py-2">No items in this category.</p>;
                      }
                      return (
                        <>
                          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300 mb-2 sticky top-0 bg-slate-800/95 py-1">
                            {displayCat}
                          </p>
                          <div className="space-y-0.5">
                            {items.map((item) => {
                              const inList = newListItems.some((r) => r.itemId === item.id);
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => addItemToNewList(item)}
                                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                    inList
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                                      : 'text-slate-200 hover:bg-slate-700 border border-transparent'
                                  }`}
                                >
                                  {item.name}
                                  {inList && ' ✓'}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {newListItems.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-300 mb-1.5">
                    In this list ({newListItems.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {newListItems.map((ref) => (
                      <span
                        key={ref.itemId}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-700 text-slate-200 text-sm"
                      >
                        {ref.name}
                        <button
                          type="button"
                          onClick={() => removeItemFromNewList(ref.itemId)}
                          className="text-slate-400 hover:text-red-300"
                          aria-label={`Remove ${ref.name}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setIsCreatingList(false);
                    setNewListName('');
                    setNewListDate(new Date().toISOString().split('T')[0]);
                    setNewListItems([]);
                    setBuildFromHistoryId('');
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createList}
                  disabled={!newListName.trim()}
                  className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create List
                </button>
              </div>
            </div>
          )}

          {/* Active section */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">Active</h3>
            {activeLists.length === 0 ? (
              <p className="text-slate-400 text-center py-6">
                No active lists. Create one above or move a list from History.
              </p>
            ) : (
              <div className="space-y-4">
                {activeLists.map((list) =>
                  editingListId === list.id ? (
                    <div
                      key={list.id}
                      className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 space-y-3"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            List name
                          </label>
                          <input
                            type="text"
                            value={editingListName}
                            onChange={(e) => setEditingListName(e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Date
                          </label>
                          <input
                            type="date"
                            value={editingListDate}
                            onChange={(e) => setEditingListDate(e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Add items (click to add)
                        </label>
                        <div className="rounded-lg border border-slate-700 bg-slate-900/70 overflow-hidden">
                          <div className="flex gap-0 border-b border-slate-700 bg-slate-800/70">
                            <div className="w-1/4 min-w-0 flex-shrink-0 px-2 py-1.5">
                              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Category</span>
                            </div>
                            <div className="flex-1 min-w-0 px-2 py-1.5 border-l border-slate-700">
                              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Items</span>
                            </div>
                          </div>
                          <div className="flex gap-0 max-h-48 overflow-hidden">
                            <div className="w-1/4 min-w-0 flex-shrink-0 border-r border-slate-700 bg-slate-900/50 overflow-y-auto p-2">
                              {getUniqueCategories().map((cat) => {
                                const isSelected = (selectedPickerCategory ?? getUniqueCategories()[0] ?? null) === cat;
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
                            <div className="flex-1 min-w-0 overflow-y-auto p-2">
                              {(() => {
                                const cats = getUniqueCategories();
                                const displayCat = selectedPickerCategory ?? cats[0] ?? null;
                                const items = displayCat ? getItemsByCategory(displayCat) : [];
                                if (!displayCat || items.length === 0) {
                                  return <p className="text-slate-500 text-sm py-1">No items.</p>;
                                }
                                return (
                                  <div className="space-y-0.5">
                                    {items.map((item) => {
                                      const inList = editingListItems.some((r) => r.itemId === item.id);
                                      return (
                                        <button
                                          key={item.id}
                                          type="button"
                                          onClick={() => addItemToEditingList(item)}
                                          className={`w-full text-left px-2 py-1 rounded text-sm ${
                                            inList ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-200 hover:bg-slate-700'
                                          }`}
                                        >
                                          {item.name}
                                          {inList && ' ✓'}
                                        </button>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                      {editingListItems.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {editingListItems.map((ref) => (
                            <span
                              key={ref.itemId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-700 text-slate-200 text-xs"
                            >
                              {ref.name}
                              <button
                                type="button"
                                onClick={() => removeItemFromEditingList(ref.itemId)}
                                className="text-slate-400 hover:text-red-300"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={cancelEditingList}
                          className="px-3 py-1.5 rounded border border-slate-600 bg-slate-700 text-slate-200 text-sm hover:bg-slate-600"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveEditingList}
                          className="px-3 py-1.5 rounded bg-emerald-500 text-slate-950 text-sm font-medium hover:bg-emerald-400"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={list.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-base font-semibold text-slate-50">
                            {list.name}
                            <span className="text-slate-400 font-normal"> — {formatDateDisplay(list.date)}</span>
                          </h4>
                          {list.items.length > 0 ? (() => {
                            const groups = groupListItemsByCategory(list.items);
                            return (
                              <div
                                className="mt-3 grid gap-x-6 gap-y-3"
                                style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}
                              >
                                {groups.map(({ category, items: categoryItems }) => (
                                  <div key={category}>
                                    <p
                                      className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300 border-b border-slate-700 pb-1 truncate"
                                      title={category}
                                      style={{ maxWidth: '100%' }}
                                    >
                                      {category.length > 15 ? `${category.slice(0, 15)}…` : category}
                                    </p>
                                    <p className="text-sm text-slate-200 mt-0.5">
                                      {categoryItems.length === 1
                                        ? categoryItems[0].name
                                        : `${categoryItems.length} items`}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            );
                          })() : (
                            <p className="text-slate-500 text-sm mt-1">No items</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <label
                            className="flex items-center gap-2 cursor-pointer"
                            title="Display on dashboard"
                          >
                            <span className="text-xs text-slate-400 whitespace-nowrap">Dashboard</span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={isListOnDashboard(list.id)}
                              aria-label="Display on dashboard"
                              title="Display on dashboard"
                              onClick={() => toggleListOnDashboard(list)}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                                isListOnDashboard(list.id) ? 'bg-emerald-500' : 'bg-slate-700'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                                  isListOnDashboard(list.id) ? 'translate-x-5' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setViewListId(list.id)}
                              aria-label="View full list"
                              title="View full list"
                              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditingList(list)}
                              aria-label="Edit list"
                              title="Edit list"
                              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => moveToHistory(list.id)}
                              aria-label="Move to History"
                              title="Move to History"
                              className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteConfirmListId(list.id);
                                setDeleteConfirmText('');
                              }}
                              aria-label="Delete list"
                              title="Delete list"
                              className="rounded-lg p-2 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                            >
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* History section */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">History</h3>
            {historyLists.length === 0 ? (
              <p className="text-slate-400 text-center py-6">
                No lists in history yet. Move an active list to History when done.
              </p>
            ) : (
              <div className="space-y-4">
                {historyLists.map((list) =>
                  editingListId === list.id ? (
                    <div
                      key={list.id}
                      className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 space-y-3"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            List name
                          </label>
                          <input
                            type="text"
                            value={editingListName}
                            onChange={(e) => setEditingListName(e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Date
                          </label>
                          <input
                            type="date"
                            value={editingListDate}
                            onChange={(e) => setEditingListDate(e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Add items (click to add)
                        </label>
                        <div className="rounded-lg border border-slate-700 bg-slate-900/70 overflow-hidden">
                          <div className="flex gap-0 border-b border-slate-700 bg-slate-800/70">
                            <div className="w-1/4 min-w-0 flex-shrink-0 px-2 py-1.5">
                              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Category</span>
                            </div>
                            <div className="flex-1 min-w-0 px-2 py-1.5 border-l border-slate-700">
                              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Items</span>
                            </div>
                          </div>
                          <div className="flex gap-0 max-h-48 overflow-hidden">
                            <div className="w-1/4 min-w-0 flex-shrink-0 border-r border-slate-700 bg-slate-900/50 overflow-y-auto p-2">
                              {getUniqueCategories().map((cat) => {
                                const isSelected = (selectedPickerCategory ?? getUniqueCategories()[0] ?? null) === cat;
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
                            <div className="flex-1 min-w-0 overflow-y-auto p-2">
                              {(() => {
                                const cats = getUniqueCategories();
                                const displayCat = selectedPickerCategory ?? cats[0] ?? null;
                                const items = displayCat ? getItemsByCategory(displayCat) : [];
                                if (!displayCat || items.length === 0) {
                                  return <p className="text-slate-500 text-sm py-1">No items.</p>;
                                }
                                return (
                                  <div className="space-y-0.5">
                                    {items.map((item) => {
                                      const inList = editingListItems.some((r) => r.itemId === item.id);
                                      return (
                                        <button
                                          key={item.id}
                                          type="button"
                                          onClick={() => addItemToEditingList(item)}
                                          className={`w-full text-left px-2 py-1 rounded text-sm ${
                                            inList ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-200 hover:bg-slate-700'
                                          }`}
                                        >
                                          {item.name}
                                          {inList && ' ✓'}
                                        </button>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                      {editingListItems.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {editingListItems.map((ref) => (
                            <span
                              key={ref.itemId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-700 text-slate-200 text-xs"
                            >
                              {ref.name}
                              <button
                                type="button"
                                onClick={() => removeItemFromEditingList(ref.itemId)}
                                className="text-slate-400 hover:text-red-300"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={cancelEditingList}
                          className="px-3 py-1.5 rounded border border-slate-600 bg-slate-700 text-slate-200 text-sm hover:bg-slate-600"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveEditingList}
                          className="px-3 py-1.5 rounded bg-emerald-500 text-slate-950 text-sm font-medium hover:bg-emerald-400"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={list.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-base font-semibold text-slate-50">
                            {list.name}
                            <span className="text-slate-400 font-normal"> — {formatDateDisplay(list.date)}</span>
                          </h4>
                          {list.items.length > 0 ? (() => {
                            const groups = groupListItemsByCategory(list.items);
                            return (
                              <div
                                className="mt-3 grid gap-x-6 gap-y-3"
                                style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}
                              >
                                {groups.map(({ category, items: categoryItems }) => (
                                  <div key={category}>
                                    <p
                                      className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300 border-b border-slate-700 pb-1 truncate"
                                      title={category}
                                      style={{ maxWidth: '100%' }}
                                    >
                                      {category.length > 15 ? `${category.slice(0, 15)}…` : category}
                                    </p>
                                    <p className="text-sm text-slate-200 mt-0.5">
                                      {categoryItems.length === 1
                                        ? categoryItems[0].name
                                        : `${categoryItems.length} items`}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            );
                          })() : (
                            <p className="text-slate-500 text-sm mt-1">No items</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setViewListId(list.id)}
                            aria-label="View full list"
                            title="View full list"
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditingList(list)}
                            aria-label="Edit list"
                            title="Edit list"
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteConfirmListId(list.id);
                              setDeleteConfirmText('');
                            }}
                            aria-label="Delete list"
                            title="Delete list"
                            className="rounded-lg p-2 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* View full list modal */}
      {viewListId && (() => {
        const list = shoppingLists.find((l) => l.id === viewListId);
        if (!list) return null;
        const groups = groupListItemsByCategory(list.items);
        return (
          <>
            <style
              dangerouslySetInnerHTML={{
                __html: `
                  @media print {
                    body * { visibility: hidden; }
                    .shopping-list-view-print, .shopping-list-view-print * { visibility: visible; }
                    .shopping-list-view-print { position: absolute; left: 0; top: 0; width: 100%; background: white; color: black; padding: 1rem; }
                    .shopping-list-view-print .print-only-hidden { display: none !important; }
                    .shopping-list-view-print .print-title { display: block !important; }
                  }
                `,
              }}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl mx-4 max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between gap-4 mb-4 print-only-hidden">
                  <h3 className="text-lg font-semibold text-slate-50">
                    {list.name}
                    <span className="text-slate-400 font-normal"> — {formatDateDisplay(list.date)}</span>
                  </h3>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      aria-label="Print list"
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewListId(null)}
                      aria-label="Close modal"
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="shopping-list-view-print overflow-y-auto flex-1 pr-2">
                  <div className="print-title hidden mb-2 text-lg font-semibold">
                    {list.name} — {formatDateDisplay(list.date)}
                  </div>
                  {list.items.length === 0 ? (
                    <p className="text-slate-500 text-sm">No items</p>
                  ) : (
                    <div className="space-y-4">
                      {groups.map(({ category, items: categoryItems }) => (
                        <div key={category}>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300 mb-1">
                            {category}
                          </p>
                          <ul className="text-sm text-slate-200 list-disc list-inside ml-0 space-y-0.5">
                            {categoryItems.map((ref) => (
                              <li key={ref.itemId}>
                                {ref.name || (masterItems.find((i) => i.id === ref.itemId)?.name ?? 'Unknown item')}
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

      {/* Items Tab — two columns: left 25% categories, right 75% items in selected category */}
      {activeTab === 'items' && (() => {
        const categories = getUniqueCategories();
        const displayCategory = selectedItemsCategory ?? categories[0] ?? null;
        const currentItems = displayCategory ? getItemsByCategory(displayCategory) : [];

        return (
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
                        {isCreatingNewCategory
                          ? 'Select existing category'
                          : '+ Create new category'}
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
                      disabled={!newItemName.trim() || !newItemCategory.trim()}
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
                {/* Left: categories — 25% width */}
                <div className="w-1/4 min-w-0 flex-shrink-0 border-r border-slate-800 bg-slate-900/50">
                  <div className="p-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 px-2">
                      Categories
                    </h3>
                    {categories.length === 0 ? (
                      <p className="text-slate-500 text-sm px-2 py-4">No categories yet. Add an item to create one.</p>
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

                {/* Right: items in selected category — 75% width */}
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
                                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                    Category <span className="text-red-400">*</span>
                                  </label>
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
                                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                    Item Name <span className="text-red-400">*</span>
                                  </label>
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
        );
      })()}

      {/* Delete list confirmation modal */}
      {deleteConfirmListId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-slate-50 mb-2">
              Delete Shopping List
            </h3>
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4">
              <p className="text-red-300 font-semibold mb-2">
                ⚠️ Warning: This action cannot be undone!
              </p>
              <p className="text-red-200 text-sm">
                This list will be <strong>permanently deleted</strong>.
              </p>
            </div>
            <p className="text-slate-300 mb-4">
              Type <strong className="text-slate-200">delete</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/50 mb-4"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setDeleteConfirmListId(null);
                  setDeleteConfirmText('');
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={deleteList}
                disabled={deleteConfirmText.toLowerCase() !== 'delete'}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setDeleteConfirmListId(null);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete item confirmation modal */}
      {deleteConfirmItemId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-slate-50 mb-2">
              Delete Item
            </h3>
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 mb-4">
              <p className="text-red-300 font-semibold mb-2">
                ⚠️ Warning: This action cannot be undone!
              </p>
              <p className="text-red-200 text-sm">
                This item will be removed from your master list. It will not affect existing shopping lists that already include it.
              </p>
            </div>
            <p className="text-slate-300 mb-4">
              Type <strong className="text-slate-200">delete</strong> to confirm:
            </p>
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
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  );
}
