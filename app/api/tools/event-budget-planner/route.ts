import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

type DbNamed = {
  id: string;
  name: string;
  is_active: boolean;
  date_added: string;
  date_inactivated: string | null;
};

type DbVendor = DbNamed & {
  contact_person: string;
  phone: string;
  email: string;
  service_provided: string;
  notes: string;
};

type DbEvent = {
  id: string;
  name: string;
  event_date: string;
  type_id: string;
  notes: string;
  is_active: boolean;
  date_added: string;
  date_inactivated: string | null;
  created_at: string;
};

type DbBudget = {
  id: string;
  event_id: string;
  category_id: string;
  budget_amount: number | string;
};

type DbExpense = {
  id: string;
  event_id: string;
  category_id: string;
  vendor_id: string;
  expense_date: string;
  amount: number | string;
  note: string;
};

type DbSplit = {
  id: string;
  expense_id: string;
  vendor_id: string;
  amount: number | string;
  display_order: number;
};

type VendorSplitPart = {
  vendorId: string;
  amount: number;
};

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function mapNamed(row: DbNamed) {
  return {
    id: row.id,
    name: row.name,
    isActive: row.is_active !== false,
    dateAdded: row.date_added,
    dateInactivated: row.date_inactivated || undefined,
  };
}

function mapVendor(row: DbVendor) {
  return {
    ...mapNamed(row),
    contactPerson: row.contact_person,
    phone: row.phone,
    email: row.email,
    serviceProvided: row.service_provided,
    notes: row.notes,
  };
}

function parseAmount(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isMissingRelationError(error: { code?: string; message?: string } | null) {
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST116' ||
    !!error?.message?.includes('does not exist') ||
    !!error?.message?.includes('schema cache')
  );
}

function moneyCents(value: number) {
  return Math.round(value * 100);
}

function normalizeVendorSplits(
  vendorId: unknown,
  amount: unknown,
  vendorSplits: unknown
): { error: string } | { total: number; parts: VendorSplitPart[] } {
  const total = parseAmount(amount);
  if (total <= 0) return { error: 'Amount must be greater than zero' };

  const raw = Array.isArray(vendorSplits) && vendorSplits.length > 0 ? vendorSplits : [{ vendorId, amount: total }];
  const parts = raw.map((row) => {
    const part = row as { vendorId?: unknown; amount?: unknown };
    return {
      vendorId: String(part?.vendorId ?? '').trim(),
      amount: parseAmount(part?.amount),
    };
  });

  if (parts.some((part) => !part.vendorId || part.amount <= 0)) {
    return { error: 'Each vendor split needs a vendor and an amount greater than zero.' };
  }

  if (parts.reduce((sum, part) => sum + moneyCents(part.amount), 0) !== moneyCents(total)) {
    return { error: 'Vendor amounts must sum to the expense amount.' };
  }

  return { total, parts };
}

async function fetchExpenseSplits(expenseIds: string[]): Promise<DbSplit[]> {
  if (expenseIds.length === 0) return [];
  const { data, error } = await supabaseServer
    .from('tools_ebp_expense_splits')
    .select('*')
    .in('expense_id', expenseIds)
    .order('display_order', { ascending: true });

  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }

  return (data ?? []) as DbSplit[];
}

function mapExpense(row: DbExpense, splits: DbSplit[]) {
  const amount = parseAmount(row.amount);
  const vendorSplits = splits.length
    ? splits.map((split) => ({ vendorId: split.vendor_id, amount: parseAmount(split.amount) }))
    : [{ vendorId: row.vendor_id, amount }];

  return {
    id: row.id,
    categoryId: row.category_id,
    date: row.expense_date,
    vendorId: vendorSplits[0]?.vendorId ?? row.vendor_id,
    amount,
    note: row.note,
    vendorSplits,
  };
}

async function replaceExpenseSplits(expenseId: string, parts: VendorSplitPart[]) {
  const { error: deleteError } = await supabaseServer
    .from('tools_ebp_expense_splits')
    .delete()
    .eq('expense_id', expenseId);

  if (deleteError && !isMissingRelationError(deleteError)) throw deleteError;

  if (parts.length <= 1) return;

  const { error: insertError } = await supabaseServer.from('tools_ebp_expense_splits').insert(
    parts.map((part, index) => ({
      expense_id: expenseId,
      vendor_id: part.vendorId,
      amount: part.amount,
      display_order: index,
    }))
  );

  if (insertError) {
    if (isMissingRelationError(insertError)) {
      throw new Error('Expense splits table is missing. Run supabase/UPDATE_ebp_expense_splits.sql.');
    }
    throw insertError;
  }
}

