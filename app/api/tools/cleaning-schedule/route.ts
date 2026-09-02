import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';
import {
  advanceFrom,
  asDateOnly,
  CleaningFrequency,
  CleaningScheduleData,
  dbToFrequency,
  frequencyToDb,
  isFrequencyValid,
  latenessFor,
  todayIso,
} from '@/lib/cleaning-schedule';

type DbCategory = {
  id: string;
  name: string;
  is_default: boolean;
};

type DbItem = {
  id: string;
  name: string;
  category_id: string;
  description: string | null;
  notes: string | null;
  is_default: boolean;
  is_hidden: boolean;
};

type DbTask = {
  id: string;
  item_id: string;
  frequency: string;
  interval_count: number | null;
  interval_unit: string | null;
  days_of_week: unknown;
  day_of_month: number | null;
  next_due_date: string;
  last_completed_date: string | null;
  is_active: boolean;
  date_added: string;
  date_inactivated: string | null;
};

type DbCompletion = {
  id: string;
  task_id: string;
  scheduled_date: string;
  completed_date: string;
  lateness: 'Early' | 'On time' | 'Late';
};

function mapData(
  categories: DbCategory[],
  items: DbItem[],
  tasks: DbTask[],
  completions: DbCompletion[]
): CleaningScheduleData {
  return {
    categories: categories.map((row) => ({
      id: row.id,
      name: row.name,
      isDefault: row.is_default === true,
    })),
    items: items.map((row) => ({
      id: row.id,
      name: row.name,
      categoryId: row.category_id,
      description: row.description ?? '',
      notes: row.notes ?? '',
      isDefault: row.is_default === true,
      isHidden: row.is_hidden === true,
    })),
    tasks: tasks.map((row) => ({
      id: row.id,
      libraryItemId: row.item_id,
      frequency: dbToFrequency(row),
      nextDueDate: asDateOnly(row.next_due_date),
      lastCompletedDate: row.last_completed_date ? asDateOnly(row.last_completed_date) : null,
      isActive: row.is_active !== false,
      dateAdded: asDateOnly(row.date_added) || todayIso(),
      dateInactivated: row.date_inactivated ? asDateOnly(row.date_inactivated) : undefined,
    })),
    completions: completions.map((row) => ({
      id: row.id,
      scheduledTaskId: row.task_id,
      scheduledDate: asDateOnly(row.scheduled_date),
      completedDate: asDateOnly(row.completed_date),
      lateness: row.lateness,
    })),
  };
}

