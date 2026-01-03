-- Repair History Tool Database Schema
-- All tables prefixed with 'tools_rh_'

-- Headers/Categories table - multiple categories per user allowed (Home, Auto1, Auto2, etc.)
CREATE TABLE IF NOT EXISTS tools_rh_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  card_color TEXT DEFAULT '#10b981', -- Color for the category card UI (hex color code)
  category_type TEXT NOT NULL CHECK (category_type IN ('Home', 'Auto')), -- Home or Auto category
  is_default BOOLEAN DEFAULT false, -- True for default categories (Home, Auto1, Auto2)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id and tool_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_rh_headers_user_tool ON tools_rh_headers(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_rh_headers_category_type ON tools_rh_headers(category_type);

-- History records table - repair/replacement records
CREATE TABLE IF NOT EXISTS tools_rh_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  header_id UUID NOT NULL REFERENCES tools_rh_headers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  item_name TEXT NOT NULL, -- Name of the repaired/replaced item
  type TEXT NOT NULL CHECK (type IN ('repair', 'replace')),
  description TEXT,
  cost TEXT, -- Stored as text to allow various formats (e.g., "$150", "150.00", "Free")
  service_provider TEXT,
  
  -- Receipt and Warranty files
  receipt_file_url TEXT, -- URL or path to stored receipt file
  receipt_file_name TEXT, -- Original filename
  warranty_file_url TEXT, -- URL or path to stored warranty file
  warranty_file_name TEXT, -- Original filename
  warranty_end_date DATE, -- Warranty expiration date
  warranty_dashboard_item_id UUID REFERENCES dashboard_items(id) ON DELETE SET NULL, -- Link to dashboard calendar event for warranty expiration
  
  -- Insurance information
  submitted_to_insurance BOOLEAN DEFAULT false,
  insurance_carrier TEXT,
  claim_number TEXT,
  amount_insurance_paid TEXT, -- Stored as text to allow various formats
  agent_contact_info TEXT,
  claim_notes TEXT,
  
  -- Auto-specific fields
  odometer_reading TEXT, -- Odometer reading at time of repair (for Auto categories)
  
  -- Manual link (Home categories only)
  manual_link TEXT, -- URL to online user manual
  
  -- General notes
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_rh_records_header_id ON tools_rh_records(header_id);
CREATE INDEX IF NOT EXISTS idx_rh_records_user_tool ON tools_rh_records(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_rh_records_date ON tools_rh_records(date);
CREATE INDEX IF NOT EXISTS idx_rh_records_type ON tools_rh_records(type);
CREATE INDEX IF NOT EXISTS idx_rh_records_item_name ON tools_rh_records(item_name);
CREATE INDEX IF NOT EXISTS idx_rh_records_warranty_end_date ON tools_rh_records(warranty_end_date) WHERE warranty_end_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rh_records_warranty_dashboard_item_id ON tools_rh_records(warranty_dashboard_item_id) WHERE warranty_dashboard_item_id IS NOT NULL;

-- Repair pictures table - multiple pictures per record
CREATE TABLE IF NOT EXISTS tools_rh_repair_pictures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES tools_rh_records(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL, -- URL or path to stored image file
  file_name TEXT, -- Original filename
  file_size BIGINT, -- File size in bytes
  file_type TEXT, -- MIME type (e.g., 'image/jpeg', 'image/png')
  display_order INTEGER DEFAULT 0, -- Order for displaying pictures
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_rh_pictures_record_id ON tools_rh_repair_pictures(record_id);
CREATE INDEX IF NOT EXISTS idx_rh_pictures_display_order ON tools_rh_repair_pictures(record_id, display_order);

-- Items table - predefined and user-defined items for Home and Auto categories
-- Items are shared across all headers of the same category_type (Home or Auto)
CREATE TABLE IF NOT EXISTS tools_rh_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  category_type TEXT NOT NULL CHECK (category_type IN ('Home', 'Auto')), -- Home or Auto items
  name TEXT NOT NULL,
  area TEXT NOT NULL, -- Area/category grouping (e.g., 'Interior – Major Systems', 'Engine & Powertrain')
  is_default BOOLEAN DEFAULT false, -- True for system-defined default items
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_rh_items_user_tool ON tools_rh_items(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_rh_items_category_type ON tools_rh_items(category_type);
CREATE INDEX IF NOT EXISTS idx_rh_items_area ON tools_rh_items(area);
CREATE INDEX IF NOT EXISTS idx_rh_items_is_default ON tools_rh_items(is_default);

-- Partial unique index: Ensure unique item names per user per category type (only for non-default items)
CREATE UNIQUE INDEX IF NOT EXISTS idx_rh_items_unique_user_item 
  ON tools_rh_items(user_id, tool_id, category_type, name) 
  WHERE is_default = false;

-- Functions to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_rh_headers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_rh_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_rh_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_rh_headers_updated_at ON tools_rh_headers;
CREATE TRIGGER trigger_update_rh_headers_updated_at
  BEFORE UPDATE ON tools_rh_headers
  FOR EACH ROW
  EXECUTE FUNCTION update_rh_headers_updated_at();

DROP TRIGGER IF EXISTS trigger_update_rh_records_updated_at ON tools_rh_records;
CREATE TRIGGER trigger_update_rh_records_updated_at
  BEFORE UPDATE ON tools_rh_records
  FOR EACH ROW
  EXECUTE FUNCTION update_rh_records_updated_at();

DROP TRIGGER IF EXISTS trigger_update_rh_items_updated_at ON tools_rh_items;
CREATE TRIGGER trigger_update_rh_items_updated_at
  BEFORE UPDATE ON tools_rh_items
  FOR EACH ROW
  EXECUTE FUNCTION update_rh_items_updated_at();

-- Enable Row Level Security on all tables
ALTER TABLE tools_rh_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_rh_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_rh_repair_pictures ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_rh_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own repair history data
-- Drop existing policies if they exist, then create them

-- Headers table policies
DROP POLICY IF EXISTS "Users can view their own headers" ON tools_rh_headers;
CREATE POLICY "Users can view their own headers" ON tools_rh_headers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own headers" ON tools_rh_headers;
CREATE POLICY "Users can insert their own headers" ON tools_rh_headers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own headers" ON tools_rh_headers;
CREATE POLICY "Users can update their own headers" ON tools_rh_headers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own headers" ON tools_rh_headers;
CREATE POLICY "Users can delete their own headers" ON tools_rh_headers
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Records table policies
DROP POLICY IF EXISTS "Users can view their own records" ON tools_rh_records;
CREATE POLICY "Users can view their own records" ON tools_rh_records
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own records" ON tools_rh_records;
CREATE POLICY "Users can insert their own records" ON tools_rh_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM tools_rh_headers
      WHERE tools_rh_headers.id = tools_rh_records.header_id
      AND tools_rh_headers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own records" ON tools_rh_records;
CREATE POLICY "Users can update their own records" ON tools_rh_records
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM tools_rh_headers
      WHERE tools_rh_headers.id = tools_rh_records.header_id
      AND tools_rh_headers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own records" ON tools_rh_records;
CREATE POLICY "Users can delete their own records" ON tools_rh_records
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Repair pictures table policies
DROP POLICY IF EXISTS "Users can view their own repair pictures" ON tools_rh_repair_pictures;
CREATE POLICY "Users can view their own repair pictures" ON tools_rh_repair_pictures
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_rh_records
      WHERE tools_rh_records.id = tools_rh_repair_pictures.record_id
      AND tools_rh_records.user_id = auth.uid()
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
      AND tools_rh_records.user_id = auth.uid()
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
      AND tools_rh_records.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_rh_records
      WHERE tools_rh_records.id = tools_rh_repair_pictures.record_id
      AND tools_rh_records.user_id = auth.uid()
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
      AND tools_rh_records.user_id = auth.uid()
    )
  );

-- Items table policies
DROP POLICY IF EXISTS "Users can view their own items" ON tools_rh_items;
CREATE POLICY "Users can view their own items" ON tools_rh_items
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_default = true);

DROP POLICY IF EXISTS "Users can insert their own items" ON tools_rh_items;
CREATE POLICY "Users can insert their own items" ON tools_rh_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_default = false);

DROP POLICY IF EXISTS "Users can update their own items" ON tools_rh_items;
CREATE POLICY "Users can update their own items" ON tools_rh_items
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND is_default = false)
  WITH CHECK (auth.uid() = user_id AND is_default = false);

DROP POLICY IF EXISTS "Users can delete their own items" ON tools_rh_items;
CREATE POLICY "Users can delete their own items" ON tools_rh_items
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND is_default = false);
