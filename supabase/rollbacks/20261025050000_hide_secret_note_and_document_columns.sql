-- Rolls back supabase/migrations/20261025050000_hide_secret_note_and_document_columns.sql.
-- Not applied by supabase db push. Run only to restore the previous direct grants.
-- Restoring them makes password hashes and note text selectable again.

BEGIN;

DO $rollback$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'tools_note_notes',
    'tools_note_security_questions',
    'tools_id_documents',
    'tools_id_security_questions'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I TO anon, authenticated',
      table_name
    );
    IF NOT has_table_privilege('authenticated', to_regclass(format('public.%I', table_name)), 'SELECT') THEN
      RAISE EXCEPTION 'SELECT was not restored on %', table_name;
    END IF;
  END LOOP;

  IF NOT has_column_privilege('authenticated', 'public.tools_note_notes'::regclass, 'note', 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.tools_note_notes'::regclass, 'view_password_hash', 'SELECT')
     OR NOT has_column_privilege('authenticated', 'public.tools_id_documents'::regclass, 'download_password_hash', 'SELECT') THEN
    RAISE EXCEPTION 'secret column SELECT was not restored';
  END IF;
END
$rollback$;

COMMIT;
