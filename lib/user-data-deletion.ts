import { supabaseServer } from '@/lib/supabaseServer';

type SupabaseLikeError = { message?: string; code?: string } | null;

function isMissingRelationError(error: SupabaseLikeError): boolean {
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    (error?.message || '').toLowerCase().includes('does not exist')
  );
}

export type LinkedGuestAccount = {
  id: string;
  email: string;
  first_name: string;
  last_name: string | null;
};

/** Guest logins on the household owned by these admin user ids. */
export async function listLinkedGuestAccounts(
  adminUserIds: string[]
): Promise<Map<string, LinkedGuestAccount[]>> {
  const grouped = new Map<string, LinkedGuestAccount[]>();
  const adminIds = [...new Set(adminUserIds.filter(Boolean))];
  if (adminIds.length === 0) return grouped;

  const { data: households, error: householdError } = await supabaseServer
    .from('households')
    .select('id, admin_user_id')
    .in('admin_user_id', adminIds);

  if (householdError) {
    if (isMissingRelationError(householdError)) return grouped;
    throw householdError;
  }
  if (!households?.length) return grouped;

  const adminByHousehold = new Map(
    households.map((household) => [household.id, household.admin_user_id])
  );

  const { data: members, error: memberError } = await supabaseServer
    .from('household_members')
    .select('household_id, user_id')
    .in('household_id', households.map((household) => household.id))
    .eq('role', 'user')
    .eq('status', 'active');

  if (memberError) {
    if (isMissingRelationError(memberError)) return grouped;
    throw memberError;
  }

  const memberIds = [
    ...new Set(
      (members || [])
        .map((member) => member.user_id)
        .filter((userId): userId is string => Boolean(userId) && !adminIds.includes(userId))
    ),
  ];
  if (memberIds.length === 0) return grouped;

  const { data: guests, error: guestError } = await supabaseServer
    .from('users')
    .select('id, email, first_name, last_name')
    .in('id', memberIds)
    .eq('user_status', 'guest');

  if (guestError) throw guestError;

  const guestsById = new Map((guests || []).map((guest) => [guest.id, guest]));
  for (const member of members || []) {
    const guest = guestsById.get(member.user_id);
    const adminUserId = adminByHousehold.get(member.household_id);
    if (!guest || !adminUserId) continue;
    const current = grouped.get(adminUserId) ?? [];
    if (!current.some((row) => row.id === guest.id)) current.push(guest);
    grouped.set(adminUserId, current);
  }

  return grouped;
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

type StorageDelete = { bucket: string; path: string };
type FileUrlRow = { file_url: string | null };

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

async function flushStorageDeletes(storageDeletes: StorageDelete[]): Promise<void> {
  const grouped = storageDeletes.reduce<Record<string, string[]>>((acc, item) => {
    if (!acc[item.bucket]) acc[item.bucket] = [];
    acc[item.bucket].push(item.path);
    return acc;
  }, {});

  for (const [bucket, paths] of Object.entries(grouped)) {
    await removeStoragePaths(bucket, paths);
  }
}

function pushFileUrl(dest: StorageDelete[], fileUrl: string | null | undefined, bucket: string): void {
  const path = fileUrl ? extractStoragePath(fileUrl, bucket) : null;
  if (path) dest.push({ bucket, path });
}

function pushFileUrlRows(dest: StorageDelete[], rows: FileUrlRow[] | null, bucket: string): void {
  (rows || []).forEach((row) => pushFileUrl(dest, row.file_url, bucket));
}

async function collectUserFileUrls(
  table: string,
  userId: string,
  bucket: string,
  dest: StorageDelete[]
): Promise<void> {
  const { data, error } = await supabaseServer
    .from(table as 'tools_id_documents')
    .select('file_url')
    .eq('user_id', userId);
  if (error && !isMissingRelationError(error)) throw error;
  pushFileUrlRows(dest, data, bucket);
}

async function deleteUserToolRows(table: string, userId: string, toolId: string): Promise<void> {
  const { error } = await supabaseServer
    .from(table as 'tools_id_documents')
    .delete()
    .eq('user_id', userId)
    .eq('tool_id', toolId);
  if (error && !isMissingRelationError(error)) throw error;
}

/**
 * Shared account erasure used by:
 * - `app/api/admin/users/route.ts` (DELETE) as `delete_user`, after `delete_user_tools`
 * - `app/api/account/delete/route.ts` (DELETE)
 *
 * Per-tool counterpart: `deleteUserTool` / `delete_user_tool` (same storage + row
 * coverage, scoped to one catalog tool; does not delete the user).
 * All of a user's tools: `deleteUserTools` / `delete_user_tools`.
 *
 * Flow: when this user owns a household, delete each attached guest account first
 * (their tools, storage, `users` row, and Auth login), then remove storage objects
 * referenced by this user and delete `users` (FK CASCADE).
 * `user_tool_entitlements` is removed with the user, not with per-tool Remove.
 *
 * Storage cleanup (this file) — query tables for file URLs, then remove from bucket:
 * | Tool                    | Tables (file columns)                                              | Bucket                 | Schema / storage script |
 * |-------------------------|--------------------------------------------------------------------|------------------------|-------------------------|
 * | Important Documents     | tools_id_documents (file_url)                                      | important-documents    | supabase/archive/tools/important-documents.sql |
 * | Notes                   | tools_note_attachments (file_url)                                  | notes                  | supabase/archive/tools/notes.sql |
 * | To-Do List              | tools_tdl_attachments (file_url)                                   | to-do-list             | supabase/archive/tools/to-do-list.sql |
 * | Cleaning Schedule       | tools_cs_item_attachments, tools_cs_completion_attachments (file_url) | cleaning-schedule   | supabase/archive/tools/cleaning-schedule.sql |
 * | Repair History          | tools_rh_record_attachments, tools_rh_records (receipt_file_url, warranty_file_url), tools_rh_repair_pictures (file_url) | repair-history | supabase/archive/tools/repair-history.sql |
 * | Healthcare Appts        | tools_hcah_documents (file_url) via headers → records              | healthcare-appt-history | supabase/archive/tools/healthcare-appts-history.sql |
 * | Pet Care Schedule       | tools_pcs_pet_attachments, tools_pcs_document_attachments, tools_pcs_veterinary_attachments, tools_pcs_vaccination_attachments, tools_pcs_appointment_attachments, tools_pcs_documents.file_url | pet-care-schedule | supabase/archive/tools/pet-care-schedule.sql |
 * | HSA Tracker (receipts)  | tools_hsa_expense_receipts (file_url) via expenses                  | hsa-tracker            | supabase/archive/tools/hsa-tracker.sql |
 * | Travel Log              | tools_tl_trip_attachments (file_url)                               | travel-log             | supabase/archive/tools/travel-log.sql |
 * | Event Budget Planner    | tools_ebp_event_attachments, tools_ebp_expense_attachments (file_url) | event-budget-planner | supabase/archive/tools/event-budget-planner.sql |
 * | Meal Planner            | tools_mp_meal_attachments (file_url)                               | meal-planner           | supabase/archive/tools/meal-planner.sql |
 * | Shopping List           | tools_sl_list_attachments (file_url)                               | shopping-list          | supabase/archive/tools/shopping-list.sql |
 * | Goals Tracking          | tools_gt_goal_attachments, tools_gt_update_attachments (file_url)  | goals-tracking         | supabase/archive/tools/goals-tracking.sql |
 * | Calendar Events         | tools_ce_event_attachments (file_url)                              | calendar-events        | supabase/archive/tools/calendar-events.sql |
 * | Subscription Tracker    | tools_st_subscription_attachments (file_url)                       | subscription-tracker   | supabase/archive/tools/subscription-tracker.sql |
 * | Address Book            | tools_ab_address_attachments (file_url)                            | address-book           | supabase/archive/tools/address-book.sql |
 * | Home Maintenance        | tools_hms_item_attachments, tools_hms_completion_attachments (file_url) | home-maintenance-schedule | supabase/archive/tools/home-maintenance-schedule.sql |
 * | End of Life Planner     | tools_eolp_document_attachments, tools_eolp_insurance_attachments, tools_eolp_letter_attachments, tools_eolp_personal_item_attachments, tools_eolp_other_record_attachments (file_url) | end-of-life-planner | supabase/archive/tools/end-of-life-planner.sql |
 *
 * DB-only cascade (user_id → users ON DELETE CASCADE; no storage block required here):
 * | Tool                 | Tables                                                                 | Schema script |
 * |----------------------|------------------------------------------------------------------------|---------------|
 * | Address Book         | tools_ab_addresses, tools_ab_tags, tools_ab_address_tags, tools_ab_address_attachments | supabase/archive/tools/address-book.sql |
 * | Travel Log           | tools_tl_trips → tools_tl_lodging, tools_tl_journal_notes, tools_tl_trip_attachments | supabase/archive/tools/travel-log.sql |
 * | HSA Tracker          | tools_hsa_accounts, tools_hsa_deposits, tools_hsa_expenses             | supabase/archive/tools/hsa-tracker.sql |
 * | Event Budget Planner | tools_ebp_categories, tools_ebp_types, tools_ebp_vendors, tools_ebp_events → tools_ebp_event_category_budgets, tools_ebp_expenses → tools_ebp_expense_splits, tools_ebp_event_attachments, tools_ebp_expense_attachments | supabase/archive/tools/event-budget-planner.sql |
 * | Cleaning Schedule    | tools_cs_categories, tools_cs_items → tools_cs_tasks → tools_cs_completions, tools_cs_item_attachments, tools_cs_completion_attachments | supabase/archive/tools/cleaning-schedule.sql |
 * | Home Maintenance     | tools_hms_categories, tools_hms_items → tools_hms_tasks → tools_hms_completions, tools_hms_item_attachments, tools_hms_completion_attachments | supabase/archive/tools/home-maintenance-schedule.sql |
 * | End of Life Planner  | tools_eolp_plans → sections, subsections, personal/home/wishes 1:1 rows, list tables, tools_eolp_other_custom_fields, document/insurance/letter/personal-item/other attachment tables | supabase/archive/tools/end-of-life-planner.sql |
 * | Notes                | tools_note_notes, tools_note_tags, tools_note_note_tags, tools_note_security_questions, tools_note_attachments | supabase/archive/tools/notes.sql |
 * | Goals Tracking       | tools_gt_categories, tools_gt_goals, tools_gt_phases, tools_gt_tasks, tools_gt_update_notes, tools_gt_goal_attachments, tools_gt_update_attachments | supabase/archive/tools/goals-tracking.sql |
 * | Meal Planner         | tools_mp_items, tools_mp_meal_types, tools_mp_meals, tools_mp_meal_ingredients, tools_mp_meal_attachments, tools_mp_plans, tools_mp_plan_assignments | supabase/archive/tools/meal-planner.sql |
 * | Shopping List        | tools_sl_lists, tools_sl_items, tools_sl_list_items, tools_sl_list_attachments | supabase/archive/tools/shopping-list.sql |
 * | To-Do List           | tools_tdl_categories, tools_tdl_tasks, tools_tdl_attachments           | supabase/archive/tools/to-do-list.sql |
 * | Subscription Tracker | tools_st_subscriptions, tools_st_subscription_attachments              | supabase/archive/tools/subscription-tracker.sql |
 * | Calendar Events      | tools_ce_categories, tools_ce_events, tools_ce_event_attachments      | supabase/archive/tools/calendar-events.sql |
 * | Calendar Pins        | calendar_pins                                                          | supabase/archive/platform/calendar-pins.sql |
 * | Repair History (DB)  | tools_rh_headers, tools_rh_records, tools_rh_items, tools_rh_record_attachments | supabase/archive/tools/repair-history.sql |
 * | Healthcare (DB)      | tools_hcah_headers, tools_hcah_records (+ document rows cascade)     | supabase/archive/tools/healthcare-appts-history.sql |
 * | Pet Care (DB)        | tools_pcs_pets and related child tables + attachment tables            | supabase/archive/tools/pet-care-schedule.sql |
 * | Important Docs (DB)  | tools_id_documents, tools_id_tags, tools_id_document_tags, tools_id_security_questions | supabase/archive/tools/important-documents.sql |
 *
 * Global seed data (not per-user, not deleted): tools_hsa_default_accounts, tools_gt_default_categories,
 *   tools_ebp_default_categories, tools_ebp_default_types, tools_cs_default_categories,
 *   tools_cs_default_items, tools_hms_default_categories, tools_hms_default_items,
 *   tools_eolp_default_next_steps, etc.
 *
 * Event Budget Planner API: app/api/tools/event-budget-planner/ (route.ts + categories/types/vendors sub-routes)
 * Cleaning Schedule API: app/api/tools/cleaning-schedule/route.ts
 * Cleaning Schedule UI: app/components/CleaningScheduleTool.tsx
 * Cleaning Schedule helpers: lib/cleaning-schedule.ts
 * Home Maintenance Schedule API: app/api/tools/home-maintenance-schedule/route.ts
 * Home Maintenance Schedule UI: app/components/HomeMaintenanceScheduleTool.tsx
 * Home Maintenance Schedule helpers: lib/home-maintenance-schedule.ts
 * End of Life Planner API: app/api/tools/end-of-life-planner/route.ts
 * End of Life Planner UI: app/components/EndOfLifePlannerTool.tsx
 * End of Life Planner helpers: lib/end-of-life-planner.ts, lib/end-of-life-planner-db.ts
 */
export async function deleteUserAndAssociatedData(
  userId: string,
  options?: { visited?: Set<string> }
): Promise<void> {
  const visited = options?.visited ?? new Set<string>();
  if (visited.has(userId)) return;
  visited.add(userId);

  const guests = (await listLinkedGuestAccounts([userId])).get(userId) ?? [];
  for (const guest of guests) {
    if (visited.has(guest.id)) continue;
    await deleteUserTools(guest.id);
    await deleteUserAndAssociatedData(guest.id, { visited });
  }

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

  // Repair History — supabase/archive/create-repair-history-*.sql + supabase/archive/tools/repair-history.sql
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

  const { data: rhAttachments, error: rhAttachmentsError } = await supabaseServer
    .from('tools_rh_record_attachments')
    .select('file_url')
    .eq('user_id', userId);
  if (rhAttachmentsError && !isMissingRelationError(rhAttachmentsError)) throw rhAttachmentsError;
  (rhAttachments || []).forEach((row: { file_url: string | null }) => {
    const path = row.file_url ? extractStoragePath(row.file_url, 'repair-history') : null;
    if (path) storageDeletes.push({ bucket: 'repair-history', path });
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
        const path = row.file_url ? extractStoragePath(row.file_url, 'healthcare-appt-history') : null;
        if (path) storageDeletes.push({ bucket: 'healthcare-appt-history', path });
      });
    }
  }

  // Pet Care Schedule — supabase/archive/create-pet-care-schedule-*.sql + supabase/archive/tools/pet-care-schedule.sql
  const pcsAttachmentTables = [
    'tools_pcs_pet_attachments',
    'tools_pcs_document_attachments',
    'tools_pcs_veterinary_attachments',
    'tools_pcs_vaccination_attachments',
    'tools_pcs_appointment_attachments',
  ] as const;
  for (const table of pcsAttachmentTables) {
    const { data: pcsFiles, error: pcsFilesError } = await supabaseServer
      .from(table)
      .select('file_url')
      .eq('user_id', userId);
    if (pcsFilesError && !isMissingRelationError(pcsFilesError)) throw pcsFilesError;
    (pcsFiles || []).forEach((row: { file_url: string | null }) => {
      const path = row.file_url ? extractStoragePath(row.file_url, 'pet-care-schedule') : null;
      if (path) storageDeletes.push({ bucket: 'pet-care-schedule', path });
    });
  }

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

  // HSA Tracker receipts — supabase/archive/tools/hsa-tracker.sql
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
  // HSA Tracker DB rows — supabase/archive/tools/hsa-tracker.sql (receipt files handled above)
  // tools_hsa_accounts, tools_hsa_deposits, tools_hsa_expenses: removed via users ON DELETE CASCADE

  // To-Do List attachments — supabase/archive/tools/to-do-list.sql
  const { data: todoFiles, error: todoFilesError } = await supabaseServer
    .from('tools_tdl_attachments')
    .select('file_url')
    .eq('user_id', userId);
  if (todoFilesError && !isMissingRelationError(todoFilesError)) throw todoFilesError;
  (todoFiles || []).forEach((row: { file_url: string | null }) => {
    const path = row.file_url ? extractStoragePath(row.file_url, 'to-do-list') : null;
    if (path) storageDeletes.push({ bucket: 'to-do-list', path });
  });

  // Notes attachments — supabase/archive/tools/notes.sql
  const { data: noteFiles, error: noteFilesError } = await supabaseServer
    .from('tools_note_attachments')
    .select('file_url')
    .eq('user_id', userId);
  if (noteFilesError && !isMissingRelationError(noteFilesError)) throw noteFilesError;
  (noteFiles || []).forEach((row: { file_url: string | null }) => {
    const path = row.file_url ? extractStoragePath(row.file_url, 'notes') : null;
    if (path) storageDeletes.push({ bucket: 'notes', path });
  });

  // Address Book attachments — supabase/archive/tools/address-book.sql
  const { data: addressBookFiles, error: addressBookFilesError } = await supabaseServer
    .from('tools_ab_address_attachments')
    .select('file_url')
    .eq('user_id', userId);
  if (addressBookFilesError && !isMissingRelationError(addressBookFilesError)) throw addressBookFilesError;
  (addressBookFiles || []).forEach((row: { file_url: string | null }) => {
    const path = row.file_url ? extractStoragePath(row.file_url, 'address-book') : null;
    if (path) storageDeletes.push({ bucket: 'address-book', path });
  });
  // tools_ab_addresses / tags / address_tags: removed via users ON DELETE CASCADE

  // Travel Log attachments — supabase/archive/tools/travel-log.sql
  const { data: travelFiles, error: travelFilesError } = await supabaseServer
    .from('tools_tl_trip_attachments')
    .select('file_url')
    .eq('user_id', userId);
  if (travelFilesError && !isMissingRelationError(travelFilesError)) throw travelFilesError;
  (travelFiles || []).forEach((row: { file_url: string | null }) => {
    const path = row.file_url ? extractStoragePath(row.file_url, 'travel-log') : null;
    if (path) storageDeletes.push({ bucket: 'travel-log', path });
  });
  // tools_tl_trips (user_id) → tools_tl_lodging, tools_tl_journal_notes: removed via users + trip CASCADE

  // Event Budget Planner attachments — supabase/archive/tools/event-budget-planner.sql
  const { data: ebpEventFiles, error: ebpEventFilesError } = await supabaseServer
    .from('tools_ebp_event_attachments')
    .select('file_url')
    .eq('user_id', userId);
  if (ebpEventFilesError && !isMissingRelationError(ebpEventFilesError)) throw ebpEventFilesError;
  (ebpEventFiles || []).forEach((row: { file_url: string | null }) => {
    const path = row.file_url ? extractStoragePath(row.file_url, 'event-budget-planner') : null;
    if (path) storageDeletes.push({ bucket: 'event-budget-planner', path });
  });

  const { data: ebpExpenseFiles, error: ebpExpenseFilesError } = await supabaseServer
    .from('tools_ebp_expense_attachments')
    .select('file_url')
    .eq('user_id', userId);
  if (ebpExpenseFilesError && !isMissingRelationError(ebpExpenseFilesError)) throw ebpExpenseFilesError;
  (ebpExpenseFiles || []).forEach((row: { file_url: string | null }) => {
    const path = row.file_url ? extractStoragePath(row.file_url, 'event-budget-planner') : null;
    if (path) storageDeletes.push({ bucket: 'event-budget-planner', path });
  });

  // Meal Planner attachments — supabase/archive/tools/meal-planner.sql
  const { data: mealPlannerFiles, error: mealPlannerFilesError } = await supabaseServer
    .from('tools_mp_meal_attachments')
    .select('file_url')
    .eq('user_id', userId);
  if (mealPlannerFilesError && !isMissingRelationError(mealPlannerFilesError)) throw mealPlannerFilesError;
  (mealPlannerFiles || []).forEach((row: { file_url: string | null }) => {
    const path = row.file_url ? extractStoragePath(row.file_url, 'meal-planner') : null;
    if (path) storageDeletes.push({ bucket: 'meal-planner', path });
  });
  // tools_mp_meals / plans / items: removed via users ON DELETE CASCADE

  // Shopping List attachments — supabase/archive/tools/shopping-list.sql
  const { data: shoppingListFiles, error: shoppingListFilesError } = await supabaseServer
    .from('tools_sl_list_attachments')
    .select('file_url')
    .eq('user_id', userId);
  if (shoppingListFilesError && !isMissingRelationError(shoppingListFilesError)) throw shoppingListFilesError;
  (shoppingListFiles || []).forEach((row: { file_url: string | null }) => {
    const path = row.file_url ? extractStoragePath(row.file_url, 'shopping-list') : null;
    if (path) storageDeletes.push({ bucket: 'shopping-list', path });
  });
  // tools_sl_lists / items / list_items: removed via users ON DELETE CASCADE

  // Goals Tracking attachments — supabase/archive/tools/goals-tracking.sql
  const { data: gtGoalFiles, error: gtGoalFilesError } = await supabaseServer
    .from('tools_gt_goal_attachments')
    .select('file_url')
    .eq('user_id', userId);
  if (gtGoalFilesError && !isMissingRelationError(gtGoalFilesError)) throw gtGoalFilesError;
  (gtGoalFiles || []).forEach((row: { file_url: string | null }) => {
    const path = row.file_url ? extractStoragePath(row.file_url, 'goals-tracking') : null;
    if (path) storageDeletes.push({ bucket: 'goals-tracking', path });
  });

  const { data: gtUpdateFiles, error: gtUpdateFilesError } = await supabaseServer
    .from('tools_gt_update_attachments')
    .select('file_url')
    .eq('user_id', userId);
  if (gtUpdateFilesError && !isMissingRelationError(gtUpdateFilesError)) throw gtUpdateFilesError;
  (gtUpdateFiles || []).forEach((row: { file_url: string | null }) => {
    const path = row.file_url ? extractStoragePath(row.file_url, 'goals-tracking') : null;
    if (path) storageDeletes.push({ bucket: 'goals-tracking', path });
  });
  // tools_gt_categories / goals / phases / tasks / update_notes: removed via users + goal CASCADE

  // Calendar Events attachments — supabase/archive/tools/calendar-events.sql
  const { data: calendarEventFiles, error: calendarEventFilesError } = await supabaseServer
    .from('tools_ce_event_attachments')
    .select('file_url')
    .eq('user_id', userId);
  if (calendarEventFilesError && !isMissingRelationError(calendarEventFilesError)) throw calendarEventFilesError;
  (calendarEventFiles || []).forEach((row: { file_url: string | null }) => {
    const path = row.file_url ? extractStoragePath(row.file_url, 'calendar-events') : null;
    if (path) storageDeletes.push({ bucket: 'calendar-events', path });
  });
  // tools_ce_categories / events: removed via users ON DELETE CASCADE

  // Subscription Tracker attachments — supabase/archive/tools/subscription-tracker.sql
  const { data: subscriptionFiles, error: subscriptionFilesError } = await supabaseServer
    .from('tools_st_subscription_attachments')
    .select('file_url')
    .eq('user_id', userId);
  if (subscriptionFilesError && !isMissingRelationError(subscriptionFilesError)) throw subscriptionFilesError;
  (subscriptionFiles || []).forEach((row: { file_url: string | null }) => {
    const path = row.file_url ? extractStoragePath(row.file_url, 'subscription-tracker') : null;
    if (path) storageDeletes.push({ bucket: 'subscription-tracker', path });
  });
  // tools_st_subscriptions: removed via users ON DELETE CASCADE

  // Event Budget Planner — supabase/archive/tools/event-budget-planner.sql
  // Delete events first (CASCADE → budgets/expenses/attachments → splits); categories/types/vendors then cascade from users.
  const { error: ebpEventsDeleteError } = await supabaseServer
    .from('tools_ebp_events')
    .delete()
    .eq('user_id', userId);
  if (ebpEventsDeleteError && !isMissingRelationError(ebpEventsDeleteError)) throw ebpEventsDeleteError;
  // tools_ebp_categories, tools_ebp_types, tools_ebp_vendors: removed via users ON DELETE CASCADE

  // Cleaning Schedule attachments — supabase/archive/tools/cleaning-schedule.sql
  const { data: csItemFiles, error: csItemFilesError } = await supabaseServer
    .from('tools_cs_item_attachments')
    .select('file_url')
    .eq('user_id', userId);
  if (csItemFilesError && !isMissingRelationError(csItemFilesError)) throw csItemFilesError;
  (csItemFiles || []).forEach((row: { file_url: string | null }) => {
    const path = row.file_url ? extractStoragePath(row.file_url, 'cleaning-schedule') : null;
    if (path) storageDeletes.push({ bucket: 'cleaning-schedule', path });
  });

  const { data: csCompletionFiles, error: csCompletionFilesError } = await supabaseServer
    .from('tools_cs_completion_attachments')
    .select('file_url')
    .eq('user_id', userId);
  if (csCompletionFilesError && !isMissingRelationError(csCompletionFilesError)) throw csCompletionFilesError;
  (csCompletionFiles || []).forEach((row: { file_url: string | null }) => {
    const path = row.file_url ? extractStoragePath(row.file_url, 'cleaning-schedule') : null;
    if (path) storageDeletes.push({ bucket: 'cleaning-schedule', path });
  });

  // Cleaning Schedule — supabase/archive/tools/cleaning-schedule.sql
  // Items restrict category deletes; a trigger also blocks DELETE of is_default rows.
  // Clear the default flag, then delete items (CASCADE → tasks → completions) before categories.
  const { error: csItemsUnflagError } = await supabaseServer
    .from('tools_cs_items')
    .update({ is_default: false })
    .eq('user_id', userId);
  if (csItemsUnflagError && !isMissingRelationError(csItemsUnflagError)) throw csItemsUnflagError;

  const { error: csCategoriesUnflagError } = await supabaseServer
    .from('tools_cs_categories')
    .update({ is_default: false })
    .eq('user_id', userId);
  if (csCategoriesUnflagError && !isMissingRelationError(csCategoriesUnflagError)) throw csCategoriesUnflagError;

  const { error: csItemsDeleteError } = await supabaseServer
    .from('tools_cs_items')
    .delete()
    .eq('user_id', userId);
  if (csItemsDeleteError && !isMissingRelationError(csItemsDeleteError)) throw csItemsDeleteError;

  const { error: csCategoriesDeleteError } = await supabaseServer
    .from('tools_cs_categories')
    .delete()
    .eq('user_id', userId);
  if (csCategoriesDeleteError && !isMissingRelationError(csCategoriesDeleteError)) throw csCategoriesDeleteError;
  // tools_cs_default_categories / tools_cs_default_items are global seed rows and are left in place.

  // Home Maintenance Schedule attachments — supabase/archive/tools/home-maintenance-schedule.sql
  const { data: hmsItemFiles, error: hmsItemFilesError } = await supabaseServer
    .from('tools_hms_item_attachments')
    .select('file_url')
    .eq('user_id', userId);
  if (hmsItemFilesError && !isMissingRelationError(hmsItemFilesError)) throw hmsItemFilesError;
  (hmsItemFiles || []).forEach((row: { file_url: string | null }) => {
    const path = row.file_url ? extractStoragePath(row.file_url, 'home-maintenance-schedule') : null;
    if (path) storageDeletes.push({ bucket: 'home-maintenance-schedule', path });
  });

  const { data: hmsCompletionFiles, error: hmsCompletionFilesError } = await supabaseServer
    .from('tools_hms_completion_attachments')
    .select('file_url')
    .eq('user_id', userId);
  if (hmsCompletionFilesError && !isMissingRelationError(hmsCompletionFilesError)) throw hmsCompletionFilesError;
  (hmsCompletionFiles || []).forEach((row: { file_url: string | null }) => {
    const path = row.file_url ? extractStoragePath(row.file_url, 'home-maintenance-schedule') : null;
    if (path) storageDeletes.push({ bucket: 'home-maintenance-schedule', path });
  });

  // Home Maintenance Schedule — supabase/archive/tools/home-maintenance-schedule.sql
  // API: app/api/tools/home-maintenance-schedule/route.ts
  // UI: app/components/HomeMaintenanceScheduleTool.tsx
  // Helpers: lib/home-maintenance-schedule.ts
  // Items restrict category deletes; a trigger also blocks DELETE of is_default rows.
  // Clear the default flag, then delete items (CASCADE → tasks → completions) before categories.
  const { error: hmsItemsUnflagError } = await supabaseServer
    .from('tools_hms_items')
    .update({ is_default: false })
    .eq('user_id', userId);
  if (hmsItemsUnflagError && !isMissingRelationError(hmsItemsUnflagError)) throw hmsItemsUnflagError;

  const { error: hmsCategoriesUnflagError } = await supabaseServer
    .from('tools_hms_categories')
    .update({ is_default: false })
    .eq('user_id', userId);
  if (hmsCategoriesUnflagError && !isMissingRelationError(hmsCategoriesUnflagError)) throw hmsCategoriesUnflagError;

  const { error: hmsItemsDeleteError } = await supabaseServer
    .from('tools_hms_items')
    .delete()
    .eq('user_id', userId);
  if (hmsItemsDeleteError && !isMissingRelationError(hmsItemsDeleteError)) throw hmsItemsDeleteError;

  const { error: hmsCategoriesDeleteError } = await supabaseServer
    .from('tools_hms_categories')
    .delete()
    .eq('user_id', userId);
  if (hmsCategoriesDeleteError && !isMissingRelationError(hmsCategoriesDeleteError)) throw hmsCategoriesDeleteError;
  // tools_hms_default_categories / tools_hms_default_items are global seed rows and are left in place.

  // End of Life Planner attachments — supabase/archive/tools/end-of-life-planner.sql
  for (const table of [
    'tools_eolp_document_attachments',
    'tools_eolp_insurance_attachments',
    'tools_eolp_letter_attachments',
    'tools_eolp_personal_item_attachments',
    'tools_eolp_other_record_attachments',
  ] as const) {
    const { data: eolFiles, error: eolFilesError } = await supabaseServer
      .from(table)
      .select('file_url')
      .eq('user_id', userId);
    if (eolFilesError && !isMissingRelationError(eolFilesError)) throw eolFilesError;
    (eolFiles || []).forEach((row: { file_url: string | null }) => {
      const path = row.file_url ? extractStoragePath(row.file_url, 'end-of-life-planner') : null;
      if (path) storageDeletes.push({ bucket: 'end-of-life-planner', path });
    });
  }

  // End of Life Planner — supabase/archive/tools/end-of-life-planner.sql
  // API: app/api/tools/end-of-life-planner/route.ts
  // UI: app/components/EndOfLifePlannerTool.tsx
  // Helpers: lib/end-of-life-planner.ts, lib/end-of-life-planner-db.ts
  // tools_eolp_plans and child tools_eolp_* rows (sections, subsections, personal, personal_blocks,
  // family_members, contacts, devices, online_accounts, documents, insurance, bank_accounts,
  // investments, credit_cards, debts, income_sources, recurring_bills, home, utilities, providers,
  // vehicles, next_steps, eol_wishes, my_wishes, personal_items, letters, other_records,
  // other_custom_fields): removed via users ON DELETE CASCADE (and plan/record CASCADE).
  // tools_eolp_default_next_steps is global seed data and is left in place.

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

  await deleteAuthIdentity(userId);
}

