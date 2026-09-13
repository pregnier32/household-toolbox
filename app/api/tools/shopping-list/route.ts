import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

type LineItemWrite = { itemId: string; quantity?: unknown; unit?: unknown };

function normalizeQuantity(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  return n;
}

function normalizeUnit(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 32) : null;
}

function lineItemsFromBody(itemIds?: string[], items?: LineItemWrite[]): LineItemWrite[] {
  if (items?.length) return items;
  return (itemIds ?? []).map((itemId) => ({ itemId }));
}

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  const msg = error?.message ?? '';
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('Could not find')
  );
}

type ListItemRow = {
  item_id: string;
  is_checked?: boolean;
  quantity?: number | null;
  unit?: string | null;
  tools_sl_items: { name: string; category?: string } | { name: string; category?: string }[] | null;
};

type MappedListItem = {
  itemId: string;
  name: string;
  category: string;
  isChecked: boolean;
  quantity: number | null;
  unit: string | null;
};

function mapListItemRows(rows: ListItemRow[]): MappedListItem[] {
  return rows.map((row) => {
    const related = row.tools_sl_items;
    const rel = related == null ? null : Array.isArray(related) ? related[0] : related;
    return {
      itemId: row.item_id,
      name: rel?.name ?? '',
      category: rel?.category ?? '',
      isChecked: !!row.is_checked,
      quantity: row.quantity == null ? null : Number(row.quantity),
      unit: row.unit ?? null,
    };
  });
}

const LIST_ITEM_SELECTS = [
  'item_id, is_checked, quantity, unit, tools_sl_items ( name, category )',
  'item_id, quantity, unit, tools_sl_items ( name, category )',
  'item_id, is_checked, tools_sl_items ( name, category )',
  'item_id, tools_sl_items ( name, category )',
];

async function fetchListLineItems(listId: string): Promise<MappedListItem[]> {
  for (const columns of LIST_ITEM_SELECTS) {
    const { data, error } = await supabaseServer
      .from('tools_sl_list_items')
      .select(columns)
      .eq('list_id', listId)
      .order('display_order', { ascending: true });
    if (!error) return mapListItemRows((data || []) as ListItemRow[]);
    if (!isMissingColumnError(error)) {
      console.error('Error fetching list items:', error);
      return [];
    }
  }
  return [];
}

type ListItemInsert = {
  list_id: string;
  item_id: string;
  display_order: number;
  is_checked: boolean;
  quantity: number | null;
  unit: string | null;
};

async function insertListLineItems(rows: ListItemInsert[]): Promise<string | null> {
  if (rows.length === 0) return null;
  const core = rows.map(({ list_id, item_id, display_order }) => ({ list_id, item_id, display_order }));
  const withQtyUnit = rows.map(({ list_id, item_id, display_order, quantity, unit }) => ({
    list_id,
    item_id,
    display_order,
    quantity,
    unit,
  }));
  const withChecked = rows.map(({ list_id, item_id, display_order, is_checked }) => ({
    list_id,
    item_id,
    display_order,
    is_checked,
  }));
  // Keep qty/unit on a path that does not depend on is_checked existing.
  const attempts: Record<string, unknown>[][] = [rows, withQtyUnit, withChecked, core];
  let lastMessage = 'Failed to save list items';
  for (const payload of attempts) {
    const { error } = await supabaseServer.from('tools_sl_list_items').insert(payload);
    if (!error) return null;
    lastMessage = error.message;
    if (!isMissingColumnError(error)) break;
  }
  console.error('Error inserting list items:', lastMessage);
  return lastMessage;
}

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
        items: { itemId: string; name: string; category: string; isChecked: boolean; quantity: number | null; unit: string | null }[];
      }[] = [];

      for (const list of lists || []) {
        const items = await fetchListLineItems(list.id);

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
      const { name, listDate, itemIds, items: itemWrites } = body as {
        name: string;
        listDate: string;
        itemIds?: string[];
        items?: LineItemWrite[];
      };
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

      const createItems = lineItemsFromBody(itemIds, itemWrites);
      if (createItems.length) {
        const insertError = await insertListLineItems(
          createItems.map((item, i: number) => ({
            list_id: list.id,
            item_id: item.itemId,
            display_order: i,
            is_checked: false,
            quantity: normalizeQuantity(item.quantity),
            unit: normalizeUnit(item.unit),
          }))
        );
        if (insertError) {
          return NextResponse.json({ error: insertError }, { status: 500 });
        }
      }

      return NextResponse.json({
        list: {
          id: list.id,
          name: list.name,
          date: list.list_date,
          isActive: true,
          showOnDashboard: false,
          items: createItems.map((item) => ({
            itemId: item.itemId,
            name: '',
            quantity: normalizeQuantity(item.quantity),
            unit: normalizeUnit(item.unit),
          })),
        },
      });
    }

    if (action === 'updateList') {
      const { listId, name, listDate, itemIds, items: itemWrites } = body as {
        listId: string;
        name?: string;
        listDate?: string;
        itemIds?: string[];
        items?: LineItemWrite[];
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

      if (itemIds !== undefined || itemWrites !== undefined) {
        const updateItems = lineItemsFromBody(itemIds, itemWrites);
        let existingRows: { item_id: string; is_checked?: boolean }[] | null = null;
        const existingFull = await supabaseServer
          .from('tools_sl_list_items')
          .select('item_id, is_checked')
          .eq('list_id', listId);
        if (!existingFull.error) {
          existingRows = existingFull.data;
        } else if (isMissingColumnError(existingFull.error)) {
          const existingCore = await supabaseServer
            .from('tools_sl_list_items')
            .select('item_id')
            .eq('list_id', listId);
          existingRows = existingCore.data;
        }
        const checkedByItem = new Map(
          (existingRows || []).map((row) => [row.item_id, !!row.is_checked])
        );
        await supabaseServer.from('tools_sl_list_items').delete().eq('list_id', listId);
        if (updateItems.length > 0) {
          const insertError = await insertListLineItems(
            updateItems.map((item, i: number) => ({
              list_id: listId,
              item_id: item.itemId,
              display_order: i,
              is_checked: checkedByItem.get(item.itemId) ?? false,
              quantity: normalizeQuantity(item.quantity),
              unit: normalizeUnit(item.unit),
            }))
          );
          if (insertError) {
            return NextResponse.json({ error: insertError }, { status: 500 });
          }
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

    if (action === 'reactivateList') {
      const { listId } = body as { listId: string };
      if (!listId) {
        return NextResponse.json({ error: 'List ID is required' }, { status: 400 });
      }
      const { error } = await supabaseServer
        .from('tools_sl_lists')
        .update({ is_active: true })
        .eq('id', listId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'setListItemChecked') {
      const { listId, itemId, isChecked } = body as { listId: string; itemId: string; isChecked: boolean };
      if (!listId || !itemId) {
        return NextResponse.json({ error: 'List ID and item ID are required' }, { status: 400 });
      }
      const { data: list, error: listErr } = await supabaseServer
        .from('tools_sl_lists')
        .select('id')
        .eq('id', listId)
        .eq('user_id', user.id)
        .eq('tool_id', toolId)
        .maybeSingle();
      if (listErr || !list) {
        return NextResponse.json({ error: 'List not found' }, { status: 404 });
      }
      const { error } = await supabaseServer
        .from('tools_sl_list_items')
        .update({ is_checked: !!isChecked })
        .eq('list_id', listId)
        .eq('item_id', itemId);
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
