-- Read-only follow-up. Safe to run in the Supabase SQL editor.
-- No credentials, row contents, or policy secrets. Returns catalog metadata only.

SELECT json_build_object(
  'rls_off', (
    SELECT COALESCE(json_agg(c.relname ORDER BY c.relname), '[]'::json)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  ),
  'rls_on_unforced', (
    SELECT count(*)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
      AND NOT c.relforcerowsecurity
  ),
  'views', (
    SELECT COALESCE(json_agg(c.relname ORDER BY c.relname), '[]'::json)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('v', 'm')
  ),
  'household_grants', (
    SELECT COALESCE(json_agg(json_build_object(
      'table_name', table_name,
      'grantee', grantee,
      'privilege_type', privilege_type
    ) ORDER BY table_name, grantee, privilege_type), '[]'::json)
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND grantee IN ('anon', 'authenticated', 'PUBLIC')
      AND table_name IN ('households', 'household_members', 'household_invitations', 'settings', 'users', 'users_tools')
  ),
  'extra_privileges', (
    SELECT COALESCE(json_agg(json_build_object(
      'table_name', table_name,
      'grantee', grantee,
      'privilege_type', privilege_type
    ) ORDER BY table_name, grantee, privilege_type), '[]'::json)
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND grantee IN ('anon', 'authenticated')
      AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES')
  ),
  'user_id_update_policies', (
    SELECT COALESCE(json_agg(json_build_object(
      'table_name', tablename,
      'command', cmd,
      'with_check', with_check
    ) ORDER BY tablename, cmd), '[]'::json)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd IN ('UPDATE', 'ALL', 'INSERT')
      AND COALESCE(with_check, '') ILIKE '%user_id%'
  ),
  'access_function', (
    SELECT json_build_object(
      'security', CASE WHEN p.prosecdef THEN 'definer' ELSE 'invoker' END,
      'source', p.prosrc
    )
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'can_access_user_data'
  )
);
