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
 * | Notes                   | tools_note_attachments (file_url)                                  | notes                  | supabase/ADD_notes_attachments.sql |
 * | To-Do List              | tools_tdl_attachments (file_url)                                   | to-do-list             | supabase/ADD_todo_attachments.sql |
 * | Cleaning Schedule       | tools_cs_item_attachments, tools_cs_completion_attachments (file_url) | cleaning-schedule   | supabase/ADD_cleaning_schedule_attachments.sql |
 * | Repair History          | tools_rh_record_attachments, tools_rh_records (receipt_file_url, warranty_file_url), tools_rh_repair_pictures (file_url) | repair-history | supabase/ADD_repair_history_attachments.sql, supabase/archive/create-repair-history-tables.sql |
 * | Healthcare Appts        | tools_hcah_documents (file_url) via headers → records              | healthcare-appt-history | supabase/archive/create-healthcare-appts-history-tables.sql, create-healthcare-appts-history-storage-bucket.sql, supabase/ADD_healthcare_attachments.sql |
 * | Pet Care Schedule       | tools_pcs_pet_attachments, tools_pcs_document_attachments, tools_pcs_veterinary_attachments, tools_pcs_vaccination_attachments, tools_pcs_appointment_attachments, tools_pcs_documents.file_url | pet-care-schedule | supabase/archive/create-pet-care-schedule-tables.sql, supabase/ADD_pet_care_attachments.sql |
 * | HSA Tracker (receipts)  | tools_hsa_expense_receipts (file_url) via expenses                  | hsa-tracker            | supabase/ADD_hsa_attachments.sql |
 * | Travel Log              | tools_tl_trip_attachments (file_url)                               | travel-log             | supabase/ADD_travel_log_attachments.sql |
 * | Event Budget Planner    | tools_ebp_event_attachments, tools_ebp_expense_attachments (file_url) | event-budget-planner | supabase/ADD_event_budget_planner_attachments.sql |
 * | Meal Planner            | tools_mp_meal_attachments (file_url)                               | meal-planner           | supabase/ADD_meal_planner_attachments.sql |
 * | Shopping List           | tools_sl_list_attachments (file_url)                               | shopping-list          | supabase/ADD_shopping_list_attachments.sql |
 * | Goals Tracking          | tools_gt_goal_attachments, tools_gt_update_attachments (file_url)  | goals-tracking         | supabase/ADD_goals_tracking_attachments.sql |
 * | Calendar Events         | tools_ce_event_attachments (file_url)                              | calendar-events        | supabase/ADD_calendar_events_attachments.sql |
 * | Subscription Tracker    | tools_st_subscription_attachments (file_url)                       | subscription-tracker   | supabase/ADD_subscription_tracker_attachments.sql |
 * | Address Book            | tools_ab_address_attachments (file_url)                            | address-book           | supabase/ADD_address_book_attachments.sql |
 * | Home Maintenance        | tools_hms_item_attachments, tools_hms_completion_attachments (file_url) | home-maintenance-schedule | supabase/ADD_home_maintenance_schedule_attachments.sql |
 * | End of Life Planner     | tools_eolp_document_attachments, tools_eolp_insurance_attachments, tools_eolp_letter_attachments, tools_eolp_personal_item_attachments, tools_eolp_other_record_attachments (file_url) | end-of-life-planner | supabase/ADD_end_of_life_planner_attachments.sql |
 *
 * DB-only cascade (user_id → users ON DELETE CASCADE; no storage block required here):
 * | Tool                 | Tables                                                                 | Schema script |
 * |----------------------|------------------------------------------------------------------------|---------------|
 * | Address Book         | tools_ab_addresses, tools_ab_tags, tools_ab_address_tags, tools_ab_address_attachments | supabase/create-tools-ab-tables.sql, supabase/ADD_address_book_attachments.sql |
 * | Travel Log           | tools_tl_trips → tools_tl_lodging, tools_tl_journal_notes, tools_tl_trip_attachments | supabase/create-tools-tl-tables.sql, supabase/ADD_travel_log_attachments.sql |
 * | HSA Tracker          | tools_hsa_accounts, tools_hsa_deposits, tools_hsa_expenses             | supabase/create-tools-hsa-tables.sql |
 * | Event Budget Planner | tools_ebp_categories, tools_ebp_types, tools_ebp_vendors, tools_ebp_events → tools_ebp_event_category_budgets, tools_ebp_expenses → tools_ebp_expense_splits, tools_ebp_event_attachments, tools_ebp_expense_attachments | supabase/create-tools-ebp-tables.sql, supabase/ADD_event_budget_planner_attachments.sql |
 * | Cleaning Schedule    | tools_cs_categories, tools_cs_items → tools_cs_tasks → tools_cs_completions, tools_cs_item_attachments, tools_cs_completion_attachments | supabase/create-tools-cs-tables.sql, supabase/ADD_cleaning_schedule_attachments.sql |
 * | Home Maintenance     | tools_hms_categories, tools_hms_items → tools_hms_tasks → tools_hms_completions, tools_hms_item_attachments, tools_hms_completion_attachments | supabase/create-tools-hms-tables.sql, supabase/ADD_home_maintenance_schedule_attachments.sql |
 * | End of Life Planner  | tools_eolp_plans → sections, subsections, personal/home/wishes 1:1 rows, list tables, tools_eolp_other_custom_fields, document/insurance/letter/personal-item/other attachment tables | supabase/create-tools-eolp-tables.sql, supabase/ADD_end_of_life_planner_attachments.sql |
 * | Notes                | tools_note_notes, tools_note_tags, tools_note_note_tags, tools_note_security_questions, tools_note_attachments | supabase/archive/create-notes-tables.sql, supabase/ADD_notes_attachments.sql |
 * | Goals Tracking       | tools_gt_categories, tools_gt_goals, tools_gt_phases, tools_gt_tasks, tools_gt_update_notes, tools_gt_goal_attachments, tools_gt_update_attachments | supabase/archive/create-tools-gt-tables.sql, supabase/ADD_goals_tracking_attachments.sql |
 * | Meal Planner         | tools_mp_items, tools_mp_meal_types, tools_mp_meals, tools_mp_meal_ingredients, tools_mp_meal_attachments, tools_mp_plans, tools_mp_plan_assignments | supabase/archive/create-tools-mp-tables.sql, supabase/ADD_meal_planner_attachments.sql |
 * | Shopping List        | tools_sl_lists, tools_sl_items, tools_sl_list_items, tools_sl_list_attachments | supabase/archive/create-tools-sl-tables.sql, supabase/ADD_shopping_list_attachments.sql |
 * | To-Do List           | tools_tdl_categories, tools_tdl_tasks, tools_tdl_attachments           | supabase/archive/create-tools-tdl-tables.sql, supabase/ADD_todo_attachments.sql |
 * | Subscription Tracker | tools_st_subscriptions, tools_st_subscription_attachments              | supabase/archive/create-subscription-tracker-tables.sql, supabase/ADD_subscription_tracker_attachments.sql |
 * | Calendar Events      | tools_ce_categories, tools_ce_events, tools_ce_event_attachments      | supabase/archive/create-calendar-events-tables.sql, supabase/ADD_calendar_events_attachments.sql |
 * | Calendar Pins        | calendar_pins                                                          | supabase/create-calendar-pins-table.sql |
 * | Repair History (DB)  | tools_rh_headers, tools_rh_records, tools_rh_items, tools_rh_record_attachments | supabase/archive/create-repair-history-tables.sql, supabase/ADD_repair_history_attachments.sql |
 * | Healthcare (DB)      | tools_hcah_headers, tools_hcah_records (+ document rows cascade)     | supabase/archive/create-healthcare-appts-history-tables.sql |
 * | Pet Care (DB)        | tools_pcs_pets and related child tables + attachment tables            | supabase/archive/create-pet-care-schedule-tables.sql, supabase/ADD_pet_care_attachments.sql |
 * | Important Docs (DB)  | tools_id_documents, tools_id_tags, tools_id_document_tags, tools_id_security_questions | supabase/archive/create-important-documents-tables.sql |
 *
 * Monolithic reference (may duplicate archive scripts): supabase/DB_Build_ASOF_4_26_26.sql
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

  // Repair History — supabase/archive/create-repair-history-*.sql + ADD_repair_history_attachments.sql
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

  // Pet Care Schedule — supabase/archive/create-pet-care-schedule-*.sql + ADD_pet_care_attachments.sql
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

  // HSA Tracker receipts — supabase/ADD_hsa_attachments.sql
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

  // To-Do List attachments — supabase/ADD_todo_attachments.sql
  const { data: todoFiles, error: todoFilesError } = await supabaseServer
    .from('tools_tdl_attachments')
    .select('file_url')
    .eq('user_id', userId);
  if (todoFilesError && !isMissingRelationError(todoFilesError)) throw todoFilesError;
  (todoFiles || []).forEach((row: { file_url: string | null }) => {
    const path = row.file_url ? extractStoragePath(row.file_url, 'to-do-list') : null;
    if (path) storageDeletes.push({ bucket: 'to-do-list', path });
  });

  // Notes attachments — supabase/ADD_notes_attachments.sql
  const { data: noteFiles, error: noteFilesError } = await supabaseServer
    .from('tools_note_attachments')
    .select('file_url')
    .eq('user_id', userId);
  if (noteFilesError && !isMissingRelationError(noteFilesError)) throw noteFilesError;
  (noteFiles || []).forEach((row: { file_url: string | null }) => {
    const path = row.file_url ? extractStoragePath(row.file_url, 'notes') : null;
    if (path) storageDeletes.push({ bucket: 'notes', path });
  });

  // Address Book attachments — supabase/ADD_address_book_attachments.sql
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

  // Travel Log attachments — supabase/ADD_travel_log_attachments.sql
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

  // Event Budget Planner attachments — supabase/ADD_event_budget_planner_attachments.sql
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

  // Meal Planner attachments — supabase/ADD_meal_planner_attachments.sql
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

  // Shopping List attachments — supabase/ADD_shopping_list_attachments.sql
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

  // Goals Tracking attachments — supabase/ADD_goals_tracking_attachments.sql
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

  // Calendar Events attachments — supabase/ADD_calendar_events_attachments.sql
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

  // Subscription Tracker attachments — supabase/ADD_subscription_tracker_attachments.sql
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

  // Event Budget Planner — supabase/create-tools-ebp-tables.sql
  // Delete events first (CASCADE → budgets/expenses/attachments → splits); categories/types/vendors then cascade from users.
  const { error: ebpEventsDeleteError } = await supabaseServer
    .from('tools_ebp_events')
    .delete()
    .eq('user_id', userId);
  if (ebpEventsDeleteError && !isMissingRelationError(ebpEventsDeleteError)) throw ebpEventsDeleteError;
  // tools_ebp_categories, tools_ebp_types, tools_ebp_vendors: removed via users ON DELETE CASCADE

  // Cleaning Schedule attachments — supabase/ADD_cleaning_schedule_attachments.sql
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

  // Cleaning Schedule — supabase/create-tools-cs-tables.sql
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

  // Home Maintenance Schedule attachments — supabase/ADD_home_maintenance_schedule_attachments.sql
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

  // Home Maintenance Schedule — supabase/create-tools-hms-tables.sql
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

  // End of Life Planner attachments — supabase/ADD_end_of_life_planner_attachments.sql
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

  // End of Life Planner — supabase/create-tools-eolp-tables.sql
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
}
