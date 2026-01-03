-- RLS Policy Performance Optimization Migration
-- Addresses Supabase Performance Advisor warnings about auth.uid() re-evaluation
-- 
-- This migration optimizes all RLS policies by wrapping auth.uid() calls in subqueries
-- to prevent re-evaluation for each row, improving query performance at scale.
--
-- Pattern: Replace auth.uid() with (select auth.uid())
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- ============================================================================
-- BILLING TABLES
-- ============================================================================

-- billing_active table
DROP POLICY IF EXISTS "Users can view their own active billing" ON billing_active;
CREATE POLICY "Users can view their own active billing" ON billing_active
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- billing_history table
DROP POLICY IF EXISTS "Users can view their own billing history" ON billing_history;
CREATE POLICY "Users can view their own billing history" ON billing_history
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- CRON JOB LOGS
-- ============================================================================

-- Note: cron_job_logs table doesn't have a user_id column
-- This policy checks if the authenticated user is a superadmin
-- Optimized version: wraps auth.uid() in subquery to prevent re-evaluation
DROP POLICY IF EXISTS "Only superadmins can read cron job logs" ON cron_job_logs;
CREATE POLICY "Only superadmins can read cron job logs" ON cron_job_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (select auth.uid())
      AND (users.user_status)::text = 'superadmin'
    )
  );

-- ============================================================================
-- DASHBOARD ITEMS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own dashboard items" ON dashboard_items;
CREATE POLICY "Users can view their own dashboard items" ON dashboard_items
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own dashboard items" ON dashboard_items;
CREATE POLICY "Users can insert their own dashboard items" ON dashboard_items
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own dashboard items" ON dashboard_items;
CREATE POLICY "Users can update their own dashboard items" ON dashboard_items
  FOR UPDATE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own dashboard items" ON dashboard_items;
CREATE POLICY "Users can delete their own dashboard items" ON dashboard_items
  FOR DELETE
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- CALENDAR EVENTS (tools_ce_*)
-- ============================================================================

-- tools_ce_categories
DROP POLICY IF EXISTS "Users can view their own categories" ON tools_ce_categories;
CREATE POLICY "Users can view their own categories" ON tools_ce_categories
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own categories" ON tools_ce_categories;
CREATE POLICY "Users can insert their own categories" ON tools_ce_categories
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own categories" ON tools_ce_categories;
CREATE POLICY "Users can update their own categories" ON tools_ce_categories
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own categories" ON tools_ce_categories;
CREATE POLICY "Users can delete their own categories" ON tools_ce_categories
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- tools_ce_events
DROP POLICY IF EXISTS "Users can view their own events" ON tools_ce_events;
CREATE POLICY "Users can view their own events" ON tools_ce_events
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own events" ON tools_ce_events;
CREATE POLICY "Users can insert their own events" ON tools_ce_events
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own events" ON tools_ce_events;
CREATE POLICY "Users can update their own events" ON tools_ce_events
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own events" ON tools_ce_events;
CREATE POLICY "Users can delete their own events" ON tools_ce_events
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- IMPORTANT DOCUMENTS (tools_id_*)
-- ============================================================================

-- tools_id_documents
DROP POLICY IF EXISTS "Users can view their own documents" ON tools_id_documents;
CREATE POLICY "Users can view their own documents" ON tools_id_documents
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own documents" ON tools_id_documents;
CREATE POLICY "Users can insert their own documents" ON tools_id_documents
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own documents" ON tools_id_documents;
CREATE POLICY "Users can update their own documents" ON tools_id_documents
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own documents" ON tools_id_documents;
CREATE POLICY "Users can delete their own documents" ON tools_id_documents
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- tools_id_tags
DROP POLICY IF EXISTS "Users can view their own tags" ON tools_id_tags;
CREATE POLICY "Users can view their own tags" ON tools_id_tags
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own tags" ON tools_id_tags;
CREATE POLICY "Users can insert their own tags" ON tools_id_tags
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own tags" ON tools_id_tags;
CREATE POLICY "Users can update their own tags" ON tools_id_tags
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own tags" ON tools_id_tags;
CREATE POLICY "Users can delete their own tags" ON tools_id_tags
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- tools_id_document_tags
DROP POLICY IF EXISTS "Users can view their own document tags" ON tools_id_document_tags;
CREATE POLICY "Users can view their own document tags" ON tools_id_document_tags
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_document_tags.document_id
      AND tools_id_documents.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own document tags" ON tools_id_document_tags;
