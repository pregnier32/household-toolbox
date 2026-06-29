import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
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

    const { data: categories, error } = await supabaseServer
      .from('tools_ebp_categories')
      .select('*')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
    }

    return NextResponse.json({ categories: categories || [] });
  } catch (error: unknown) {
    console.error('Error in GET /api/tools/event-budget-planner/categories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { categoryId, toolId, name, action } = body;

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    if (action === 'inactivate' && categoryId) {
      const { error } = await supabaseServer
        .from('tools_ebp_categories')
        .update({ is_active: false, date_inactivated: todayIso() })
        .eq('id', categoryId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error inactivating category:', error);
        return NextResponse.json({ error: 'Failed to inactivate category' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'activate' && categoryId) {
      const { error } = await supabaseServer
        .from('tools_ebp_categories')
        .update({ is_active: true, date_inactivated: null })
        .eq('id', categoryId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);

      if (error) {
        console.error('Error activating category:', error);
        return NextResponse.json({ error: 'Failed to activate category' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const trimmedName = String(name).trim();

    if (categoryId) {
      const { data: existing } = await supabaseServer
        .from('tools_ebp_categories')
        .select('id')
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .eq('name', trimmedName)
        .neq('id', categoryId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ error: 'A category with this name already exists' }, { status: 400 });
      }

      const { data: updated, error } = await supabaseServer
        .from('tools_ebp_categories')
        .update({ name: trimmedName })
        .eq('id', categoryId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .select()
        .single();

      if (error) {
        console.error('Error updating category:', error);
        return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
      }

      return NextResponse.json({ category: updated });
    }

    const { data: existing } = await supabaseServer
      .from('tools_ebp_categories')
      .select('id')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .eq('name', trimmedName)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'A category with this name already exists' }, { status: 400 });
    }

    const { data: created, error } = await supabaseServer
      .from('tools_ebp_categories')
      .insert({
        user_id: user.id,
        tool_id: toolId,
        name: trimmedName,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
    }

    return NextResponse.json({ category: created });
  } catch (error: unknown) {
    console.error('Error in POST /api/tools/event-budget-planner/categories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const toolId = searchParams.get('toolId');

    if (!categoryId || !toolId) {
      return NextResponse.json({ error: 'Category ID and Tool ID are required' }, { status: 400 });
    }

    const { data: budgets } = await supabaseServer
      .from('tools_ebp_event_category_budgets')
      .select('id')
      .eq('category_id', categoryId)
      .limit(1);

    if (budgets && budgets.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category that is used on events' },
        { status: 400 }
      );
    }

    const { data: expenses } = await supabaseServer
      .from('tools_ebp_expenses')
      .select('id')
      .eq('category_id', categoryId)
      .limit(1);

    if (expenses && expenses.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category that is used on expenses' },
        { status: 400 }
      );
    }

    const { error } = await supabaseServer
      .from('tools_ebp_categories')
      .delete()
      .eq('id', categoryId)
      .eq('user_id', user.id)
      .eq('tool_id', toolId);

    if (error) {
      console.error('Error deleting category:', error);
      return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error in DELETE /api/tools/event-budget-planner/categories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
