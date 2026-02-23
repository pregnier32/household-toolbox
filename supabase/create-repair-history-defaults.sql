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
  ('Auto1', '#3b82f6', 'Auto', 2),
  ('Auto2', '#8b5cf6', 'Auto', 3)
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
