import { supabaseServer } from '@/lib/supabaseServer';
import { refreshUserStorageUsage } from '@/lib/user-storage';

export const CALENDAR_EVENTS_BUCKET = 'calendar-events';

export type CalendarEventAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

export function isMissingRelationError(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === '42P01' || (error?.message || '').toLowerCase().includes('does not exist');
}

export function extractCalendarEventsStoragePath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) return fileUrl;
  try {
    const url = new URL(fileUrl);
    const marker = `${CALENDAR_EVENTS_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export async function removeCalendarEventsStorageFiles(
  fileUrls: Array<string | null | undefined>,
  userId: string
): Promise<void> {
  const paths = [...new Set(fileUrls.map(extractCalendarEventsStoragePath).filter((path): path is string => Boolean(path)))];
  if (paths.length === 0) return;
  await supabaseServer.storage.from(CALENDAR_EVENTS_BUCKET).remove(paths);
  await refreshUserStorageUsage(userId);
}

export function mapCalendarEventAttachment(row: {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
}): CalendarEventAttachment {
  return {
    id: row.id,
    name: row.file_name,
    size: row.file_size,
    type: row.file_type,
  };
}

export async function attachmentsByEventIds(eventIds: string[], userId: string) {
  const map: Record<string, CalendarEventAttachment[]> = {};
  if (eventIds.length === 0) return map;

  const { data, error } = await supabaseServer
    .from('tools_ce_event_attachments')
    .select('id, event_id, file_name, file_size, file_type')
    .eq('user_id', userId)
    .in('event_id', eventIds)
    .order('created_at', { ascending: true });

  if (error) {
    if (!isMissingRelationError(error)) console.error('Error fetching calendar event attachments:', error);
    return map;
  }

  (data || []).forEach((row) => {
    if (!map[row.event_id]) map[row.event_id] = [];
    map[row.event_id].push(mapCalendarEventAttachment(row));
  });
  return map;
}

export async function loadOwnedEvent(eventId: string, userId: string, toolId?: string | null) {
  let query = supabaseServer
    .from('tools_ce_events')
    .select('id, is_active')
    .eq('id', eventId)
    .eq('user_id', userId);
  if (toolId) query = query.eq('tool_id', toolId);
  const { data, error } = await query.single();
  if (error || !data) return null;
  return data as { id: string; is_active: boolean | null };
}

export async function deleteEventStorageFiles(eventId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseServer
    .from('tools_ce_event_attachments')
    .select('file_url')
    .eq('event_id', eventId)
    .eq('user_id', userId);
  if (error) {
    if (!isMissingRelationError(error)) console.error('Error loading calendar event files for delete:', error);
    return;
  }
  await removeCalendarEventsStorageFiles((data || []).map((row) => row.file_url), userId);
}

export async function deleteCategoryEventStorageFiles(
  categoryId: string,
  userId: string,
  toolId: string
): Promise<void> {
  const { data: events, error: eventsError } = await supabaseServer
    .from('tools_ce_events')
    .select('id')
    .eq('category_id', categoryId)
    .eq('user_id', userId)
    .eq('tool_id', toolId);
  if (eventsError) {
    if (!isMissingRelationError(eventsError)) console.error('Error loading category events for file delete:', eventsError);
    return;
  }

  const eventIds = (events || []).map((row) => row.id);
  if (eventIds.length === 0) return;

  const { data, error } = await supabaseServer
    .from('tools_ce_event_attachments')
    .select('file_url')
    .eq('user_id', userId)
    .in('event_id', eventIds);
  if (error) {
    if (!isMissingRelationError(error)) console.error('Error loading category event files for delete:', error);
    return;
  }
  await removeCalendarEventsStorageFiles((data || []).map((row) => row.file_url), userId);
}
