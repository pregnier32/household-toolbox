import { supabaseServer } from '@/lib/supabaseServer';
import { refreshUserStorageUsage } from '@/lib/user-storage';

export const SHOPPING_LIST_BUCKET = 'shopping-list';

export type ShoppingListAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

export function isMissingRelationError(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === '42P01' || (error?.message || '').toLowerCase().includes('does not exist');
}

export function extractShoppingListStoragePath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) return fileUrl;
  try {
    const url = new URL(fileUrl);
    const marker = `${SHOPPING_LIST_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export async function removeShoppingListStorageFiles(
  fileUrls: Array<string | null | undefined>,
  userId: string
): Promise<void> {
  const paths = [...new Set(fileUrls.map(extractShoppingListStoragePath).filter((path): path is string => Boolean(path)))];
  if (paths.length === 0) return;
  await supabaseServer.storage.from(SHOPPING_LIST_BUCKET).remove(paths);
  await refreshUserStorageUsage(userId);
}

export function mapShoppingListAttachment(row: {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
}): ShoppingListAttachment {
  return {
    id: row.id,
    name: row.file_name,
    size: row.file_size,
    type: row.file_type,
  };
}

export async function attachmentsByListIds(listIds: string[], userId: string) {
  const map: Record<string, ShoppingListAttachment[]> = {};
  if (listIds.length === 0) return map;

  const { data, error } = await supabaseServer
    .from('tools_sl_list_attachments')
    .select('id, list_id, file_name, file_size, file_type')
    .eq('user_id', userId)
    .in('list_id', listIds)
    .order('created_at', { ascending: true });

  if (error) {
    if (!isMissingRelationError(error)) console.error('Error fetching shopping list attachments:', error);
    return map;
  }

  (data || []).forEach((row) => {
    if (!map[row.list_id]) map[row.list_id] = [];
    map[row.list_id].push(mapShoppingListAttachment(row));
  });
  return map;
}

export async function loadOwnedList(listId: string, userId: string, toolId?: string | null) {
  let query = supabaseServer
    .from('tools_sl_lists')
    .select('id')
    .eq('id', listId)
    .eq('user_id', userId);
  if (toolId) query = query.eq('tool_id', toolId);
  const { data, error } = await query.single();
  if (error || !data) return null;
  return data;
}

export async function deleteListStorageFiles(listId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseServer
    .from('tools_sl_list_attachments')
    .select('file_url')
    .eq('list_id', listId)
    .eq('user_id', userId);
  if (error) {
    if (!isMissingRelationError(error)) console.error('Error loading shopping list files for delete:', error);
    return;
  }
  await removeShoppingListStorageFiles((data || []).map((row) => row.file_url), userId);
}