async function ensureDefaultCategories(userId: string, toolId: string) {
  const { data: existing } = await supabaseServer
    .from('tools_ebp_categories')
    .select('id')
    .eq('user_id', userId)
    .eq('tool_id', toolId)
    .limit(1);

  if (existing && existing.length > 0) return;

  const { data: defaults } = await supabaseServer
    .from('tools_ebp_default_categories')
    .select('name, display_order')
    .order('display_order', { ascending: true });

  if (!defaults?.length) return;

  await supabaseServer.from('tools_ebp_categories').insert(
    defaults.map((d) => ({
      user_id: userId,
      tool_id: toolId,
      name: d.name,
      is_active: true,
    }))
  );
}

async function ensureDefaultTypes(userId: string, toolId: string) {
  const { data: existing } = await supabaseServer
    .from('tools_ebp_types')
    .select('id')
    .eq('user_id', userId)
    .eq('tool_id', toolId)
    .limit(1);

  if (existing && existing.length > 0) return;

  const { data: defaults } = await supabaseServer
    .from('tools_ebp_default_types')
    .select('name, display_order')
    .order('display_order', { ascending: true });

  if (!defaults?.length) return;

  await supabaseServer.from('tools_ebp_types').insert(
    defaults.map((d) => ({
      user_id: userId,
      tool_id: toolId,
      name: d.name,
      is_active: true,
    }))
  );
}

async function fetchAllData(userId: string, toolId: string) {
  await Promise.all([ensureDefaultCategories(userId, toolId), ensureDefaultTypes(userId, toolId)]);

  const [categoriesRes, typesRes, vendorsRes, eventsRes] = await Promise.all([
    supabaseServer
      .from('tools_ebp_categories')
      .select('*')
      .eq('user_id', userId)
      .eq('tool_id', toolId)
      .order('name', { ascending: true }),
    supabaseServer
      .from('tools_ebp_types')
      .select('*')
      .eq('user_id', userId)
      .eq('tool_id', toolId)
      .order('name', { ascending: true }),
    supabaseServer
      .from('tools_ebp_vendors')
      .select('*')
      .eq('user_id', userId)
      .eq('tool_id', toolId)
      .order('name', { ascending: true }),
    supabaseServer
      .from('tools_ebp_events')
      .select('*')
      .eq('user_id', userId)
      .eq('tool_id', toolId)
      .order('event_date', { ascending: false }),
  ]);

  if (categoriesRes.error) throw categoriesRes.error;
  if (typesRes.error) throw typesRes.error;
  if (vendorsRes.error) throw vendorsRes.error;
  if (eventsRes.error) throw eventsRes.error;

  const events = (eventsRes.data ?? []) as DbEvent[];
  const eventIds = events.map((e) => e.id);

  let budgets: DbBudget[] = [];
  let expenses: DbExpense[] = [];

  if (eventIds.length > 0) {
    const [budgetsRes, expensesRes] = await Promise.all([
      supabaseServer.from('tools_ebp_event_category_budgets').select('*').in('event_id', eventIds),
      supabaseServer.from('tools_ebp_expenses').select('*').in('event_id', eventIds),
    ]);

    if (budgetsRes.error) throw budgetsRes.error;
    if (expensesRes.error) throw expensesRes.error;

    budgets = (budgetsRes.data ?? []) as DbBudget[];
    expenses = (expensesRes.data ?? []) as DbExpense[];
  }

  const splits = await fetchExpenseSplits(expenses.map((expense) => expense.id));

  const mappedEvents = events.map((event) => ({
    id: event.id,
    name: event.name,
    date: event.event_date,
    typeId: event.type_id,
    notes: event.notes,
    isActive: event.is_active !== false,
    dateAdded: event.date_added || event.created_at?.split('T')[0] || todayIso(),
    dateInactivated: event.date_inactivated || undefined,
    categoryBudgets: budgets
      .filter((b) => b.event_id === event.id)
      .map((b) => ({
        categoryId: b.category_id,
        budgetAmount: parseAmount(b.budget_amount),
      })),
    expenses: expenses
      .filter((e) => e.event_id === event.id)
      .map((e) => mapExpense(e, splits.filter((split) => split.expense_id === e.id))),
  }));

  return {
    categories: ((categoriesRes.data ?? []) as DbNamed[]).map(mapNamed),
    types: ((typesRes.data ?? []) as DbNamed[]).map(mapNamed),
    vendors: ((vendorsRes.data ?? []) as DbVendor[]).map(mapVendor),
    events: mappedEvents,
  };
}

