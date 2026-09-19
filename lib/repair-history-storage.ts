import { supabaseServer } from '@/lib/supabaseServer';
import { refreshUserStorageUsage } from '@/lib/user-storage';

export const REPAIR_HISTORY_BUCKET = 'repair-history';

export type RepairHistoryAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

export function isMissingRelationError(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === '42P01' || (error?.message || '').toLowerCase().includes('does not exist');
}

export function extractRepairHistoryStoragePath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) return fileUrl;
  try {
    const url = new URL(fileUrl);
    const marker = `${REPAIR_HISTORY_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export async function removeRepairHistoryStorageFiles(
  fileUrls: Array<string | null | undefined>,
  userId: string
): Promise<void> {
  const paths = [...new Set(fileUrls.map(extractRepairHistoryStoragePath).filter((path): path is string => Boolean(path)))];
  if (paths.length === 0) return;
  await supabaseServer.storage.from(REPAIR_HISTORY_BUCKET).remove(paths);
  await refreshUserStorageUsage(userId);
}

export function mapRepairHistoryAttachment(row: {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
}): RepairHistoryAttachment {
  return {
    id: row.id,
    name: row.file_name,
    size: row.file_size,
    type: row.file_type,
  };
}

export async function attachmentsByRecordIds(recordIds: string[], userId: string) {
  const map: Record<string, RepairHistoryAttachment[]> = {};
  if (recordIds.length === 0) return map;

  const { data, error } = await supabaseServer
    .from('tools_rh_record_attachments')
    .select('id, record_id, file_name, file_size, file_type')
    .eq('user_id', userId)
    .in('record_id', recordIds)
    .order('created_at', { ascending: true });

  if (error) {
    if (!isMissingRelationError(error)) console.error('Error fetching repair history attachments:', error);
    return map;
  }

  (data || []).forEach((row) => {
    if (!map[row.record_id]) map[row.record_id] = [];
    map[row.record_id].push(mapRepairHistoryAttachment(row));
  });
  return map;
}

export async function loadOwnedRecord(recordId: string, userId: string, toolId?: string | null) {
  let query = supabaseServer
    .from('tools_rh_records')
    .select('id')
    .eq('id', recordId)
    .eq('user_id', userId);
  if (toolId) query = query.eq('tool_id', toolId);
  const { data, error } = await query.single();
  if (error || !data) return null;
  return data;
}

async function collectRecordFileUrls(recordIds: string[], userId: string): Promise<Array<string | null>> {
  if (recordIds.length === 0) return [];
  const urls: Array<string | null> = [];

  const { data: attachments, error: attachmentError } = await supabaseServer
    .from('tools_rh_record_attachments')
    .select('file_url')
    .eq('user_id', userId)
    .in('record_id', recordIds);
  if (attachmentError) {
    if (!isMissingRelationError(attachmentError)) console.error('Error loading repair history files for delete:', attachmentError);
  } else {
    urls.push(...(attachments || []).map((row) => row.file_url));
  }

  const { data: records } = await supabaseServer
    .from('tools_rh_records')
    .select('receipt_file_url, warranty_file_url')
    .eq('user_id', userId)
    .in('id', recordIds);
  (records || []).forEach((row) => {
    urls.push(row.receipt_file_url);
    urls.push(row.warranty_file_url);
  });

  const { data: pictures, error: pictureError } = await supabaseServer
    .from('tools_rh_repair_pictures')
    .select('file_url')
    .in('record_id', recordIds);
  if (pictureError) {
    if (!isMissingRelationError(pictureError)) console.error('Error loading repair pictures for delete:', pictureError);
  } else {
    urls.push(...(pictures || []).map((row) => row.file_url));
  }

  return urls;
}

export async function deleteRecordStorageFiles(recordId: string, userId: string): Promise<void> {
  const urls = await collectRecordFileUrls([recordId], userId);
  await removeRepairHistoryStorageFiles(urls, userId);
}

export async function deleteHeaderRecordStorageFiles(headerId: string, userId: string): Promise<void> {
  const { data: records, error } = await supabaseServer
    .from('tools_rh_records')
    .select('id')
    .eq('header_id', headerId)
    .eq('user_id', userId);
  if (error || !records?.length) return;
  const urls = await collectRecordFileUrls(records.map((row) => row.id), userId);
  await removeRepairHistoryStorageFiles(urls, userId);
}
