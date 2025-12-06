-- Pet Care Schedule Tool Database Schema
-- All tables prefixed with 'tools_PCS_'

-- Main pets table - multiple pets per user allowed
CREATE TABLE IF NOT EXISTS tools_PCS_pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pet_type TEXT, -- Standard type (Dog, Cat, etc.)
  custom_pet_type TEXT, -- Custom type if user selected "Other"
  birthdate DATE,
  breed TEXT,
  where_got_pet TEXT,
  weight TEXT, -- Stored as text to allow "25 lbs" or "11 kg"
  color TEXT,
  microchip_number TEXT,
  card_color TEXT, -- Color for the pet card UI (hex color code)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  -- Multiple pets per user per tool are allowed
);

-- Create index on user_id and tool_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_pcs_pets_user_tool ON tools_PCS_pets(user_id, tool_id);

-- Food entries table
CREATE TABLE IF NOT EXISTS tools_PCS_food_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES tools_PCS_pets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- 1-5 star rating
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on pet_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_pcs_food_pet_id ON tools_PCS_food_entries(pet_id);
CREATE INDEX IF NOT EXISTS idx_pcs_food_is_current ON tools_PCS_food_entries(is_current);

-- Veterinary records table
CREATE TABLE IF NOT EXISTS tools_PCS_veterinary_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES tools_PCS_pets(id) ON DELETE CASCADE,
  veterinarian_name TEXT,
  clinic_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'History')),
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on pet_id and status for faster lookups
CREATE INDEX IF NOT EXISTS idx_pcs_vet_pet_id ON tools_PCS_veterinary_records(pet_id);
CREATE INDEX IF NOT EXISTS idx_pcs_vet_status ON tools_PCS_veterinary_records(status);

-- Care plan items table
CREATE TABLE IF NOT EXISTS tools_PCS_care_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES tools_PCS_pets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL, -- Daily, Weekly, Monthly, etc.
  is_active BOOLEAN DEFAULT true,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on pet_id and is_active for faster lookups
CREATE INDEX IF NOT EXISTS idx_pcs_care_pet_id ON tools_PCS_care_plan_items(pet_id);
CREATE INDEX IF NOT EXISTS idx_pcs_care_is_active ON tools_PCS_care_plan_items(is_active);

-- Vaccinations table
CREATE TABLE IF NOT EXISTS tools_PCS_vaccinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES tools_PCS_pets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  veterinarian TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on pet_id and date for faster lookups
CREATE INDEX IF NOT EXISTS idx_pcs_vacc_pet_id ON tools_PCS_vaccinations(pet_id);
CREATE INDEX IF NOT EXISTS idx_pcs_vacc_date ON tools_PCS_vaccinations(date);

