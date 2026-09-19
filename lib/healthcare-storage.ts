import { supabaseServer } from '@/lib/supabaseServer';
import { refreshUserStorageUsage } from '@/lib/user-storage';

export const HEALTHCARE_BUCKET = 'healthcare-appt-history';

export type HealthcareAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

export function isMissingRelationError(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === '42P01' || (error?.message || '').toLowerCase().includes('does not exist');
}

export function isMissingColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  const msg = (error?.message || '').toLowerCase();
  return error?.code === '42703' || error?.code === 'PGRST204' || msg.includes('does not exist') || msg.includes('schema cache');
}

export function extractHealthcareStoragePath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) return fileUrl;
  try {
    const url = new URL(fileUrl);
    const marker = `${HEALTHCARE_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export async function removeHealthcareStorageFiles(
  fileUrls: Array<string | null | undefined>,
  userId: string
): Promise<void> {
  const paths = [...new Set(fileUrls.map(extractHealthcareStoragePath).filter((path): path is string => Boolean(path)))];
  if (paths.length === 0) return;
  await supabaseServer.storage.from(HEALTHCARE_BUCKET).remove(paths);
  await refreshUserStorageUsage(userId);
}

export function mapHealthcareAttachment(row: {
  id: string;
  file_name?: string | null;
  file_size?: number | null;
  file_type?: string | null;
}): HealthcareAttachment {
  return {
    id: row.id,
    name: row.file_name || 'attachment',
    size: row.file_size ?? 0,
    type: row.file_type || '',
  };
}

export async function attachmentsByRecordIds(recordIds: string[]) {
  const map: Record<string, HealthcareAttachment[]> = {};
  if (recordIds.length === 0) return map;

  const { data, error } = await supabaseServer
    .from('tools_hcah_documents')
    .select('id, record_id, file_name, file_size, file_type')
    .in('record_id', recordIds)
    .order('display_order', { ascending: true });

  if (error) {
    if (!isMissingRelationError(error)) console.error('Error fetching healthcare attachments:', error);
    return map;
  }

  (data || []).forEach((row) => {
    if (!map[row.record_id]) map[row.record_id] = [];
    map[row.record_id].push(mapHealthcareAttachment(row));
  });
  return map;
}

export async function loadOwnedRecord(recordId: string, userId: string, toolId?: string | null) {
  let query = supabaseServer
    .from('tools_hcah_records')
    .select('id')
    .eq('id', recordId)
    .eq('user_id', userId);
  if (toolId) query = query.eq('tool_id', toolId);
  const { data, error } = await query.single();
  if (error || !data) return null;
  return data;
}

export async function deleteRecordStorageFiles(recordId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseServer
    .from('tools_hcah_documents')
    .select('file_url')
    .eq('record_id', recordId);
  if (error) {
    if (!isMissingRelationError(error)) console.error('Error loading healthcare files for delete:', error);
    return;
  }
  await removeHealthcareStorageFiles((data || []).map((row) => row.file_url), userId);
}

export async function deleteHeaderRecordStorageFiles(headerId: string, userId: string): Promise<void> {
  const { data: records, error } = await supabaseServer
    .from('tools_hcah_records')
    .select('id')
    .eq('header_id', headerId)
    .eq('user_id', userId);
  if (error || !records?.length) return;
  const { data: docs, error: docsError } = await supabaseServer
    .from('tools_hcah_documents')
    .select('file_url')
    .in('record_id', records.map((row) => row.id));
  if (docsError) {
    if (!isMissingRelationError(docsError)) console.error('Error loading healthcare files for header delete:', docsError);
    return;
  }
  await removeHealthcareStorageFiles((docs || []).map((row) => row.file_url), userId);
}
