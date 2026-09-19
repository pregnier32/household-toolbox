import { supabaseServer } from '@/lib/supabaseServer';
import { refreshUserStorageUsage } from '@/lib/user-storage';

export const GOALS_TRACKING_BUCKET = 'goals-tracking';

export type GoalsTrackingAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

export function isMissingRelationError(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === '42P01' || (error?.message || '').toLowerCase().includes('does not exist');
}

export function extractGoalsTrackingStoragePath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) return fileUrl;
  try {
    const url = new URL(fileUrl);
    const marker = `${GOALS_TRACKING_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export async function removeGoalsTrackingStorageFiles(
  fileUrls: Array<string | null | undefined>,
  userId: string
): Promise<void> {
  const paths = [
    ...new Set(fileUrls.map(extractGoalsTrackingStoragePath).filter((path): path is string => Boolean(path))),
  ];
  if (paths.length === 0) return;
  await supabaseServer.storage.from(GOALS_TRACKING_BUCKET).remove(paths);
  await refreshUserStorageUsage(userId);
}

export function mapGoalsTrackingAttachment(row: {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
}): GoalsTrackingAttachment {
  return {
    id: row.id,
    name: row.file_name,
    size: row.file_size,
    type: row.file_type,
  };
}

export async function attachmentsByGoalIds(goalIds: string[], userId: string) {
  const map: Record<string, GoalsTrackingAttachment[]> = {};
  if (goalIds.length === 0) return map;

  const { data, error } = await supabaseServer
    .from('tools_gt_goal_attachments')
    .select('id, goal_id, file_name, file_size, file_type')
    .eq('user_id', userId)
    .in('goal_id', goalIds)
    .order('created_at', { ascending: true });

  if (error) {
    if (!isMissingRelationError(error)) console.error('Error fetching Goals Tracking goal attachments:', error);
    return map;
  }

  (data || []).forEach((row) => {
    if (!map[row.goal_id]) map[row.goal_id] = [];
    map[row.goal_id].push(mapGoalsTrackingAttachment(row));
  });
  return map;
}

export async function attachmentsByUpdateIds(noteIds: string[], userId: string) {
  const map: Record<string, GoalsTrackingAttachment[]> = {};
  if (noteIds.length === 0) return map;

  const { data, error } = await supabaseServer
    .from('tools_gt_update_attachments')
    .select('id, note_id, file_name, file_size, file_type')
    .eq('user_id', userId)
    .in('note_id', noteIds)
    .order('created_at', { ascending: true });

  if (error) {
    if (!isMissingRelationError(error)) console.error('Error fetching Goals Tracking update attachments:', error);
    return map;
  }

  (data || []).forEach((row) => {
    if (!map[row.note_id]) map[row.note_id] = [];
    map[row.note_id].push(mapGoalsTrackingAttachment(row));
  });
  return map;
}

export async function loadOwnedGoal(goalId: string, userId: string, toolId?: string | null) {
  let query = supabaseServer
    .from('tools_gt_goals')
    .select('id')
    .eq('id', goalId)
    .eq('user_id', userId);
  if (toolId) query = query.eq('tool_id', toolId);
  const { data, error } = await query.single();
  if (error || !data) return null;
  return data;
}

export async function loadOwnedUpdateNote(noteId: string, userId: string, toolId?: string | null) {
  const { data: note, error } = await supabaseServer
    .from('tools_gt_update_notes')
    .select('id, goal_id')
    .eq('id', noteId)
    .single();
  if (error || !note) return null;
  const goal = await loadOwnedGoal(note.goal_id, userId, toolId);
  if (!goal) return null;
  return note;
}

export async function deleteUpdateStorageFiles(noteId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseServer
    .from('tools_gt_update_attachments')
    .select('file_url')
    .eq('note_id', noteId)
    .eq('user_id', userId);
  if (error) {
    if (!isMissingRelationError(error)) console.error('Error loading Goals Tracking update files for delete:', error);
    return;
  }
  await removeGoalsTrackingStorageFiles((data || []).map((row) => row.file_url), userId);
}

export async function deleteGoalStorageFiles(goalId: string, userId: string): Promise<void> {
  const urls: Array<string | null> = [];

  const { data: goalFiles, error: goalError } = await supabaseServer
    .from('tools_gt_goal_attachments')
    .select('file_url')
    .eq('goal_id', goalId)
    .eq('user_id', userId);
  if (goalError) {
    if (!isMissingRelationError(goalError)) console.error('Error loading Goals Tracking goal files for delete:', goalError);
  } else {
    urls.push(...(goalFiles || []).map((row) => row.file_url));
  }

  const { data: notes } = await supabaseServer.from('tools_gt_update_notes').select('id').eq('goal_id', goalId);
  const noteIds = (notes || []).map((row) => row.id);
  if (noteIds.length > 0) {
    const { data: updateFiles, error: updateError } = await supabaseServer
      .from('tools_gt_update_attachments')
      .select('file_url')
      .eq('user_id', userId)
      .in('note_id', noteIds);
    if (updateError) {
      if (!isMissingRelationError(updateError)) {
        console.error('Error loading Goals Tracking update files for goal delete:', updateError);
      }
    } else {
      urls.push(...(updateFiles || []).map((row) => row.file_url));
    }
  }

  await removeGoalsTrackingStorageFiles(urls, userId);
}

export async function deleteCategoryStorageFiles(categoryId: string, userId: string): Promise<void> {
  const { data: goals, error } = await supabaseServer
    .from('tools_gt_goals')
    .select('id')
    .eq('category_id', categoryId)
    .eq('user_id', userId);
  if (error) {
    if (!isMissingRelationError(error)) console.error('Error loading Goals Tracking goals for category delete:', error);
    return;
  }
  for (const goal of goals || []) {
    await deleteGoalStorageFiles(goal.id, userId);
  }
}