function isMissingAuthUser(error: { status?: number; code?: string; message?: string }): boolean {
  if (error.status === 404) return true;
  const code = (error.code || '').toLowerCase();
  if (code === 'user_not_found') return true;
  return (error.message || '').toLowerCase().includes('user not found');
}

/**
 * Hard-delete the Supabase Auth identity so the email can be used again.
 * Application data is already removed with public.users. A missing Auth user
 * is treated as already deleted.
 */
async function deleteAuthIdentity(userId: string): Promise<void> {
  const { error } = await supabaseServer.auth.admin.deleteUser(userId, false);
  if (!error || isMissingAuthUser(error)) return;
  console.error('Auth identity delete failed', userId);
  throw error;
}

export type DeletedUserTool = {
  userId: string;
  toolId: string;
  toolName: string;
};

/**
 * Wipe one user's data and Storage files for a single catalog tool.
 *
 * Used as `delete_user_tool(userId, toolId)` — `toolId` is `tools.id`, not `users_tools.id`.
 * Does not delete the user, `users_tools` ownership, `user_tool_entitlements`,
 * `tool_icons`, or global seed tables.
 * Calendar pins for that user + tool are removed.
 *
 * Cleaning Schedule / Home Maintenance: unflag `is_default` then delete items before categories
 * (same trigger/RESTRICT pattern as full-account erase). Event Budget Planner: delete events first.
 */
