-- Repair History — current schema
-- Safe to re-run. Creates anything missing. Does not delete user rows.
-- Includes tables, later columns, attachment tables, and storage policies for bucket "repair-history".
-- Run in the Supabase SQL editor.

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
  USING (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "Users can insert their own headers" ON tools_rh_headers;
CREATE POLICY "Users can insert their own headers" ON tools_rh_headers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "Users can update their own headers" ON tools_rh_headers;
CREATE POLICY "Users can update their own headers" ON tools_rh_headers
  FOR UPDATE
  TO authenticated
  USING (public.can_access_user_data(user_id))
  WITH CHECK (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "Users can delete their own headers" ON tools_rh_headers;
CREATE POLICY "Users can delete their own headers" ON tools_rh_headers
  FOR DELETE
  TO authenticated
  USING (public.can_access_user_data(user_id));

-- Records table policies
DROP POLICY IF EXISTS "Users can view their own records" ON tools_rh_records;
CREATE POLICY "Users can view their own records" ON tools_rh_records
  FOR SELECT
  TO authenticated
  USING (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "Users can insert their own records" ON tools_rh_records;
CREATE POLICY "Users can insert their own records" ON tools_rh_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_user_data(user_id) AND
    EXISTS (
      SELECT 1 FROM tools_rh_headers
      WHERE tools_rh_headers.id = tools_rh_records.header_id
      AND public.can_access_user_data(tools_rh_headers.user_id)
    )
  );

DROP POLICY IF EXISTS "Users can update their own records" ON tools_rh_records;
CREATE POLICY "Users can update their own records" ON tools_rh_records
  FOR UPDATE
  TO authenticated
  USING (public.can_access_user_data(user_id))
  WITH CHECK (
    public.can_access_user_data(user_id) AND
    EXISTS (
      SELECT 1 FROM tools_rh_headers
      WHERE tools_rh_headers.id = tools_rh_records.header_id
      AND public.can_access_user_data(tools_rh_headers.user_id)
    )
  );

DROP POLICY IF EXISTS "Users can delete their own records" ON tools_rh_records;
CREATE POLICY "Users can delete their own records" ON tools_rh_records
  FOR DELETE
  TO authenticated
  USING (public.can_access_user_data(user_id));

-- Repair pictures table policies
DROP POLICY IF EXISTS "Users can view their own repair pictures" ON tools_rh_repair_pictures;
CREATE POLICY "Users can view their own repair pictures" ON tools_rh_repair_pictures
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_rh_records
      WHERE tools_rh_records.id = tools_rh_repair_pictures.record_id
      AND public.can_access_user_data(tools_rh_records.user_id)
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
      AND public.can_access_user_data(tools_rh_records.user_id)
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
      AND public.can_access_user_data(tools_rh_records.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_rh_records
      WHERE tools_rh_records.id = tools_rh_repair_pictures.record_id
      AND public.can_access_user_data(tools_rh_records.user_id)
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
      AND public.can_access_user_data(tools_rh_records.user_id)
    )
  );

-- Items table policies
DROP POLICY IF EXISTS "Users can view their own items" ON tools_rh_items;
CREATE POLICY "Users can view their own items" ON tools_rh_items
  FOR SELECT
  TO authenticated
  USING (public.can_access_user_data(user_id) OR is_default = true);

DROP POLICY IF EXISTS "Users can insert their own items" ON tools_rh_items;
CREATE POLICY "Users can insert their own items" ON tools_rh_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_user_data(user_id) AND is_default = false);

DROP POLICY IF EXISTS "Users can update their own items" ON tools_rh_items;
CREATE POLICY "Users can update their own items" ON tools_rh_items
  FOR UPDATE
  TO authenticated
  USING (public.can_access_user_data(user_id) AND is_default = false)
  WITH CHECK (public.can_access_user_data(user_id) AND is_default = false);

DROP POLICY IF EXISTS "Users can delete their own items" ON tools_rh_items;
CREATE POLICY "Users can delete their own items" ON tools_rh_items
  FOR DELETE
  TO authenticated
  USING (public.can_access_user_data(user_id) AND is_default = false);


-- Repair History Tool Defaults Table
-- This table stores the default headers and items that are copied to user tables when they add the tool

