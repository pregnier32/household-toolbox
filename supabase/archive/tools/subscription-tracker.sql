-- Subscription Tracker — current schema
-- Safe to re-run. Creates anything missing. Does not delete user rows.
-- Includes tables, later columns, attachment tables, and storage policies for bucket "subscription-tracker".
-- Run in the Supabase SQL editor.

-- Subscription Tracker Tool Database Schema
-- All tables prefixed with 'tools_st_'

-- Main subscriptions table - multiple subscriptions per user allowed
CREATE TABLE IF NOT EXISTS tools_st_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- Can be default category or custom category
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'annual')),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31), -- NULL for annual subscriptions
  billed_date DATE, -- Only for annual subscriptions
  renewal_date DATE, -- Only for annual subscriptions
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  date_inactivated DATE, -- When subscription was inactivated
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_st_subscriptions_user_tool ON tools_st_subscriptions(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_st_subscriptions_is_active ON tools_st_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_st_subscriptions_frequency ON tools_st_subscriptions(frequency);
CREATE INDEX IF NOT EXISTS idx_st_subscriptions_category ON tools_st_subscriptions(category);
CREATE INDEX IF NOT EXISTS idx_st_subscriptions_renewal_date ON tools_st_subscriptions(renewal_date) WHERE renewal_date IS NOT NULL;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_st_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_st_subscriptions_updated_at ON tools_st_subscriptions;
CREATE TRIGGER trigger_update_st_subscriptions_updated_at
  BEFORE UPDATE ON tools_st_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_st_subscriptions_updated_at();

-- Enable Row Level Security
ALTER TABLE tools_st_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own subscription data
-- Drop existing policies if they exist, then create them

-- SELECT policy
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON tools_st_subscriptions;
CREATE POLICY "Users can view their own subscriptions" ON tools_st_subscriptions
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- INSERT policy
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON tools_st_subscriptions;
CREATE POLICY "Users can insert their own subscriptions" ON tools_st_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- UPDATE policy
DROP POLICY IF EXISTS "Users can update their own subscriptions" ON tools_st_subscriptions;
CREATE POLICY "Users can update their own subscriptions" ON tools_st_subscriptions
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- DELETE policy
DROP POLICY IF EXISTS "Users can delete their own subscriptions" ON tools_st_subscriptions;
CREATE POLICY "Users can delete their own subscriptions" ON tools_st_subscriptions
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);



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


-- Trigger functions with a fixed search_path.
CREATE OR REPLACE FUNCTION update_st_subscriptions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- Storage policies for bucket "subscription-tracker".
-- Create that bucket in Supabase Storage if it does not exist yet.
DROP POLICY IF EXISTS "subscription-tracker: Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "subscription-tracker: Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "subscription-tracker: Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "subscription-tracker: Users can delete their own files" ON storage.objects;

CREATE POLICY "subscription-tracker: Users can upload to their own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'subscription-tracker' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);

CREATE POLICY "subscription-tracker: Users can read their own files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'subscription-tracker' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);

CREATE POLICY "subscription-tracker: Users can update their own files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'subscription-tracker' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
)
WITH CHECK (
  bucket_id = 'subscription-tracker' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);

CREATE POLICY "subscription-tracker: Users can delete their own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'subscription-tracker' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);


ALTER TABLE IF EXISTS tools_st_subscriptions DROP CONSTRAINT IF EXISTS tools_st_subscriptions_calendar_reminder_id_fkey;
DROP INDEX IF EXISTS idx_st_subscriptions_calendar_reminder_id;
ALTER TABLE IF EXISTS tools_st_subscriptions DROP COLUMN IF EXISTS calendar_reminder_id;
ALTER TABLE IF EXISTS tools_st_subscriptions DROP COLUMN IF EXISTS add_reminder_to_calendar;


NOTIFY pgrst, 'reload schema';
