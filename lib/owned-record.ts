import { supabaseServer } from '@/lib/supabaseServer';

type Row = Record<string, unknown>;

type LooseQuery = {
  select: (columns?: string) => LooseQuery;
  eq: (column: string, value: unknown) => LooseQuery;
  in: (column: string, values: readonly unknown[]) => LooseQuery;
  maybeSingle: () => Promise<{ data: Row | null; error: { message?: string } | null }>;
  then: PromiseLike<{ data: Row[] | null; error: { message?: string } | null }>['then'];
};

function from(table: string): LooseQuery {
  return (supabaseServer as unknown as { from: (name: string) => LooseQuery }).from(table);
}

export async function findOwnedRow(
  table: string,
  id: string,
  userId: string,
  options?: { toolId?: string | null; columns?: string }
): Promise<Row | null> {
  if (!id) return null;
  let query = from(table).select(options?.columns || 'id').eq('id', id).eq('user_id', userId);
  if (options?.toolId) query = query.eq('tool_id', options.toolId);
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function requireOwnedIds(
  table: string,
  ids: readonly string[],
  userId: string,
  options?: { toolId?: string | null }
): Promise<boolean> {
  const unique = [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))];
  if (unique.length === 0) return true;
  let query = from(table).select('id').in('id', unique).eq('user_id', userId);
  if (options?.toolId) query = query.eq('tool_id', options.toolId);
  const { data, error } = await query;
  if (error || !data) return false;
  return data.length === unique.length;
}

export async function findChildThroughOwnedParent(options: {
  childTable: string;
  childId: string;
  parentFk: string;
  parentTable: string;
  userId: string;
  toolId?: string | null;
  childColumns?: string;
}): Promise<{ child: Row; parentId: string } | null> {
  if (!options.childId) return null;
  const { data: child, error } = await from(options.childTable)
    .select(options.childColumns || `id, ${options.parentFk}`)
    .eq('id', options.childId)
    .maybeSingle();
  if (error || !child) return null;
  const parentId = String(child[options.parentFk] || '');
  if (!parentId) return null;
  const parent = await findOwnedRow(options.parentTable, parentId, options.userId, {
    toolId: options.toolId,
    columns: 'id',
  });
  if (!parent) return null;
  return { child, parentId };
}
