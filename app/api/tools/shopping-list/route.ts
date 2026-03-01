import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

async function copyDefaultsToUser(userId: string, toolId: string) {
  const { data: existing } = await supabaseServer
    .from('tools_sl_items')
    .select('id')
    .eq('user_id', userId)
    .eq('tool_id', toolId)
    .limit(1);

  if (existing && existing.length > 0) return;

  const { data: defaults, error: defErr } = await supabaseServer
    .from('tools_sl_default_items')
    .select('category, name, display_order')
    .order('category', { ascending: true })
    .order('display_order', { ascending: true });

  if (defErr || !defaults?.length) return;

  let order = 0;
  const toInsert = defaults.map((d) => ({
    user_id: userId,
    tool_id: toolId,
    category: d.category,
    name: d.name,
    display_order: order++,
  }));

  await supabaseServer.from('tools_sl_items').insert(toInsert);
}

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const toolId = searchParams.get('toolId');
  const resource = searchParams.get('resource'); // 'items' | 'lists' | 'dashboard'

  if (!toolId) {
    return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
  }

  try {
    if (resource === 'dashboard') {
      const { data: lists, error } = await supabaseServer
        .from('tools_sl_lists')
        .select('id, name, list_date')
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .eq('show_on_dashboard', true)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching dashboard lists:', error);
        return NextResponse.json({ error: 'Failed to fetch lists' }, { status: 500 });
      }

      const summaries: { listId: string; name: string; date: string; itemCount: number }[] = [];
      for (const list of lists || []) {
        const { count } = await supabaseServer
          .from('tools_sl_list_items')
          .select('id', { count: 'exact', head: true })
          .eq('list_id', list.id);
        summaries.push({
          listId: list.id,
          name: list.name,
          date: list.list_date,
          itemCount: count ?? 0,
        });
      }
      return NextResponse.json({ summaries });
    }

    if (resource === 'items' || !resource) {
      const { data: userItems, error: itemsError } = await supabaseServer
        .from('tools_sl_items')
        .select('id, name, category, display_order')
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .order('category', { ascending: true })
        .order('display_order', { ascending: true });

      if (itemsError) {
        console.error('Error fetching items:', itemsError);
        return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
      }

      if (!userItems || userItems.length === 0) {
        await copyDefaultsToUser(user.id, toolId);
        const { data: reloaded, error: reloadErr } = await supabaseServer
          .from('tools_sl_items')
          .select('id, name, category, display_order')
          .eq('user_id', user.id)
          .eq('tool_id', toolId)
          .order('category', { ascending: true })
          .order('display_order', { ascending: true });

        if (reloadErr) {
          return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
        }
        return NextResponse.json({
          items: (reloaded || []).map((i) => ({ id: i.id, name: i.name, category: i.category })),
        });
      }

      return NextResponse.json({
        items: userItems.map((i) => ({ id: i.id, name: i.name, category: i.category })),
      });
    }

    if (resource === 'lists') {
      const { data: lists, error: listsError } = await supabaseServer
        .from('tools_sl_lists')
        .select('id, name, list_date, is_active, show_on_dashboard')
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .order('list_date', { ascending: false });

      if (listsError) {
        console.error('Error fetching lists:', listsError);
        return NextResponse.json({ error: 'Failed to fetch lists' }, { status: 500 });
      }

      const result: {
        id: string;
        name: string;
        date: string;
        isActive: boolean;
        showOnDashboard: boolean;
        items: { itemId: string; name: string }[];
      }[] = [];

      for (const list of lists || []) {
        const { data: listItemRows } = await supabaseServer
          .from('tools_sl_list_items')
          .select(`
            item_id,
            tools_sl_items ( name )
          `)
          .eq('list_id', list.id)
          .order('display_order', { ascending: true });

        const items = (listItemRows || []).map((row: { item_id: string; tools_sl_items: { name: string } | null }) => ({
          itemId: row.item_id,
          name: row.tools_sl_items?.name ?? '',
        }));

        result.push({
          id: list.id,
          name: list.name,
          date: list.list_date,
          isActive: !!list.is_active,
          showOnDashboard: !!list.show_on_dashboard,
          items,
        });
      }

      return NextResponse.json({ lists: result });
    }

    return NextResponse.json({ error: 'Invalid resource' }, { status: 400 });
  } catch (err) {
    console.error('Shopping list GET error:', err);
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
    const { action, toolId } = body as { action: string; toolId?: string };

    if (!toolId) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    if (action === 'copyDefaults') {
      await copyDefaultsToUser(user.id, toolId);
      return NextResponse.json({ success: true });
    }

    if (action === 'createList') {
      const { name, listDate, itemIds } = body as { name: string; listDate: string; itemIds: string[] };
      if (!name?.trim()) {
        return NextResponse.json({ error: 'List name is required' }, { status: 400 });
      }
      const { data: list, error: listError } = await supabaseServer
        .from('tools_sl_lists')
        .insert({
          user_id: user.id,
          tool_id: toolId,
          name: name.trim(),
          list_date: listDate || new Date().toISOString().split('T')[0],
          is_active: true,
          show_on_dashboard: false,
        })
        .select()
        .single();

      if (listError) {
        console.error('Error creating list:', listError);
        return NextResponse.json({ error: listError.message }, { status: 500 });
      }

      if (itemIds?.length) {
        const listItems = itemIds.map((itemId: string, i: number) => ({
          list_id: list.id,
          item_id: itemId,
          display_order: i,
        }));
        await supabaseServer.from('tools_sl_list_items').insert(listItems);
      }

      return NextResponse.json({
        list: {
          id: list.id,
          name: list.name,
          date: list.list_date,
          isActive: true,
          showOnDashboard: false,
          items: itemIds?.map((id: string) => ({ itemId: id, name: '' })) ?? [],
        },
      });
    }

    if (action === 'updateList') {
      const { listId, name, listDate, itemIds } = body as {
        listId: string;
        name?: string;
        listDate?: string;
        itemIds?: string[];
      };
      if (!listId) {
        return NextResponse.json({ error: 'List ID is required' }, { status: 400 });
      }

      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name.trim();
      if (listDate !== undefined) updates.list_date = listDate;

      if (Object.keys(updates).length > 0) {
        const { error: upErr } = await supabaseServer
          .from('tools_sl_lists')
          .update(updates)
          .eq('id', listId)
          .eq('user_id', user.id)
          .eq('tool_id', toolId);
        if (upErr) {
          return NextResponse.json({ error: upErr.message }, { status: 500 });
        }
      }

      if (itemIds !== undefined) {
        await supabaseServer.from('tools_sl_list_items').delete().eq('list_id', listId);
        if (itemIds.length > 0) {
          await supabaseServer.from('tools_sl_list_items').insert(
            itemIds.map((itemId: string, i: number) => ({
              list_id: listId,
              item_id: itemId,
              display_order: i,
            }))
          );
        }
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'deleteList') {
      const { listId } = body as { listId: string };
      if (!listId) {
        return NextResponse.json({ error: 'List ID is required' }, { status: 400 });
      }
      const { error } = await supabaseServer
        .from('tools_sl_lists')
        .delete()
        .eq('id', listId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'moveToHistory') {
      const { listId } = body as { listId: string };
      if (!listId) {
        return NextResponse.json({ error: 'List ID is required' }, { status: 400 });
      }
      const { error } = await supabaseServer
        .from('tools_sl_lists')
        .update({ is_active: false, show_on_dashboard: false })
        .eq('id', listId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'setShowOnDashboard') {
      const { listId, showOnDashboard } = body as { listId: string; showOnDashboard: boolean };
      if (!listId) {
        return NextResponse.json({ error: 'List ID is required' }, { status: 400 });
      }
      const { error } = await supabaseServer
        .from('tools_sl_lists')
        .update({ show_on_dashboard: !!showOnDashboard })
        .eq('id', listId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'createItem') {
      const { name, category } = body as { name: string; category: string };
      if (!name?.trim() || !category?.trim()) {
        return NextResponse.json({ error: 'Item name and category are required' }, { status: 400 });
      }
      const { data: maxOrder } = await supabaseServer
        .from('tools_sl_items')
        .select('display_order')
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .order('display_order', { ascending: false })
        .limit(1)
        .single();

      const displayOrder = (maxOrder?.display_order ?? -1) + 1;
      const { data: item, error } = await supabaseServer
        .from('tools_sl_items')
        .insert({
          user_id: user.id,
          tool_id: toolId,
          name: name.trim(),
          category: category.trim(),
          display_order: displayOrder,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({
        item: { id: item.id, name: item.name, category: item.category },
      });
    }

    if (action === 'updateItem') {
      const { itemId, name, category } = body as { itemId: string; name?: string; category?: string };
      if (!itemId) {
        return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
      }
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name.trim();
      if (category !== undefined) updates.category = category.trim();
      const { error } = await supabaseServer
        .from('tools_sl_items')
        .update(updates)
        .eq('id', itemId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'deleteItem') {
      const { itemId } = body as { itemId: string };
      if (!itemId) {
        return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
      }
      const { error } = await supabaseServer
        .from('tools_sl_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Shopping list POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
