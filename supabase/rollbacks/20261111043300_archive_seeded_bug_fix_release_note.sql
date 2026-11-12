-- Rolls back supabase/migrations/20261111043300_archive_seeded_bug_fix_release_note.sql.
-- Publishes the seeded bug-fix notice again when that exact row is archived.

BEGIN;

DO $rollback$
DECLARE
  note_id constant uuid := 'a1c0e001-0001-4000-8000-000000000004';
BEGIN
  IF to_regclass('public.release_notes') IS NULL THEN
    RAISE EXCEPTION 'Missing public.release_notes';
  END IF;

  UPDATE public.release_notes
  SET status = 'published'
  WHERE id = note_id
    AND category = 'bug_fix'
    AND title = 'Document Upload Improvements'
    AND status = 'archived';

  IF NOT EXISTS (
    SELECT 1
    FROM public.release_notes
    WHERE id = note_id
      AND category = 'bug_fix'
      AND title = 'Document Upload Improvements'
      AND status = 'published'
  ) THEN
    RAISE EXCEPTION 'Bug fix notice was not published again';
  END IF;
END
$rollback$;

COMMIT;