-- Appointments table
CREATE TABLE IF NOT EXISTS tools_PCS_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES tools_PCS_pets(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TIME,
  type TEXT NOT NULL, -- Annual checkup, Vaccination, Surgery, etc.
  veterinarian TEXT,
  notes TEXT,
  is_upcoming BOOLEAN DEFAULT true, -- Calculated based on date, but stored for performance
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on pet_id, date, and is_upcoming for faster lookups
CREATE INDEX IF NOT EXISTS idx_pcs_appt_pet_id ON tools_PCS_appointments(pet_id);
CREATE INDEX IF NOT EXISTS idx_pcs_appt_date ON tools_PCS_appointments(date);
CREATE INDEX IF NOT EXISTS idx_pcs_appt_is_upcoming ON tools_PCS_appointments(is_upcoming);

-- Documents table
CREATE TABLE IF NOT EXISTS tools_PCS_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES tools_PCS_pets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  file_url TEXT, -- URL or path to stored file
  file_name TEXT, -- Original filename
  file_size BIGINT, -- File size in bytes
  file_type TEXT, -- MIME type
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on pet_id and date for faster lookups
CREATE INDEX IF NOT EXISTS idx_pcs_doc_pet_id ON tools_PCS_documents(pet_id);
CREATE INDEX IF NOT EXISTS idx_pcs_doc_date ON tools_PCS_documents(date);

-- Notes table
CREATE TABLE IF NOT EXISTS tools_PCS_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES tools_PCS_pets(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on pet_id and is_current for faster lookups
CREATE INDEX IF NOT EXISTS idx_pcs_notes_pet_id ON tools_PCS_notes(pet_id);
CREATE INDEX IF NOT EXISTS idx_pcs_notes_is_current ON tools_PCS_notes(is_current);
CREATE INDEX IF NOT EXISTS idx_pcs_notes_date ON tools_PCS_notes(date);

-- Functions to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pcs_pets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_pcs_food_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_pcs_vet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_pcs_care_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_pcs_vacc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_pcs_appt_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_pcs_doc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_pcs_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
-- Drop existing triggers if they exist, then create them
DROP TRIGGER IF EXISTS trigger_update_pcs_pets_updated_at ON tools_PCS_pets;
CREATE TRIGGER trigger_update_pcs_pets_updated_at
  BEFORE UPDATE ON tools_PCS_pets
  FOR EACH ROW
  EXECUTE FUNCTION update_pcs_pets_updated_at();

DROP TRIGGER IF EXISTS trigger_update_pcs_food_updated_at ON tools_PCS_food_entries;
CREATE TRIGGER trigger_update_pcs_food_updated_at
  BEFORE UPDATE ON tools_PCS_food_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_pcs_food_updated_at();

DROP TRIGGER IF EXISTS trigger_update_pcs_vet_updated_at ON tools_PCS_veterinary_records;
CREATE TRIGGER trigger_update_pcs_vet_updated_at
  BEFORE UPDATE ON tools_PCS_veterinary_records
  FOR EACH ROW
  EXECUTE FUNCTION update_pcs_vet_updated_at();

DROP TRIGGER IF EXISTS trigger_update_pcs_care_updated_at ON tools_PCS_care_plan_items;
CREATE TRIGGER trigger_update_pcs_care_updated_at
  BEFORE UPDATE ON tools_PCS_care_plan_items
  FOR EACH ROW
  EXECUTE FUNCTION update_pcs_care_updated_at();

DROP TRIGGER IF EXISTS trigger_update_pcs_vacc_updated_at ON tools_PCS_vaccinations;
CREATE TRIGGER trigger_update_pcs_vacc_updated_at
  BEFORE UPDATE ON tools_PCS_vaccinations
  FOR EACH ROW
  EXECUTE FUNCTION update_pcs_vacc_updated_at();

DROP TRIGGER IF EXISTS trigger_update_pcs_appt_updated_at ON tools_PCS_appointments;
CREATE TRIGGER trigger_update_pcs_appt_updated_at
  BEFORE UPDATE ON tools_PCS_appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_pcs_appt_updated_at();

DROP TRIGGER IF EXISTS trigger_update_pcs_doc_updated_at ON tools_PCS_documents;
CREATE TRIGGER trigger_update_pcs_doc_updated_at
  BEFORE UPDATE ON tools_PCS_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_pcs_doc_updated_at();

DROP TRIGGER IF EXISTS trigger_update_pcs_notes_updated_at ON tools_PCS_notes;
CREATE TRIGGER trigger_update_pcs_notes_updated_at
  BEFORE UPDATE ON tools_PCS_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_pcs_notes_updated_at();

-- Enable Row Level Security on all tables
ALTER TABLE tools_PCS_pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_PCS_food_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_PCS_veterinary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_PCS_care_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_PCS_vaccinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_PCS_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_PCS_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_PCS_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own pet data
-- Drop existing policies if they exist, then create them
-- Pets table
DROP POLICY IF EXISTS "Users can view their own pets" ON tools_PCS_pets;
CREATE POLICY "Users can view their own pets" ON tools_PCS_pets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own pets" ON tools_PCS_pets;
CREATE POLICY "Users can insert their own pets" ON tools_PCS_pets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own pets" ON tools_PCS_pets;
CREATE POLICY "Users can update their own pets" ON tools_PCS_pets
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own pets" ON tools_PCS_pets;
CREATE POLICY "Users can delete their own pets" ON tools_PCS_pets
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Food entries table
DROP POLICY IF EXISTS "Users can view their own food entries" ON tools_PCS_food_entries;
CREATE POLICY "Users can view their own food entries" ON tools_PCS_food_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_food_entries.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own food entries" ON tools_PCS_food_entries;
CREATE POLICY "Users can insert their own food entries" ON tools_PCS_food_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_food_entries.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own food entries" ON tools_PCS_food_entries;
CREATE POLICY "Users can update their own food entries" ON tools_PCS_food_entries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_food_entries.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_food_entries.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own food entries" ON tools_PCS_food_entries;
CREATE POLICY "Users can delete their own food entries" ON tools_PCS_food_entries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_food_entries.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

-- Veterinary records table
DROP POLICY IF EXISTS "Users can view their own veterinary records" ON tools_PCS_veterinary_records;
CREATE POLICY "Users can view their own veterinary records" ON tools_PCS_veterinary_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_veterinary_records.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own veterinary records" ON tools_PCS_veterinary_records;
CREATE POLICY "Users can insert their own veterinary records" ON tools_PCS_veterinary_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_veterinary_records.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own veterinary records" ON tools_PCS_veterinary_records;
CREATE POLICY "Users can update their own veterinary records" ON tools_PCS_veterinary_records
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_veterinary_records.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_veterinary_records.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own veterinary records" ON tools_PCS_veterinary_records;
CREATE POLICY "Users can delete their own veterinary records" ON tools_PCS_veterinary_records
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_veterinary_records.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

-- Care plan items table
DROP POLICY IF EXISTS "Users can view their own care plan items" ON tools_PCS_care_plan_items;
CREATE POLICY "Users can view their own care plan items" ON tools_PCS_care_plan_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_care_plan_items.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own care plan items" ON tools_PCS_care_plan_items;
CREATE POLICY "Users can insert their own care plan items" ON tools_PCS_care_plan_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_care_plan_items.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own care plan items" ON tools_PCS_care_plan_items;
CREATE POLICY "Users can update their own care plan items" ON tools_PCS_care_plan_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_care_plan_items.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_care_plan_items.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own care plan items" ON tools_PCS_care_plan_items;
CREATE POLICY "Users can delete their own care plan items" ON tools_PCS_care_plan_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_care_plan_items.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

-- Vaccinations table
DROP POLICY IF EXISTS "Users can view their own vaccinations" ON tools_PCS_vaccinations;
CREATE POLICY "Users can view their own vaccinations" ON tools_PCS_vaccinations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_vaccinations.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own vaccinations" ON tools_PCS_vaccinations;
CREATE POLICY "Users can insert their own vaccinations" ON tools_PCS_vaccinations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_vaccinations.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own vaccinations" ON tools_PCS_vaccinations;
CREATE POLICY "Users can update their own vaccinations" ON tools_PCS_vaccinations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_vaccinations.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_vaccinations.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own vaccinations" ON tools_PCS_vaccinations;
CREATE POLICY "Users can delete their own vaccinations" ON tools_PCS_vaccinations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_vaccinations.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

-- Appointments table
DROP POLICY IF EXISTS "Users can view their own appointments" ON tools_PCS_appointments;
CREATE POLICY "Users can view their own appointments" ON tools_PCS_appointments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_appointments.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own appointments" ON tools_PCS_appointments;
CREATE POLICY "Users can insert their own appointments" ON tools_PCS_appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_appointments.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own appointments" ON tools_PCS_appointments;
CREATE POLICY "Users can update their own appointments" ON tools_PCS_appointments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_appointments.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_appointments.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own appointments" ON tools_PCS_appointments;
CREATE POLICY "Users can delete their own appointments" ON tools_PCS_appointments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_appointments.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

-- Documents table
DROP POLICY IF EXISTS "Users can view their own documents" ON tools_PCS_documents;
CREATE POLICY "Users can view their own documents" ON tools_PCS_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_documents.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own documents" ON tools_PCS_documents;
CREATE POLICY "Users can insert their own documents" ON tools_PCS_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_documents.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own documents" ON tools_PCS_documents;
CREATE POLICY "Users can update their own documents" ON tools_PCS_documents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_documents.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_documents.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own documents" ON tools_PCS_documents;
CREATE POLICY "Users can delete their own documents" ON tools_PCS_documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_documents.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

-- Notes table
DROP POLICY IF EXISTS "Users can view their own notes" ON tools_PCS_notes;
CREATE POLICY "Users can view their own notes" ON tools_PCS_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_notes.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own notes" ON tools_PCS_notes;
CREATE POLICY "Users can insert their own notes" ON tools_PCS_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_notes.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own notes" ON tools_PCS_notes;
CREATE POLICY "Users can update their own notes" ON tools_PCS_notes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_notes.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_notes.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own notes" ON tools_PCS_notes;
CREATE POLICY "Users can delete their own notes" ON tools_PCS_notes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_PCS_pets
      WHERE tools_PCS_pets.id = tools_PCS_notes.pet_id
      AND tools_PCS_pets.user_id = auth.uid()
    )
  );
