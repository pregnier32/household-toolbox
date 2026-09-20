import { supabaseServer } from '@/lib/supabaseServer';
import { refreshUserStorageUsage } from '@/lib/user-storage';
import type { EolAttachment } from '@/lib/end-of-life-planner';

export const END_OF_LIFE_PLANNER_BUCKET = 'end-of-life-planner';

export type EolAttachmentStore = 'document' | 'insurance' | 'letter' | 'personal-item' | 'other';

const STORE = {
  document: {
    table: 'tools_eolp_document_attachments',
    ownerTable: 'tools_eolp_documents',
    ownerColumn: 'document_id',
    folder: 'documents',
  },
  insurance: {
    table: 'tools_eolp_insurance_attachments',
    ownerTable: 'tools_eolp_insurance',
    ownerColumn: 'insurance_id',
    folder: 'insurance',
  },
  letter: {
    table: 'tools_eolp_letter_attachments',
    ownerTable: 'tools_eolp_letters',
    ownerColumn: 'letter_id',
    folder: 'letters',
  },
  'personal-item': {
    table: 'tools_eolp_personal_item_attachments',
    ownerTable: 'tools_eolp_personal_items',
    ownerColumn: 'personal_item_id',
    folder: 'personal-items',
  },
  other: {
    table: 'tools_eolp_other_record_attachments',
    ownerTable: 'tools_eolp_other_records',
    ownerColumn: 'record_id',
    folder: 'other',
  },
} as const;

const TABLE_TO_STORE: Record<string, EolAttachmentStore> = {
  tools_eolp_documents: 'document',
  tools_eolp_insurance: 'insurance',
  tools_eolp_letters: 'letter',
  tools_eolp_personal_items: 'personal-item',
  tools_eolp_other_records: 'other',
};

export function storeConfig(store: EolAttachmentStore) {
  return STORE[store];
}

export function isMissingRelationError(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === '42P01' || (error?.message || '').toLowerCase().includes('does not exist');
}

export function extractEolStoragePath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) return fileUrl;
  try {
    const url = new URL(fileUrl);
    const marker = `${END_OF_LIFE_PLANNER_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export async function removeEolStorageFiles(fileUrls: Array<string | null | undefined>, userId: string): Promise<void> {
  const paths = [...new Set(fileUrls.map(extractEolStoragePath).filter((path): path is string => Boolean(path)))];
  if (paths.length === 0) return;
  await supabaseServer.storage.from(END_OF_LIFE_PLANNER_BUCKET).remove(paths);
  await refreshUserStorageUsage(userId);
}

export function mapEolAttachment(row: {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
}): EolAttachment {
  return {
    id: row.id,
    name: row.file_name,
    size: row.file_size,
    type: row.file_type,
  };
}

export async function attachmentsByOwnerIds(store: EolAttachmentStore, ownerIds: string[], userId: string) {
  const map: Record<string, EolAttachment[]> = {};
  if (ownerIds.length === 0) return map;
  const { table, ownerColumn } = STORE[store];
  const { data, error } = await supabaseServer
    .from(table)
    .select(`id, ${ownerColumn}, file_name, file_size, file_type`)
    .eq('user_id', userId)
    .in(ownerColumn, ownerIds)
    .order('created_at', { ascending: true });

  if (error) {
    if (!isMissingRelationError(error)) console.error(`Error fetching EOL ${store} attachments:`, error);
    return map;
  }

  (data || []).forEach((row) => {
    const ownerId = String((row as Record<string, string>)[ownerColumn] || '');
    if (!ownerId) return;
    if (!map[ownerId]) map[ownerId] = [];
    map[ownerId].push(mapEolAttachment(row));
  });
  return map;
}

export async function loadOwnedStoreRecord(
  store: EolAttachmentStore,
  ownerId: string,
  userId: string,
  toolId?: string | null
) {
  const { ownerTable } = STORE[store];
  let query = supabaseServer.from(ownerTable).select('id').eq('id', ownerId).eq('user_id', userId);
  if (toolId) query = query.eq('tool_id', toolId);
  const { data, error } = await query.single();
  if (error || !data) return null;
  return data;
}

export async function lookupAttachmentById(attachmentId: string, userId: string) {
  for (const store of Object.keys(STORE) as EolAttachmentStore[]) {
    const { table, ownerColumn } = STORE[store];
    const { data, error } = await supabaseServer
      .from(table)
      .select(`id, ${ownerColumn}, file_url, file_name, file_type`)
      .eq('id', attachmentId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error && !isMissingRelationError(error)) {
      return { error };
    }
    if (data) {
      return {
        store,
        attachment: {
          id: data.id,
          ownerId: String((data as Record<string, string>)[ownerColumn] || ''),
          file_url: data.file_url,
          file_name: data.file_name,
          file_type: data.file_type,
        },
      };
    }
  }
  return { store: null, attachment: null };
}

export async function deleteStorageForRemovedRows(ownerTable: string, ownerIds: string[], userId: string): Promise<void> {
  const store = TABLE_TO_STORE[ownerTable];
  if (!store || ownerIds.length === 0) return;
  const { table, ownerColumn } = STORE[store];
  const { data, error } = await supabaseServer
    .from(table)
    .select('file_url')
    .eq('user_id', userId)
    .in(ownerColumn, ownerIds);
  if (error) {
    if (!isMissingRelationError(error)) console.error(`Error loading EOL ${store} files for delete:`, error);
    return;
  }
  await removeEolStorageFiles((data || []).map((row) => row.file_url), userId);
}

export async function deletePlanStorageFiles(planId: string, userId: string): Promise<void> {
  const urls: string[] = [];
  for (const store of Object.keys(STORE) as EolAttachmentStore[]) {
    const { table, ownerTable, ownerColumn } = STORE[store];
    const { data: owners, error: ownerError } = await supabaseServer
      .from(ownerTable)
      .select('id')
      .eq('plan_id', planId)
      .eq('user_id', userId);
    if (ownerError) {
      if (!isMissingRelationError(ownerError)) console.error(`Error loading EOL ${store} owners for plan delete:`, ownerError);
      continue;
    }
    const ownerIds = (owners || []).map((row) => row.id);
    if (ownerIds.length === 0) continue;
    const { data: files, error: fileError } = await supabaseServer
      .from(table)
      .select('file_url')
      .eq('user_id', userId)
      .in(ownerColumn, ownerIds);
    if (fileError) {
      if (!isMissingRelationError(fileError)) console.error(`Error loading EOL ${store} files for plan delete:`, fileError);
      continue;
    }
    urls.push(...(files || []).map((row) => row.file_url));
  }
  await removeEolStorageFiles(urls, userId);
}
