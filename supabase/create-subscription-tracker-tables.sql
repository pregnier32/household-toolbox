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
  add_reminder_to_calendar BOOLEAN DEFAULT false, -- Only for annual subscriptions
  calendar_reminder_id UUID REFERENCES dashboard_items(id) ON DELETE SET NULL, -- Link to dashboard calendar event
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
CREATE INDEX IF NOT EXISTS idx_st_subscriptions_calendar_reminder_id ON tools_st_subscriptions(calendar_reminder_id) WHERE calendar_reminder_id IS NOT NULL;

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
  USING (auth.uid() = user_id);

-- INSERT policy
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON tools_st_subscriptions;
CREATE POLICY "Users can insert their own subscriptions" ON tools_st_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE policy
DROP POLICY IF EXISTS "Users can update their own subscriptions" ON tools_st_subscriptions;
CREATE POLICY "Users can update their own subscriptions" ON tools_st_subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE policy
DROP POLICY IF EXISTS "Users can delete their own subscriptions" ON tools_st_subscriptions;
CREATE POLICY "Users can delete their own subscriptions" ON tools_st_subscriptions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

