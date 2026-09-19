import { supabaseServer } from '@/lib/supabaseServer';
import { refreshUserStorageUsage } from '@/lib/user-storage';
import type { CleaningAttachment } from '@/lib/cleaning-schedule';

export const CLEANING_SCHEDULE_BUCKET = 'cleaning-schedule';

export function isMissingRelationError(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === '42P01' || (error?.message || '').toLowerCase().includes('does not exist');
}

export function extractCleaningStoragePath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) return fileUrl;
  try {
    const url = new URL(fileUrl);
    const marker = `${CLEANING_SCHEDULE_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export async function removeCleaningStorageFiles(fileUrls: Array<string | null | undefined>, userId: string): Promise<void> {
  const paths = fileUrls.map(extractCleaningStoragePath).filter((path): path is string => Boolean(path));
  if (paths.length === 0) return;
  await supabaseServer.storage.from(CLEANING_SCHEDULE_BUCKET).remove(paths);
  await refreshUserStorageUsage(userId);
}

export function mapCleaningAttachment(row: {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
}): CleaningAttachment {
  return {
    id: row.id,
    name: row.file_name,
    size: row.file_size,
    type: row.file_type,
  };
}

export async function attachmentsByItemIds(itemIds: string[], userId: string) {
  const map: Record<string, CleaningAttachment[]> = {};
  if (itemIds.length === 0) return map;

  const { data, error } = await supabaseServer
    .from('tools_cs_item_attachments')
    .select('id, item_id, file_name, file_size, file_type')
    .eq('user_id', userId)
    .in('item_id', itemIds)
    .order('created_at', { ascending: true });

  if (error) {
    if (!isMissingRelationError(error)) console.error('Error fetching cleaning item attachments:', error);
    return map;
  }

  (data || []).forEach((row) => {
    if (!map[row.item_id]) map[row.item_id] = [];
    map[row.item_id].push(mapCleaningAttachment(row));
  });
  return map;
}

export async function attachmentsByCompletionIds(completionIds: string[], userId: string) {
  const map: Record<string, CleaningAttachment[]> = {};
  if (completionIds.length === 0) return map;

  const { data, error } = await supabaseServer
    .from('tools_cs_completion_attachments')
    .select('id, completion_id, file_name, file_size, file_type')
    .eq('user_id', userId)
    .in('completion_id', completionIds)
    .order('created_at', { ascending: true });

  if (error) {
    if (!isMissingRelationError(error)) console.error('Error fetching cleaning completion attachments:', error);
    return map;
  }

  (data || []).forEach((row) => {
    if (!map[row.completion_id]) map[row.completion_id] = [];
    map[row.completion_id].push(mapCleaningAttachment(row));
  });
  return map;
}

export async function loadOwnedItem(itemId: string, userId: string, toolId?: string | null) {
  let query = supabaseServer
    .from('tools_cs_items')
    .select('id')
    .eq('id', itemId)
    .eq('user_id', userId);
  if (toolId) query = query.eq('tool_id', toolId);
  const { data, error } = await query.single();
  if (error || !data) return null;
  return data;
}

export async function loadOwnedCompletion(completionId: string, userId: string, toolId?: string | null) {
  let query = supabaseServer
    .from('tools_cs_completions')
    .select('id')
    .eq('id', completionId)
    .eq('user_id', userId);
  if (toolId) query = query.eq('tool_id', toolId);
  const { data, error } = await query.single();
  if (error || !data) return null;
  return data;
}

export async function deleteItemStorageFiles(itemId: string, userId: string): Promise<void> {
  const { data: itemFiles, error: itemError } = await supabaseServer
    .from('tools_cs_item_attachments')
    .select('file_url')
    .eq('item_id', itemId)
    .eq('user_id', userId);
  if (itemError && !isMissingRelationError(itemError)) {
    console.error('Error loading cleaning item files for delete:', itemError);
  }

  const urls = (itemFiles || []).map((row) => row.file_url);

  const { data: tasks, error: taskError } = await supabaseServer
    .from('tools_cs_tasks')
    .select('id')
    .eq('item_id', itemId)
    .eq('user_id', userId);
  if (taskError && !isMissingRelationError(taskError)) {
    console.error('Error loading cleaning tasks for item file delete:', taskError);
  }

  const taskIds = (tasks || []).map((task) => task.id);
  if (taskIds.length > 0) {
    const { data: completions, error: completionError } = await supabaseServer
      .from('tools_cs_completions')
      .select('id')
      .eq('user_id', userId)
      .in('task_id', taskIds);
    if (completionError && !isMissingRelationError(completionError)) {
      console.error('Error loading cleaning completions for item file delete:', completionError);
    }
    const completionIds = (completions || []).map((row) => row.id);
    if (completionIds.length > 0) {
      const { data: completionFiles, error: completionFileError } = await supabaseServer
        .from('tools_cs_completion_attachments')
        .select('file_url')
        .eq('user_id', userId)
        .in('completion_id', completionIds);
      if (completionFileError && !isMissingRelationError(completionFileError)) {
        console.error('Error loading cleaning completion files for item delete:', completionFileError);
      }
      urls.push(...(completionFiles || []).map((row) => row.file_url));
    }
  }

  await removeCleaningStorageFiles(urls, userId);
}

export async function deleteTaskCompletionStorageFiles(taskId: string, userId: string): Promise<void> {
  const { data: completions, error: completionError } = await supabaseServer
    .from('tools_cs_completions')
    .select('id')
    .eq('task_id', taskId)
    .eq('user_id', userId);
  if (completionError) {
    if (!isMissingRelationError(completionError)) {
      console.error('Error loading cleaning completions for task file delete:', completionError);
    }
    return;
  }

  const completionIds = (completions || []).map((row) => row.id);
  if (completionIds.length === 0) return;

  const { data, error } = await supabaseServer
    .from('tools_cs_completion_attachments')
    .select('file_url')
    .eq('user_id', userId)
    .in('completion_id', completionIds);
  if (error) {
    if (!isMissingRelationError(error)) console.error('Error loading cleaning completion files for task delete:', error);
    return;
  }
  await removeCleaningStorageFiles((data || []).map((row) => row.file_url), userId);
}