-- Default headers table
CREATE TABLE IF NOT EXISTS tools_rh_default_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  card_color TEXT DEFAULT '#10b981',
  category_type TEXT NOT NULL CHECK (category_type IN ('Home', 'Auto')),
  display_order INTEGER DEFAULT 0, -- Order for displaying headers
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default items table
CREATE TABLE IF NOT EXISTS tools_rh_default_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_type TEXT NOT NULL CHECK (category_type IN ('Home', 'Auto')),
  name TEXT NOT NULL,
  area TEXT NOT NULL,
  display_order INTEGER DEFAULT 0, -- Order for displaying items within area
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rh_default_headers_category_type ON tools_rh_default_headers(category_type);
CREATE INDEX IF NOT EXISTS idx_rh_default_headers_display_order ON tools_rh_default_headers(display_order);
CREATE INDEX IF NOT EXISTS idx_rh_default_items_category_type ON tools_rh_default_items(category_type);
CREATE INDEX IF NOT EXISTS idx_rh_default_items_area ON tools_rh_default_items(area);
CREATE INDEX IF NOT EXISTS idx_rh_default_items_display_order ON tools_rh_default_items(display_order);

-- Unique constraint: one default header per name/category_type combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_rh_default_headers_unique 
  ON tools_rh_default_headers(category_type, name);

-- Unique constraint: one default item per name/category_type combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_rh_default_items_unique 
  ON tools_rh_default_items(category_type, name);

-- Functions to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_rh_default_headers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION update_rh_default_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, pg_catalog;

-- Triggers to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_rh_default_headers_updated_at ON tools_rh_default_headers;
CREATE TRIGGER trigger_update_rh_default_headers_updated_at
  BEFORE UPDATE ON tools_rh_default_headers
  FOR EACH ROW
  EXECUTE FUNCTION update_rh_default_headers_updated_at();

DROP TRIGGER IF EXISTS trigger_update_rh_default_items_updated_at ON tools_rh_default_items;
CREATE TRIGGER trigger_update_rh_default_items_updated_at
  BEFORE UPDATE ON tools_rh_default_items
  FOR EACH ROW
  EXECUTE FUNCTION update_rh_default_items_updated_at();

-- RLS Policies: All authenticated users can read defaults (but not modify)
ALTER TABLE tools_rh_default_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_rh_default_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view default headers" ON tools_rh_default_headers;
CREATE POLICY "Anyone can view default headers" ON tools_rh_default_headers
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view default items" ON tools_rh_default_items;
CREATE POLICY "Anyone can view default items" ON tools_rh_default_items
  FOR SELECT
  TO authenticated
  USING (true);

-- Populate default headers
INSERT INTO tools_rh_default_headers (name, card_color, category_type, display_order) VALUES
  ('Home', '#10b981', 'Home', 1),
  ('Auto', '#3b82f6', 'Auto', 2)
ON CONFLICT (category_type, name) DO NOTHING;

