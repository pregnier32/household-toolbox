-- Create user_dashboard_kpis table to store user preferences for displaying KPIs on the main dashboard
-- This allows users to toggle which KPIs from various tools they want to see on their main dashboard

CREATE TABLE IF NOT EXISTS user_dashboard_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  kpi_key TEXT NOT NULL, -- e.g., 'subscription_tracker_total_monthly_spend'
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, tool_id, kpi_key)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_dashboard_kpis_user_tool ON user_dashboard_kpis(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_user_dashboard_kpis_user_enabled ON user_dashboard_kpis(user_id, is_enabled) WHERE is_enabled = true;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_dashboard_kpis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_user_dashboard_kpis_updated_at ON user_dashboard_kpis;
CREATE TRIGGER trigger_update_user_dashboard_kpis_updated_at
  BEFORE UPDATE ON user_dashboard_kpis
  FOR EACH ROW
  EXECUTE FUNCTION update_user_dashboard_kpis_updated_at();

-- Enable Row Level Security
ALTER TABLE user_dashboard_kpis ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own KPI preferences
-- Drop existing policies if they exist, then create them

-- SELECT policy
DROP POLICY IF EXISTS "Users can view their own dashboard KPIs" ON user_dashboard_kpis;
CREATE POLICY "Users can view their own dashboard KPIs" ON user_dashboard_kpis
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT policy
DROP POLICY IF EXISTS "Users can insert their own dashboard KPIs" ON user_dashboard_kpis;
CREATE POLICY "Users can insert their own dashboard KPIs" ON user_dashboard_kpis
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE policy
DROP POLICY IF EXISTS "Users can update their own dashboard KPIs" ON user_dashboard_kpis;
CREATE POLICY "Users can update their own dashboard KPIs" ON user_dashboard_kpis
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE policy
DROP POLICY IF EXISTS "Users can delete their own dashboard KPIs" ON user_dashboard_kpis;
CREATE POLICY "Users can delete their own dashboard KPIs" ON user_dashboard_kpis
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
