-- Rolls back supabase/migrations/20261115203000_healthcare_appointment_time.sql.
-- Not applied by supabase db push. Run only to remove the appointment time column.
-- Saved appointment times cannot be recovered.

BEGIN;

DO $rollback$
BEGIN
  IF to_regclass('public.tools_hcah_records') IS NULL THEN
    RAISE EXCEPTION 'Missing public.tools_hcah_records';
  END IF;

  ALTER TABLE public.tools_hcah_records
    DROP COLUMN IF EXISTS appointment_time;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tools_hcah_records'
      AND column_name = 'appointment_time'
  ) THEN
    RAISE EXCEPTION 'tools_hcah_records.appointment_time is still present';
  END IF;
END
$rollback$;

COMMIT;
