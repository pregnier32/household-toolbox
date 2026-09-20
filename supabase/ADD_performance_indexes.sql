-- Targeted indexes for hot-path lookups that are missing from the schema scripts.
-- Safe to re-run. Does not drop existing indexes.
--
-- High: users_tools, password_reset_tokens, tool_icons (grow with users / run on every Store/login).
-- Medium: composites used on dashboard/tool list filters as row counts grow.

-- ============================================================================
-- HIGH: users_tools (Store, My Tools, Buy, admin, account-delete)
-- The table was created outside these SQL files and has no indexes in-repo.
-- ============================================================================

DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  IF to_regclass('public.users_tools') IS NULL THEN
    RAISE NOTICE 'users_tools does not exist; skipping';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT user_id, tool_id
    FROM users_tools
    GROUP BY user_id, tool_id
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE NOTICE 'users_tools has % duplicate (user_id, tool_id) groups; skipped UNIQUE index. Clean duplicates, then re-run.', dup_count;
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tools_user_tool ON users_tools(user_id, tool_id)';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_tools_user_status
  ON users_tools(user_id, status);

CREATE INDEX IF NOT EXISTS idx_users_tools_tool_id
  ON users_tools(tool_id);

-- ============================================================================
-- HIGH: password_reset_tokens (reset lookup + invalidate unused)
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.password_reset_tokens') IS NULL THEN
    RAISE NOTICE 'password_reset_tokens does not exist; skipping';
    RETURN;
  END IF;

  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_unused ON password_reset_tokens(user_id) WHERE COALESCE(used, false) = false';
END $$;

-- ============================================================================
-- HIGH: tool_icons (admin upsert by tool + type; FK on tools delete)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tool_icons_tool_id
  ON tool_icons(tool_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tool_icons_tool_type
  ON tool_icons(tool_id, icon_type);

-- ============================================================================
-- MEDIUM: dashboard / tool-page filters (user_id + status or is_active)
-- PK already covers calendar pin IN (id, ...) lookups. These help full lists.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tdl_tasks_user_status
  ON tools_tdl_tasks(user_id, status);

CREATE INDEX IF NOT EXISTS idx_gt_goals_user_status
  ON tools_gt_goals(user_id, status);

CREATE INDEX IF NOT EXISTS idx_ce_events_user_active
  ON tools_ce_events(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_st_subscriptions_user_active
  ON tools_st_subscriptions(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_id_documents_user_active
  ON tools_id_documents(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_note_notes_user_active
  ON tools_note_notes(user_id, is_active);

-- ============================================================================
-- OPTIONAL: waitlist (marketing form; table may not be in generated types)
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.waitlist') IS NULL THEN
    RETURN;
  END IF;
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email)';
END $$;

NOTIFY pgrst, 'reload schema';
