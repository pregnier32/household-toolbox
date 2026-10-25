-- Read-only catalog inspection. Safe to run in the Supabase SQL editor.
-- Returns signatures, owners, security mode, execute grants, RLS flags, and policy text.
-- Does not modify data, privileges, or policies.

SELECT json_build_object(
  'functions', (
    SELECT COALESCE(json_agg(row_to_json(fn) ORDER BY fn.name, fn.identity_args), '[]'::json)
    FROM (
      SELECT
        n.nspname AS schema,
        p.proname AS name,
        pg_get_function_identity_arguments(p.oid) AS identity_args,
        pg_get_function_result(p.oid) AS result_type,
        CASE WHEN p.prosecdef THEN 'definer' ELSE 'invoker' END AS security,
        r.rolname AS owner,
        p.proacl::text AS acl,
        (position('household_tool_access_locked' IN p.prosrc) > 0) AS calls_lock_helper,
        (position('can_access_user_data' IN p.prosrc) > 0) AS calls_access_helper
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_roles r ON r.oid = p.proowner
      WHERE n.nspname = 'public'
        AND p.proname = ANY (ARRAY[
          'apply_tools_eolp_owner_rls',
          'rewrite_household_owner_check',
          'household_tool_access_locked',
          'can_access_user_data',
          'can_access_storage_owner',
          'get_user_storage_usage',
          'get_site_storage_stats',
          'save_promotion',
          'assign_promotion',
          'assign_manual_entitlement',
          'claim_billing_lock',
          'release_billing_lock',
          'claim_stripe_event',
          'finish_stripe_event'
        ])
    ) fn
  ),
  'execute', (
    SELECT COALESCE(json_agg(row_to_json(priv) ORDER BY priv.name, priv.role_name), '[]'::json)
    FROM (
      SELECT
        p.proname AS name,
        pg_get_function_identity_arguments(p.oid) AS identity_args,
        role_name,
        has_function_privilege(role_name, p.oid, 'EXECUTE') AS can_execute
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS roles(role_name)
      WHERE n.nspname = 'public'
        AND p.proname = ANY (ARRAY[
          'apply_tools_eolp_owner_rls',
          'rewrite_household_owner_check',
          'household_tool_access_locked',
          'can_access_user_data',
          'can_access_storage_owner',
          'get_user_storage_usage',
          'get_site_storage_stats',
          'save_promotion',
          'assign_promotion',
          'assign_manual_entitlement',
          'claim_billing_lock',
          'release_billing_lock',
          'claim_stripe_event',
          'finish_stripe_event'
        ])
    ) priv
  ),
  'call_chain', (
    SELECT row_to_json(chain)
    FROM (
      SELECT
        access_owner.rolname AS access_owner,
        lock_owner.rolname AS lock_owner,
        access.prosecdef AS access_is_definer,
        lockfn.prosecdef AS lock_is_definer,
        has_function_privilege(access.proowner, lockfn.oid, 'EXECUTE') AS access_owner_can_execute_lock,
        (position('household_tool_access_locked' IN access.prosrc) > 0) AS access_source_calls_lock
      FROM pg_proc access
      JOIN pg_namespace access_ns ON access_ns.oid = access.pronamespace
      JOIN pg_roles access_owner ON access_owner.oid = access.proowner
      JOIN pg_proc lockfn ON lockfn.proname = 'household_tool_access_locked'
      JOIN pg_namespace lock_ns ON lock_ns.oid = lockfn.pronamespace AND lock_ns.nspname = 'public'
      JOIN pg_roles lock_owner ON lock_owner.oid = lockfn.proowner
      WHERE access_ns.nspname = 'public'
        AND access.proname = 'can_access_user_data'
    ) chain
  ),
  'rls', (
    SELECT COALESCE(json_agg(row_to_json(rel) ORDER BY rel.table_name), '[]'::json)
    FROM (
      SELECT
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS rls_forced,
        (
          SELECT COUNT(*)
          FROM pg_policy pol
          WHERE pol.polrelid = c.oid
        ) AS policy_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND (
          NOT c.relrowsecurity
          OR c.relname = ANY (ARRAY[
            'settings', 'users', 'households', 'household_members', 'household_invitations',
            'users_tools', 'tools_gt_goals', 'tools_gt_phases', 'tools_gt_tasks', 'tools_gt_update_notes',
            'tools_sl_lists', 'tools_sl_list_items', 'tools_note_notes', 'tools_id_documents'
          ])
        )
    ) rel
  ),
  'policies', (
    SELECT COALESCE(json_agg(row_to_json(pol) ORDER BY pol.table_name, pol.policy_name), '[]'::json)
    FROM (
      SELECT
        tablename AS table_name,
        policyname AS policy_name,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = ANY (ARRAY[
          'settings', 'users', 'households', 'household_members', 'household_invitations',
          'users_tools', 'tools_gt_goals', 'tools_gt_phases', 'tools_gt_tasks', 'tools_gt_update_notes',
          'tools_sl_lists', 'tools_sl_list_items', 'tools_note_notes', 'tools_id_documents'
        ])
    ) pol
  ),
  'table_grants', (
    SELECT COALESCE(json_agg(row_to_json(gr) ORDER BY gr.table_name, gr.grantee, gr.privilege_type), '[]'::json)
    FROM (
      SELECT table_name, grantee, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND grantee IN ('anon', 'authenticated', 'PUBLIC')
        AND table_name = ANY (ARRAY[
          'settings', 'users', 'households', 'household_members', 'household_invitations',
          'users_tools', 'tools_gt_goals', 'tools_gt_phases', 'tools_gt_tasks', 'tools_gt_update_notes',
          'tools_sl_lists', 'tools_sl_list_items', 'tools_note_notes', 'tools_id_documents'
        ])
    ) gr
  )
) AS inspection;
