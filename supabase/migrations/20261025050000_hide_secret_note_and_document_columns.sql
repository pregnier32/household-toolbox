-- Prepared for the production SQL editor. Not applied by this review.
-- Do not run supabase db push. The linked project is production.
--
-- anon and authenticated have table-level SELECT on the notes and document
-- tables, so a column-only revoke would not hide anything. No public function
-- reads these columns. The browser client is used for Auth only. Notes,
-- documents, search, editing, attachments, password checks, and household
-- sharing go through service-role API routes.
--
-- Table-level privileges are removed from anon and authenticated. Authenticated
-- keeps SELECT on the non-secret columns, still subject to row-level security.
-- tools_note_notes.note is one of those withheld columns: a column grant cannot
-- show an open note and hide a password-protected one. The API still returns
-- open text and password-checked text. service_role keeps full table access.

BEGIN;

DO $secrets$
DECLARE
  spec record;
  safe_columns text;
  secret_list text;
  secret_column text;
BEGIN
  CREATE TEMP TABLE secret_table (
    table_name text PRIMARY KEY,
    secret_columns text[] NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO secret_table (table_name, secret_columns) VALUES
    ('tools_note_notes', ARRAY['note', 'view_password_hash']),
    ('tools_note_security_questions', ARRAY['answer_hash']),
    ('tools_id_documents', ARRAY['download_password_hash']),
    ('tools_id_security_questions', ARRAY['answer_hash']);

  FOR spec IN SELECT table_name, secret_columns FROM secret_table LOOP
    IF to_regclass(format('public.%I', spec.table_name)) IS NULL THEN
      RAISE EXCEPTION 'Missing public.%', spec.table_name;
    END IF;

    FOREACH secret_column IN ARRAY spec.secret_columns LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_attribute attribute
        WHERE attribute.attrelid = to_regclass(format('public.%I', spec.table_name))
          AND attribute.attname = secret_column
          AND attribute.attnum > 0
          AND NOT attribute.attisdropped
      ) THEN
        RAISE EXCEPTION 'Missing %.%', spec.table_name, secret_column;
      END IF;
    END LOOP;

    SELECT string_agg(quote_ident(attribute.attname), ', ' ORDER BY attribute.attnum)
      INTO safe_columns
    FROM pg_attribute attribute
    WHERE attribute.attrelid = to_regclass(format('public.%I', spec.table_name))
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND NOT (attribute.attname = ANY (spec.secret_columns));

    IF coalesce(safe_columns, '') = '' THEN
      RAISE EXCEPTION '% has no non-secret columns', spec.table_name;
    END IF;

    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY column_name)
      INTO secret_list
    FROM unnest(spec.secret_columns) AS column_name;

    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', spec.table_name);
    EXECUTE format(
      'REVOKE SELECT, INSERT, UPDATE, REFERENCES (%s) ON TABLE public.%I FROM PUBLIC, anon, authenticated',
      secret_list,
      spec.table_name
    );
    EXECUTE format(
      'GRANT SELECT (%s) ON TABLE public.%I TO authenticated',
      safe_columns,
      spec.table_name
    );
  END LOOP;

  FOR spec IN SELECT table_name, secret_columns FROM secret_table LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.role_table_grants granted
      WHERE granted.table_schema = 'public'
        AND granted.table_name = spec.table_name
        AND granted.grantee IN ('anon', 'authenticated', 'PUBLIC')
    ) THEN
      RAISE EXCEPTION 'A table-level grant remains on %', spec.table_name;
    END IF;

    IF NOT has_table_privilege('service_role', to_regclass(format('public.%I', spec.table_name)), 'SELECT')
       OR NOT has_table_privilege('service_role', to_regclass(format('public.%I', spec.table_name)), 'INSERT')
       OR NOT has_table_privilege('service_role', to_regclass(format('public.%I', spec.table_name)), 'UPDATE')
       OR NOT has_table_privilege('service_role', to_regclass(format('public.%I', spec.table_name)), 'DELETE') THEN
      RAISE EXCEPTION 'service_role lost data access on %', spec.table_name;
    END IF;

    FOREACH secret_column IN ARRAY spec.secret_columns LOOP
      IF has_column_privilege('anon', to_regclass(format('public.%I', spec.table_name)), secret_column, 'SELECT')
         OR has_column_privilege('authenticated', to_regclass(format('public.%I', spec.table_name)), secret_column, 'SELECT')
         OR has_column_privilege('anon', to_regclass(format('public.%I', spec.table_name)), secret_column, 'UPDATE')
         OR has_column_privilege('authenticated', to_regclass(format('public.%I', spec.table_name)), secret_column, 'UPDATE')
         OR has_column_privilege('anon', to_regclass(format('public.%I', spec.table_name)), secret_column, 'INSERT')
         OR has_column_privilege('authenticated', to_regclass(format('public.%I', spec.table_name)), secret_column, 'INSERT') THEN
        RAISE EXCEPTION '%.% is still available to anon or authenticated', spec.table_name, secret_column;
      END IF;
    END LOOP;
  END LOOP;

  IF NOT has_column_privilege('authenticated', 'public.tools_note_notes'::regclass, 'note_name', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated lost note metadata';
  END IF;
  IF has_column_privilege('anon', 'public.tools_note_notes'::regclass, 'note_name', 'SELECT') THEN
    RAISE EXCEPTION 'anon can still read note metadata';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.tools_id_documents'::regclass, 'document_name', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated lost document metadata';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc proc
    JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname = 'public'
      AND (
        position('view_password_hash' IN proc.prosrc) > 0
        OR position('download_password_hash' IN proc.prosrc) > 0
        OR position('answer_hash' IN proc.prosrc) > 0
      )
      AND (
        has_function_privilege('anon', proc.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', proc.oid, 'EXECUTE')
      )
  ) THEN
    RAISE EXCEPTION 'an exposed function reads a secret column';
  END IF;
END
$secrets$;

COMMIT;
