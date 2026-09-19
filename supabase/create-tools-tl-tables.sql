-- Travel Log Tool Database Schema
-- All tables prefixed with 'tools_tl_'
-- Matches UI: TravelLogTool (trips list, lodging + journal child records, travel counts flag).
--
-- Run in Supabase SQL Editor (idempotent: safe to re-run).
-- After deploy, register tool_id FK indexes in add-performance-indexes.sql if you maintain that file.

-- ============================================================================
-- TRIPS (one row per trip / vacation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_tl_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,

  trip_name TEXT NOT NULL,
  destination TEXT NOT NULL DEFAULT '',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  number_of_days INTEGER GENERATED ALWAYS AS (end_date - start_date + 1) STORED,

  trip_rating INTEGER NOT NULL DEFAULT 0 CHECK (trip_rating >= 0 AND trip_rating <= 5),

  trip_type TEXT CHECK (
    trip_type IS NULL OR trip_type IN (
      'Family', 'Couple', 'Solo', 'Business', 'Friends', 'Group Tour', 'Other'
    )
  ),
  trip_goal TEXT CHECK (
    trip_goal IS NULL OR trip_goal IN (
      'Relaxation', 'Adventure', 'Family Time', 'Business', 'Other'
    )
  ),
  trip_goal_other TEXT NOT NULL DEFAULT '',

  -- Multi-select in UI: Car, Plane, Train, Cruise, RV, Other
  transportation_methods TEXT[] NOT NULL DEFAULT '{}',

  departure_location TEXT NOT NULL DEFAULT '',
  primary_destination TEXT NOT NULL DEFAULT '',
  travel_companions TEXT NOT NULL DEFAULT '',

  planned_budget NUMERIC(12, 2),
  total_trip_cost NUMERIC(12, 2),
  budget_notes TEXT NOT NULL DEFAULT '',

  best_memory TEXT NOT NULL DEFAULT '',
  biggest_surprise TEXT NOT NULL DEFAULT '',
  highlight_of_trip TEXT NOT NULL DEFAULT '',

  would_return TEXT CHECK (would_return IS NULL OR would_return IN ('Yes', 'No', 'Maybe')),
  would_recommend TEXT CHECK (would_recommend IS NULL OR would_recommend IN ('Yes', 'No', 'Maybe')),

  -- UI: "Include this trip in your travel counts?" — NULL = unanswered, TRUE/FALSE = Yes/No
  include_in_travel_counts BOOLEAN,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT tools_tl_trips_end_on_or_after_start CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_tl_trips_user_id ON tools_tl_trips(user_id);
CREATE INDEX IF NOT EXISTS idx_tl_trips_tool_id ON tools_tl_trips(tool_id);
CREATE INDEX IF NOT EXISTS idx_tl_trips_user_tool ON tools_tl_trips(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_tl_trips_start_date ON tools_tl_trips(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_tl_trips_trip_name ON tools_tl_trips(trip_name);
CREATE INDEX IF NOT EXISTS idx_tl_trips_include_in_travel_counts
  ON tools_tl_trips(include_in_travel_counts)
  WHERE include_in_travel_counts IS NOT NULL;

-- ============================================================================
-- LODGING (many per trip)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_tl_lodging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES tools_tl_trips(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  lodging_type TEXT CHECK (
    lodging_type IS NULL OR lodging_type IN (
      'Hotel', 'Motel', 'Resort', 'Vacation Rental', 'Camping', 'RV Park', 'Friends/Family', 'Other'
    )
  ),
  check_in_date DATE,
  check_out_date DATE,
  notes TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT tools_tl_lodging_checkout_on_or_after_checkin
    CHECK (check_out_date IS NULL OR check_in_date IS NULL OR check_out_date >= check_in_date)
);

CREATE INDEX IF NOT EXISTS idx_tl_lodging_trip_id ON tools_tl_lodging(trip_id);
CREATE INDEX IF NOT EXISTS idx_tl_lodging_check_in_date ON tools_tl_lodging(check_in_date)
  WHERE check_in_date IS NOT NULL;

-- ============================================================================
-- JOURNAL NOTES (many per trip)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tools_tl_journal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES tools_tl_trips(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  note_date DATE NOT NULL,
  note_text TEXT NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tl_journal_notes_trip_id ON tools_tl_journal_notes(trip_id);
CREATE INDEX IF NOT EXISTS idx_tl_journal_notes_note_date ON tools_tl_journal_notes(note_date DESC);

-- ============================================================================
-- UPDATED_AT TRIGGERS (secure search_path per system_design.md)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_tl_trips_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_tl_lodging_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_tl_journal_notes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_tl_trips_updated_at ON tools_tl_trips;
CREATE TRIGGER trigger_update_tl_trips_updated_at
  BEFORE UPDATE ON tools_tl_trips
  FOR EACH ROW
  EXECUTE FUNCTION update_tl_trips_updated_at();

DROP TRIGGER IF EXISTS trigger_update_tl_lodging_updated_at ON tools_tl_lodging;
CREATE TRIGGER trigger_update_tl_lodging_updated_at
  BEFORE UPDATE ON tools_tl_lodging
  FOR EACH ROW
  EXECUTE FUNCTION update_tl_lodging_updated_at();

DROP TRIGGER IF EXISTS trigger_update_tl_journal_notes_updated_at ON tools_tl_journal_notes;
CREATE TRIGGER trigger_update_tl_journal_notes_updated_at
  BEFORE UPDATE ON tools_tl_journal_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_tl_journal_notes_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (optimized: (select auth.uid()))
-- ============================================================================
ALTER TABLE tools_tl_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_tl_lodging ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_tl_journal_notes ENABLE ROW LEVEL SECURITY;

-- Trips
DROP POLICY IF EXISTS "tl: Users can view their own trips" ON tools_tl_trips;
CREATE POLICY "tl: Users can view their own trips" ON tools_tl_trips
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "tl: Users can insert their own trips" ON tools_tl_trips;
CREATE POLICY "tl: Users can insert their own trips" ON tools_tl_trips
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "tl: Users can update their own trips" ON tools_tl_trips;
CREATE POLICY "tl: Users can update their own trips" ON tools_tl_trips
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "tl: Users can delete their own trips" ON tools_tl_trips;
CREATE POLICY "tl: Users can delete their own trips" ON tools_tl_trips
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- Lodging (via parent trip ownership)
DROP POLICY IF EXISTS "tl: Users can view their own lodging" ON tools_tl_lodging;
CREATE POLICY "tl: Users can view their own lodging" ON tools_tl_lodging
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_tl_trips t
      WHERE t.id = tools_tl_lodging.trip_id
        AND t.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "tl: Users can insert their own lodging" ON tools_tl_lodging;
CREATE POLICY "tl: Users can insert their own lodging" ON tools_tl_lodging
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_tl_trips t
      WHERE t.id = tools_tl_lodging.trip_id
        AND t.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "tl: Users can update their own lodging" ON tools_tl_lodging;
CREATE POLICY "tl: Users can update their own lodging" ON tools_tl_lodging
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_tl_trips t
      WHERE t.id = tools_tl_lodging.trip_id
        AND t.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_tl_trips t
      WHERE t.id = tools_tl_lodging.trip_id
        AND t.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "tl: Users can delete their own lodging" ON tools_tl_lodging;
CREATE POLICY "tl: Users can delete their own lodging" ON tools_tl_lodging
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_tl_trips t
      WHERE t.id = tools_tl_lodging.trip_id
        AND t.user_id = (select auth.uid())
    )
  );

-- Journal notes (via parent trip ownership)
DROP POLICY IF EXISTS "tl: Users can view their own journal notes" ON tools_tl_journal_notes;
CREATE POLICY "tl: Users can view their own journal notes" ON tools_tl_journal_notes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_tl_trips t
      WHERE t.id = tools_tl_journal_notes.trip_id
        AND t.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "tl: Users can insert their own journal notes" ON tools_tl_journal_notes;
CREATE POLICY "tl: Users can insert their own journal notes" ON tools_tl_journal_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_tl_trips t
      WHERE t.id = tools_tl_journal_notes.trip_id
        AND t.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "tl: Users can update their own journal notes" ON tools_tl_journal_notes;
CREATE POLICY "tl: Users can update their own journal notes" ON tools_tl_journal_notes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_tl_trips t
      WHERE t.id = tools_tl_journal_notes.trip_id
        AND t.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_tl_trips t
      WHERE t.id = tools_tl_journal_notes.trip_id
        AND t.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "tl: Users can delete their own journal notes" ON tools_tl_journal_notes;
CREATE POLICY "tl: Users can delete their own journal notes" ON tools_tl_journal_notes
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_tl_trips t
      WHERE t.id = tools_tl_journal_notes.trip_id
        AND t.user_id = (select auth.uid())
    )
  );
