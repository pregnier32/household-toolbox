import { supabaseServer } from '@/lib/supabaseServer';

type SupabaseLikeError = { message?: string; code?: string } | null;

function isMissingRelationError(error: SupabaseLikeError): boolean {
  return error?.code === '42P01' || (error?.message || '').toLowerCase().includes('does not exist');
}

function extractStoragePath(fileUrl: string, bucket: string): string | null {
  if (!fileUrl) return null;

  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
    return fileUrl;
  }

  try {
    const url = new URL(fileUrl);
    const marker = `${bucket}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return url.pathname.slice(markerIndex + marker.length);
  } catch {
    return null;
  }
}

async function removeStoragePaths(bucket: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  const chunkSize = 100;

  for (let i = 0; i < uniquePaths.length; i += chunkSize) {
    const chunk = uniquePaths.slice(i, i + chunkSize);
    const { error } = await supabaseServer.storage.from(bucket).remove(chunk);
    if (error && !isMissingRelationError(error)) {
      console.error(`Storage cleanup warning for bucket ${bucket}:`, error);
    }
  }
}

/**
 * Shared account erasure used by:
 * - `app/api/admin/users/route.ts` (DELETE)
 * - `app/api/account/delete/route.ts` (DELETE)
 *
 * Flow: remove storage objects referenced by the user, then delete `users` (FK CASCADE).
 *
 * Storage cleanup (this file) — SQL / bucket references:
 * | Tool                    | Tables                              | Bucket                 | Schema / storage script |
 * |-------------------------|-------------------------------------|------------------------|-------------------------|
 * | Important Documents     | tools_id_documents                  | important-documents    | supabase/archive/create-important-documents-tables.sql, create-important-documents-storage-bucket.sql |
 * | Repair History          | tools_rh_records, tools_rh_repair_pictures | repair-history    | supabase/archive/create-repair-history-tables.sql, create-repair-history-storage-bucket.sql |
 * | Healthcare Appts        | tools_hcah_documents                | heathcare-appt-history | supabase/archive/create-healthcare-appts-history-tables.sql, create-healthcare-appts-history-storage-bucket.sql |
 * | Pet Care Schedule       | tools_pcs_documents                 | pet-care-schedule      | supabase/archive/create-pet-care-schedule-tables.sql, create-pet-care-schedule-storage-bucket.sql |
 * | HSA Tracker (receipts)  | tools_hsa_expense_receipts*         | hsa-tracker*           | supabase/create-tools-hsa-tables.sql (*when receipts table + bucket are enabled) |
 *
 * DB-only cascade (no storage block required here; user_id → users ON DELETE CASCADE):
 * | Tool           | Tables                                                                 | Schema script |
 * |----------------|------------------------------------------------------------------------|---------------|
 * | Address Book   | tools_ab_addresses, tools_ab_tags, tools_ab_address_tags               | supabase/create-tools-ab-tables.sql |
 * | HSA Tracker    | tools_hsa_accounts, tools_hsa_deposits, tools_hsa_expenses            | supabase/create-tools-hsa-tables.sql |
 * | Notes          | tools_note_notes, tools_note_tags, tools_note_note_tags, tools_note_security_questions | supabase/DB_Build_ASOF_4_26_26.sql |
 * | Other tools    | Goals, subscriptions, shopping lists, meal planner, calendar, TDL, etc. | supabase/DB_Build_ASOF_4_26_26.sql |
 *
 * Global seed data (not per-user, not deleted): tools_hsa_default_accounts
 */
export async function deleteUserAndAssociatedData(userId: string): Promise<void> {
  const storageDeletes: Array<{ bucket: string; path: string }> = [];

  // Important Documents — supabase/archive/create-important-documents-*.sql
  const { data: idDocs, error: idDocsError } = await supabaseServer
    .from('tools_id_documents')
    .select('file_url')
    .eq('user_id', userId);

  if (idDocsError && !isMissingRelationError(idDocsError)) throw idDocsError;
  (idDocs || []).forEach((row: { file_url: string | null }) => {
    const path = row.file_url ? extractStoragePath(row.file_url, 'important-documents') : null;
    if (path) storageDeletes.push({ bucket: 'important-documents', path });
  });

  // Repair History — supabase/archive/create-repair-history-*.sql
  const { data: rhRecords, error: rhError } = await supabaseServer
    .from('tools_rh_records')
    .select('id, receipt_file_url, warranty_file_url')
    .eq('user_id', userId);
  if (rhError && !isMissingRelationError(rhError)) throw rhError;

  const rhRecordIds = (rhRecords || []).map((r: { id: string }) => r.id);
  (rhRecords || []).forEach((row: { receipt_file_url: string | null; warranty_file_url: string | null }) => {
    const receiptPath = row.receipt_file_url ? extractStoragePath(row.receipt_file_url, 'repair-history') : null;
    const warrantyPath = row.warranty_file_url ? extractStoragePath(row.warranty_file_url, 'repair-history') : null;
    if (receiptPath) storageDeletes.push({ bucket: 'repair-history', path: receiptPath });
    if (warrantyPath) storageDeletes.push({ bucket: 'repair-history', path: warrantyPath });
  });

  if (rhRecordIds.length > 0) {
    const { data: rhPictures, error: rhPicturesError } = await supabaseServer
      .from('tools_rh_repair_pictures')
      .select('file_url')
      .in('record_id', rhRecordIds);
    if (rhPicturesError && !isMissingRelationError(rhPicturesError)) throw rhPicturesError;
    (rhPictures || []).forEach((row: { file_url: string | null }) => {
      const path = row.file_url ? extractStoragePath(row.file_url, 'repair-history') : null;
      if (path) storageDeletes.push({ bucket: 'repair-history', path });
    });
  }

  // Healthcare Appts & History — supabase/archive/create-healthcare-appts-history-*.sql
  const { data: hcahHeaders, error: hcahHeadersError } = await supabaseServer
    .from('tools_hcah_headers')
    .select('id')
    .eq('user_id', userId);
  if (hcahHeadersError && !isMissingRelationError(hcahHeadersError)) throw hcahHeadersError;

  const hcahHeaderIds = (hcahHeaders || []).map((h: { id: string }) => h.id);
  if (hcahHeaderIds.length > 0) {
    const { data: hcahRecords, error: hcahRecordsError } = await supabaseServer
      .from('tools_hcah_records')
      .select('id')
      .in('header_id', hcahHeaderIds);
    if (hcahRecordsError && !isMissingRelationError(hcahRecordsError)) throw hcahRecordsError;

    const hcahRecordIds = (hcahRecords || []).map((r: { id: string }) => r.id);
    if (hcahRecordIds.length > 0) {
      const { data: hcahDocs, error: hcahDocsError } = await supabaseServer
        .from('tools_hcah_documents')
        .select('file_url')
        .in('record_id', hcahRecordIds);
      if (hcahDocsError && !isMissingRelationError(hcahDocsError)) throw hcahDocsError;
      (hcahDocs || []).forEach((row: { file_url: string | null }) => {
        const path = row.file_url ? extractStoragePath(row.file_url, 'heathcare-appt-history') : null;
        if (path) storageDeletes.push({ bucket: 'heathcare-appt-history', path });
      });
    }
  }

  // Pet Care Schedule — supabase/archive/create-pet-care-schedule-*.sql
  const { data: pets, error: petsError } = await supabaseServer
    .from('tools_pcs_pets')
    .select('id')
    .eq('user_id', userId);
  if (petsError && !isMissingRelationError(petsError)) throw petsError;
  const petIds = (pets || []).map((p: { id: string }) => p.id);

  if (petIds.length > 0) {
    const { data: petDocs, error: petDocsError } = await supabaseServer
      .from('tools_pcs_documents')
      .select('file_url')
      .in('pet_id', petIds);
    if (petDocsError && !isMissingRelationError(petDocsError)) throw petDocsError;
    (petDocs || []).forEach((row: { file_url: string | null }) => {
      const path = row.file_url ? extractStoragePath(row.file_url, 'pet-care-schedule') : null;
      if (path) storageDeletes.push({ bucket: 'pet-care-schedule', path });
    });
  }

  // HSA Tracker receipts — supabase/create-tools-hsa-tables.sql (phase 2; table may not exist yet)
  const { data: hsaExpenses, error: hsaExpensesError } = await supabaseServer
    .from('tools_hsa_expenses')
    .select('id')
    .eq('user_id', userId);
  if (hsaExpensesError && !isMissingRelationError(hsaExpensesError)) throw hsaExpensesError;

  const hsaExpenseIds = (hsaExpenses || []).map((e: { id: string }) => e.id);
  if (hsaExpenseIds.length > 0) {
    const { data: hsaReceipts, error: hsaReceiptsError } = await supabaseServer
      .from('tools_hsa_expense_receipts')
      .select('file_url')
      .in('expense_id', hsaExpenseIds);
    if (hsaReceiptsError && !isMissingRelationError(hsaReceiptsError)) throw hsaReceiptsError;
    (hsaReceipts || []).forEach((row: { file_url: string | null }) => {
      const path = row.file_url ? extractStoragePath(row.file_url, 'hsa-tracker') : null;
      if (path) storageDeletes.push({ bucket: 'hsa-tracker', path });
    });
  }
  // tools_hsa_accounts / deposits / expenses: removed via users ON DELETE CASCADE

  // Address Book — supabase/create-tools-ab-tables.sql (DB-only; no storage)
  // tools_ab_addresses, tools_ab_tags, tools_ab_address_tags: removed via users ON DELETE CASCADE

  const grouped = storageDeletes.reduce<Record<string, string[]>>((acc, item) => {
    if (!acc[item.bucket]) acc[item.bucket] = [];
    acc[item.bucket].push(item.path);
    return acc;
  }, {});

  for (const [bucket, paths] of Object.entries(grouped)) {
    await removeStoragePaths(bucket, paths);
  }

  const { error: deleteUserError } = await supabaseServer
    .from('users')
    .delete()
    .eq('id', userId);

  if (deleteUserError) throw deleteUserError;
}