export async function deleteUserTool(userId: string, toolId: string): Promise<DeletedUserTool> {
  if (!userId) throw new Error('userId is required');
  if (!toolId) throw new Error('toolId is required');

  const { data: tool, error: toolError } = await supabaseServer
    .from('tools')
    .select('id, name')
    .eq('id', toolId)
    .maybeSingle();
  if (toolError) throw toolError;
  if (!tool) throw new Error(`Tool not found: ${toolId}`);

  const toolName = tool.name;
  const storageDeletes: StorageDelete[] = [];

  switch (toolName) {
    case 'Important Documents': {
      await collectUserFileUrls('tools_id_documents', userId, 'important-documents', storageDeletes);
      await deleteUserToolRows('tools_id_documents', userId, toolId);
      await deleteUserToolRows('tools_id_tags', userId, toolId);
      break;
    }
    case 'Notes': {
      await collectUserFileUrls('tools_note_attachments', userId, 'notes', storageDeletes);
      await deleteUserToolRows('tools_note_notes', userId, toolId);
      await deleteUserToolRows('tools_note_tags', userId, toolId);
      break;
    }
    case 'To Do List': {
      await collectUserFileUrls('tools_tdl_attachments', userId, 'to-do-list', storageDeletes);
      await deleteUserToolRows('tools_tdl_tasks', userId, toolId);
      await deleteUserToolRows('tools_tdl_categories', userId, toolId);
      break;
    }
    case 'Repair History': {
      const { data: rhRecords, error: rhError } = await supabaseServer
        .from('tools_rh_records')
        .select('id, receipt_file_url, warranty_file_url')
        .eq('user_id', userId)
        .eq('tool_id', toolId);
      if (rhError && !isMissingRelationError(rhError)) throw rhError;

      const rhRecordIds = (rhRecords || []).map((row: { id: string }) => row.id);
      (rhRecords || []).forEach((row: { receipt_file_url: string | null; warranty_file_url: string | null }) => {
        pushFileUrl(storageDeletes, row.receipt_file_url, 'repair-history');
        pushFileUrl(storageDeletes, row.warranty_file_url, 'repair-history');
      });

      await collectUserFileUrls('tools_rh_record_attachments', userId, 'repair-history', storageDeletes);

      if (rhRecordIds.length > 0) {
        const { data: rhPictures, error: rhPicturesError } = await supabaseServer
          .from('tools_rh_repair_pictures')
          .select('file_url')
          .in('record_id', rhRecordIds);
        if (rhPicturesError && !isMissingRelationError(rhPicturesError)) throw rhPicturesError;
        pushFileUrlRows(storageDeletes, rhPictures, 'repair-history');
      }

      await deleteUserToolRows('tools_rh_headers', userId, toolId);
      await deleteUserToolRows('tools_rh_items', userId, toolId);
      break;
    }
    case 'Healthcare Appts and History':
    case 'Healthcare Appts & History': {
      const { data: hcahHeaders, error: hcahHeadersError } = await supabaseServer
        .from('tools_hcah_headers')
        .select('id')
        .eq('user_id', userId)
        .eq('tool_id', toolId);
      if (hcahHeadersError && !isMissingRelationError(hcahHeadersError)) throw hcahHeadersError;

      const hcahHeaderIds = (hcahHeaders || []).map((row: { id: string }) => row.id);
      if (hcahHeaderIds.length > 0) {
        const { data: hcahRecords, error: hcahRecordsError } = await supabaseServer
          .from('tools_hcah_records')
          .select('id')
          .in('header_id', hcahHeaderIds);
        if (hcahRecordsError && !isMissingRelationError(hcahRecordsError)) throw hcahRecordsError;

        const hcahRecordIds = (hcahRecords || []).map((row: { id: string }) => row.id);
        if (hcahRecordIds.length > 0) {
          const { data: hcahDocs, error: hcahDocsError } = await supabaseServer
            .from('tools_hcah_documents')
            .select('file_url')
            .in('record_id', hcahRecordIds);
          if (hcahDocsError && !isMissingRelationError(hcahDocsError)) throw hcahDocsError;
          pushFileUrlRows(storageDeletes, hcahDocs, 'healthcare-appt-history');
        }
      }

      await deleteUserToolRows('tools_hcah_headers', userId, toolId);
      break;
    }
    case 'Pet Care Schedule': {
      for (const table of [
        'tools_pcs_pet_attachments',
        'tools_pcs_document_attachments',
        'tools_pcs_veterinary_attachments',
        'tools_pcs_vaccination_attachments',
        'tools_pcs_appointment_attachments',
      ] as const) {
        await collectUserFileUrls(table, userId, 'pet-care-schedule', storageDeletes);
      }

      const { data: pets, error: petsError } = await supabaseServer
        .from('tools_pcs_pets')
        .select('id')
        .eq('user_id', userId)
        .eq('tool_id', toolId);
      if (petsError && !isMissingRelationError(petsError)) throw petsError;

      const petIds = (pets || []).map((row: { id: string }) => row.id);
      if (petIds.length > 0) {
        const { data: petDocs, error: petDocsError } = await supabaseServer
          .from('tools_pcs_documents')
          .select('file_url')
          .in('pet_id', petIds);
        if (petDocsError && !isMissingRelationError(petDocsError)) throw petDocsError;
        pushFileUrlRows(storageDeletes, petDocs, 'pet-care-schedule');
      }

      await deleteUserToolRows('tools_pcs_pets', userId, toolId);
      break;
    }
    case 'HSA Tracker': {
      const { data: hsaExpenses, error: hsaExpensesError } = await supabaseServer
        .from('tools_hsa_expenses')
        .select('id')
        .eq('user_id', userId)
        .eq('tool_id', toolId);
      if (hsaExpensesError && !isMissingRelationError(hsaExpensesError)) throw hsaExpensesError;

      const hsaExpenseIds = (hsaExpenses || []).map((row: { id: string }) => row.id);
      if (hsaExpenseIds.length > 0) {
        const { data: hsaReceipts, error: hsaReceiptsError } = await supabaseServer
          .from('tools_hsa_expense_receipts')
          .select('file_url')
          .in('expense_id', hsaExpenseIds);
        if (hsaReceiptsError && !isMissingRelationError(hsaReceiptsError)) throw hsaReceiptsError;
        pushFileUrlRows(storageDeletes, hsaReceipts, 'hsa-tracker');
      }

      await deleteUserToolRows('tools_hsa_deposits', userId, toolId);
      await deleteUserToolRows('tools_hsa_expenses', userId, toolId);
      await deleteUserToolRows('tools_hsa_accounts', userId, toolId);
      break;
    }
    case 'Travel Log': {
      await collectUserFileUrls('tools_tl_trip_attachments', userId, 'travel-log', storageDeletes);
      await deleteUserToolRows('tools_tl_trips', userId, toolId);
      break;
    }
    case 'Event Budget Planner': {
      await collectUserFileUrls('tools_ebp_event_attachments', userId, 'event-budget-planner', storageDeletes);
      await collectUserFileUrls('tools_ebp_expense_attachments', userId, 'event-budget-planner', storageDeletes);
      await deleteUserToolRows('tools_ebp_events', userId, toolId);
      await deleteUserToolRows('tools_ebp_categories', userId, toolId);
      await deleteUserToolRows('tools_ebp_types', userId, toolId);
      await deleteUserToolRows('tools_ebp_vendors', userId, toolId);
      break;
    }
    case 'Meal Planner': {
      await collectUserFileUrls('tools_mp_meal_attachments', userId, 'meal-planner', storageDeletes);
      await deleteUserToolRows('tools_mp_plans', userId, toolId);
      await deleteUserToolRows('tools_mp_meals', userId, toolId);
      await deleteUserToolRows('tools_mp_meal_types', userId, toolId);
      await deleteUserToolRows('tools_mp_items', userId, toolId);
      break;
    }
    case 'Shopping List': {
      await collectUserFileUrls('tools_sl_list_attachments', userId, 'shopping-list', storageDeletes);
      await deleteUserToolRows('tools_sl_lists', userId, toolId);
      await deleteUserToolRows('tools_sl_items', userId, toolId);
      break;
    }
    case 'Goals Tracking': {
      await collectUserFileUrls('tools_gt_goal_attachments', userId, 'goals-tracking', storageDeletes);
      await collectUserFileUrls('tools_gt_update_attachments', userId, 'goals-tracking', storageDeletes);
      await deleteUserToolRows('tools_gt_goals', userId, toolId);
      await deleteUserToolRows('tools_gt_categories', userId, toolId);
      break;
    }
    case 'Calendar Events': {
      await collectUserFileUrls('tools_ce_event_attachments', userId, 'calendar-events', storageDeletes);
      await deleteUserToolRows('tools_ce_events', userId, toolId);
      await deleteUserToolRows('tools_ce_categories', userId, toolId);
      break;
    }
    case 'Subscription Tracker': {
      await collectUserFileUrls('tools_st_subscription_attachments', userId, 'subscription-tracker', storageDeletes);
      await deleteUserToolRows('tools_st_subscriptions', userId, toolId);
      break;
    }
    case 'Address Book': {
      await collectUserFileUrls('tools_ab_address_attachments', userId, 'address-book', storageDeletes);
      await deleteUserToolRows('tools_ab_addresses', userId, toolId);
      await deleteUserToolRows('tools_ab_tags', userId, toolId);
      break;
    }
    case 'Cleaning Schedule': {
      await collectUserFileUrls('tools_cs_item_attachments', userId, 'cleaning-schedule', storageDeletes);
      await collectUserFileUrls('tools_cs_completion_attachments', userId, 'cleaning-schedule', storageDeletes);

      const { error: csItemsUnflagError } = await supabaseServer
        .from('tools_cs_items')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('tool_id', toolId);
      if (csItemsUnflagError && !isMissingRelationError(csItemsUnflagError)) throw csItemsUnflagError;

      const { error: csCategoriesUnflagError } = await supabaseServer
        .from('tools_cs_categories')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('tool_id', toolId);
      if (csCategoriesUnflagError && !isMissingRelationError(csCategoriesUnflagError)) throw csCategoriesUnflagError;

      await deleteUserToolRows('tools_cs_items', userId, toolId);
      await deleteUserToolRows('tools_cs_categories', userId, toolId);
      break;
    }
    case 'Home Maintenance Schedule': {
      await collectUserFileUrls('tools_hms_item_attachments', userId, 'home-maintenance-schedule', storageDeletes);
      await collectUserFileUrls('tools_hms_completion_attachments', userId, 'home-maintenance-schedule', storageDeletes);

      const { error: hmsItemsUnflagError } = await supabaseServer
        .from('tools_hms_items')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('tool_id', toolId);
      if (hmsItemsUnflagError && !isMissingRelationError(hmsItemsUnflagError)) throw hmsItemsUnflagError;

      const { error: hmsCategoriesUnflagError } = await supabaseServer
        .from('tools_hms_categories')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('tool_id', toolId);
      if (hmsCategoriesUnflagError && !isMissingRelationError(hmsCategoriesUnflagError)) throw hmsCategoriesUnflagError;

      await deleteUserToolRows('tools_hms_items', userId, toolId);
      await deleteUserToolRows('tools_hms_categories', userId, toolId);
      break;
    }
    case 'End of Life Planner': {
      for (const table of [
        'tools_eolp_document_attachments',
        'tools_eolp_insurance_attachments',
        'tools_eolp_letter_attachments',
        'tools_eolp_personal_item_attachments',
        'tools_eolp_other_record_attachments',
      ] as const) {
        await collectUserFileUrls(table, userId, 'end-of-life-planner', storageDeletes);
      }
      await deleteUserToolRows('tools_eolp_plans', userId, toolId);
      break;
    }
    case 'Percent of my Order':
      break;
    default:
      throw new Error(`delete_user_tool has no wipe mapping for tool "${toolName}"`);
  }

  await flushStorageDeletes(storageDeletes);

  const { error: pinsError } = await supabaseServer
    .from('calendar_pins')
    .delete()
    .eq('user_id', userId)
    .eq('tool_id', toolId);
  if (pinsError && !isMissingRelationError(pinsError)) throw pinsError;

  return { userId, toolId, toolName };
}

