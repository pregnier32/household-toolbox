-- Subscription Tracker attachments: multiple optional files per subscription.
-- Safe to re-run. After this succeeds, reload types:
--   npm run supabase:types
--
-- Files live in the existing `subscription-tracker` storage bucket at
-- {userId}/{subscriptionId}/{timestamp}-{filename}
--
-- One store covers receipts, contracts, and renewal notices. Do not attach
-- files to categories, search, Export, billed/renewal dates, or calendar pins.
-- History (is_active = false) is View/Download only. Reactivate to add or
-- remove files.

CREATE TABLE IF NOT EXISTS tools_st_subscription_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES tools_st_subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_st_subscription_attachments_subscription_id
  ON tools_st_subscription_attachments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_st_subscription_attachments_user_id
  ON tools_st_subscription_attachments(user_id);

ALTER TABLE tools_st_subscription_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own subscription attachments" ON tools_st_subscription_attachments;
CREATE POLICY "Users can view their own subscription attachments" ON tools_st_subscription_attachments
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own subscription attachments" ON tools_st_subscription_attachments;
CREATE POLICY "Users can insert their own subscription attachments" ON tools_st_subscription_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own subscription attachments" ON tools_st_subscription_attachments;
CREATE POLICY "Users can update their own subscription attachments" ON tools_st_subscription_attachments
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own subscription attachments" ON tools_st_subscription_attachments;
CREATE POLICY "Users can delete their own subscription attachments" ON tools_st_subscription_attachments
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));
