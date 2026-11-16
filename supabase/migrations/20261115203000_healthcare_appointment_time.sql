-- Adds an optional appointment time to Healthcare Appts & History.
-- Safe to re-run. Do not apply this file with supabase db push unless asked.
--
-- Existing visits stay dateless-for-time: the column is null until a time is saved.

BEGIN;

DO $migration$
BEGIN
  IF to_regclass('public.tools_hcah_records') IS NULL THEN
    RAISE EXCEPTION 'Missing public.tools_hcah_records';
  END IF;

  ALTER TABLE public.tools_hcah_records
    ADD COLUMN IF NOT EXISTS appointment_time TEXT;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tools_hcah_records'
      AND column_name = 'appointment_time'
  ) THEN
    RAISE EXCEPTION 'tools_hcah_records.appointment_time was not added';
  END IF;
END
$migration$;

COMMIT;