/**
 * Wipe every catalog tool this user currently owns.
 *
 * Used as `delete_user_tools(userId)`. Calls `delete_user_tool` once per
 * distinct `users_tools.tool_id`. Does not delete the user, `users_tools`,
 * or `user_tool_entitlements`. Tools with no wipe mapping are left for
 * `delete_user`, which still removes the account and cascaded rows.
 */
export async function deleteUserTools(userId: string): Promise<DeletedUserTool[]> {
  if (!userId) throw new Error('userId is required');

  const { data: rows, error } = await supabaseServer
    .from('users_tools')
    .select('tool_id')
    .eq('user_id', userId);

  if (error && !isMissingRelationError(error)) throw error;

  const toolIds = Array.from(
    new Set(
      (rows || [])
        .map((row: { tool_id: string | null }) => row.tool_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  const deleted: DeletedUserTool[] = [];
  for (const toolId of toolIds) {
    try {
      deleted.push(await deleteUserTool(userId, toolId));
    } catch (toolError) {
      if (toolError instanceof Error && toolError.message.includes('no wipe mapping')) {
        console.warn(toolError.message);
        continue;
      }
      throw toolError;
    }
  }

  return deleted;
}

export const delete_user_tool = deleteUserTool;
export const delete_user_tools = deleteUserTools;
export const delete_user = deleteUserAndAssociatedData;
