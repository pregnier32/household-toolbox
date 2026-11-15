-- Removes the Meal Planner recipe scale column.
-- Safe to re-run. Do not apply this file with supabase db push unless asked.
--
-- Shopping lists count each ingredient once per cook day. Stored scale
-- values are discarded. A missing column is already gone and is left alone.

BEGIN;

DO $migration$
BEGIN
  IF to_regclass('public.tools_mp_meals') IS NULL THEN
    RAISE EXCEPTION 'Missing public.tools_mp_meals';
  END IF;

  ALTER TABLE public.tools_mp_meals
    DROP COLUMN IF EXISTS scale;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tools_mp_meals'
      AND column_name = 'scale'
  ) THEN
    RAISE EXCEPTION 'tools_mp_meals.scale is still present';
  END IF;
END
$migration$;

COMMIT;
