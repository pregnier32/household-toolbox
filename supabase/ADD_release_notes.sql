-- Customer-facing release notes ("What's New") plus lightweight per-user read tracking.
-- Safe to re-run. After this succeeds, reload types:
--   npm run supabase:types
--
-- App access goes through Next.js API routes + supabaseServer (service role),
-- which bypasses RLS. These policies lock down the anon/authenticated keys.

CREATE TABLE IF NOT EXISTS release_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT,
  category TEXT NOT NULL,
  publish_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  featured BOOLEAN NOT NULL DEFAULT false,
  link_url TEXT,
  link_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT release_notes_category_check
    CHECK (category IN ('new_tool', 'new_feature', 'improvement', 'bug_fix', 'security', 'announcement')),
  CONSTRAINT release_notes_status_check
    CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT release_notes_title_not_blank
    CHECK (length(trim(title)) > 0),
  CONSTRAINT release_notes_summary_not_blank
    CHECK (length(trim(summary)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_release_notes_customer_feed
  ON release_notes (publish_date DESC, created_at DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_release_notes_status_publish_date
  ON release_notes (status, publish_date DESC);

CREATE INDEX IF NOT EXISTS idx_release_notes_category
  ON release_notes (category);

CREATE OR REPLACE FUNCTION update_release_notes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_release_notes_updated_at ON release_notes;
CREATE TRIGGER trigger_update_release_notes_updated_at
  BEFORE UPDATE ON release_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_release_notes_updated_at();

-- One row per user: watermark of the newest published note they have viewed.
CREATE TABLE IF NOT EXISTS user_release_note_reads (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_viewed_publish_date DATE NOT NULL,
  last_viewed_id UUID REFERENCES release_notes(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_release_note_reads_last_viewed_id
  ON user_release_note_reads (last_viewed_id);

CREATE OR REPLACE FUNCTION update_user_release_note_reads_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_user_release_note_reads_updated_at ON user_release_note_reads;
CREATE TRIGGER trigger_update_user_release_note_reads_updated_at
  BEFORE UPDATE ON user_release_note_reads
  FOR EACH ROW
  EXECUTE FUNCTION update_user_release_note_reads_updated_at();

ALTER TABLE release_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_release_note_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read published release notes" ON release_notes;
CREATE POLICY "Anyone can read published release notes"
  ON release_notes
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published' AND publish_date <= CURRENT_DATE);

DROP POLICY IF EXISTS "Deny client insert on release notes" ON release_notes;
CREATE POLICY "Deny client insert on release notes"
  ON release_notes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny client update on release notes" ON release_notes;
CREATE POLICY "Deny client update on release notes"
  ON release_notes
  FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny client delete on release notes" ON release_notes;
CREATE POLICY "Deny client delete on release notes"
  ON release_notes
  FOR DELETE
  TO anon, authenticated
  USING (false);

DROP POLICY IF EXISTS "Deny all client access to release note reads" ON user_release_note_reads;
CREATE POLICY "Deny all client access to release note reads"
  ON user_release_note_reads
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

REVOKE INSERT, UPDATE, DELETE ON TABLE release_notes FROM anon, authenticated;
GRANT SELECT ON TABLE release_notes TO anon, authenticated;
GRANT ALL ON TABLE release_notes TO service_role;

REVOKE ALL ON TABLE user_release_note_reads FROM anon, authenticated;
GRANT ALL ON TABLE user_release_note_reads TO service_role;

-- Development/test seed records. Safe to re-run; does not overwrite edits.
INSERT INTO release_notes (
  id,
  title,
  summary,
  content,
  category,
  publish_date,
  status,
  featured,
  link_url,
  link_text
) VALUES
  (
    'a1c0e001-0001-4000-8000-000000000001',
    'Event Budget Planner',
    'Plan expected event expenses and compare them against actual spending.',
    'The Event Budget Planner helps you set category budgets, track actual costs, and see where an event is over or under plan before the day arrives.',
    'new_tool',
    DATE '2026-09-19',
    'published',
    true,
    '/dashboard',
    'Open Event Budget Planner'
  ),
  (
    'a1c0e001-0001-4000-8000-000000000002',
    'Additional Storage Options',
    'Paid users can now purchase additional storage for their Household Toolbox account.',
    'If you are running low on attachment space, you can add extra storage from your Storage page without changing your existing tools.',
    'new_feature',
    DATE '2026-09-17',
    'published',
    false,
    '/dashboard/storage',
    'View Storage'
  ),
  (
    'a1c0e001-0001-4000-8000-000000000003',
    'Faster Tool Navigation',
    'We''ve improved navigation between Household Toolbox tools.',
    'Opening and switching between tools in your Tool Box should feel snappier, especially when several tools are already in use.',
    'improvement',
    DATE '2026-09-12',
    'published',
    false,
    '/dashboard',
    'Go to Tool Box'
  ),
  (
    'a1c0e001-0001-4000-8000-000000000004',
    'Document Upload Improvements',
    'Fixed an issue that could occasionally prevent larger documents from uploading successfully.',
    'Uploads that previously stalled on larger files should now complete more reliably across document-based tools.',
    'bug_fix',
    DATE '2026-09-08',
    'published',
    false,
    NULL,
    NULL
  ),
  (
    'a1c0e001-0001-4000-8000-000000000005',
    'Draft: Internal preview only',
    'This draft should never appear on the customer What''s New page.',
    'Used to verify that draft release notes stay hidden from customers.',
    'announcement',
    DATE '2026-09-19',
    'draft',
    false,
    NULL,
    NULL
  )
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
