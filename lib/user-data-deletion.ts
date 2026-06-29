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
 * Storage cleanup (this file) — query tables for file URLs, then remove from bucket:
 * | Tool                    | Tables (file columns)                                              | Bucket                 | Schema / storage script |
 * |-------------------------|--------------------------------------------------------------------|------------------------|-------------------------|
 * | Important Documents     | tools_id_documents (file_url)                                      | important-documents    | supabase/archive/create-important-documents-tables.sql, create-important-documents-storage-bucket.sql |
 * | Repair History          | tools_rh_records (receipt_file_url, warranty_file_url), tools_rh_repair_pictures (file_url) | repair-history | supabase/archive/create-repair-history-tables.sql, create-repair-history-storage-bucket.sql |
 * | Healthcare Appts        | tools_hcah_documents (file_url) via headers → records              | heathcare-appt-history | supabase/archive/create-healthcare-appts-history-tables.sql, create-healthcare-appts-history-storage-bucket.sql |
 * | Pet Care Schedule       | tools_pcs_documents (file_url) via pets                            | pet-care-schedule      | supabase/archive/create-pet-care-schedule-tables.sql, create-pet-care-schedule-storage-bucket.sql |
 * | HSA Tracker (receipts)  | tools_hsa_expense_receipts (file_url)* via expenses                | hsa-tracker*           | supabase/create-tools-hsa-tables.sql (*when receipts table + bucket are enabled) |
 *
 * DB-only cascade (user_id → users ON DELETE CASCADE; no storage block required here):
 * | Tool                 | Tables                                                                 | Schema script |
 * |----------------------|------------------------------------------------------------------------|---------------|
 * | Address Book         | tools_ab_addresses, tools_ab_tags, tools_ab_address_tags               | supabase/create-tools-ab-tables.sql |
 * | Travel Log           | tools_tl_trips → tools_tl_lodging, tools_tl_journal_notes (trip CASCADE) | supabase/create-tools-tl-tables.sql |
 * | HSA Tracker          | tools_hsa_accounts, tools_hsa_deposits, tools_hsa_expenses             | supabase/create-tools-hsa-tables.sql |
 * | Event Budget Planner | tools_ebp_categories, tools_ebp_types, tools_ebp_vendors, tools_ebp_events → tools_ebp_event_category_budgets, tools_ebp_expenses | supabase/create-tools-ebp-tables.sql |
 * | Notes                | tools_note_notes, tools_note_tags, tools_note_note_tags, tools_note_security_questions | supabase/archive/create-notes-tables.sql |
 * | Goals Tracking       | tools_gt_categories, tools_gt_goals, tools_gt_phases, tools_gt_tasks, tools_gt_update_notes | supabase/archive/create-tools-gt-tables.sql |
 * | Meal Planner         | tools_mp_items, tools_mp_meal_types, tools_mp_meals, tools_mp_meal_ingredients, tools_mp_plans, tools_mp_plan_assignments | supabase/archive/create-tools-mp-tables.sql |
 * | Shopping List        | tools_sl_lists, tools_sl_items, tools_sl_list_items                    | supabase/archive/create-tools-sl-tables.sql |
 * | To-Do List           | tools_tdl_categories, tools_tdl_tasks                                  | supabase/archive/create-tools-tdl-tables.sql |
 * | Subscription Tracker | tools_st_subscriptions                                                 | supabase/archive/create-subscription-tracker-tables.sql |
 * | Calendar Events      | tools_ce_categories, tools_ce_events                                   | supabase/archive/create-calendar-events-tables.sql |
 * | Dashboard Items      | dashboard_items                                                        | supabase/archive/create-dashboard-items-table.sql |
 * | Repair History (DB)  | tools_rh_headers, tools_rh_records, tools_rh_items (+ child rows)    | supabase/archive/create-repair-history-tables.sql |
 * | Healthcare (DB)      | tools_hcah_headers, tools_hcah_records (+ document rows cascade)     | supabase/archive/create-healthcare-appts-history-tables.sql |
 * | Pet Care (DB)        | tools_pcs_pets and related child tables                                | supabase/archive/create-pet-care-schedule-tables.sql |
 * | Important Docs (DB)  | tools_id_documents, tools_id_tags, tools_id_document_tags, tools_id_security_questions | supabase/archive/create-important-documents-tables.sql |
 *
 * Monolithic reference (may duplicate archive scripts): supabase/DB_Build_ASOF_4_26_26.sql
 * Global seed data (not per-user, not deleted): tools_hsa_default_accounts, tools_gt_default_categories,
 *   tools_ebp_default_categories, tools_ebp_default_types, etc.
 *
 * Event Budget Planner API: app/api/tools/event-budget-planner/ (route.ts + categories/types/vendors sub-routes)
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
  // HSA Tracker DB rows — supabase/create-tools-hsa-tables.sql (receipt files handled above)
  // tools_hsa_accounts, tools_hsa_deposits, tools_hsa_expenses: removed via users ON DELETE CASCADE

  // Address Book — supabase/create-tools-ab-tables.sql (DB-only; no storage)
  // tools_ab_addresses, tools_ab_tags, tools_ab_address_tags: removed via users ON DELETE CASCADE

  // Travel Log — supabase/create-tools-tl-tables.sql (DB-only; no storage)
  // tools_tl_trips (user_id) → tools_tl_lodging, tools_tl_journal_notes: removed via users + trip CASCADE

  // Event Budget Planner — supabase/create-tools-ebp-tables.sql (DB-only; no storage)
  // Delete events first (CASCADE → budgets/expenses); categories/types/vendors then cascade from users.
  const { error: ebpEventsDeleteError } = await supabaseServer
    .from('tools_ebp_events')
    .delete()
    .eq('user_id', userId);
  if (ebpEventsDeleteError && !isMissingRelationError(ebpEventsDeleteError)) throw ebpEventsDeleteError;
  // tools_ebp_categories, tools_ebp_types, tools_ebp_vendors: removed via users ON DELETE CASCADE

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
