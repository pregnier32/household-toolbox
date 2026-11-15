-- Rolls back supabase/migrations/20261115000000_drop_meal_planner_scale.sql.
-- Not applied by supabase db push. Run only to restore the scale column.
-- Previous scale values cannot be recovered. Restored meals use 1.

BEGIN;

DO $rollback$
BEGIN
  IF to_regclass('public.tools_mp_meals') IS NULL THEN
    RAISE EXCEPTION 'Missing public.tools_mp_meals';
  END IF;

  ALTER TABLE public.tools_mp_meals
    ADD COLUMN IF NOT EXISTS scale NUMERIC NOT NULL DEFAULT 1;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tools_mp_meals'
      AND column_name = 'scale'
  ) THEN
    RAISE EXCEPTION 'tools_mp_meals.scale was not restored';
  END IF;
END
$rollback$;

COMMIT;
