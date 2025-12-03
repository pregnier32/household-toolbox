-- Create billing_active and billing_history tables
-- This script creates the tables for managing active and historical billing records

-- ============================================================================
-- 1. CREATE billing_active TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS billing_active (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  billing_date DATE NOT NULL, -- The day of month when billing occurs
  item_type TEXT NOT NULL CHECK (item_type IN ('tool_subscription', 'platform_fee')),
  tool_id UUID REFERENCES tools(id) ON DELETE SET NULL, -- NULL for platform_fee
  tool_name TEXT, -- Denormalized for quick access
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  users_tools_id UUID REFERENCES users_tools(id) ON DELETE SET NULL, -- Link to source subscription
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraints using partial indexes
CREATE UNIQUE INDEX IF NOT EXISTS unique_platform_fee_per_period 
  ON billing_active(user_id, billing_period_start, billing_period_end) 
  WHERE item_type = 'platform_fee';

CREATE UNIQUE INDEX IF NOT EXISTS unique_tool_subscription_per_period 
  ON billing_active(users_tools_id, billing_period_start, billing_period_end) 
  WHERE item_type = 'tool_subscription' AND users_tools_id IS NOT NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_billing_active_user_id ON billing_active(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_active_billing_date ON billing_active(billing_date);
CREATE INDEX IF NOT EXISTS idx_billing_active_status ON billing_active(status);
CREATE INDEX IF NOT EXISTS idx_billing_active_users_tools_id ON billing_active(users_tools_id);
CREATE INDEX IF NOT EXISTS idx_billing_active_period ON billing_active(billing_period_start, billing_period_end);

-- ============================================================================
-- 2. CREATE billing_history TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS billing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  billing_date DATE NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('tool_subscription', 'platform_fee')),
  tool_id UUID REFERENCES tools(id) ON DELETE SET NULL,
  tool_name TEXT,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('processed', 'failed', 'refunded')),
  users_tools_id UUID REFERENCES users_tools(id) ON DELETE SET NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Original creation date from billing_active
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Payment processing metadata
  payment_intent_id TEXT,
  invoice_id TEXT,
  notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_billing_history_user_id ON billing_history(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_billing_date ON billing_history(billing_date);
CREATE INDEX IF NOT EXISTS idx_billing_history_processed_at ON billing_history(processed_at);
CREATE INDEX IF NOT EXISTS idx_billing_history_users_tools_id ON billing_history(users_tools_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_period ON billing_history(billing_period_start, billing_period_end);

-- ============================================================================
-- 3. CREATE FUNCTION TO UPDATE updated_at TIMESTAMP
-- ============================================================================

CREATE OR REPLACE FUNCTION update_billing_active_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_billing_active_updated_at
  BEFORE UPDATE ON billing_active
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_active_updated_at();

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE billing_active ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own billing records
CREATE POLICY "Users can view their own active billing" ON billing_active
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own billing history" ON billing_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Service role can manage all records
CREATE POLICY "Service role can manage billing_active" ON billing_active
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage billing_history" ON billing_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

