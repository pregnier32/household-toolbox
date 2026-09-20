import { supabaseServer } from '@/lib/supabaseServer';

export const STORAGE_FREE_BYTES = 200 * 1024 * 1024;
export const STORAGE_PAID_BYTES = 1024 * 1024 * 1024;
export const STORAGE_ADDON_BYTES = 1024 * 1024 * 1024;

export const STORAGE_TOOL_BUCKETS = [
  { bucket: 'address-book', name: 'Address Book' },
  { bucket: 'calendar-events', name: 'Calendar Events' },
  { bucket: 'cleaning-schedule', name: 'Cleaning Schedule' },
  { bucket: 'end-of-life-planner', name: 'End of Life Planner' },
  { bucket: 'event-budget-planner', name: 'Event Budget Planner' },
  { bucket: 'goals-tracking', name: 'Goals Tracking' },
  { bucket: 'healthcare-appt-history', name: 'Healthcare Appts and History' },
  { bucket: 'home-maintenance-schedule', name: 'Home Maintenance Schedule' },
  { bucket: 'hsa-tracker', name: 'HSA Tracker' },
  { bucket: 'important-documents', name: 'Important Documents' },
  { bucket: 'meal-planner', name: 'Meal Planner' },
  { bucket: 'notes', name: 'Notes' },
  { bucket: 'pet-care-schedule', name: 'Pet Care Schedule' },
  { bucket: 'repair-history', name: 'Repair History' },
  { bucket: 'shopping-list', name: 'Shopping List' },
  { bucket: 'subscription-tracker', name: 'Subscription Tracker' },
  { bucket: 'to-do-list', name: 'To-Do List' },
  { bucket: 'travel-log', name: 'Travel Log' },
] as const;

export type StoragePlan = 'free' | 'paid';

export type StorageToolUsage = {
  bucket: string;
  name: string;
  usedBytes: number;
};

export type StorageQuota = {
  usedBytes: number;
  limitBytes: number;
  includedBytes: number;
  addonGb: number;
  addonBytes: number;
  percent: number;
  plan: StoragePlan;
  planLabel: string;
  usedLabel: string;
  limitLabel: string;
  updatedAt: string | null;
  tools?: StorageToolUsage[];
};

type UserStorageRow = {
  storage_used_bytes: number | null;
  storage_plan: string | null;
  storage_addon_gb: number | null;
  storage_usage_updated_at: string | null;
};

export class StorageLimitError extends Error {
  code = 'STORAGE_LIMIT_EXCEEDED' as const;

  constructor(message: string) {
    super(message);
    this.name = 'StorageLimitError';
  }
}

export function isStorageLimitError(error: unknown): error is StorageLimitError {
  return error instanceof StorageLimitError ||
    (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'STORAGE_LIMIT_EXCEEDED');
}

