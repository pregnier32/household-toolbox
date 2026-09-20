import { supabaseServer } from '@/lib/supabaseServer';
import { refreshUserStorageUsage } from '@/lib/user-storage';

export const ADDRESS_BOOK_BUCKET = 'address-book';

export type AddressBookAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
};

export function isMissingRelationError(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === '42P01' || (error?.message || '').toLowerCase().includes('does not exist');
}

export function extractAddressBookStoragePath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) return fileUrl;
  try {
    const url = new URL(fileUrl);
    const marker = `${ADDRESS_BOOK_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export async function removeAddressBookStorageFiles(
  fileUrls: Array<string | null | undefined>,
  userId: string
): Promise<void> {
  const paths = [...new Set(fileUrls.map(extractAddressBookStoragePath).filter((path): path is string => Boolean(path)))];
  if (paths.length === 0) return;
  await supabaseServer.storage.from(ADDRESS_BOOK_BUCKET).remove(paths);
  await refreshUserStorageUsage(userId);
}

export function mapAddressBookAttachment(row: {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
}): AddressBookAttachment {
  return {
    id: row.id,
    name: row.file_name,
    size: row.file_size,
    type: row.file_type,
  };
}

export async function attachmentsByAddressIds(addressIds: string[], userId: string) {
  const map: Record<string, AddressBookAttachment[]> = {};
  if (addressIds.length === 0) return map;

  const { data, error } = await supabaseServer
    .from('tools_ab_address_attachments')
    .select('id, address_id, file_name, file_size, file_type')
    .eq('user_id', userId)
    .in('address_id', addressIds)
    .order('created_at', { ascending: true });

  if (error) {
    if (!isMissingRelationError(error)) console.error('Error fetching address book attachments:', error);
    return map;
  }

  (data || []).forEach((row) => {
    if (!map[row.address_id]) map[row.address_id] = [];
    map[row.address_id].push(mapAddressBookAttachment(row));
  });
  return map;
}

export async function loadOwnedAddress(addressId: string, userId: string, toolId?: string | null) {
  let query = supabaseServer
    .from('tools_ab_addresses')
    .select('id, is_active')
    .eq('id', addressId)
    .eq('user_id', userId);
  if (toolId) query = query.eq('tool_id', toolId);
  const { data, error } = await query.single();
  if (error || !data) return null;
  return data as { id: string; is_active: boolean | null };
}

export async function deleteAddressStorageFiles(addressId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseServer
    .from('tools_ab_address_attachments')
    .select('file_url')
    .eq('address_id', addressId)
    .eq('user_id', userId);
  if (error) {
    if (!isMissingRelationError(error)) console.error('Error loading address files for delete:', error);
    return;
  }
  await removeAddressBookStorageFiles((data || []).map((row) => row.file_url), userId);
}