-- Populate default Home items
INSERT INTO tools_rh_default_items (category_type, name, area, display_order) VALUES
  -- Interior – Major Systems
  ('Home', 'Furnace / Heating System', 'Interior – Major Systems', 1),
  ('Home', 'Air Conditioner (AC)', 'Interior – Major Systems', 2),
  ('Home', 'Heat Pump', 'Interior – Major Systems', 3),
  ('Home', 'Thermostat', 'Interior – Major Systems', 4),
  ('Home', 'Water Heater (Tank / Tankless)', 'Interior – Major Systems', 5),
  ('Home', 'Electrical Panel / Breaker Box', 'Interior – Major Systems', 6),
  ('Home', 'Main Water Shutoff Valve', 'Interior – Major Systems', 7),
  ('Home', 'Plumbing Pipes (Supply / Drain)', 'Interior – Major Systems', 8),
  ('Home', 'Sump Pump', 'Interior – Major Systems', 9),
  ('Home', 'Radon Mitigation System', 'Interior – Major Systems', 10),
  -- Plumbing Fixtures
  ('Home', 'Kitchen Sink', 'Plumbing Fixtures', 1),
  ('Home', 'Bathroom Sink', 'Plumbing Fixtures', 2),
  ('Home', 'Toilet', 'Plumbing Fixtures', 3),
  ('Home', 'Shower', 'Plumbing Fixtures', 4),
  ('Home', 'Bathtub', 'Plumbing Fixtures', 5),
  ('Home', 'Faucets', 'Plumbing Fixtures', 6),
  ('Home', 'Garbage Disposal', 'Plumbing Fixtures', 7),
  ('Home', 'Dishwasher Plumbing Connections', 'Plumbing Fixtures', 8),
  ('Home', 'Water Softener', 'Plumbing Fixtures', 9),
  ('Home', 'Well Pump (if applicable)', 'Plumbing Fixtures', 10),
  -- Electrical & Lighting
  ('Home', 'Electrical Outlets', 'Electrical & Lighting', 1),
  ('Home', 'Light Switches', 'Electrical & Lighting', 2),
  ('Home', 'Light Fixtures', 'Electrical & Lighting', 3),
  ('Home', 'Ceiling Fans', 'Electrical & Lighting', 4),
  ('Home', 'GFCI Outlets', 'Electrical & Lighting', 5),
  ('Home', 'Smoke Detectors', 'Electrical & Lighting', 6),
  ('Home', 'Carbon Monoxide Detectors', 'Electrical & Lighting', 7),
  ('Home', 'Doorbell / Chime', 'Electrical & Lighting', 8),
  -- Appliances
  ('Home', 'Refrigerator', 'Appliances', 1),
  ('Home', 'Dishwasher', 'Appliances', 2),
  ('Home', 'Oven / Range', 'Appliances', 3),
  ('Home', 'Microwave', 'Appliances', 4),
  ('Home', 'Washing Machine', 'Appliances', 5),
  ('Home', 'Dryer', 'Appliances', 6),
  ('Home', 'Garbage Disposal', 'Appliances', 7),
  ('Home', 'Trash Compactor', 'Appliances', 8),
  ('Home', 'Ice Maker', 'Appliances', 9),
  -- Doors, Windows & Insulation
  ('Home', 'Exterior Doors', 'Doors, Windows & Insulation', 1),
  ('Home', 'Interior Doors', 'Doors, Windows & Insulation', 2),
  ('Home', 'Windows', 'Doors, Windows & Insulation', 3),
  ('Home', 'Window Screens', 'Doors, Windows & Insulation', 4),
  ('Home', 'Weatherstripping', 'Doors, Windows & Insulation', 5),
  ('Home', 'Door Locks / Deadbolts', 'Doors, Windows & Insulation', 6),
  ('Home', 'Garage Door', 'Doors, Windows & Insulation', 7),
  ('Home', 'Garage Door Opener', 'Doors, Windows & Insulation', 8),
  ('Home', 'Attic Insulation', 'Doors, Windows & Insulation', 9),
  ('Home', 'Wall Insulation', 'Doors, Windows & Insulation', 10),
  -- Structural & Exterior
  ('Home', 'Roof', 'Structural & Exterior', 1),
  ('Home', 'Gutters / Downspouts', 'Structural & Exterior', 2),
  ('Home', 'Siding', 'Structural & Exterior', 3),
  ('Home', 'Foundation', 'Structural & Exterior', 4),
  ('Home', 'Driveway', 'Structural & Exterior', 5),
  ('Home', 'Walkways / Patios', 'Structural & Exterior', 6),
  ('Home', 'Deck / Porch', 'Structural & Exterior', 7),
  ('Home', 'Fence', 'Structural & Exterior', 8),
  ('Home', 'Retaining Walls', 'Structural & Exterior', 9),
  -- Safety & Security
  ('Home', 'Smoke Detectors', 'Safety & Security', 1),
  ('Home', 'Carbon Monoxide Detectors', 'Safety & Security', 2),
  ('Home', 'Security System', 'Safety & Security', 3),
  ('Home', 'Security Cameras', 'Safety & Security', 4),
  ('Home', 'Door Locks', 'Safety & Security', 5),
  ('Home', 'Window Locks', 'Safety & Security', 6),
  ('Home', 'Fire Extinguishers', 'Safety & Security', 7),
  -- Garage & Storage
  ('Home', 'Garage Door', 'Garage & Storage', 1),
  ('Home', 'Garage Door Opener', 'Garage & Storage', 2),
  ('Home', 'Garage Floor', 'Garage & Storage', 3),
  ('Home', 'Storage Shelving', 'Garage & Storage', 4),
  -- Yard & Outdoor
  ('Home', 'Lawn Mower', 'Yard & Outdoor', 1),
  ('Home', 'Sprinkler System', 'Yard & Outdoor', 2),
  ('Home', 'Outdoor Faucets / Spigots', 'Yard & Outdoor', 3),
  ('Home', 'Outdoor Lighting', 'Yard & Outdoor', 4),
  ('Home', 'Fence', 'Yard & Outdoor', 5),
  ('Home', 'Deck / Patio', 'Yard & Outdoor', 6)