export function formatStorageBytes(bytes: number): string {
  const safe = Math.max(0, bytes);
  if (safe < 1024) return `${safe} B`;
  if (safe < 1024 * 1024) return `${(safe / 1024).toFixed(safe < 10 * 1024 ? 1 : 0)} KB`;
  if (safe < 1024 * 1024 * 1024) return `${(safe / (1024 * 1024)).toFixed(safe < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(safe / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function computeStorageLimit(plan: StoragePlan, addonGb: number): { includedBytes: number; addonBytes: number; limitBytes: number } {
  const includedBytes = plan === 'paid' ? STORAGE_PAID_BYTES : STORAGE_FREE_BYTES;
  const addonBytes = Math.max(0, addonGb) * STORAGE_ADDON_BYTES;
  return { includedBytes, addonBytes, limitBytes: includedBytes + addonBytes };
}

function normalizePlan(value: string | null | undefined): StoragePlan {
  return value === 'paid' ? 'paid' : 'free';
}

function toQuota(row: UserStorageRow, tools?: StorageToolUsage[]): StorageQuota {
  const plan = normalizePlan(row.storage_plan);
  const addonGb = Math.max(0, row.storage_addon_gb ?? 0);
  const usedBytes = Math.max(0, row.storage_used_bytes ?? 0);
  const { includedBytes, addonBytes, limitBytes } = computeStorageLimit(plan, addonGb);
  const percent = limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : 0;
  return {
    usedBytes,
    limitBytes,
    includedBytes,
    addonGb,
    addonBytes,
    percent,
    plan,
    planLabel: plan === 'paid' ? 'Paid' : 'Free',
    usedLabel: formatStorageBytes(usedBytes),
    limitLabel: formatStorageBytes(limitBytes),
    updatedAt: row.storage_usage_updated_at,
    tools,
  };
}

async function readUserStorageRow(userId: string): Promise<UserStorageRow> {
  const { data, error } = await supabaseServer
    .from('users')
    .select('storage_used_bytes, storage_plan, storage_addon_gb, storage_usage_updated_at')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to load storage usage');
  }

  return data as UserStorageRow;
}

async function persistUsedBytes(userId: string, usedBytes: number): Promise<void> {
  const { error } = await supabaseServer
    .from('users')
    .update({
      storage_used_bytes: usedBytes,
      storage_usage_updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('Failed to persist storage usage:', error);
  }
}

function objectBelongsToUser(path: string, userId: string): boolean {
  return path === userId || path.startsWith(`${userId}/`) || path.includes(`/${userId}/`);
}

async function listPrefixSizes(bucket: string, prefix: string): Promise<number> {
  let offset = 0;
  let total = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabaseServer.storage.from(bucket).list(prefix, {
      limit,
      offset,
    });
    if (error || !data?.length) break;

    for (const item of data) {
      if (item.id) {
        const size = Number(item.metadata?.size ?? 0);
        if (Number.isFinite(size) && size > 0) total += size;
      } else {
        const childPrefix = prefix ? `${prefix}/${item.name}` : item.name;
        total += await listPrefixSizes(bucket, childPrefix);
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }

  return total;
}

async function recountViaStorageApi(userId: string): Promise<StorageToolUsage[]> {
  const tools: StorageToolUsage[] = [];

  for (const tool of STORAGE_TOOL_BUCKETS) {
    const { data: root, error } = await supabaseServer.storage.from(tool.bucket).list('', { limit: 1000, offset: 0 });
    if (error || !root) {
      tools.push({ bucket: tool.bucket, name: tool.name, usedBytes: 0 });
      continue;
    }

    let usedBytes = 0;
    for (const item of root) {
      const path = item.name;
      if (item.id) {
        if (objectBelongsToUser(path, userId)) {
          const size = Number(item.metadata?.size ?? 0);
          if (Number.isFinite(size) && size > 0) usedBytes += size;
        }
        continue;
      }

      if (path === userId) {
        usedBytes += await listPrefixSizes(tool.bucket, userId);
        continue;
      }

      usedBytes += await listPrefixSizes(tool.bucket, `${path}/${userId}`);
    }

    tools.push({ bucket: tool.bucket, name: tool.name, usedBytes });
  }

  return tools;
}

export async function recountUserStorage(userId: string): Promise<StorageQuota> {
  const row = await readUserStorageRow(userId);
  let tools: StorageToolUsage[] = STORAGE_TOOL_BUCKETS.map((tool) => ({
    bucket: tool.bucket,
    name: tool.name,
    usedBytes: 0,
  }));

  const { data, error } = await supabaseServer.rpc('get_user_storage_usage', { p_user_id: userId });
  if (error) {
    console.error('Storage usage RPC failed; falling back to Storage API listing:', error);
    tools = await recountViaStorageApi(userId);
  } else {
    const usedByBucket = new Map<string, number>();
    for (const item of data || []) {
      usedByBucket.set(item.bucket_id, Number(item.used_bytes) || 0);
    }
    tools = STORAGE_TOOL_BUCKETS.map((tool) => ({
      bucket: tool.bucket,
      name: tool.name,
      usedBytes: usedByBucket.get(tool.bucket) ?? 0,
    }));
  }

  const usedBytes = tools.reduce((sum, tool) => sum + tool.usedBytes, 0);
  await persistUsedBytes(userId, usedBytes);

  return toQuota(
    {
      ...row,
      storage_used_bytes: usedBytes,
      storage_usage_updated_at: new Date().toISOString(),
    },
    tools.sort((a, b) => b.usedBytes - a.usedBytes || a.name.localeCompare(b.name))
  );
}

export async function getUserStorageQuota(userId: string, options?: { refresh?: boolean }): Promise<StorageQuota> {
  const row = await readUserStorageRow(userId);
  if (options?.refresh || !row.storage_usage_updated_at) {
    return recountUserStorage(userId);
  }
  return toQuota(row);
}

export async function assertCanStoreBytes(userId: string, incomingBytes: number): Promise<StorageQuota> {
  const quota = await getUserStorageQuota(userId);
  if (quota.usedBytes + incomingBytes > quota.limitBytes) {
    throw new StorageLimitError(
      `This upload would exceed your ${quota.limitLabel} storage limit. Free up space or increase your storage to add more files.`
    );
  }
  return quota;
}

export async function refreshUserStorageUsage(userId: string): Promise<StorageQuota> {
  return recountUserStorage(userId);
}

export type SiteStorageStats = {
  documentCount: number;
  usedBytes: number;
  usedLabel: string;
};

const ATTACHMENT_COUNT_TABLES = [
  'tools_ab_address_attachments',
  'tools_ce_event_attachments',
  'tools_cs_completion_attachments',
  'tools_cs_item_attachments',
  'tools_ebp_event_attachments',
  'tools_ebp_expense_attachments',
  'tools_eolp_document_attachments',
  'tools_eolp_insurance_attachments',
  'tools_eolp_letter_attachments',
  'tools_eolp_other_record_attachments',
  'tools_eolp_personal_item_attachments',
  'tools_gt_goal_attachments',
  'tools_gt_update_attachments',
  'tools_hcah_documents',
  'tools_hms_completion_attachments',
  'tools_hms_item_attachments',
  'tools_hsa_expense_receipts',
  'tools_id_documents',
  'tools_mp_meal_attachments',
  'tools_note_attachments',
  'tools_pcs_appointment_attachments',
  'tools_pcs_document_attachments',
  'tools_pcs_documents',
  'tools_pcs_pet_attachments',
  'tools_pcs_vaccination_attachments',
  'tools_pcs_veterinary_attachments',
  'tools_rh_record_attachments',
  'tools_rh_repair_pictures',
  'tools_sl_list_attachments',
  'tools_st_subscription_attachments',
  'tools_tdl_attachments',
  'tools_tl_trip_attachments',
] as const;

async function countAttachmentRows(): Promise<number> {
  const counts = await Promise.all(
    ATTACHMENT_COUNT_TABLES.map(async (table) => {
      const { count, error } = await supabaseServer
        .from(table)
        .select('*', { count: 'exact', head: true });
      if (error) {
        console.error(`Failed to count ${table}:`, error);
        return 0;
      }
      return count || 0;
    })
  );

  const extraFileColumns = await Promise.all([
    supabaseServer
      .from('tools_rh_records')
      .select('*', { count: 'exact', head: true })
      .not('receipt_file_url', 'is', null),
    supabaseServer
      .from('tools_rh_records')
      .select('*', { count: 'exact', head: true })
      .not('warranty_file_url', 'is', null),
  ]);

  const extraCount = extraFileColumns.reduce((sum, result) => {
    if (result.error) {
      console.error('Failed to count extra file columns:', result.error);
      return sum;
    }
    return sum + (result.count || 0);
  }, 0);

  return counts.reduce((sum, value) => sum + value, 0) + extraCount;
}

async function sumCachedUserStorageBytes(): Promise<number> {
  const { data, error } = await supabaseServer
    .from('users')
    .select('storage_used_bytes');

  if (error) {
    console.error('Failed to sum cached storage usage:', error);
    return 0;
  }

  return (data || []).reduce((sum, row) => sum + Math.max(0, row.storage_used_bytes ?? 0), 0);
}

export async function getSiteStorageStats(): Promise<SiteStorageStats> {
  const { data, error } = await supabaseServer.rpc('get_site_storage_stats');
  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      const usedBytes = Math.max(0, Number(row.used_bytes) || 0);
      return {
        documentCount: Math.max(0, Number(row.document_count) || 0),
        usedBytes,
        usedLabel: formatStorageBytes(usedBytes),
      };
    }
  } else {
    console.error('Site storage stats RPC failed; using cached fallback:', error);
  }

  const [documentCount, usedBytes] = await Promise.all([
    countAttachmentRows(),
    sumCachedUserStorageBytes(),
  ]);

  return {
    documentCount,
    usedBytes,
    usedLabel: formatStorageBytes(usedBytes),
  };
}
