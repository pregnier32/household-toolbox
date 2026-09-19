import { supabaseServer } from '@/lib/supabaseServer';
import { refreshUserStorageUsage } from '@/lib/user-storage';

export const HSA_BUCKET = 'hsa-tracker';

export type HsaAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

export function isMissingRelationError(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === '42P01' || (error?.message || '').toLowerCase().includes('does not exist');
}

export function extractHsaStoragePath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) return fileUrl;
  try {
    const url = new URL(fileUrl);
    const marker = `${HSA_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export async function removeHsaStorageFiles(fileUrls: Array<string | null | undefined>, userId: string): Promise<void> {
  const paths = fileUrls.map(extractHsaStoragePath).filter((path): path is string => Boolean(path));
  if (paths.length === 0) return;
  await supabaseServer.storage.from(HSA_BUCKET).remove(paths);
  await refreshUserStorageUsage(userId);
}

export function mapHsaAttachment(row: {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
}): HsaAttachment {
  return {
    id: row.id,
    name: row.file_name,
    size: row.file_size,
    type: row.file_type,
  };
}

export async function attachmentsByExpenseIds(expenseIds: string[], userId: string) {
  const map: Record<string, HsaAttachment[]> = {};
  if (expenseIds.length === 0) return map;

  const { data, error } = await supabaseServer
    .from('tools_hsa_expense_receipts')
    .select('id, expense_id, file_name, file_size, file_type')
    .eq('user_id', userId)
    .in('expense_id', expenseIds)
    .order('created_at', { ascending: true });

  if (error) {
    if (!isMissingRelationError(error)) console.error('Error fetching HSA receipts:', error);
    return map;
  }

  (data || []).forEach((row) => {
    if (!map[row.expense_id]) map[row.expense_id] = [];
    map[row.expense_id].push(mapHsaAttachment(row));
  });
  return map;
}

export async function loadOwnedExpense(expenseId: string, userId: string, toolId?: string | null) {
  let query = supabaseServer
    .from('tools_hsa_expenses')
    .select('id')
    .eq('id', expenseId)
    .eq('user_id', userId);
  if (toolId) query = query.eq('tool_id', toolId);
  const { data, error } = await query.single();
  if (error || !data) return null;
  return data;
}

export async function deleteExpenseStorageFiles(expenseId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseServer
    .from('tools_hsa_expense_receipts')
    .select('file_url')
    .eq('expense_id', expenseId)
    .eq('user_id', userId);
  if (error) {
    if (!isMissingRelationError(error)) console.error('Error loading HSA files for delete:', error);
    return;
  }
  await removeHsaStorageFiles((data || []).map((row) => row.file_url), userId);
}

export async function deleteAccountExpenseStorageFiles(accountId: string, userId: string): Promise<void> {
  const { data: expenses, error: expenseError } = await supabaseServer
    .from('tools_hsa_expenses')
    .select('id')
    .eq('account_id', accountId)
    .eq('user_id', userId);
  if (expenseError || !expenses?.length) return;

  const expenseIds = expenses.map((row) => row.id);
  const { data, error } = await supabaseServer
    .from('tools_hsa_expense_receipts')
    .select('file_url')
    .eq('user_id', userId)
    .in('expense_id', expenseIds);
  if (error) {
    if (!isMissingRelationError(error)) console.error('Error loading account HSA files for delete:', error);
    return;
  }
  await removeHsaStorageFiles((data || []).map((row) => row.file_url), userId);
}