ON CONFLICT (category_type, name) DO NOTHING;

-- Populate default Auto items
INSERT INTO tools_rh_default_items (category_type, name, area, display_order) VALUES
  -- Engine & Routine Maintenance
  ('Auto', 'Oil Change', 'Engine & Routine Maintenance', 1),
  ('Auto', 'Engine Air Filter', 'Engine & Routine Maintenance', 2),
  ('Auto', 'Cabin Air Filter', 'Engine & Routine Maintenance', 3),
  ('Auto', 'Spark Plugs', 'Engine & Routine Maintenance', 4),
  ('Auto', 'Ignition Coils', 'Engine & Routine Maintenance', 5),
  ('Auto', 'Timing Belt / Chain', 'Engine & Routine Maintenance', 6),
  ('Auto', 'Serpentine Belt', 'Engine & Routine Maintenance', 7),
  ('Auto', 'Radiator', 'Engine & Routine Maintenance', 8),
  ('Auto', 'Thermostat (Engine)', 'Engine & Routine Maintenance', 9),
  ('Auto', 'Water Pump', 'Engine & Routine Maintenance', 10),
  ('Auto', 'Coolant / Antifreeze', 'Engine & Routine Maintenance', 11),
  ('Auto', 'Engine Oil', 'Engine & Routine Maintenance', 12),
  ('Auto', 'Transmission Fluid', 'Engine & Routine Maintenance', 13),
  ('Auto', 'Transmission Filter', 'Engine & Routine Maintenance', 14),
  -- Brakes & Suspension
  ('Auto', 'Brake Pads', 'Brakes & Suspension', 1),
  ('Auto', 'Brake Rotors', 'Brakes & Suspension', 2),
  ('Auto', 'Brake Calipers', 'Brakes & Suspension', 3),
  ('Auto', 'Brake Lines', 'Brakes & Suspension', 4),
  ('Auto', 'Brake Fluid', 'Brakes & Suspension', 5),
  ('Auto', 'Shock Absorbers', 'Brakes & Suspension', 6),
  ('Auto', 'Struts', 'Brakes & Suspension', 7),
  ('Auto', 'Suspension Springs', 'Brakes & Suspension', 8),
  ('Auto', 'Control Arms', 'Brakes & Suspension', 9),
  ('Auto', 'Ball Joints', 'Brakes & Suspension', 10),
  ('Auto', 'Tie Rod Ends', 'Brakes & Suspension', 11),
  ('Auto', 'Wheel Bearings', 'Brakes & Suspension', 12),
  -- Tires & Wheels
  ('Auto', 'Tires', 'Tires & Wheels', 1),
  ('Auto', 'Wheel Alignment', 'Tires & Wheels', 2),
  ('Auto', 'Wheel Balancing', 'Tires & Wheels', 3),
  ('Auto', 'Tire Rotation', 'Tires & Wheels', 4),
  ('Auto', 'Wheel Rims', 'Tires & Wheels', 5),
  ('Auto', 'TPMS Sensors', 'Tires & Wheels', 6),
  -- Electrical System
  ('Auto', 'Battery', 'Electrical System', 1),
  ('Auto', 'Alternator', 'Electrical System', 2),
  ('Auto', 'Starter Motor', 'Electrical System', 3),
  ('Auto', 'Headlights', 'Electrical System', 4),
  ('Auto', 'Taillights', 'Electrical System', 5),
  ('Auto', 'Turn Signals', 'Electrical System', 6),
  ('Auto', 'Fuses', 'Electrical System', 7),
  ('Auto', 'Wiring Harness', 'Electrical System', 8),
  -- Exhaust System
  ('Auto', 'Muffler', 'Exhaust System', 1),
  ('Auto', 'Catalytic Converter', 'Exhaust System', 2),
  ('Auto', 'Exhaust Pipes', 'Exhaust System', 3),
  ('Auto', 'O2 Sensors', 'Exhaust System', 4),
  -- Interior & Comfort
  ('Auto', 'Air Conditioning System', 'Interior & Comfort', 1),
  ('Auto', 'Heater Core', 'Interior & Comfort', 2),
  ('Auto', 'Blower Motor', 'Interior & Comfort', 3),
  ('Auto', 'Climate Control Module', 'Interior & Comfort', 4),
  ('Auto', 'Seats', 'Interior & Comfort', 5),
  ('Auto', 'Seat Belts', 'Interior & Comfort', 6),
  ('Auto', 'Dashboard', 'Interior & Comfort', 7),
  ('Auto', 'Radio / Infotainment', 'Interior & Comfort', 8),
  ('Auto', 'Speakers', 'Interior & Comfort', 9),
  -- Body & Exterior
  ('Auto', 'Windshield', 'Body & Exterior', 1),
  ('Auto', 'Windshield Wipers', 'Body & Exterior', 2),
  ('Auto', 'Side Windows', 'Body & Exterior', 3),
  ('Auto', 'Mirrors', 'Body & Exterior', 4),
  ('Auto', 'Paint / Body Work', 'Body & Exterior', 5),
  ('Auto', 'Bumpers', 'Body & Exterior', 6),
  ('Auto', 'Doors', 'Body & Exterior', 7),
  ('Auto', 'Hood', 'Body & Exterior', 8),
  ('Auto', 'Trunk / Hatch', 'Body & Exterior', 9)
