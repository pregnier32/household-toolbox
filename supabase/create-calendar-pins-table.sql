-- Calendar pin registry: the user's choice to show a tool record on the Dashboard Calendar.
-- Dates and titles stay on the source tool row. This table stores only the selection.
--
-- source_type: stable identifier for the kind of source row
--   (e.g. travel_trip, pet_appointment, repair_warranty, todo_task)
-- source_id: the tool row UUID
-- pin_kind: distinguishes multiple pins from one source row
--   (e.g. start, end, warranty, reminder_30d, default)
--
-- Run in Supabase SQL Editor (idempotent: safe to re-run).

CREATE TABLE IF NOT EXISTS calendar_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  pin_kind TEXT NOT NULL DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT calendar_pins_unique_source UNIQUE (user_id, source_type, source_id, pin_kind)
);

CREATE INDEX IF NOT EXISTS idx_calendar_pins_user_id ON calendar_pins(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_pins_tool_id ON calendar_pins(tool_id);
CREATE INDEX IF NOT EXISTS idx_calendar_pins_user_tool ON calendar_pins(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_calendar_pins_source ON calendar_pins(source_type, source_id);

ALTER TABLE calendar_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own calendar pins" ON calendar_pins;
CREATE POLICY "Users can view their own calendar pins" ON calendar_pins
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own calendar pins" ON calendar_pins;
CREATE POLICY "Users can insert their own calendar pins" ON calendar_pins
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own calendar pins" ON calendar_pins;
CREATE POLICY "Users can update their own calendar pins" ON calendar_pins
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own calendar pins" ON calendar_pins;
CREATE POLICY "Users can delete their own calendar pins" ON calendar_pins
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

NOTIFY pgrst, 'reload schema';
