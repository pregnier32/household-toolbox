-- Archives the seeded What's New bug-fix notice.
-- Safe to re-run. Do not apply this file with supabase db push.
--
-- Hides the seeded What's New bug-fix notice. The three earlier published
-- notes stay published. A missing row is already gone and is left alone.
-- A row with this id but a different title or category stops the script.

BEGIN;

DO $migration$
DECLARE
  note_status text;
  note_category text;
  note_title text;
  note_id constant uuid := 'a1c0e001-0001-4000-8000-000000000004';
BEGIN
  IF to_regclass('public.release_notes') IS NULL THEN
    RAISE EXCEPTION 'Missing public.release_notes';
  END IF;

  SELECT status, category, title
    INTO note_status, note_category, note_title
  FROM public.release_notes
  WHERE id = note_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF note_category IS DISTINCT FROM 'bug_fix'
     OR note_title IS DISTINCT FROM 'Document Upload Improvements' THEN
    RAISE EXCEPTION 'Release note % is not the seeded bug fix notice', note_id;
  END IF;

  IF note_status = 'published' THEN
    UPDATE public.release_notes
    SET status = 'archived'
    WHERE id = note_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.release_notes
    WHERE id = note_id
      AND status = 'published'
  ) THEN
    RAISE EXCEPTION 'Bug fix notice is still published';
  END IF;
END
$migration$;

COMMIT;
