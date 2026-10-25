-- Read-only release preflight. Returns catalog facts only.
-- Do not add data queries, function calls, or writes.

SELECT json_build_object(
  'functions', (
    SELECT COALESCE(json_agg(json_build_object(
      'name', p.proname,
      'args', pg_get_function_identity_arguments(p.oid),
      'definer', p.prosecdef,
      'owner', r.rolname,
      'anon', has_function_privilege('anon', p.oid, 'EXECUTE'),
      'authenticated', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      'service_role', has_function_privilege('service_role', p.oid, 'EXECUTE'),
      'public', has_function_privilege('public', p.oid, 'EXECUTE')
    ) ORDER BY p.proname), '[]'::json)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles r ON r.oid = p.proowner
    WHERE n.nspname = 'public'
  ),
  'access_calls_lock', (
    SELECT position('household_tool_access_locked' IN p.prosrc) > 0
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'can_access_user_data'
  ),
  'lock_owner_can_execute', (
    SELECT has_function_privilege(access.proowner, lockfn.oid, 'EXECUTE')
    FROM pg_proc access
    JOIN pg_namespace access_ns ON access_ns.oid = access.pronamespace
    JOIN pg_proc lockfn ON lockfn.proname = 'household_tool_access_locked'
    JOIN pg_namespace lock_ns ON lock_ns.oid = lockfn.pronamespace
    WHERE access_ns.nspname = 'public'
      AND lock_ns.nspname = 'public'
      AND access.proname = 'can_access_user_data'
  ),
  'storage_usage_has_nested_match', (
    SELECT position('%/' IN p.prosrc) > 0
      AND position('|| ''/%''' IN p.prosrc) > 0
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_user_storage_usage'
  ),
  'policies_calling_helpers', (
    SELECT COALESCE(json_agg(json_build_object(
      'schema', n.nspname,
      'table', c.relname,
      'policy', pol.polname,
      'command', pol.polcmd,
      'qual_calls_lock', pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%household_tool_access_locked%',
      'check_calls_lock', pg_get_expr(pol.polwithcheck, pol.polrelid) ILIKE '%household_tool_access_locked%',
      'qual_calls_access', pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%can_access_user_data%',
      'check_calls_access', pg_get_expr(pol.polwithcheck, pol.polrelid) ILIKE '%can_access_user_data%',
      'qual_calls_storage', pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%can_access_storage_owner%',
      'check_calls_storage', pg_get_expr(pol.polwithcheck, pol.polrelid) ILIKE '%can_access_storage_owner%'
    ) ORDER BY n.nspname, c.relname, pol.polname), '[]'::json)
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%household_tool_access_locked%'
       OR pg_get_expr(pol.polwithcheck, pol.polrelid) ILIKE '%household_tool_access_locked%'
       OR pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%can_access_user_data%'
       OR pg_get_expr(pol.polwithcheck, pol.polrelid) ILIKE '%can_access_user_data%'
       OR pg_get_expr(pol.polqual, pol.polrelid) ILIKE '%can_access_storage_owner%'
       OR pg_get_expr(pol.polwithcheck, pol.polrelid) ILIKE '%can_access_storage_owner%'
  ),
  'secret_columns', (
    SELECT COALESCE(json_agg(json_build_object(
      'table_name', c.relname,
      'column_name', a.attname,
      'table_select_anon', has_table_privilege('anon', c.oid, 'SELECT'),
      'table_select_authenticated', has_table_privilege('authenticated', c.oid, 'SELECT'),
      'table_insert_authenticated', has_table_privilege('authenticated', c.oid, 'INSERT'),
      'table_update_authenticated', has_table_privilege('authenticated', c.oid, 'UPDATE'),
      'table_delete_authenticated', has_table_privilege('authenticated', c.oid, 'DELETE'),
      'table_select_service', has_table_privilege('service_role', c.oid, 'SELECT'),
      'table_insert_service', has_table_privilege('service_role', c.oid, 'INSERT'),
      'table_update_service', has_table_privilege('service_role', c.oid, 'UPDATE'),
      'table_delete_service', has_table_privilege('service_role', c.oid, 'DELETE'),
      'column_select_anon', has_column_privilege('anon', c.oid, a.attnum, 'SELECT'),
      'column_select_authenticated', has_column_privilege('authenticated', c.oid, a.attnum, 'SELECT')
    ) ORDER BY c.relname, a.attname), '[]'::json)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT a.attisdropped
      AND a.attnum > 0
      AND a.attname IN ('view_password_hash', 'download_password_hash', 'answer_hash', 'note', 'note_name', 'document_name')
      AND c.relname IN (
        'tools_note_notes',
        'tools_note_security_questions',
        'tools_id_documents',
        'tools_id_security_questions'
      )
  ),
  'other_note_columns', (
    SELECT COALESCE(json_agg(json_build_object(
      'table_name', c.relname,
      'column_name', a.attname,
      'table_select_authenticated', has_table_privilege('authenticated', c.oid, 'SELECT')
    ) ORDER BY c.relname, a.attname), '[]'::json)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT a.attisdropped
      AND a.attnum > 0
      AND a.attname IN ('note', 'view_password_hash', 'download_password_hash', 'answer_hash')
      AND c.relname NOT IN (
        'tools_note_notes',
        'tools_note_security_questions',
        'tools_id_documents',
        'tools_id_security_questions'
      )
  ),
  'user_id_tables', (
    SELECT COALESCE(json_agg(c.relname ORDER BY c.relname), '[]'::json)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attname = 'user_id'
      AND a.attnum > 0
      AND NOT a.attisdropped
  ),
  'required_tables_present', (
    SELECT COALESCE(json_agg(name ORDER BY name), '[]'::json)
    FROM unnest(ARRAY[
      'tools_note_notes',
      'tools_id_documents',
      'tools_note_security_questions',
      'tools_id_security_questions',
      'users_tools',
      'billing_invoices',
      'account_notices',
      'calendar_pins',
      'user_release_note_reads',
      'users',
      'household_members',
      'households',
      'settings'
    ]) AS name
    WHERE to_regclass('public.' || name) IS NOT NULL
  ),
  'household_membership_grants', json_build_object(
    'members_select_authenticated', has_table_privilege('authenticated', 'public.household_members'::regclass, 'SELECT'),
    'members_select_service', has_table_privilege('service_role', 'public.household_members'::regclass, 'SELECT'),
    'households_select_authenticated', has_table_privilege('authenticated', 'public.households'::regclass, 'SELECT'),
    'households_select_service', has_table_privilege('service_role', 'public.households'::regclass, 'SELECT')
  ),
  'service_role_bypassrls', (
    SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'
  ),
  'existing_ownership_triggers', (
    SELECT COALESCE(json_agg(json_build_object('table', c.relname, 'trigger', t.tgname) ORDER BY c.relname), '[]'::json)
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND NOT t.tgisinternal
      AND t.tgname IN ('reject_user_id_change', 'reject_unowned_user_id')
  ),
  'rls', (
    SELECT json_build_object(
      'tables', count(*),
      'rls_enabled', count(*) FILTER (WHERE c.relrowsecurity),
      'rls_forced', count(*) FILTER (WHERE c.relforcerowsecurity),
      'views', (
        SELECT count(*)
        FROM pg_class view
        JOIN pg_namespace vn ON vn.oid = view.relnamespace
        WHERE vn.nspname = 'public' AND view.relkind = 'v'
      )
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  ),
  'truncate_grant_counts', (
    SELECT json_build_object(
      'anon', count(*) FILTER (WHERE has_table_privilege('anon', c.oid, 'TRUNCATE')),
      'authenticated', count(*) FILTER (WHERE has_table_privilege('authenticated', c.oid, 'TRUNCATE'))
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  ),
  'schema_reload_trigger', (
    SELECT COALESCE(json_agg(evtname), '[]'::json)
    FROM pg_event_trigger
    WHERE evtenabled <> 'D'
  ),
  'storage_name_shapes', (
    SELECT json_build_object(
      'objects', count(*),
      'owner_prefix_or_exact', count(*) FILTER (
        WHERE name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(/|$)'
      ),
      'other_shape', count(*) FILTER (
        WHERE name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(/|$)'
      )
    )
    FROM storage.objects
  )
);
