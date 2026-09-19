import { supabaseServer } from '@/lib/supabaseServer';
import { refreshUserStorageUsage } from '@/lib/user-storage';

export const MEAL_PLANNER_BUCKET = 'meal-planner';

export type MealPlannerAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

export function isMissingRelationError(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === '42P01' || (error?.message || '').toLowerCase().includes('does not exist');
}

export function extractMealPlannerStoragePath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) return fileUrl;
  try {
    const url = new URL(fileUrl);
    const marker = `${MEAL_PLANNER_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export async function removeMealPlannerStorageFiles(
  fileUrls: Array<string | null | undefined>,
  userId: string
): Promise<void> {
  const paths = [...new Set(fileUrls.map(extractMealPlannerStoragePath).filter((path): path is string => Boolean(path)))];
  if (paths.length === 0) return;
  await supabaseServer.storage.from(MEAL_PLANNER_BUCKET).remove(paths);
  await refreshUserStorageUsage(userId);
}

export function mapMealPlannerAttachment(row: {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
}): MealPlannerAttachment {
  return {
    id: row.id,
    name: row.file_name,
    size: row.file_size,
    type: row.file_type,
  };
}

export async function attachmentsByMealIds(mealIds: string[], userId: string) {
  const map: Record<string, MealPlannerAttachment[]> = {};
  if (mealIds.length === 0) return map;

  const { data, error } = await supabaseServer
    .from('tools_mp_meal_attachments')
    .select('id, meal_id, file_name, file_size, file_type')
    .eq('user_id', userId)
    .in('meal_id', mealIds)
    .order('created_at', { ascending: true });

  if (error) {
    if (!isMissingRelationError(error)) console.error('Error fetching meal planner attachments:', error);
    return map;
  }

  (data || []).forEach((row) => {
    if (!map[row.meal_id]) map[row.meal_id] = [];
    map[row.meal_id].push(mapMealPlannerAttachment(row));
  });
  return map;
}

export async function loadOwnedMeal(mealId: string, userId: string, toolId?: string | null) {
  let query = supabaseServer
    .from('tools_mp_meals')
    .select('id')
    .eq('id', mealId)
    .eq('user_id', userId);
  if (toolId) query = query.eq('tool_id', toolId);
  const { data, error } = await query.single();
  if (error || !data) return null;
  return data;
}

export async function deleteMealStorageFiles(mealId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseServer
    .from('tools_mp_meal_attachments')
    .select('file_url')
    .eq('meal_id', mealId)
    .eq('user_id', userId);
  if (error) {
    if (!isMissingRelationError(error)) console.error('Error loading meal planner files for delete:', error);
    return;
  }
  await removeMealPlannerStorageFiles((data || []).map((row) => row.file_url), userId);
}
