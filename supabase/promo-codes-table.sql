-- Create promo_codes table to store promotional codes for customer discounts
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  usage_count INTEGER DEFAULT 0 NOT NULL CHECK (usage_count >= 0),
  max_uses INTEGER,
  active BOOLEAN DEFAULT TRUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on code for faster lookups
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);

-- Create index on active and expires_at for filtering active, non-expired codes
CREATE INDEX IF NOT EXISTS idx_promo_codes_active_expires ON promo_codes(active, expires_at);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_promo_codes_created_at ON promo_codes(created_at);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_promo_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_promo_codes_updated_at
  BEFORE UPDATE ON promo_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_promo_codes_updated_at();

-- Enable Row Level Security
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Create policy to allow only service role (server-side) to manage promo codes
-- This ensures promo codes can only be accessed from server-side code
CREATE POLICY "Service role can manage promo codes" ON promo_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Note: Promo codes should only be accessed via server-side code using the service role key
-- This ensures security and prevents unauthorized access to promo code data

