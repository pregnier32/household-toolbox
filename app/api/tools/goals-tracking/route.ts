import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

// Copy default categories to user when they have none
async function copyDefaultsToUser(userId: string, toolId: string) {
  const { data: existing } = await supabaseServer
    .from('tools_gt_categories')
    .select('id')
    .eq('user_id', userId)
    .eq('tool_id', toolId)
    .limit(1);

  if (existing && existing.length > 0) return;

  const { data: defaults } = await supabaseServer
    .from('tools_gt_default_categories')
    .select('*')
    .order('display_order', { ascending: true });

  if (!defaults?.length) return;

  await supabaseServer.from('tools_gt_categories').insert(
    defaults.map((d, i) => ({
      user_id: userId,
      tool_id: toolId,
      name: d.name,
      card_color: d.card_color,
      display_order: i,
    }))
  );
}

// Map DB goal row + phases/tasks/notes to UI Goal shape
function mapGoalRow(
  g: {
    id: string;
    category_id: string;
    title: string;
    description: string | null;
    target_date: string | null;
    priority: string;
    status: string;
    percent_complete: number;
    show_on_dashboard: boolean;
    reminder_days: number | null;
    last_update_date: string | null;
    use_task_progress_for_percent: boolean;
  },
  phases: { id: string; goal_id: string; name: string; display_order: number }[],
  tasks: { id: string; phase_id: string; goal_id: string; title: string; completed: boolean }[],
  notes: { id: string; goal_id: string; note_date: string; note: string }[]
) {
  return {
    id: g.id,
    categoryId: g.category_id,
    title: g.title,
    description: g.description ?? '',
    targetDate: g.target_date ?? '',
    priority: g.priority as 'High' | 'Medium' | 'Low',
    status: g.status as 'Not Started' | 'In Progress' | 'Delayed' | 'Completed',
    percentComplete: g.percent_complete ?? 0,
    showOnDashboard: !!g.show_on_dashboard,
    reminderDays: g.reminder_days ?? null,
    lastUpdateDate: g.last_update_date ?? null,
    useTaskProgressForPercent: !!g.use_task_progress_for_percent,
    phases: phases
      .filter((p) => p.goal_id === g.id)
      .sort((a, b) => a.display_order - b.display_order)
      .map((p) => ({
        id: p.id,
        goalId: p.goal_id,
        name: p.name,
        order: p.display_order,
      })),
    tasks: tasks
      .filter((t) => t.goal_id === g.id)
      .map((t) => ({
        id: t.id,
        phaseId: t.phase_id,
        title: t.title,
        completed: !!t.completed,
      })),
    updateNotes: notes
      .filter((n) => n.goal_id === g.id)
      .map((n) => ({
        id: n.id,
        goalId: n.goal_id,
        noteDate: n.note_date,
        note: n.note ?? '',
      })),
  };
}

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const toolId = searchParams.get('toolId');

  if (!toolId) {
    return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
  }

  try {
    await copyDefaultsToUser(user.id, toolId);

    const { data: categories, error: catError } = await supabaseServer
      .from('tools_gt_categories')
      .select('id, name, card_color, display_order')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .order('display_order', { ascending: true });

    if (catError) {
      console.error('Error fetching categories:', catError);
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
    }

    const { data: goalsRows, error: goalsError } = await supabaseServer
      .from('tools_gt_goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('tool_id', toolId)
      .order('created_at', { ascending: true });

    if (goalsError) {
      console.error('Error fetching goals:', goalsError);
      return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 });
    }

    const categoryIds = (categories ?? []).map((c: { id: string }) => c.id);
    const goalIds = (goalsRows ?? []).map((g: { id: string }) => g.id);

    let phases: { id: string; goal_id: string; name: string; display_order: number }[] = [];
    let tasks: { id: string; phase_id: string; goal_id: string; title: string; completed: boolean }[] = [];
    let notes: { id: string; goal_id: string; note_date: string; note: string }[] = [];

    if (goalIds.length > 0) {
      const [phasesRes, tasksRes, notesRes] = await Promise.all([
        supabaseServer.from('tools_gt_phases').select('id, goal_id, name, display_order').in('goal_id', goalIds),
        supabaseServer.from('tools_gt_tasks').select('id, phase_id, goal_id, title, completed').in('goal_id', goalIds),
        supabaseServer.from('tools_gt_update_notes').select('id, goal_id, note_date, note').in('goal_id', goalIds),
      ]);
      phases = (phasesRes.data ?? []) as typeof phases;
      tasks = (tasksRes.data ?? []) as typeof tasks;
      notes = (notesRes.data ?? []) as typeof notes;
    }

    const goals = (goalsRows ?? []).map((g: Record<string, unknown>) =>
      mapGoalRow(
        g as Parameters<typeof mapGoalRow>[0],
        phases,
        tasks,
        notes
      )
    );

    return NextResponse.json({
      categories: (categories ?? []).map((c: { id: string; name: string; card_color: string }) => ({
        id: c.id,
        name: c.name,
        card_color: c.card_color || '#10b981',
      })),
      goals,
    });
  } catch (err) {
    console.error('Goals tracking GET error:', err);
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
      resource: 'category' | 'goal' | 'phase' | 'task' | 'update_note';
      action: 'create' | 'update' | 'delete';
      toolId?: string;
    };

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    if (resource === 'category') {
      if (action === 'create') {
        const { name, card_color, display_order } = body as { name: string; card_color?: string; display_order?: number };
        if (!name?.trim()) {
          return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
        }
        const { data, error } = await supabaseServer
          .from('tools_gt_categories')
          .insert({
            user_id: user.id,
            tool_id: toolId,
            name: name.trim(),
            card_color: card_color || '#10b981',
            display_order: display_order ?? 0,
          })
          .select()
          .single();
        if (error) {
          console.error('Error creating category:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({
          category: { id: data.id, name: data.name, card_color: data.card_color || '#10b981' },
        });
      }
      if (action === 'update') {
        const { categoryId, name, card_color } = body as { categoryId: string; name?: string; card_color?: string };
        if (!categoryId) {
          return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
        }
        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = name.trim();
        if (card_color !== undefined) updates.card_color = card_color;
        const { data, error } = await supabaseServer
          .from('tools_gt_categories')
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
          category: { id: data.id, name: data.name, card_color: data.card_color || '#10b981' },
        });
      }
      if (action === 'delete') {
        const { categoryId } = body as { categoryId: string };
        if (!categoryId) {
          return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
        }
        const { error } = await supabaseServer
          .from('tools_gt_categories')
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

    if (resource === 'goal') {
      if (action === 'create') {
        const {
          categoryId,
          title,
          description,
          targetDate,
          priority,
          status,
        } = body as {
          categoryId: string;
          title: string;
          description?: string;
          targetDate?: string;
          priority?: string;
          status?: string;
        };
        if (!categoryId || !title?.trim()) {
          return NextResponse.json({ error: 'Category and title are required' }, { status: 400 });
        }
        const { data, error } = await supabaseServer
          .from('tools_gt_goals')
          .insert({
            user_id: user.id,
            tool_id: toolId,
            category_id: categoryId,
            title: title.trim(),
            description: description ?? '',
            target_date: targetDate || null,
            priority: priority || 'Medium',
            status: status || 'Not Started',
          })
          .select()
          .single();
        if (error) {
          console.error('Error creating goal:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({
          goal: mapGoalRow(
            data as Parameters<typeof mapGoalRow>[0],
            [],
            [],
            []
          ),
        });
      }
      if (action === 'update') {
        const {
          goalId,
          title,
          description,
          targetDate,
          priority,
          status,
          percentComplete,
          showOnDashboard,
          reminderDays,
          useTaskProgressForPercent,
        } = body as {
          goalId: string;
          title?: string;
          description?: string;
          targetDate?: string;
          priority?: string;
          status?: string;
          percentComplete?: number;
          showOnDashboard?: boolean;
          reminderDays?: number | null;
          useTaskProgressForPercent?: boolean;
        };
        if (!goalId) {
          return NextResponse.json({ error: 'Goal ID is required' }, { status: 400 });
        }
        const updates: Record<string, unknown> = {};
        if (title !== undefined) updates.title = title.trim();
        if (description !== undefined) updates.description = description;
        if (targetDate !== undefined) updates.target_date = targetDate || null;
        if (priority !== undefined) updates.priority = priority;
        if (status !== undefined) updates.status = status;
        if (percentComplete !== undefined) updates.percent_complete = percentComplete;
        if (showOnDashboard !== undefined) updates.show_on_dashboard = showOnDashboard;
        if (reminderDays !== undefined) updates.reminder_days = reminderDays;
        if (useTaskProgressForPercent !== undefined) updates.use_task_progress_for_percent = useTaskProgressForPercent;
        const { data, error } = await supabaseServer
          .from('tools_gt_goals')
          .update(updates)
          .eq('id', goalId)
          .eq('user_id', user.id)
          .eq('tool_id', toolId)
          .select()
          .single();
        if (error) {
          console.error('Error updating goal:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        const { data: phases } = await supabaseServer.from('tools_gt_phases').select('*').eq('goal_id', goalId);
        const { data: tasks } = await supabaseServer.from('tools_gt_tasks').select('*').eq('goal_id', goalId);
        const { data: notes } = await supabaseServer.from('tools_gt_update_notes').select('*').eq('goal_id', goalId);
        return NextResponse.json({
          goal: mapGoalRow(
            data as Parameters<typeof mapGoalRow>[0],
            (phases ?? []) as Parameters<typeof mapGoalRow>[1],
            (tasks ?? []) as Parameters<typeof mapGoalRow>[2],
            (notes ?? []) as Parameters<typeof mapGoalRow>[3]
          ),
        });
      }
      if (action === 'delete') {
        const { goalId } = body as { goalId: string };
        if (!goalId) {
          return NextResponse.json({ error: 'Goal ID is required' }, { status: 400 });
        }
        const { error } = await supabaseServer
          .from('tools_gt_goals')
          .delete()
          .eq('id', goalId)
          .eq('user_id', user.id)
          .eq('tool_id', toolId);
        if (error) {
          console.error('Error deleting goal:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }
    }

    if (resource === 'phase') {
      if (action === 'create') {
        const { goalId, name, display_order } = body as { goalId: string; name: string; display_order?: number };
        if (!goalId || !name?.trim()) {
          return NextResponse.json({ error: 'Goal ID and name are required' }, { status: 400 });
        }
        const { data, error } = await supabaseServer
          .from('tools_gt_phases')
          .insert({
            goal_id: goalId,
            name: name.trim(),
            display_order: display_order ?? 0,
          })
          .select()
          .single();
        if (error) {
          console.error('Error creating phase:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({
          phase: {
            id: data.id,
            goalId: data.goal_id,
            name: data.name,
            order: data.display_order,
          },
        });
      }
      if (action === 'update') {
        const { phaseId, name, display_order } = body as { phaseId: string; name?: string; display_order?: number };
        if (!phaseId) {
          return NextResponse.json({ error: 'Phase ID is required' }, { status: 400 });
        }
        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = name.trim();
        if (display_order !== undefined) updates.display_order = display_order;
        const { data, error } = await supabaseServer
          .from('tools_gt_phases')
          .update(updates)
          .eq('id', phaseId)
          .select()
          .single();
        if (error) {
          console.error('Error updating phase:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({
          phase: {
            id: data.id,
            goalId: data.goal_id,
            name: data.name,
            order: data.display_order,
          },
        });
      }
      if (action === 'delete') {
        const { phaseId } = body as { phaseId: string };
        if (!phaseId) {
          return NextResponse.json({ error: 'Phase ID is required' }, { status: 400 });
        }
        const { error } = await supabaseServer.from('tools_gt_phases').delete().eq('id', phaseId);
        if (error) {
          console.error('Error deleting phase:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }
    }

    if (resource === 'task') {
      if (action === 'create') {
        const { phaseId, goalId, title } = body as { phaseId: string; goalId: string; title?: string };
        if (!phaseId || !goalId) {
          return NextResponse.json({ error: 'Phase ID and goal ID are required' }, { status: 400 });
        }
        const { data, error } = await supabaseServer
          .from('tools_gt_tasks')
          .insert({
            phase_id: phaseId,
            goal_id: goalId,
            title: (title && title.trim()) || 'New task',
            completed: false,
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
            phaseId: data.phase_id,
            title: data.title,
            completed: !!data.completed,
          },
        });
      }
      if (action === 'update') {
        const { taskId, title, completed } = body as { taskId: string; title?: string; completed?: boolean };
        if (!taskId) {
          return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
        }
        const updates: Record<string, unknown> = {};
        if (title !== undefined) updates.title = title.trim();
        if (completed !== undefined) updates.completed = completed;
        const { data, error } = await supabaseServer
          .from('tools_gt_tasks')
          .update(updates)
          .eq('id', taskId)
          .select()
          .single();
        if (error) {
          console.error('Error updating task:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({
          task: {
            id: data.id,
            phaseId: data.phase_id,
            title: data.title,
            completed: !!data.completed,
          },
        });
      }
      if (action === 'delete') {
        const { taskId } = body as { taskId: string };
        if (!taskId) {
          return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
        }
        const { error } = await supabaseServer.from('tools_gt_tasks').delete().eq('id', taskId);
        if (error) {
          console.error('Error deleting task:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }
    }

    if (resource === 'update_note') {
      if (action === 'create') {
        const { goalId, noteDate, note } = body as { goalId: string; noteDate: string; note: string };
        if (!goalId || !noteDate) {
          return NextResponse.json({ error: 'Goal ID and note date are required' }, { status: 400 });
        }
        const { data, error } = await supabaseServer
          .from('tools_gt_update_notes')
          .insert({
            goal_id: goalId,
            note_date: noteDate,
            note: note ?? '',
          })
          .select()
          .single();
        if (error) {
          console.error('Error creating update note:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        await supabaseServer
          .from('tools_gt_goals')
          .update({ last_update_date: noteDate })
          .eq('id', goalId)
          .eq('user_id', user.id);
        return NextResponse.json({
          note: {
            id: data.id,
            goalId: data.goal_id,
            noteDate: data.note_date,
            note: data.note ?? '',
          },
        });
      }
      if (action === 'update') {
        const { noteId, goalId, noteDate, note } = body as {
          noteId: string;
          goalId: string;
          noteDate?: string;
          note?: string;
        };
        if (!noteId) {
          return NextResponse.json({ error: 'Note ID is required' }, { status: 400 });
        }
        const updates: Record<string, unknown> = {};
        if (noteDate !== undefined) updates.note_date = noteDate;
        if (note !== undefined) updates.note = note;
        const { data, error } = await supabaseServer
          .from('tools_gt_update_notes')
          .update(updates)
          .eq('id', noteId)
          .select()
          .single();
        if (error) {
          console.error('Error updating update note:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        if (noteDate !== undefined && goalId) {
          await supabaseServer
            .from('tools_gt_goals')
            .update({ last_update_date: noteDate })
            .eq('id', goalId)
            .eq('user_id', user.id);
        }
        return NextResponse.json({
          note: {
            id: data.id,
            goalId: data.goal_id,
            noteDate: data.note_date,
            note: data.note ?? '',
          },
        });
      }
      if (action === 'delete') {
        const { noteId } = body as { noteId: string };
        if (!noteId) {
          return NextResponse.json({ error: 'Note ID is required' }, { status: 400 });
        }
        const { error } = await supabaseServer.from('tools_gt_update_notes').delete().eq('id', noteId);
        if (error) {
          console.error('Error deleting update note:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ error: 'Invalid resource or action' }, { status: 400 });
  } catch (err) {
    console.error('Goals tracking POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
