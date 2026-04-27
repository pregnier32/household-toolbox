-- Update RLS policies to allow users to update and delete their own default items
-- This allows users to edit default items that were copied to their tables

-- Update items table policies
DROP POLICY IF EXISTS "Users can update their own items" ON tools_rh_items;
CREATE POLICY "Users can update their own items" ON tools_rh_items
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own items" ON tools_rh_items;
CREATE POLICY "Users can delete their own items" ON tools_rh_items
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);
