-- Durable per-user, per-tool trial/entitlement ledger.
-- Survives My Tools Remove and delete_user_tool. Deleted only with the user.
-- Safe to re-run. After this succeeds, reload types:
--   npm run supabase:types

CREATE TABLE IF NOT EXISTS user_tool_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  first_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  trial_started_at TIMESTAMP WITH TIME ZONE,
  trial_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT user_tool_entitlements_user_tool_unique UNIQUE (user_id, tool_id)
);

CREATE INDEX IF NOT EXISTS idx_user_tool_entitlements_user_id
  ON user_tool_entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tool_entitlements_tool_id
  ON user_tool_entitlements(tool_id);

CREATE OR REPLACE FUNCTION update_user_tool_entitlements_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_user_tool_entitlements_updated_at ON user_tool_entitlements;
CREATE TRIGGER trigger_update_user_tool_entitlements_updated_at
  BEFORE UPDATE ON user_tool_entitlements
  FOR EACH ROW
  EXECUTE FUNCTION update_user_tool_entitlements_updated_at();

ALTER TABLE user_tool_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own tool entitlements" ON user_tool_entitlements;
CREATE POLICY "Users can view their own tool entitlements" ON user_tool_entitlements
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Existing ownership counts as trial already used so re-add cannot restart a trial.
INSERT INTO user_tool_entitlements (
  user_id,
  tool_id,
  first_started_at,
  trial_started_at,
  trial_used
)
SELECT
  ut.user_id,
  ut.tool_id,
  COALESCE(ut.created_at, NOW()),
  COALESCE(ut.created_at, NOW()),
  true
FROM users_tools ut
ON CONFLICT (user_id, tool_id) DO NOTHING;
