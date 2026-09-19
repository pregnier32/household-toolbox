import { supabaseServer } from '@/lib/supabaseServer';
import { refreshUserStorageUsage } from '@/lib/user-storage';

export const EBP_BUCKET = 'event-budget-planner';

export type EbpAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

export function isMissingRelationError(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === '42P01' || (error?.message || '').toLowerCase().includes('does not exist');
}

export function extractEbpStoragePath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) return fileUrl;
  try {
    const url = new URL(fileUrl);
    const marker = `${EBP_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export async function removeEbpStorageFiles(fileUrls: Array<string | null | undefined>, userId: string): Promise<void> {
  const paths = [...new Set(fileUrls.map(extractEbpStoragePath).filter((path): path is string => Boolean(path)))];
  if (paths.length === 0) return;
  await supabaseServer.storage.from(EBP_BUCKET).remove(paths);
  await refreshUserStorageUsage(userId);
}

export function mapEbpAttachment(row: {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
}): EbpAttachment {
  return {
    id: row.id,
    name: row.file_name,
    size: row.file_size,
    type: row.file_type,
  };
}

export async function attachmentsByEventIds(eventIds: string[], userId: string) {
  const map: Record<string, EbpAttachment[]> = {};
  if (eventIds.length === 0) return map;

  const { data, error } = await supabaseServer
    .from('tools_ebp_event_attachments')
    .select('id, event_id, file_name, file_size, file_type')
    .eq('user_id', userId)
    .in('event_id', eventIds)
    .order('created_at', { ascending: true });

  if (error) {
    if (!isMissingRelationError(error)) console.error('Error fetching EBP event attachments:', error);
    return map;
  }

  (data || []).forEach((row) => {
    if (!map[row.event_id]) map[row.event_id] = [];
    map[row.event_id].push(mapEbpAttachment(row));
  });
  return map;
}

export async function attachmentsByExpenseIds(expenseIds: string[], userId: string) {
  const map: Record<string, EbpAttachment[]> = {};
  if (expenseIds.length === 0) return map;

  const { data, error } = await supabaseServer
    .from('tools_ebp_expense_attachments')
    .select('id, expense_id, file_name, file_size, file_type')
    .eq('user_id', userId)
    .in('expense_id', expenseIds)
    .order('created_at', { ascending: true });

  if (error) {
    if (!isMissingRelationError(error)) console.error('Error fetching EBP expense attachments:', error);
    return map;
  }

  (data || []).forEach((row) => {
    if (!map[row.expense_id]) map[row.expense_id] = [];
    map[row.expense_id].push(mapEbpAttachment(row));
  });
  return map;
}

export async function loadOwnedEvent(eventId: string, userId: string, toolId?: string | null) {
  let query = supabaseServer
    .from('tools_ebp_events')
    .select('id, is_active')
    .eq('id', eventId)
    .eq('user_id', userId);
  if (toolId) query = query.eq('tool_id', toolId);
  const { data, error } = await query.single();
  if (error || !data) return null;
  return data;
}

export async function loadOwnedExpense(expenseId: string, userId: string, toolId?: string | null) {
  const { data: expense, error } = await supabaseServer
    .from('tools_ebp_expenses')
    .select('id, event_id')
    .eq('id', expenseId)
    .single();
  if (error || !expense) return null;
  const event = await loadOwnedEvent(expense.event_id, userId, toolId);
  if (!event) return null;
  return { ...expense, is_active: event.is_active };
}

export async function deleteExpenseStorageFiles(expenseId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseServer
    .from('tools_ebp_expense_attachments')
    .select('file_url')
    .eq('expense_id', expenseId)
    .eq('user_id', userId);
  if (error) {
    if (!isMissingRelationError(error)) console.error('Error loading EBP expense files for delete:', error);
    return;
  }
  await removeEbpStorageFiles((data || []).map((row) => row.file_url), userId);
}

export async function deleteEventStorageFiles(eventId: string, userId: string): Promise<void> {
  const urls: Array<string | null> = [];

  const { data: eventFiles, error: eventError } = await supabaseServer
    .from('tools_ebp_event_attachments')
    .select('file_url')
    .eq('event_id', eventId)
    .eq('user_id', userId);
  if (eventError) {
    if (!isMissingRelationError(eventError)) console.error('Error loading EBP event files for delete:', eventError);
  } else {
    urls.push(...(eventFiles || []).map((row) => row.file_url));
  }

  const { data: expenses } = await supabaseServer.from('tools_ebp_expenses').select('id').eq('event_id', eventId);
  const expenseIds = (expenses || []).map((row) => row.id);
  if (expenseIds.length > 0) {
    const { data: expenseFiles, error: expenseError } = await supabaseServer
      .from('tools_ebp_expense_attachments')
      .select('file_url')
      .eq('user_id', userId)
      .in('expense_id', expenseIds);
    if (expenseError) {
      if (!isMissingRelationError(expenseError)) console.error('Error loading EBP expense files for event delete:', expenseError);
    } else {
      urls.push(...(expenseFiles || []).map((row) => row.file_url));
    }
  }

  await removeEbpStorageFiles(urls, userId);
}
