import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

async function copyDefaultsToUser(userId: string, toolId: string) {
  const { data: existing } = await supabaseServer
    .from('tools_tdl_categories')
    .select('id')
    .eq('user_id', userId)
    .eq('tool_id', toolId)
    .limit(1);

  if (existing && existing.length > 0) return;

  const { data: defaults } = await supabaseServer
    .from('tools_tdl_default_categories')
    .select('*')
    .order('display_order', { ascending: true });

  if (!defaults?.length) return;

  await supabaseServer
    .from('tools_tdl_categories')
    .insert(
      defaults.map((d) => ({
        user_id: userId,
        tool_id: toolId,
        name: d.name,
        card_color: d.card_color,
        show_on_dashboard: false,
      }))
    );
}

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const toolId = searchParams.get('toolId');
  const resource = searchParams.get('resource');
  const categoryId = searchParams.get('categoryId');

  if (!toolId) {
    return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
  }

  try {
    if (resource === 'dashboard') {
      const { data: categories } = await supabaseServer
        .from('tools_tdl_categories')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .eq('show_on_dashboard', true);

      if (!categories?.length) {
        return NextResponse.json({ items: [] });
      }

      const items: { categoryName: string; taskNames: string[] }[] = [];
      for (const cat of categories) {
        const { data: tasks } = await supabaseServer
          .from('tools_tdl_tasks')
          .select('task_name')
          .eq('category_id', cat.id)
          .neq('status', 'Completed');
        items.push({
          categoryName: cat.name,
          taskNames: (tasks || []).map((t) => t.task_name),
        });
      }
      return NextResponse.json({ items });
    }

    if (resource === 'categories' || !resource) {
      const { data: categories, error } = await supabaseServer
        .from('tools_tdl_categories')
        .select('*')
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching categories:', error);
        return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
      }

      if (!categories?.length) {
        await copyDefaultsToUser(user.id, toolId);
        const { data: reloaded } = await supabaseServer
          .from('tools_tdl_categories')
          .select('*')
          .eq('user_id', user.id)
          .eq('tool_id', toolId)
          .order('created_at', { ascending: true });
        const list = reloaded || [];
        return NextResponse.json({
          categories: list.map((c: { id: string; name: string; card_color: string | null; show_on_dashboard: boolean }) => ({
            id: c.id,
            name: c.name,
            card_color: c.card_color || '#10b981',
            showOnDashboard: !!c.show_on_dashboard,
          })),
        });
      }

      return NextResponse.json({
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          card_color: c.card_color || '#10b981',
          showOnDashboard: !!c.show_on_dashboard,
        })),
      });
    }

    if (resource === 'tasks' && categoryId) {
      const { data: tasks, error } = await supabaseServer
        .from('tools_tdl_tasks')
        .select('*')
        .eq('category_id', categoryId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching tasks:', error);
        return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
      }

      return NextResponse.json({
        tasks: (tasks || []).map((t) => ({
          id: t.id,
          categoryId: t.category_id,
          taskName: t.task_name,
          dueDate: t.due_date || '',
          priority: t.priority || 'Medium',
          notes: t.notes || '',
          status: t.status || 'Not Started',
        })),
      });
    }

    return NextResponse.json({ error: 'Invalid resource' }, { status: 400 });
  } catch (err) {
    console.error('To Do List GET error:', err);
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
    const { resource, action, toolId } = body as {
      resource: 'category' | 'task';
      action: 'create' | 'update' | 'delete';
      toolId?: string;
    };

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    if (resource === 'category') {
      if (action === 'create') {
        const { name, card_color } = body as { name: string; card_color?: string };
        if (!name?.trim()) {
          return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
        }
        const { data, error } = await supabaseServer
          .from('tools_tdl_categories')
          .insert({
            user_id: user.id,
            tool_id: toolId,
            name: name.trim(),
            card_color: card_color || '#10b981',
            show_on_dashboard: false,
          })
          .select()
          .single();
        if (error) {
          console.error('Error creating category:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({
          category: {
            id: data.id,
            name: data.name,
            card_color: data.card_color || '#10b981',
            showOnDashboard: !!data.show_on_dashboard,
          },
        });
      }

      if (action === 'update') {
        const { categoryId, name, card_color, show_on_dashboard } = body as {
          categoryId: string;
          name?: string;
          card_color?: string;
          show_on_dashboard?: boolean;
        };
        if (!categoryId) {
          return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
        }
        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = name.trim();
        if (card_color !== undefined) updates.card_color = card_color;
        if (show_on_dashboard !== undefined) updates.show_on_dashboard = show_on_dashboard;
        const { data, error } = await supabaseServer
          .from('tools_tdl_categories')
          .update(updates)
          .eq('id', categoryId)
          .eq('user_id', user.id)
          .eq('tool_id', toolId)
          .select()
          .single();
        if (error) {
          console.error('Error updating category:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({
          category: {
            id: data.id,
            name: data.name,
            card_color: data.card_color || '#10b981',
            showOnDashboard: !!data.show_on_dashboard,
          },
        });
      }

      if (action === 'delete') {
        const { categoryId } = body as { categoryId: string };
        if (!categoryId) {
          return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
        }
        const { error } = await supabaseServer
          .from('tools_tdl_categories')
          .delete()
          .eq('id', categoryId)
          .eq('user_id', user.id)
          .eq('tool_id', toolId);
        if (error) {
          console.error('Error deleting category:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }
    }

    if (resource === 'task') {
      if (action === 'create') {
        const { categoryId, task_name, due_date, priority, notes, status } = body as {
          categoryId: string;
          task_name: string;
          due_date?: string;
          priority?: string;
          notes?: string;
          status?: string;
        };
        if (!categoryId || !task_name?.trim()) {
          return NextResponse.json({ error: 'Category and task name are required' }, { status: 400 });
        }
        const { data, error } = await supabaseServer
          .from('tools_tdl_tasks')
          .insert({
            category_id: categoryId,
            user_id: user.id,
            tool_id: toolId,
            task_name: task_name.trim(),
            due_date: due_date || null,
            priority: priority || 'Medium',
            notes: notes || '',
            status: status || 'Not Started',
          })
          .select()
          .single();
        if (error) {
          console.error('Error creating task:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({
          task: {
            id: data.id,
            categoryId: data.category_id,
            taskName: data.task_name,
            dueDate: data.due_date || '',
            priority: data.priority || 'Medium',
            notes: data.notes || '',
            status: data.status || 'Not Started',
          },
        });
      }

      if (action === 'update') {
        const { taskId, task_name, due_date, priority, notes, status } = body as {
          taskId: string;
          task_name?: string;
          due_date?: string;
          priority?: string;
          notes?: string;
          status?: string;
        };
        if (!taskId) {
          return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
        }
        const updates: Record<string, unknown> = {};
        if (task_name !== undefined) updates.task_name = task_name.trim();
        if (due_date !== undefined) updates.due_date = due_date || null;
        if (priority !== undefined) updates.priority = priority;
        if (notes !== undefined) updates.notes = notes;
        if (status !== undefined) updates.status = status;
        const { data, error } = await supabaseServer
          .from('tools_tdl_tasks')
          .update(updates)
          .eq('id', taskId)
          .eq('user_id', user.id)
          .select()
          .single();
        if (error) {
          console.error('Error updating task:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({
          task: {
            id: data.id,
            categoryId: data.category_id,
            taskName: data.task_name,
            dueDate: data.due_date || '',
            priority: data.priority || 'Medium',
            notes: data.notes || '',
            status: data.status || 'Not Started',
          },
        });
      }

      if (action === 'delete') {
        const { taskId } = body as { taskId: string };
        if (!taskId) {
          return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
        }
        const { error } = await supabaseServer
          .from('tools_tdl_tasks')
          .delete()
          .eq('id', taskId)
          .eq('user_id', user.id);
        if (error) {
          console.error('Error deleting task:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ error: 'Invalid resource or action' }, { status: 400 });
  } catch (err) {
    console.error('To Do List POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
