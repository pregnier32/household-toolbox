import { supabaseServer } from '@/lib/supabaseServer';
import { refreshUserStorageUsage } from '@/lib/user-storage';

export const TRAVEL_LOG_BUCKET = 'travel-log';

export type TravelLogAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

export function isMissingRelationError(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === '42P01' || (error?.message || '').toLowerCase().includes('does not exist');
}

export function extractTravelLogStoragePath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) return fileUrl;
  try {
    const url = new URL(fileUrl);
    const marker = `${TRAVEL_LOG_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export async function removeTravelLogStorageFiles(fileUrls: Array<string | null | undefined>, userId: string): Promise<void> {
  const paths = fileUrls.map(extractTravelLogStoragePath).filter((path): path is string => Boolean(path));
  if (paths.length === 0) return;
  await supabaseServer.storage.from(TRAVEL_LOG_BUCKET).remove(paths);
  await refreshUserStorageUsage(userId);
}

export function mapTravelLogAttachment(row: {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
}): TravelLogAttachment {
  return {
    id: row.id,
    name: row.file_name,
    size: row.file_size,
    type: row.file_type,
  };
}

export async function attachmentsByTripIds(tripIds: string[], userId: string) {
  const map: Record<string, TravelLogAttachment[]> = {};
  if (tripIds.length === 0) return map;

  const { data, error } = await supabaseServer
    .from('tools_tl_trip_attachments')
    .select('id, trip_id, file_name, file_size, file_type')
    .eq('user_id', userId)
    .in('trip_id', tripIds)
    .order('created_at', { ascending: true });

  if (error) {
    if (!isMissingRelationError(error)) console.error('Error fetching travel log attachments:', error);
    return map;
  }

  (data || []).forEach((row) => {
    if (!map[row.trip_id]) map[row.trip_id] = [];
    map[row.trip_id].push(mapTravelLogAttachment(row));
  });
  return map;
}

export async function loadOwnedTrip(tripId: string, userId: string, toolId?: string | null) {
  let query = supabaseServer
    .from('tools_tl_trips')
    .select('id')
    .eq('id', tripId)
    .eq('user_id', userId);
  if (toolId) query = query.eq('tool_id', toolId);
  const { data, error } = await query.single();
  if (error || !data) return null;
  return data;
}

export async function deleteTripStorageFiles(tripId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseServer
    .from('tools_tl_trip_attachments')
    .select('file_url')
    .eq('trip_id', tripId)
    .eq('user_id', userId);
  if (error) {
    if (!isMissingRelationError(error)) console.error('Error loading travel log files for delete:', error);
    return;
  }
  await removeTravelLogStorageFiles((data || []).map((row) => row.file_url), userId);
}
