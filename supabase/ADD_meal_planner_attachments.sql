-- Meal Planner attachments: multiple optional files per meal.
-- Safe to re-run. After this succeeds, reload types:
--   npm run supabase:types
--
-- Files live in the existing `meal-planner` storage bucket at
-- {userId}/{mealId}/{timestamp}-{filename}
--
-- Do not attach files to plans, plan assignments, items, meal types, or the
-- grocery modal. Plan assignments are deleted and re-inserted on every plan
-- save, so a day-slot file store would orphan or cascade-delete on Save.

CREATE TABLE IF NOT EXISTS tools_mp_meal_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES tools_mp_meals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_meal_attachments_meal_id ON tools_mp_meal_attachments(meal_id);
CREATE INDEX IF NOT EXISTS idx_mp_meal_attachments_user_id ON tools_mp_meal_attachments(user_id);

ALTER TABLE tools_mp_meal_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own meal planner attachments" ON tools_mp_meal_attachments;
CREATE POLICY "Users can view their own meal planner attachments" ON tools_mp_meal_attachments
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own meal planner attachments" ON tools_mp_meal_attachments;
CREATE POLICY "Users can insert their own meal planner attachments" ON tools_mp_meal_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own meal planner attachments" ON tools_mp_meal_attachments;
CREATE POLICY "Users can update their own meal planner attachments" ON tools_mp_meal_attachments
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own meal planner attachments" ON tools_mp_meal_attachments;
CREATE POLICY "Users can delete their own meal planner attachments" ON tools_mp_meal_attachments
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));