CREATE POLICY "Users can insert their own document tags" ON tools_id_document_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_document_tags.document_id
      AND tools_id_documents.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own document tags" ON tools_id_document_tags;
CREATE POLICY "Users can update their own document tags" ON tools_id_document_tags
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_document_tags.document_id
      AND tools_id_documents.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_document_tags.document_id
      AND tools_id_documents.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own document tags" ON tools_id_document_tags;
CREATE POLICY "Users can delete their own document tags" ON tools_id_document_tags
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_document_tags.document_id
      AND tools_id_documents.user_id = (select auth.uid())
    )
  );

-- tools_id_security_questions (note: this table doesn't have user_id, it references documents)
DROP POLICY IF EXISTS "Users can view their own security questions" ON tools_id_security_questions;
CREATE POLICY "Users can view their own security questions" ON tools_id_security_questions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_security_questions.document_id
      AND tools_id_documents.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own security questions" ON tools_id_security_questions;
CREATE POLICY "Users can insert their own security questions" ON tools_id_security_questions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_security_questions.document_id
      AND tools_id_documents.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own security questions" ON tools_id_security_questions;
CREATE POLICY "Users can update their own security questions" ON tools_id_security_questions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_security_questions.document_id
      AND tools_id_documents.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_security_questions.document_id
      AND tools_id_documents.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own security questions" ON tools_id_security_questions;
CREATE POLICY "Users can delete their own security questions" ON tools_id_security_questions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_security_questions.document_id
      AND tools_id_documents.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- NOTES (tools_note_*)
-- ============================================================================

-- tools_note_notes
DROP POLICY IF EXISTS "Users can view their own notes" ON tools_note_notes;
CREATE POLICY "Users can view their own notes" ON tools_note_notes
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own notes" ON tools_note_notes;
CREATE POLICY "Users can insert their own notes" ON tools_note_notes
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own notes" ON tools_note_notes;
CREATE POLICY "Users can update their own notes" ON tools_note_notes
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own notes" ON tools_note_notes;
CREATE POLICY "Users can delete their own notes" ON tools_note_notes
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- tools_note_tags
DROP POLICY IF EXISTS "Users can view their own tags" ON tools_note_tags;
CREATE POLICY "Users can view their own tags" ON tools_note_tags
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own tags" ON tools_note_tags;
CREATE POLICY "Users can insert their own tags" ON tools_note_tags
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own tags" ON tools_note_tags;
CREATE POLICY "Users can update their own tags" ON tools_note_tags
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own tags" ON tools_note_tags;
CREATE POLICY "Users can delete their own tags" ON tools_note_tags
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- tools_note_note_tags
DROP POLICY IF EXISTS "Users can view their own note tags" ON tools_note_note_tags;
CREATE POLICY "Users can view their own note tags" ON tools_note_note_tags
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_note_tags.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own note tags" ON tools_note_note_tags;
CREATE POLICY "Users can insert their own note tags" ON tools_note_note_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_note_tags.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own note tags" ON tools_note_note_tags;
CREATE POLICY "Users can update their own note tags" ON tools_note_note_tags
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_note_tags.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_note_tags.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own note tags" ON tools_note_note_tags;
CREATE POLICY "Users can delete their own note tags" ON tools_note_note_tags
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_note_tags.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  );