async function ensureDefaults(userId: string, toolId: string) {
  const { data: existingCategories, error: existingCatError } = await supabaseServer
    .from('tools_cs_categories')
    .select('id, name')
    .eq('user_id', userId)
    .eq('tool_id', toolId);

  if (existingCatError) throw existingCatError;

  const { data: defaultCategories, error: defaultCatError } = await supabaseServer
    .from('tools_cs_default_categories')
    .select('name, display_order')
    .order('display_order', { ascending: true });

  if (defaultCatError) throw defaultCatError;

  const haveCategoryNames = new Set((existingCategories ?? []).map((row) => row.name.toLowerCase()));
  const categoriesToInsert = (defaultCategories ?? []).filter((row) => !haveCategoryNames.has(row.name.toLowerCase()));

  if (categoriesToInsert.length > 0) {
    const { error } = await supabaseServer.from('tools_cs_categories').insert(
      categoriesToInsert.map((row) => ({
        user_id: userId,
        tool_id: toolId,
        name: row.name,
        is_default: true,
      }))
    );
    if (error) throw error;
  }

  const { data: userCategories, error: userCatError } = await supabaseServer
    .from('tools_cs_categories')
    .select('id, name')
    .eq('user_id', userId)
    .eq('tool_id', toolId);

  if (userCatError) throw userCatError;

  const categoryIdByName = new Map((userCategories ?? []).map((row) => [row.name.toLowerCase(), row.id]));

  const { data: existingItems, error: existingItemError } = await supabaseServer
    .from('tools_cs_items')
    .select('source_key')
    .eq('user_id', userId)
    .eq('tool_id', toolId)
    .not('source_key', 'is', null);

  if (existingItemError) throw existingItemError;

  const { data: defaultItems, error: defaultItemError } = await supabaseServer
    .from('tools_cs_default_items')
    .select('source_key, name, category_name, description, display_order')
    .order('display_order', { ascending: true });

  if (defaultItemError) throw defaultItemError;

  const haveKeys = new Set((existingItems ?? []).map((row) => row.source_key).filter(Boolean));
  const itemsToInsert = (defaultItems ?? [])
    .filter((row) => !haveKeys.has(row.source_key))
    .map((row) => {
      const categoryId = categoryIdByName.get(row.category_name.toLowerCase());
      if (!categoryId) return null;
      return {
        user_id: userId,
        tool_id: toolId,
        category_id: categoryId,
        name: row.name,
        description: row.description ?? '',
        notes: '',
        is_default: true,
        is_hidden: false,
        source_key: row.source_key,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (itemsToInsert.length > 0) {
    const { error } = await supabaseServer.from('tools_cs_items').insert(itemsToInsert);
    if (error) throw error;
  }
}

async function fetchAllData(userId: string, toolId: string): Promise<CleaningScheduleData> {
  await ensureDefaults(userId, toolId);

  const [categoriesRes, itemsRes, tasksRes, completionsRes] = await Promise.all([
    supabaseServer
      .from('tools_cs_categories')
      .select('id, name, is_default')
      .eq('user_id', userId)
      .eq('tool_id', toolId)
      .order('name', { ascending: true }),
    supabaseServer
      .from('tools_cs_items')
      .select('id, name, category_id, description, notes, is_default, is_hidden')
      .eq('user_id', userId)
      .eq('tool_id', toolId)
      .order('name', { ascending: true }),
    supabaseServer
      .from('tools_cs_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('tool_id', toolId)
      .order('next_due_date', { ascending: true }),
    supabaseServer
      .from('tools_cs_completions')
      .select('id, task_id, scheduled_date, completed_date, lateness')
      .eq('user_id', userId)
      .eq('tool_id', toolId)
      .order('completed_date', { ascending: false }),
  ]);

  if (categoriesRes.error) throw categoriesRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (tasksRes.error) throw tasksRes.error;
  if (completionsRes.error) throw completionsRes.error;

  return mapData(
    (categoriesRes.data ?? []) as DbCategory[],
    (itemsRes.data ?? []) as DbItem[],
    (tasksRes.data ?? []) as DbTask[],
    (completionsRes.data ?? []) as DbCompletion[]
  );
}

async function resolveCategoryId(
  userId: string,
  toolId: string,
  categoryId?: string,
  newCategoryName?: string
): Promise<{ id?: string; error?: string }> {
  const createdName = newCategoryName?.trim();
  if (createdName) {
    const { data: existing } = await supabaseServer
      .from('tools_cs_categories')
      .select('id')
      .eq('user_id', userId)
      .eq('tool_id', toolId)
      .ilike('name', createdName)
      .maybeSingle();

    if (existing?.id) return { id: existing.id };

    const { data: created, error } = await supabaseServer
      .from('tools_cs_categories')
      .insert({
        user_id: userId,
        tool_id: toolId,
        name: createdName,
        is_default: false,
      })
      .select('id')
      .single();

    if (error || !created) {
      console.error('Error creating cleaning schedule category:', error);
      return { error: 'Failed to create category' };
    }
    return { id: created.id };
  }

  if (!categoryId) return { error: 'Category is required' };

  const { data: owned } = await supabaseServer
    .from('tools_cs_categories')
    .select('id')
    .eq('id', categoryId)
    .eq('user_id', userId)
    .eq('tool_id', toolId)
    .maybeSingle();

  if (!owned) return { error: 'Category not found' };
  return { id: categoryId };
}

function parseFrequency(value: unknown): CleaningFrequency | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as CleaningFrequency;
  if (!raw.kind) return null;
  const frequency: CleaningFrequency = { kind: raw.kind };
  if (raw.intervalCount != null) frequency.intervalCount = Number(raw.intervalCount);
  if (raw.intervalUnit === 'days' || raw.intervalUnit === 'weeks' || raw.intervalUnit === 'months') {
    frequency.intervalUnit = raw.intervalUnit;
  }
  if (Array.isArray(raw.daysOfWeek)) {
    frequency.daysOfWeek = raw.daysOfWeek.map((day) => Number(day)).filter((day) => Number.isInteger(day));
  }
  if (raw.dayOfMonth != null) frequency.dayOfMonth = Number(raw.dayOfMonth);
  return isFrequencyValid(frequency) ? frequency : null;
}

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const toolId = new URL(request.url).searchParams.get('toolId');
    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    const data = await fetchAllData(user.id, toolId);
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Error in GET /api/tools/cleaning-schedule:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      toolId,
      action,
      categoryId,
      itemId,
      taskId,
      name,
      description,
      notes,
      newCategoryName,
      frequency: frequencyRaw,
      nextDueDate,
      scheduledDate,
      completeBasis,
    } = body as {
      toolId?: string;
      action?: string;
      categoryId?: string;
      itemId?: string;
      taskId?: string;
      name?: string;
      description?: string;
      notes?: string;
      newCategoryName?: string;
      frequency?: CleaningFrequency;
      nextDueDate?: string;
      scheduledDate?: string;
      completeBasis?: 'today' | 'scheduled';
    };

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    if (action === 'createCategory') {
      if (!name?.trim()) {
        return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
      }

      const { data: duplicate } = await supabaseServer
        .from('tools_cs_categories')
        .select('id')
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .ilike('name', name.trim())
        .maybeSingle();

      if (duplicate) {
        return NextResponse.json({ error: 'A category with that name already exists' }, { status: 400 });
      }

      const { error } = await supabaseServer.from('tools_cs_categories').insert({
        user_id: user.id,
        tool_id: toolId,
        name: name.trim(),
        is_default: false,
      });

      if (error) {
        console.error('Error creating category:', error);
        return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
      }

      return NextResponse.json({ success: true, ...(await fetchAllData(user.id, toolId)) });
    }

    if (action === 'updateCategory') {
      if (!categoryId || !name?.trim()) {
        return NextResponse.json({ error: 'Category ID and name are required' }, { status: 400 });
      }

      const { data: category } = await supabaseServer
        .from('tools_cs_categories')
        .select('id, is_default')
        .eq('id', categoryId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .maybeSingle();

      if (!category) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }
      if (category.is_default) {
        return NextResponse.json({ error: 'Default categories cannot be renamed' }, { status: 400 });
      }

      const { data: duplicate } = await supabaseServer
        .from('tools_cs_categories')
        .select('id')
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .ilike('name', name.trim())
        .neq('id', categoryId)
        .maybeSingle();

      if (duplicate) {
        return NextResponse.json({ error: 'A category with that name already exists' }, { status: 400 });
      }

      const { error } = await supabaseServer
        .from('tools_cs_categories')
        .update({ name: name.trim() })
        .eq('id', categoryId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error updating category:', error);
        return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
      }

      return NextResponse.json({ success: true, ...(await fetchAllData(user.id, toolId)) });
    }

    if (action === 'deleteCategory') {
      if (!categoryId) {
        return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
      }

      const { data: category } = await supabaseServer
        .from('tools_cs_categories')
        .select('id, is_default')
        .eq('id', categoryId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .maybeSingle();

      if (!category) {
        return NextResponse.json({ error: 'Category not found' }, { status: 404 });
      }
      if (category.is_default) {
        return NextResponse.json({ error: 'Default categories cannot be deleted' }, { status: 400 });
      }

      const { count } = await supabaseServer
        .from('tools_cs_items')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', categoryId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if ((count ?? 0) > 0) {
        return NextResponse.json({ error: 'Category is still in use' }, { status: 400 });
      }

      const { error } = await supabaseServer
        .from('tools_cs_categories')
        .delete()
        .eq('id', categoryId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error deleting category:', error);
        return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
      }

      return NextResponse.json({ success: true, ...(await fetchAllData(user.id, toolId)) });
    }

    if (action === 'createItem') {
      if (!name?.trim()) {
        return NextResponse.json({ error: 'Item name is required' }, { status: 400 });
      }

      const category = await resolveCategoryId(user.id, toolId, categoryId, newCategoryName);
      if (!category.id) {
        return NextResponse.json({ error: category.error || 'Category is required' }, { status: 400 });
      }

      const { error } = await supabaseServer.from('tools_cs_items').insert({
        user_id: user.id,
        tool_id: toolId,
        category_id: category.id,
        name: name.trim(),
        description: (description ?? '').trim(),
        notes: (notes ?? '').trim(),
        is_default: false,
        is_hidden: false,
      });

      if (error) {
        console.error('Error creating item:', error);
        return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
      }

      return NextResponse.json({ success: true, createdCategoryId: category.id, ...(await fetchAllData(user.id, toolId)) });
    }

    if (action === 'updateItem' || action === 'updateSchedule') {
      if (!itemId && action === 'updateItem') {
        return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
      }

      let resolvedItemId = itemId;
      if (action === 'updateSchedule') {
        if (!taskId) {
          return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
        }
        const { data: task } = await supabaseServer
          .from('tools_cs_tasks')
          .select('id, item_id')
          .eq('id', taskId)
          .eq('user_id', user.id)
          .eq('tool_id', toolId)
          .maybeSingle();
        if (!task) {
          return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }
        resolvedItemId = task.item_id;
      }

      if (!resolvedItemId) {
        return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
      }

      const { data: item } = await supabaseServer
        .from('tools_cs_items')
        .select('id, is_default')
        .eq('id', resolvedItemId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .maybeSingle();

      if (!item) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }

      const category = await resolveCategoryId(user.id, toolId, categoryId, newCategoryName);
      if (!category.id) {
        return NextResponse.json({ error: category.error || 'Category is required' }, { status: 400 });
      }

      const itemUpdate: Record<string, unknown> = {
        category_id: category.id,
        description: (description ?? '').trim(),
        notes: (notes ?? '').trim(),
      };
      if (!item.is_default) {
        if (!name?.trim()) {
          return NextResponse.json({ error: 'Item name is required' }, { status: 400 });
        }
        itemUpdate.name = name.trim();
      }

      const { error: itemError } = await supabaseServer
        .from('tools_cs_items')
        .update(itemUpdate)
        .eq('id', resolvedItemId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (itemError) {
        console.error('Error updating item:', itemError);
        return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
      }

      if (action === 'updateSchedule') {
        const frequency = parseFrequency(frequencyRaw);
        if (!frequency || !nextDueDate) {
          return NextResponse.json({ error: 'Frequency and next due date are required' }, { status: 400 });
        }

        const { error: taskError } = await supabaseServer
          .from('tools_cs_tasks')
          .update({
            ...frequencyToDb(frequency),
            next_due_date: nextDueDate,
          })
          .eq('id', taskId)
          .eq('user_id', user.id)
          .eq('tool_id', toolId);

        if (taskError) {
          console.error('Error updating task:', taskError);
          return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true, ...(await fetchAllData(user.id, toolId)) });
    }

    if (action === 'hideItem' || action === 'restoreItem') {
      if (!itemId) {
        return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
      }

      const { data: item } = await supabaseServer
        .from('tools_cs_items')
        .select('id, is_default')
        .eq('id', itemId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .maybeSingle();

      if (!item) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }
      if (!item.is_default) {
        return NextResponse.json({ error: 'Only default items can be hidden or restored' }, { status: 400 });
      }

      const { error } = await supabaseServer
        .from('tools_cs_items')
        .update({ is_hidden: action === 'hideItem' })
        .eq('id', itemId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error updating item visibility:', error);
        return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
      }

      return NextResponse.json({ success: true, ...(await fetchAllData(user.id, toolId)) });
    }

    if (action === 'deleteItem') {
      if (!itemId) {
        return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
      }

      const { data: item } = await supabaseServer
        .from('tools_cs_items')
        .select('id, is_default')
        .eq('id', itemId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .maybeSingle();

      if (!item) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }
      if (item.is_default) {
        return NextResponse.json({ error: 'Default items cannot be deleted' }, { status: 400 });
      }

      const { error } = await supabaseServer
        .from('tools_cs_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error deleting item:', error);
        return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
      }

      return NextResponse.json({ success: true, ...(await fetchAllData(user.id, toolId)) });
    }

    if (action === 'activateTask') {
      if (!itemId || !nextDueDate) {
        return NextResponse.json({ error: 'Item ID and next due date are required' }, { status: 400 });
      }

      const frequency = parseFrequency(frequencyRaw);
      if (!frequency) {
        return NextResponse.json({ error: 'A valid frequency is required' }, { status: 400 });
      }

      const { data: item } = await supabaseServer
        .from('tools_cs_items')
        .select('id')
        .eq('id', itemId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .maybeSingle();

      if (!item) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }

      const payload = {
        user_id: user.id,
        tool_id: toolId,
        item_id: itemId,
        ...frequencyToDb(frequency),
        next_due_date: nextDueDate,
        is_active: true,
        date_inactivated: null,
      };

      const { data: existing } = await supabaseServer
        .from('tools_cs_tasks')
        .select('id')
        .eq('item_id', itemId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .maybeSingle();

      const { error } = existing
        ? await supabaseServer.from('tools_cs_tasks').update(payload).eq('id', existing.id)
        : await supabaseServer.from('tools_cs_tasks').insert(payload);

      if (error) {
        console.error('Error activating task:', error);
        return NextResponse.json({ error: 'Failed to activate task' }, { status: 500 });
      }

      return NextResponse.json({ success: true, ...(await fetchAllData(user.id, toolId)) });
    }

    if (action === 'deactivateTask' || action === 'reactivateTask') {
      if (!taskId) {
        return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
      }

      const { error } = await supabaseServer
        .from('tools_cs_tasks')
        .update(
          action === 'deactivateTask'
            ? { is_active: false, date_inactivated: todayIso() }
            : { is_active: true, date_inactivated: null }
        )
        .eq('id', taskId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error updating task active state:', error);
        return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
      }

      return NextResponse.json({ success: true, ...(await fetchAllData(user.id, toolId)) });
    }

    if (action === 'deleteTask') {
      if (!taskId) {
        return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
      }

      const { data: task } = await supabaseServer
        .from('tools_cs_tasks')
        .select('id, item_id')
        .eq('id', taskId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .maybeSingle();

      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }

      const { data: item } = await supabaseServer
        .from('tools_cs_items')
        .select('is_default')
        .eq('id', task.item_id)
        .maybeSingle();

      if (item?.is_default) {
        return NextResponse.json({ error: 'Default scheduled tasks cannot be permanently deleted' }, { status: 400 });
      }

      const { error } = await supabaseServer
        .from('tools_cs_tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error deleting task:', error);
        return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
      }

      return NextResponse.json({ success: true, ...(await fetchAllData(user.id, toolId)) });
    }

    if (action === 'completeTask') {
      if (!taskId || !scheduledDate) {
        return NextResponse.json({ error: 'Task ID and scheduled date are required' }, { status: 400 });
      }

      const { data: task } = await supabaseServer
        .from('tools_cs_tasks')
        .select('*')
        .eq('id', taskId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .maybeSingle();

      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }

      const completedDate = completeBasis === 'scheduled' ? asDateOnly(scheduledDate) : todayIso();
      const scheduled = asDateOnly(scheduledDate);
      const frequency = dbToFrequency(task as DbTask);
      const nextDue = advanceFrom(completedDate, frequency);
      const lateness = latenessFor(scheduled, completedDate);

      const { error: completionError } = await supabaseServer.from('tools_cs_completions').insert({
        user_id: user.id,
        tool_id: toolId,
        task_id: taskId,
        scheduled_date: scheduled,
        completed_date: completedDate,
        lateness,
      });

      if (completionError) {
        console.error('Error writing completion:', completionError);
        return NextResponse.json({ error: 'Failed to complete task' }, { status: 500 });
      }

      const { error: taskError } = await supabaseServer
        .from('tools_cs_tasks')
        .update({
          next_due_date: nextDue,
          last_completed_date: completedDate,
        })
        .eq('id', taskId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (taskError) {
        console.error('Error advancing next due date:', taskError);
        return NextResponse.json({ error: 'Failed to complete task' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        nextDueDate: nextDue,
        ...(await fetchAllData(user.id, toolId)),
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Error in POST /api/tools/cleaning-schedule:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
