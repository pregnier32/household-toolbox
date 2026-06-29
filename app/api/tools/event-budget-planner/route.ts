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
      .map((e) => ({
        id: e.id,
        categoryId: e.category_id,
        date: e.expense_date,
        vendorId: e.vendor_id,
        amount: parseAmount(e.amount),
        note: e.note,
      })),
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
      if (!eventId || !categoryId || !vendorId) {
        return NextResponse.json({ error: 'Event, category, and vendor are required' }, { status: 400 });
      }

      const expenseAmount = parseAmount(amount);
      if (expenseAmount <= 0) {
        return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 });
      }

      if (!(await verifyEventOwnership(eventId, user.id, toolId))) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }

      if (action === 'addExpense') {
        const { error } = await supabaseServer.from('tools_ebp_expenses').insert({
          event_id: eventId,
          category_id: categoryId,
          vendor_id: vendorId,
          expense_date: expenseDate || todayIso(),
          amount: expenseAmount,
          note: (note ?? '').trim(),
        });

        if (error) {
          console.error('Error adding expense:', error);
          return NextResponse.json({ error: 'Failed to add expense' }, { status: 500 });
        }
      } else {
        if (!expenseId) {
          return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 });
        }

        const { error } = await supabaseServer
          .from('tools_ebp_expenses')
          .update({
            category_id: categoryId,
            vendor_id: vendorId,
            expense_date: expenseDate || todayIso(),
            amount: expenseAmount,
            note: (note ?? '').trim(),
          })
          .eq('id', expenseId)
          .eq('event_id', eventId);

        if (error) {
          console.error('Error updating expense:', error);
          return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
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