-- tools_note_security_questions (note: this table doesn't have user_id, it references notes)
DROP POLICY IF EXISTS "Users can view their own security questions" ON tools_note_security_questions;
CREATE POLICY "Users can view their own security questions" ON tools_note_security_questions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_security_questions.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own security questions" ON tools_note_security_questions;
CREATE POLICY "Users can insert their own security questions" ON tools_note_security_questions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_security_questions.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own security questions" ON tools_note_security_questions;
CREATE POLICY "Users can update their own security questions" ON tools_note_security_questions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_security_questions.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_security_questions.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own security questions" ON tools_note_security_questions;
CREATE POLICY "Users can delete their own security questions" ON tools_note_security_questions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_security_questions.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- PET CARE SCHEDULE (tools_pcs_*)
-- ============================================================================

-- tools_pcs_pets (note: actual table name may be tools_PCS_pets, but PostgreSQL folds to lowercase)
DROP POLICY IF EXISTS "Users can view their own pets" ON tools_pcs_pets;
CREATE POLICY "Users can view their own pets" ON tools_pcs_pets
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own pets" ON tools_pcs_pets;
CREATE POLICY "Users can insert their own pets" ON tools_pcs_pets
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own pets" ON tools_pcs_pets;
CREATE POLICY "Users can update their own pets" ON tools_pcs_pets
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own pets" ON tools_pcs_pets;
CREATE POLICY "Users can delete their own pets" ON tools_pcs_pets
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- tools_pcs_food_entries
DROP POLICY IF EXISTS "Users can view their own food entries" ON tools_pcs_food_entries;
CREATE POLICY "Users can view their own food entries" ON tools_pcs_food_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_food_entries.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own food entries" ON tools_pcs_food_entries;
CREATE POLICY "Users can insert their own food entries" ON tools_pcs_food_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_food_entries.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own food entries" ON tools_pcs_food_entries;
CREATE POLICY "Users can update their own food entries" ON tools_pcs_food_entries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_food_entries.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_food_entries.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own food entries" ON tools_pcs_food_entries;
CREATE POLICY "Users can delete their own food entries" ON tools_pcs_food_entries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_food_entries.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

-- tools_pcs_veterinary_records
DROP POLICY IF EXISTS "Users can view their own veterinary records" ON tools_pcs_veterinary_records;
CREATE POLICY "Users can view their own veterinary records" ON tools_pcs_veterinary_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_veterinary_records.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own veterinary records" ON tools_pcs_veterinary_records;
CREATE POLICY "Users can insert their own veterinary records" ON tools_pcs_veterinary_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_veterinary_records.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own veterinary records" ON tools_pcs_veterinary_records;
CREATE POLICY "Users can update their own veterinary records" ON tools_pcs_veterinary_records
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_veterinary_records.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_veterinary_records.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own veterinary records" ON tools_pcs_veterinary_records;
CREATE POLICY "Users can delete their own veterinary records" ON tools_pcs_veterinary_records
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_veterinary_records.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

-- tools_pcs_care_plan_items
DROP POLICY IF EXISTS "Users can view their own care plan items" ON tools_pcs_care_plan_items;
CREATE POLICY "Users can view their own care plan items" ON tools_pcs_care_plan_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_care_plan_items.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own care plan items" ON tools_pcs_care_plan_items;
CREATE POLICY "Users can insert their own care plan items" ON tools_pcs_care_plan_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_care_plan_items.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own care plan items" ON tools_pcs_care_plan_items;
CREATE POLICY "Users can update their own care plan items" ON tools_pcs_care_plan_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_care_plan_items.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_care_plan_items.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own care plan items" ON tools_pcs_care_plan_items;
CREATE POLICY "Users can delete their own care plan items" ON tools_pcs_care_plan_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_care_plan_items.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

-- tools_pcs_vaccinations
DROP POLICY IF EXISTS "Users can view their own vaccinations" ON tools_pcs_vaccinations;
CREATE POLICY "Users can view their own vaccinations" ON tools_pcs_vaccinations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_vaccinations.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own vaccinations" ON tools_pcs_vaccinations;
CREATE POLICY "Users can insert their own vaccinations" ON tools_pcs_vaccinations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_vaccinations.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own vaccinations" ON tools_pcs_vaccinations;
CREATE POLICY "Users can update their own vaccinations" ON tools_pcs_vaccinations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_vaccinations.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_vaccinations.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own vaccinations" ON tools_pcs_vaccinations;
CREATE POLICY "Users can delete their own vaccinations" ON tools_pcs_vaccinations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_vaccinations.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

-- tools_pcs_appointments
DROP POLICY IF EXISTS "Users can view their own appointments" ON tools_pcs_appointments;
CREATE POLICY "Users can view their own appointments" ON tools_pcs_appointments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_appointments.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own appointments" ON tools_pcs_appointments;
CREATE POLICY "Users can insert their own appointments" ON tools_pcs_appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_appointments.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own appointments" ON tools_pcs_appointments;
CREATE POLICY "Users can update their own appointments" ON tools_pcs_appointments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_appointments.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_appointments.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own appointments" ON tools_pcs_appointments;
CREATE POLICY "Users can delete their own appointments" ON tools_pcs_appointments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_appointments.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

-- tools_pcs_documents
DROP POLICY IF EXISTS "Users can view their own documents" ON tools_pcs_documents;
CREATE POLICY "Users can view their own documents" ON tools_pcs_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_documents.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own documents" ON tools_pcs_documents;
CREATE POLICY "Users can insert their own documents" ON tools_pcs_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_documents.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own documents" ON tools_pcs_documents;
CREATE POLICY "Users can update their own documents" ON tools_pcs_documents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_documents.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_documents.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own documents" ON tools_pcs_documents;
CREATE POLICY "Users can delete their own documents" ON tools_pcs_documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_documents.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

-- tools_pcs_notes
DROP POLICY IF EXISTS "Users can view their own notes" ON tools_pcs_notes;
CREATE POLICY "Users can view their own notes" ON tools_pcs_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_notes.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own notes" ON tools_pcs_notes;
CREATE POLICY "Users can insert their own notes" ON tools_pcs_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_notes.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own notes" ON tools_pcs_notes;
CREATE POLICY "Users can update their own notes" ON tools_pcs_notes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_notes.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_notes.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own notes" ON tools_pcs_notes;
CREATE POLICY "Users can delete their own notes" ON tools_pcs_notes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_pcs_pets
      WHERE tools_pcs_pets.id = tools_pcs_notes.pet_id
      AND tools_pcs_pets.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- REPAIR HISTORY (tools_rh_*)
-- ============================================================================

-- tools_rh_headers
DROP POLICY IF EXISTS "Users can view their own headers" ON tools_rh_headers;
CREATE POLICY "Users can view their own headers" ON tools_rh_headers
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own headers" ON tools_rh_headers;
CREATE POLICY "Users can insert their own headers" ON tools_rh_headers
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own headers" ON tools_rh_headers;
CREATE POLICY "Users can update their own headers" ON tools_rh_headers
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own headers" ON tools_rh_headers;
CREATE POLICY "Users can delete their own headers" ON tools_rh_headers
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- tools_rh_records
DROP POLICY IF EXISTS "Users can view their own records" ON tools_rh_records;
CREATE POLICY "Users can view their own records" ON tools_rh_records
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own records" ON tools_rh_records;
CREATE POLICY "Users can insert their own records" ON tools_rh_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id AND
    EXISTS (
      SELECT 1 FROM tools_rh_headers
      WHERE tools_rh_headers.id = tools_rh_records.header_id
      AND tools_rh_headers.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own records" ON tools_rh_records;
CREATE POLICY "Users can update their own records" ON tools_rh_records
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id AND
    EXISTS (
      SELECT 1 FROM tools_rh_headers
      WHERE tools_rh_headers.id = tools_rh_records.header_id
      AND tools_rh_headers.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own records" ON tools_rh_records;
CREATE POLICY "Users can delete their own records" ON tools_rh_records
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- tools_rh_repair_pictures
DROP POLICY IF EXISTS "Users can view their own repair pictures" ON tools_rh_repair_pictures;
CREATE POLICY "Users can view their own repair pictures" ON tools_rh_repair_pictures
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_rh_records
      WHERE tools_rh_records.id = tools_rh_repair_pictures.record_id
      AND tools_rh_records.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own repair pictures" ON tools_rh_repair_pictures;
CREATE POLICY "Users can insert their own repair pictures" ON tools_rh_repair_pictures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_rh_records
      WHERE tools_rh_records.id = tools_rh_repair_pictures.record_id
      AND tools_rh_records.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own repair pictures" ON tools_rh_repair_pictures;
CREATE POLICY "Users can update their own repair pictures" ON tools_rh_repair_pictures
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_rh_records
      WHERE tools_rh_records.id = tools_rh_repair_pictures.record_id
      AND tools_rh_records.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_rh_records
      WHERE tools_rh_records.id = tools_rh_repair_pictures.record_id
      AND tools_rh_records.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own repair pictures" ON tools_rh_repair_pictures;
CREATE POLICY "Users can delete their own repair pictures" ON tools_rh_repair_pictures
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_rh_records
      WHERE tools_rh_records.id = tools_rh_repair_pictures.record_id
      AND tools_rh_records.user_id = (select auth.uid())
    )
  );

-- tools_rh_items
DROP POLICY IF EXISTS "Users can view their own items" ON tools_rh_items;
CREATE POLICY "Users can view their own items" ON tools_rh_items
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id OR is_default = true);

