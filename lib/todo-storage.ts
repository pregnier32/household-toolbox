import { supabaseServer } from '@/lib/supabaseServer';
import { refreshUserStorageUsage } from '@/lib/user-storage';

export const TODO_BUCKET = 'to-do-list';

export function isMissingRelationError(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === '42P01' || (error?.message || '').toLowerCase().includes('does not exist');
}

export function extractTodoStoragePath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) return fileUrl;
  try {
    const url = new URL(fileUrl);
    const marker = `${TODO_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export async function removeTodoStorageFiles(fileUrls: Array<string | null | undefined>, userId: string): Promise<void> {
  const paths = fileUrls.map(extractTodoStoragePath).filter((path): path is string => Boolean(path));
  if (paths.length === 0) return;
  await supabaseServer.storage.from(TODO_BUCKET).remove(paths);
  await refreshUserStorageUsage(userId);
}

export async function loadOwnedTask(taskId: string, userId: string, toolId?: string | null) {
  let query = supabaseServer
    .from('tools_tdl_tasks')
    .select('id')
    .eq('id', taskId)
    .eq('user_id', userId);
  if (toolId) query = query.eq('tool_id', toolId);
  const { data, error } = await query.single();
  if (error || !data) return null;
  return data;
}

export async function deleteTaskStorageFiles(taskId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseServer
    .from('tools_tdl_attachments')
    .select('file_url')
    .eq('task_id', taskId)
    .eq('user_id', userId);
  if (error) {
    if (!isMissingRelationError(error)) console.error('Error loading to-do files for delete:', error);
    return;
  }
  await removeTodoStorageFiles((data || []).map((row) => row.file_url), userId);
}

export async function deleteCategoryTaskStorageFiles(categoryId: string, userId: string): Promise<void> {
  const { data: tasks, error: taskError } = await supabaseServer
    .from('tools_tdl_tasks')
    .select('id')
    .eq('category_id', categoryId)
    .eq('user_id', userId);
  if (taskError || !tasks?.length) return;
  const taskIds = tasks.map((task) => task.id);
  const { data, error } = await supabaseServer
    .from('tools_tdl_attachments')
    .select('file_url')
    .eq('user_id', userId)
    .in('task_id', taskIds);
  if (error) {
    if (!isMissingRelationError(error)) console.error('Error loading category to-do files for delete:', error);
    return;
  }
  await removeTodoStorageFiles((data || []).map((row) => row.file_url), userId);
}
