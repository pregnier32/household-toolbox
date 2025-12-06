-- Fix the foreign key constraint on dashboard_items.user_id
-- This changes the reference from auth.users(id) to users(id) to match other tables

-- Drop the existing foreign key constraint
ALTER TABLE dashboard_items 
  DROP CONSTRAINT IF EXISTS dashboard_items_user_id_fkey;

-- Add the correct foreign key constraint
ALTER TABLE dashboard_items 
  ADD CONSTRAINT dashboard_items_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES users(id) 
  ON DELETE CASCADE;