DROP POLICY IF EXISTS "Users can insert their own items" ON tools_rh_items;
CREATE POLICY "Users can insert their own items" ON tools_rh_items
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id AND is_default = false);

DROP POLICY IF EXISTS "Users can update their own items" ON tools_rh_items;
CREATE POLICY "Users can update their own items" ON tools_rh_items
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id AND is_default = false)
  WITH CHECK ((select auth.uid()) = user_id AND is_default = false);

DROP POLICY IF EXISTS "Users can delete their own items" ON tools_rh_items;
CREATE POLICY "Users can delete their own items" ON tools_rh_items
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id AND is_default = false);

-- ============================================================================
-- SUBSCRIPTION TRACKER (tools_st_*)
-- ============================================================================

-- tools_st_subscriptions
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON tools_st_subscriptions;
CREATE POLICY "Users can view their own subscriptions" ON tools_st_subscriptions
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON tools_st_subscriptions;
CREATE POLICY "Users can insert their own subscriptions" ON tools_st_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own subscriptions" ON tools_st_subscriptions;
CREATE POLICY "Users can update their own subscriptions" ON tools_st_subscriptions
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own subscriptions" ON tools_st_subscriptions;
CREATE POLICY "Users can delete their own subscriptions" ON tools_st_subscriptions
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- USER DASHBOARD KPIS
-- ============================================================================

-- user_dashboard_kpis
DROP POLICY IF EXISTS "Users can view their own dashboard KPIs" ON user_dashboard_kpis;
CREATE POLICY "Users can view their own dashboard KPIs" ON user_dashboard_kpis
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own dashboard KPIs" ON user_dashboard_kpis;
CREATE POLICY "Users can insert their own dashboard KPIs" ON user_dashboard_kpis
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own dashboard KPIs" ON user_dashboard_kpis;
CREATE POLICY "Users can update their own dashboard KPIs" ON user_dashboard_kpis
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own dashboard KPIs" ON user_dashboard_kpis;
CREATE POLICY "Users can delete their own dashboard KPIs" ON user_dashboard_kpis
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);