ON CONFLICT (category_type, name) DO NOTHING;


-- Repair History stock headers: Home + Auto (replace Auto1/Auto2).
-- Safe to rerun. Does not touch user repair records.

BEGIN;

UPDATE tools_rh_default_headers
SET name = 'Auto'
WHERE name = 'Auto1'
  AND category_type = 'Auto'
  AND NOT EXISTS (
    SELECT 1
    FROM tools_rh_default_headers existing
    WHERE existing.category_type = 'Auto'
      AND existing.name = 'Auto'
  );

DELETE FROM tools_rh_default_headers
WHERE category_type = 'Auto'
  AND name IN ('Auto1', 'Auto2');

INSERT INTO tools_rh_default_headers (name, card_color, category_type, display_order) VALUES
  ('Home', '#10b981', 'Home', 1),
  ('Auto', '#3b82f6', 'Auto', 2)
ON CONFLICT (category_type, name) DO NOTHING;

COMMIT;


-- Update RLS policies to allow users to update and delete their own default items
-- This allows users to edit default items that were copied to their tables

-- Update items table policies
DROP POLICY IF EXISTS "Users can update their own items" ON tools_rh_items;
CREATE POLICY "Users can update their own items" ON tools_rh_items
  FOR UPDATE
  TO authenticated
  USING (public.can_access_user_data(user_id))
  WITH CHECK (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "Users can delete their own items" ON tools_rh_items;
CREATE POLICY "Users can delete their own items" ON tools_rh_items
  FOR DELETE
  TO authenticated
  USING (public.can_access_user_data(user_id));


-- Repair History attachments: multiple optional files per repair record.
-- Safe to re-run. After this succeeds, reload types:
--   npm run supabase:types
--
-- Files live in the existing `repair-history` storage bucket.
-- New uploads use {userId}/{recordId}/{timestamp}-{filename}.
-- Existing receipt / warranty / picture objects stay at their current paths.
--
-- Do not attach files to Items or categories. Items are catalog rows for the
-- dropdown. Insurance is fields on the same repair — same file store.

CREATE TABLE IF NOT EXISTS tools_rh_record_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES tools_rh_records(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rh_record_attachments_record_id ON tools_rh_record_attachments(record_id);
CREATE INDEX IF NOT EXISTS idx_rh_record_attachments_user_id ON tools_rh_record_attachments(user_id);

ALTER TABLE tools_rh_record_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own repair history attachments" ON tools_rh_record_attachments;
CREATE POLICY "Users can view their own repair history attachments" ON tools_rh_record_attachments
  FOR SELECT
  TO authenticated
  USING (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "Users can insert their own repair history attachments" ON tools_rh_record_attachments;
CREATE POLICY "Users can insert their own repair history attachments" ON tools_rh_record_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "Users can update their own repair history attachments" ON tools_rh_record_attachments;
CREATE POLICY "Users can update their own repair history attachments" ON tools_rh_record_attachments
  FOR UPDATE
  TO authenticated
  USING (public.can_access_user_data(user_id))
  WITH CHECK (public.can_access_user_data(user_id));

DROP POLICY IF EXISTS "Users can delete their own repair history attachments" ON tools_rh_record_attachments;
CREATE POLICY "Users can delete their own repair history attachments" ON tools_rh_record_attachments
  FOR DELETE
  TO authenticated
  USING (public.can_access_user_data(user_id));

-- Move existing pictures into the shared store (same ids so re-runs skip them).
INSERT INTO tools_rh_record_attachments (id, record_id, user_id, file_url, file_name, file_size, file_type, created_at)
SELECT
  p.id,
  p.record_id,
  r.user_id,
  p.file_url,
  COALESCE(NULLIF(p.file_name, ''), 'Picture'),
  COALESCE(p.file_size, 0)::INTEGER,
  COALESCE(p.file_type, ''),
  COALESCE(p.created_at, NOW())
FROM tools_rh_repair_pictures p
JOIN tools_rh_records r ON r.id = p.record_id
ON CONFLICT (id) DO NOTHING;

-- Move existing receipt files.
INSERT INTO tools_rh_record_attachments (record_id, user_id, file_url, file_name, file_size, file_type, created_at)
SELECT
  r.id,
  r.user_id,
  r.receipt_file_url,
  COALESCE(NULLIF(r.receipt_file_name, ''), 'Receipt'),
  0,
  '',
  COALESCE(r.created_at, NOW())
FROM tools_rh_records r
WHERE r.receipt_file_url IS NOT NULL
  AND TRIM(r.receipt_file_url) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM tools_rh_record_attachments a
    WHERE a.record_id = r.id
      AND a.file_url = r.receipt_file_url
  );

-- Move existing warranty files.
INSERT INTO tools_rh_record_attachments (record_id, user_id, file_url, file_name, file_size, file_type, created_at)
SELECT
  r.id,
  r.user_id,
  r.warranty_file_url,
  COALESCE(NULLIF(r.warranty_file_name, ''), 'Warranty'),
  0,
  '',
  COALESCE(r.created_at, NOW())
FROM tools_rh_records r
WHERE r.warranty_file_url IS NOT NULL
  AND TRIM(r.warranty_file_url) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM tools_rh_record_attachments a
    WHERE a.record_id = r.id
      AND a.file_url = r.warranty_file_url
  );


-- Trigger functions with a fixed search_path.
CREATE OR REPLACE FUNCTION update_rh_headers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_rh_records_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_rh_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- Storage policies for bucket "repair-history".
-- Create that bucket in Supabase Storage if it does not exist yet.
DROP POLICY IF EXISTS "repair-history: Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "repair-history: Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "repair-history: Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "repair-history: Users can delete their own files" ON storage.objects;

CREATE POLICY "repair-history: Users can upload to their own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'repair-history' AND
  public.can_access_storage_owner((storage.foldername(name))[1])
);

CREATE POLICY "repair-history: Users can read their own files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'repair-history' AND
  public.can_access_storage_owner((storage.foldername(name))[1])
);

CREATE POLICY "repair-history: Users can update their own files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'repair-history' AND
  public.can_access_storage_owner((storage.foldername(name))[1])
)
WITH CHECK (
  bucket_id = 'repair-history' AND
  public.can_access_storage_owner((storage.foldername(name))[1])
);

CREATE POLICY "repair-history: Users can delete their own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'repair-history' AND
  public.can_access_storage_owner((storage.foldername(name))[1])
);


ALTER TABLE IF EXISTS tools_rh_records DROP CONSTRAINT IF EXISTS tools_rh_records_warranty_dashboard_item_id_fkey;
ALTER TABLE IF EXISTS tools_rh_records DROP COLUMN IF EXISTS warranty_dashboard_item_id;


NOTIFY pgrst, 'reload schema';
