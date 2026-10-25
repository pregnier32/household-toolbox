-- Read-only release check. Returns aggregate schema facts only.
SELECT jsonb_build_object(
  'functions', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'args', pg_get_function_identity_arguments(p.oid),
      'count', 1,
      'security_definer', p.prosecdef,
      'anon', has_function_privilege('anon', p.oid, 'EXECUTE'),
      'authenticated', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      'service_role', has_function_privilege('service_role', p.oid, 'EXECUTE')
    ) ORDER BY p.proname), '[]'::jsonb)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'apply_tools_eolp_owner_rls',
        'assign_manual_entitlement',
        'assign_promotion',
        'can_access_storage_owner',
        'can_access_user_data',
        'claim_billing_lock',
        'claim_stripe_event',
        'finish_stripe_event',
        'get_site_storage_stats',
        'get_user_storage_usage',
        'household_tool_access_locked',
        'release_billing_lock',
        'rewrite_household_owner_check',
        'save_promotion',
        'enforce_household_member_rules',
        'enforce_household_invitation_limit',
        'reject_user_id_change'
      )
  ),
  'function_overload_counts', (
    SELECT coalesce(jsonb_object_agg(p.proname, p.overload_count), '{}'::jsonb)
    FROM (
      SELECT p.proname, count(*) AS overload_count
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN (
          'apply_tools_eolp_owner_rls',
          'assign_manual_entitlement',
          'assign_promotion',
          'can_access_storage_owner',
          'can_access_user_data',
          'claim_billing_lock',
          'claim_stripe_event',
          'finish_stripe_event',
          'get_site_storage_stats',
          'get_user_storage_usage',
          'household_tool_access_locked',
          'release_billing_lock',
          'rewrite_household_owner_check',
          'save_promotion',
          'enforce_household_member_rules',
          'enforce_household_invitation_limit',
          'reject_user_id_change'
        )
      GROUP BY p.proname
    ) p
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
  'storage_usage_flags', (
    SELECT jsonb_build_object(
      'owner_prefix', position('p_user_id::text || ''/%''' IN p.prosrc) > 0,
      'middle_like', position('''%/'' || p_user_id::text || ''/%''' IN p.prosrc) > 0,
      'exact_name', position('o.name = p_user_id::text' IN p.prosrc) > 0
    )
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_user_storage_usage'
  ),
  'secret_functions_exposed', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'args', pg_get_function_identity_arguments(p.oid),
      'anon', has_function_privilege('anon', p.oid, 'EXECUTE'),
      'authenticated', has_function_privilege('authenticated', p.oid, 'EXECUTE')
    ) ORDER BY p.proname), '[]'::jsonb)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        position('view_password_hash' IN p.prosrc) > 0
        OR position('download_password_hash' IN p.prosrc) > 0
        OR position('answer_hash' IN p.prosrc) > 0
      )
      AND (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ),
  'secret_tables', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'table', c.relname,
      'exists', true,
      'rls', c.relrowsecurity,
      'anon_select', has_table_privilege('anon', c.oid, 'SELECT'),
      'authenticated_select', has_table_privilege('authenticated', c.oid, 'SELECT'),
      'authenticated_insert', has_table_privilege('authenticated', c.oid, 'INSERT'),
      'authenticated_truncate', has_table_privilege('authenticated', c.oid, 'TRUNCATE'),
      'service_select', has_table_privilege('service_role', c.oid, 'SELECT'),
      'service_insert', has_table_privilege('service_role', c.oid, 'INSERT'),
      'service_update', has_table_privilege('service_role', c.oid, 'UPDATE'),
      'service_delete', has_table_privilege('service_role', c.oid, 'DELETE')
    ) ORDER BY c.relname), '[]'::jsonb)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname IN (
        'tools_note_notes',
        'tools_note_security_questions',
        'tools_id_documents',
        'tools_id_security_questions'
      )
  ),
  'secret_columns', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'table', c.relname,
      'column', a.attname,
      'anon_select', has_column_privilege('anon', c.oid, a.attname, 'SELECT'),
      'authenticated_select', has_column_privilege('authenticated', c.oid, a.attname, 'SELECT')
    ) ORDER BY c.relname, a.attname), '[]'::jsonb)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'tools_note_notes',
        'tools_note_security_questions',
        'tools_id_documents',
        'tools_id_security_questions'
      )
      AND a.attname IN ('note', 'note_name', 'document_name', 'view_password_hash', 'download_password_hash', 'answer_hash')
      AND a.attnum > 0
      AND NOT a.attisdropped
  ),
  'views_over_secret_tables', (
    SELECT coalesce(jsonb_agg(jsonb_build_object('view', v.view_name) ORDER BY v.view_name), '[]'::jsonb)
    FROM information_schema.view_table_usage v
    WHERE v.view_schema = 'public'
      AND v.table_schema = 'public'
      AND v.table_name IN (
        'tools_note_notes',
        'tools_note_security_questions',
        'tools_id_documents',
        'tools_id_security_questions'
      )
  ),
  'required_user_id_tables', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'table', required.table_name,
      'exists', to_regclass('public.' || required.table_name) IS NOT NULL,
      'has_user_id', EXISTS (
        SELECT 1
        FROM pg_attribute a
        WHERE a.attrelid = to_regclass('public.' || required.table_name)
          AND a.attname = 'user_id'
          AND a.attnum > 0
          AND NOT a.attisdropped
      )
    ) ORDER BY required.table_name), '[]'::jsonb)
    FROM (
      VALUES
        ('tools_note_notes'),
        ('tools_id_documents'),
        ('users_tools'),
        ('billing_invoices'),
        ('account_notices'),
        ('calendar_pins'),
        ('user_release_note_reads')
    ) AS required(table_name)
  ),
  'user_id_table_count', (
    SELECT count(*)
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    JOIN pg_attribute attribute ON attribute.attrelid = relation.oid
    WHERE namespace.nspname = 'public'
      AND relation.relkind = 'r'
      AND attribute.attname = 'user_id'
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND relation.relname NOT IN ('users', 'household_members')
  ),
  'existing_user_id_triggers', (
    SELECT count(*)
    FROM pg_trigger trigger
    JOIN pg_class relation ON relation.oid = trigger.tgrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND NOT trigger.tgisinternal
      AND trigger.tgname IN ('reject_user_id_change', 'reject_unowned_user_id')
  ),
  'public_truncate_tables', (
    SELECT count(*)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND (
        has_table_privilege('anon', c.oid, 'TRUNCATE')
        OR has_table_privilege('authenticated', c.oid, 'TRUNCATE')
      )
  ),
  'public_acl_truncate_tables', (
    SELECT count(*)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND EXISTS (
        SELECT 1
        FROM aclexplode(c.relacl) acl
        JOIN pg_roles r ON r.oid = acl.grantee
        WHERE r.rolname = 'PUBLIC'
          AND acl.privilege_type = 'TRUNCATE'
      )
  ),
  'focus_table_privileges', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'table', c.relname,
      'anon_truncate', has_table_privilege('anon', c.oid, 'TRUNCATE'),
      'authenticated_truncate', has_table_privilege('authenticated', c.oid, 'TRUNCATE'),
      'authenticated_trigger', has_table_privilege('authenticated', c.oid, 'TRIGGER'),
      'authenticated_references', has_table_privilege('authenticated', c.oid, 'REFERENCES'),
      'authenticated_maintain', has_table_privilege('authenticated', c.oid, 'MAINTAIN'),
      'service_select', has_table_privilege('service_role', c.oid, 'SELECT')
    ) ORDER BY c.relname), '[]'::jsonb)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname IN ('users', 'settings', 'users_tools', 'household_members', 'household_invitations')
  ),
  'release_note_rls', (
    SELECT jsonb_build_object(
      'rls', c.relrowsecurity,
      'authenticated_insert', has_table_privilege('authenticated', c.oid, 'INSERT'),
      'policy_count', (
        SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid
      )
    )
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'user_release_note_reads'
  ),
  'storage_middle_only_objects', (
    SELECT count(*)
    FROM storage.objects object
    JOIN public.users account ON object.name LIKE '%/' || account.id::text || '/%'
    WHERE object.name IS DISTINCT FROM account.id::text
      AND object.name NOT LIKE account.id::text || '/%'
  )
) AS catalog;
