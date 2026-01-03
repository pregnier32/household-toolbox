-- Performance Optimization Migration
-- Addresses Supabase Database Linter performance suggestions
-- 
-- This migration adds indexes for unindexed foreign keys to improve query performance
-- and optionally removes unused indexes to reduce storage overhead

-- ============================================================================
-- PART 1: ADD INDEXES FOR UNINDEXED FOREIGN KEYS
-- ============================================================================
-- Foreign keys without indexes can cause performance issues during:
-- - JOIN operations
-- - DELETE CASCADE operations
-- - Foreign key constraint checks

-- billing_active table
CREATE INDEX IF NOT EXISTS idx_billing_active_tool_id 
  ON billing_active(tool_id) 
  WHERE tool_id IS NOT NULL;

-- billing_history table
CREATE INDEX IF NOT EXISTS idx_billing_history_tool_id 
  ON billing_history(tool_id) 
  WHERE tool_id IS NOT NULL;

-- tools_ce_categories table
CREATE INDEX IF NOT EXISTS idx_tools_ce_categories_tool_id 
  ON tools_ce_categories(tool_id);

-- tools_ce_events table
CREATE INDEX IF NOT EXISTS idx_tools_ce_events_tool_id 
  ON tools_ce_events(tool_id);

-- tools_id_documents table
CREATE INDEX IF NOT EXISTS idx_tools_id_documents_tool_id 
  ON tools_id_documents(tool_id);

-- tools_id_tags table
CREATE INDEX IF NOT EXISTS idx_tools_id_tags_tool_id 
  ON tools_id_tags(tool_id);

-- tools_note_notes table
CREATE INDEX IF NOT EXISTS idx_tools_note_notes_tool_id 
  ON tools_note_notes(tool_id);

-- tools_note_tags table
CREATE INDEX IF NOT EXISTS idx_tools_note_tags_tool_id 
  ON tools_note_tags(tool_id);

-- tools_pcs_pets table (note: actual table name may be tools_PCS_pets, but PostgreSQL folds to lowercase)
CREATE INDEX IF NOT EXISTS idx_tools_pcs_pets_tool_id 
  ON tools_pcs_pets(tool_id);

-- tools_rh_headers table
CREATE INDEX IF NOT EXISTS idx_tools_rh_headers_tool_id 
  ON tools_rh_headers(tool_id);

-- tools_rh_items table
CREATE INDEX IF NOT EXISTS idx_tools_rh_items_tool_id 
  ON tools_rh_items(tool_id);

-- tools_rh_records table
CREATE INDEX IF NOT EXISTS idx_tools_rh_records_tool_id 
  ON tools_rh_records(tool_id);

-- tools_st_subscriptions table
CREATE INDEX IF NOT EXISTS idx_tools_st_subscriptions_tool_id 
  ON tools_st_subscriptions(tool_id);

-- user_dashboard_kpis table
CREATE INDEX IF NOT EXISTS idx_user_dashboard_kpis_tool_id 
  ON user_dashboard_kpis(tool_id);

-- ============================================================================
-- PART 2: REMOVE UNUSED INDEXES (DEFERRED)
-- ============================================================================
-- This section has been deferred until after the application is fully built.
-- When ready to clean up unused indexes, refer to the Supabase Database Linter
-- report for the complete list of unused indexes to review and remove.
