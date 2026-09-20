import { supabaseServer } from '@/lib/supabaseServer';
import { refreshUserStorageUsage } from '@/lib/user-storage';

export const SUBSCRIPTION_TRACKER_BUCKET = 'subscription-tracker';

export type SubscriptionAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

export function isMissingRelationError(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === '42P01' || (error?.message || '').toLowerCase().includes('does not exist');
}

export function extractSubscriptionTrackerStoragePath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) return fileUrl;
  try {
    const url = new URL(fileUrl);
    const marker = `${SUBSCRIPTION_TRACKER_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export async function removeSubscriptionTrackerStorageFiles(
  fileUrls: Array<string | null | undefined>,
  userId: string
): Promise<void> {
  const paths = [...new Set(fileUrls.map(extractSubscriptionTrackerStoragePath).filter((path): path is string => Boolean(path)))];
  if (paths.length === 0) return;
  await supabaseServer.storage.from(SUBSCRIPTION_TRACKER_BUCKET).remove(paths);
  await refreshUserStorageUsage(userId);
}

export function mapSubscriptionAttachment(row: {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
}): SubscriptionAttachment {
  return {
    id: row.id,
    name: row.file_name,
    size: row.file_size,
    type: row.file_type,
  };
}

export async function attachmentsBySubscriptionIds(subscriptionIds: string[], userId: string) {
  const map: Record<string, SubscriptionAttachment[]> = {};
  if (subscriptionIds.length === 0) return map;

  const { data, error } = await supabaseServer
    .from('tools_st_subscription_attachments')
    .select('id, subscription_id, file_name, file_size, file_type')
    .eq('user_id', userId)
    .in('subscription_id', subscriptionIds)
    .order('created_at', { ascending: true });

  if (error) {
    if (!isMissingRelationError(error)) console.error('Error fetching subscription attachments:', error);
    return map;
  }

  (data || []).forEach((row) => {
    if (!map[row.subscription_id]) map[row.subscription_id] = [];
    map[row.subscription_id].push(mapSubscriptionAttachment(row));
  });
  return map;
}

export async function loadOwnedSubscription(subscriptionId: string, userId: string, toolId?: string | null) {
  let query = supabaseServer
    .from('tools_st_subscriptions')
    .select('id, is_active')
    .eq('id', subscriptionId)
    .eq('user_id', userId);
  if (toolId) query = query.eq('tool_id', toolId);
  const { data, error } = await query.single();
  if (error || !data) return null;
  return data as { id: string; is_active: boolean | null };
}

export async function deleteSubscriptionStorageFiles(subscriptionId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseServer
    .from('tools_st_subscription_attachments')
    .select('file_url')
    .eq('subscription_id', subscriptionId)
    .eq('user_id', userId);
  if (error) {
    if (!isMissingRelationError(error)) console.error('Error loading subscription files for delete:', error);
    return;
  }
  await removeSubscriptionTrackerStorageFiles((data || []).map((row) => row.file_url), userId);
}
