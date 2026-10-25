-- Read-only. Lists secret-bearing columns, their privileges, and functions that mention them.
SELECT json_build_object(
  'secret_columns', (
    SELECT COALESCE(json_agg(json_build_object(
      'table_name', c.relname,
      'column_name', a.attname,
      'table_select_anon', has_table_privilege('anon', c.oid, 'SELECT'),
      'table_select_authenticated', has_table_privilege('authenticated', c.oid, 'SELECT'),
      'table_select_service', has_table_privilege('service_role', c.oid, 'SELECT'),
      'column_select_anon', has_column_privilege('anon', c.oid, a.attnum, 'SELECT'),
      'column_select_authenticated', has_column_privilege('authenticated', c.oid, a.attnum, 'SELECT'),
      'column_update_authenticated', has_column_privilege('authenticated', c.oid, a.attnum, 'UPDATE')
    ) ORDER BY c.relname, a.attname), '[]'::json)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT a.attisdropped
      AND a.attnum > 0
      AND (
        a.attname IN ('view_password_hash', 'download_password_hash', 'answer_hash', 'note')
        OR a.attname ILIKE '%password_hash%'
        OR a.attname ILIKE '%answer_hash%'
      )
  ),
  'functions_mentioning_secrets', (
    SELECT COALESCE(json_agg(json_build_object(
      'name', p.proname,
      'args', pg_get_function_identity_arguments(p.oid),
      'security', CASE WHEN p.prosecdef THEN 'definer' ELSE 'invoker' END,
      'anon', has_function_privilege('anon', p.oid, 'EXECUTE'),
      'authenticated', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      'service_role', has_function_privilege('service_role', p.oid, 'EXECUTE')
    ) ORDER BY p.proname), '[]'::json)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        p.prosrc ILIKE '%view_password_hash%'
        OR p.prosrc ILIKE '%download_password_hash%'
        OR p.prosrc ILIKE '%answer_hash%'
        OR p.prosrc ILIKE '%requires_password_for_view%'
      )
  )
);