async function verifyEventOwnership(eventId: string, userId: string, toolId: string) {
  const { data, error } = await supabaseServer
    .from('tools_ebp_events')
    .select('id')
    .eq('id', eventId)
    .eq('user_id', userId)
    .eq('tool_id', toolId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get('toolId');

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    const data = await fetchAllData(user.id, toolId);
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Error in GET /api/tools/event-budget-planner:', error);
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
      eventId,
      name,
      date,
      typeId,
      notes,
      categoryId,
      previousCategoryId,
      budgetAmount,
      expenseId,
      vendorId,
      amount,
      note,
      expenseDate,
      vendorSplits,
    } = body as {
      toolId?: string;
      action?: string;
      eventId?: string;
      name?: string;
      date?: string;
      typeId?: string;
      notes?: string;
      categoryId?: string;
      previousCategoryId?: string;
      budgetAmount?: number;
      expenseId?: string;
      vendorId?: string;
      amount?: number;
      note?: string;
      expenseDate?: string;
      vendorSplits?: VendorSplitPart[];
    };

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    if (action === 'createEvent') {
      if (!name?.trim() || !typeId || !date) {
        return NextResponse.json({ error: 'Name, date, and type are required' }, { status: 400 });
      }

      const { data: created, error } = await supabaseServer
        .from('tools_ebp_events')
        .insert({
          user_id: user.id,
          tool_id: toolId,
          name: name.trim(),
          event_date: date,
          type_id: typeId,
          notes: (notes ?? '').trim(),
          is_active: true,
        })
        .select('*')
        .single();

      if (error || !created) {
        console.error('Error creating event:', error);
        return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
      }

      const data = await fetchAllData(user.id, toolId);
      const event = data.events.find((e) => e.id === created.id);
      return NextResponse.json({ success: true, event, ...data });
    }

    if (action === 'updateEvent') {
      if (!eventId || !name?.trim() || !typeId || !date) {
        return NextResponse.json({ error: 'Event ID, name, date, and type are required' }, { status: 400 });
      }

      const { error } = await supabaseServer
        .from('tools_ebp_events')
        .update({
          name: name.trim(),
          event_date: date,
          type_id: typeId,
          notes: (notes ?? '').trim(),
        })
        .eq('id', eventId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error updating event:', error);
        return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
      }

      return NextResponse.json({ success: true, ...(await fetchAllData(user.id, toolId)) });
    }

    if (action === 'inactivateEvent') {
      if (!eventId) {
        return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
      }

      const { error } = await supabaseServer
        .from('tools_ebp_events')
        .update({ is_active: false, date_inactivated: todayIso() })
        .eq('id', eventId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error inactivating event:', error);
        return NextResponse.json({ error: 'Failed to move event to history' }, { status: 500 });
      }

      return NextResponse.json({ success: true, ...(await fetchAllData(user.id, toolId)) });
    }

    if (action === 'activateEvent') {
      if (!eventId) {
        return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
      }

      const { error } = await supabaseServer
        .from('tools_ebp_events')
        .update({ is_active: true, date_inactivated: null })
        .eq('id', eventId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error activating event:', error);
        return NextResponse.json({ error: 'Failed to reactivate event' }, { status: 500 });
      }

      return NextResponse.json({ success: true, ...(await fetchAllData(user.id, toolId)) });
    }

    if (action === 'deleteEvent') {
      if (!eventId) {
        return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
      }

      const { error } = await supabaseServer
        .from('tools_ebp_events')
        .delete()
        .eq('id', eventId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error deleting event:', error);
        return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
      }

      return NextResponse.json({ success: true, ...(await fetchAllData(user.id, toolId)) });
    }

    if (action === 'addCategoryBudget') {
      if (!eventId || !categoryId) {
        return NextResponse.json({ error: 'Event ID and category are required' }, { status: 400 });
      }

      const budget = parseAmount(budgetAmount);
      if (budget <= 0) {
        return NextResponse.json({ error: 'Budget amount must be greater than zero' }, { status: 400 });
      }

      if (!(await verifyEventOwnership(eventId, user.id, toolId))) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }

      const { error } = await supabaseServer.from('tools_ebp_event_category_budgets').insert({
        event_id: eventId,
        category_id: categoryId,
        budget_amount: budget,
      });

      if (error) {
        console.error('Error adding category budget:', error);
        return NextResponse.json({ error: 'Failed to add category budget' }, { status: 500 });
      }

      return NextResponse.json({ success: true, ...(await fetchAllData(user.id, toolId)) });
    }

    if (action === 'updateCategoryBudget') {
      if (!eventId || !categoryId || !previousCategoryId) {
        return NextResponse.json({ error: 'Event ID, category, and previous category are required' }, { status: 400 });
      }

      const budget = parseAmount(budgetAmount);
      if (budget <= 0) {
        return NextResponse.json({ error: 'Budget amount must be greater than zero' }, { status: 400 });
      }

      if (!(await verifyEventOwnership(eventId, user.id, toolId))) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }

      if (categoryId !== previousCategoryId) {
        const { data: duplicate } = await supabaseServer
          .from('tools_ebp_event_category_budgets')
          .select('id')
          .eq('event_id', eventId)
          .eq('category_id', categoryId)
          .maybeSingle();

        if (duplicate) {
          return NextResponse.json({ error: 'Category already exists on this event' }, { status: 400 });
        }
      }

      const { error: budgetError } = await supabaseServer
        .from('tools_ebp_event_category_budgets')
        .update({ category_id: categoryId, budget_amount: budget })
        .eq('event_id', eventId)
        .eq('category_id', previousCategoryId);

      if (budgetError) {
        console.error('Error updating category budget:', budgetError);
        return NextResponse.json({ error: 'Failed to update category budget' }, { status: 500 });
      }

      if (categoryId !== previousCategoryId) {
        await supabaseServer
          .from('tools_ebp_expenses')
          .update({ category_id: categoryId })
          .eq('event_id', eventId)
          .eq('category_id', previousCategoryId);
      }

      return NextResponse.json({ success: true, ...(await fetchAllData(user.id, toolId)) });
    }

    if (action === 'removeCategoryBudget') {
      if (!eventId || !categoryId) {
        return NextResponse.json({ error: 'Event ID and category are required' }, { status: 400 });
      }

      if (!(await verifyEventOwnership(eventId, user.id, toolId))) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }

      await supabaseServer
        .from('tools_ebp_expenses')
        .delete()
        .eq('event_id', eventId)
        .eq('category_id', categoryId);

      const { error } = await supabaseServer
        .from('tools_ebp_event_category_budgets')
        .delete()
        .eq('event_id', eventId)
        .eq('category_id', categoryId);

      if (error) {
        console.error('Error removing category budget:', error);
        return NextResponse.json({ error: 'Failed to remove category' }, { status: 500 });
      }

      return NextResponse.json({ success: true, ...(await fetchAllData(user.id, toolId)) });
    }

    if (action === 'addExpense' || action === 'updateExpense') {
      if (!eventId || !categoryId) {
        return NextResponse.json({ error: 'Event and category are required' }, { status: 400 });
      }

      const normalized = normalizeVendorSplits(vendorId, amount, vendorSplits);
      if ('error' in normalized) {
        return NextResponse.json({ error: normalized.error }, { status: 400 });
      }

      if (!(await verifyEventOwnership(eventId, user.id, toolId))) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }

      const primaryVendorId = normalized.parts[0].vendorId;

      if (action === 'addExpense') {
        const { data: created, error } = await supabaseServer
          .from('tools_ebp_expenses')
          .insert({
            event_id: eventId,
            category_id: categoryId,
            vendor_id: primaryVendorId,
            expense_date: expenseDate || todayIso(),
            amount: normalized.total,
            note: (note ?? '').trim(),
          })
          .select('id')
          .single();

        if (error || !created) {
          console.error('Error adding expense:', error);
          return NextResponse.json({ error: 'Failed to add expense' }, { status: 500 });
        }

        try {
          await replaceExpenseSplits(created.id, normalized.parts);
        } catch (splitError: unknown) {
          console.error('Error adding expense splits:', splitError);
          return NextResponse.json(
            { error: splitError instanceof Error ? splitError.message : 'Failed to save expense splits' },
            { status: 500 }
          );
        }
      } else {
        if (!expenseId) {
          return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 });
        }

        const { error } = await supabaseServer
          .from('tools_ebp_expenses')
          .update({
            category_id: categoryId,
            vendor_id: primaryVendorId,
            expense_date: expenseDate || todayIso(),
            amount: normalized.total,
            note: (note ?? '').trim(),
          })
          .eq('id', expenseId)
          .eq('event_id', eventId);

        if (error) {
          console.error('Error updating expense:', error);
          return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
        }

        try {
          await replaceExpenseSplits(expenseId, normalized.parts);
        } catch (splitError: unknown) {
          console.error('Error updating expense splits:', splitError);
          return NextResponse.json(
            { error: splitError instanceof Error ? splitError.message : 'Failed to save expense splits' },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({ success: true, ...(await fetchAllData(user.id, toolId)) });
    }

    if (action === 'deleteExpense') {
      if (!eventId || !expenseId) {
        return NextResponse.json({ error: 'Event ID and expense ID are required' }, { status: 400 });
      }

      if (!(await verifyEventOwnership(eventId, user.id, toolId))) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }

      const { error } = await supabaseServer
        .from('tools_ebp_expenses')
        .delete()
        .eq('id', expenseId)
        .eq('event_id', eventId);

      if (error) {
        console.error('Error deleting expense:', error);
        return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
      }

      return NextResponse.json({ success: true, ...(await fetchAllData(user.id, toolId)) });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Error in POST /api/tools/event-budget-planner:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
