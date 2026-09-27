-- Notes — current schema
-- Safe to re-run. Creates anything missing. Does not delete user rows.
-- Includes tables, later columns, attachment tables, and storage policies for bucket "notes".
-- Run in the Supabase SQL editor.

-- Notes Tool Database Schema
-- All tables prefixed with 'tools_note_'

-- Main notes table - multiple notes per user allowed
CREATE TABLE IF NOT EXISTS tools_note_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  note_name TEXT NOT NULL,
  created_date DATE NOT NULL,
  note TEXT NOT NULL, -- Primary content field (required)
  requires_password_for_view BOOLEAN DEFAULT false,
  view_password_hash TEXT, -- Hashed password using bcrypt or similar
  is_active BOOLEAN DEFAULT true,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  date_inactivated DATE, -- When note was inactivated
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tags table - user-defined tags for categorizing notes
CREATE TABLE IF NOT EXISTS tools_note_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  date_inactivated DATE, -- When tag was inactivated
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure unique tag names per user per tool
  UNIQUE(user_id, tool_id, name)
);

-- Junction table for many-to-many relationship between notes and tags
CREATE TABLE IF NOT EXISTS tools_note_note_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES tools_note_notes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tools_note_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure a note can't have the same tag twice
  UNIQUE(note_id, tag_id)
);

-- Security questions table - stores security questions and answers for password recovery
CREATE TABLE IF NOT EXISTS tools_note_security_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES tools_note_notes(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL, -- References the question ID from the fixed list (q1, q2, etc.)
  answer_hash TEXT NOT NULL, -- Hashed answer using bcrypt or similar
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure a note can't have duplicate questions
  UNIQUE(note_id, question_id)
);

-- Create indexes for faster lookups
-- Notes table indexes
CREATE INDEX IF NOT EXISTS idx_note_notes_user_tool ON tools_note_notes(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_note_notes_is_active ON tools_note_notes(is_active);
CREATE INDEX IF NOT EXISTS idx_note_notes_created_date ON tools_note_notes(created_date);
CREATE INDEX IF NOT EXISTS idx_note_notes_requires_password ON tools_note_notes(requires_password_for_view) WHERE requires_password_for_view = true;
CREATE INDEX IF NOT EXISTS idx_note_notes_note_name ON tools_note_notes(note_name); -- For search functionality

-- Tags table indexes
CREATE INDEX IF NOT EXISTS idx_note_tags_user_tool ON tools_note_tags(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_is_active ON tools_note_tags(is_active);
CREATE INDEX IF NOT EXISTS idx_note_tags_name ON tools_note_tags(name);

-- Note tags junction table indexes
CREATE INDEX IF NOT EXISTS idx_note_note_tags_note_id ON tools_note_note_tags(note_id);
CREATE INDEX IF NOT EXISTS idx_note_note_tags_tag_id ON tools_note_note_tags(tag_id);

-- Security questions table indexes
CREATE INDEX IF NOT EXISTS idx_note_security_questions_note_id ON tools_note_security_questions(note_id);

-- Functions to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_note_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_note_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_note_security_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_note_notes_updated_at ON tools_note_notes;
CREATE TRIGGER trigger_update_note_notes_updated_at
  BEFORE UPDATE ON tools_note_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_note_notes_updated_at();

DROP TRIGGER IF EXISTS trigger_update_note_tags_updated_at ON tools_note_tags;
CREATE TRIGGER trigger_update_note_tags_updated_at
  BEFORE UPDATE ON tools_note_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_note_tags_updated_at();

DROP TRIGGER IF EXISTS trigger_update_note_security_questions_updated_at ON tools_note_security_questions;
CREATE TRIGGER trigger_update_note_security_questions_updated_at
  BEFORE UPDATE ON tools_note_security_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_note_security_questions_updated_at();

-- Enable Row Level Security
ALTER TABLE tools_note_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_note_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_note_note_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_note_security_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
-- Drop existing policies if they exist, then create them

-- ============================================================================
-- Notes table policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own notes" ON tools_note_notes;
CREATE POLICY "Users can view their own notes" ON tools_note_notes
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own notes" ON tools_note_notes;
CREATE POLICY "Users can insert their own notes" ON tools_note_notes
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own notes" ON tools_note_notes;
CREATE POLICY "Users can update their own notes" ON tools_note_notes
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own notes" ON tools_note_notes;
CREATE POLICY "Users can delete their own notes" ON tools_note_notes
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- Tags table policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own tags" ON tools_note_tags;
CREATE POLICY "Users can view their own tags" ON tools_note_tags
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own tags" ON tools_note_tags;
CREATE POLICY "Users can insert their own tags" ON tools_note_tags
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own tags" ON tools_note_tags;
CREATE POLICY "Users can update their own tags" ON tools_note_tags
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own tags" ON tools_note_tags;
CREATE POLICY "Users can delete their own tags" ON tools_note_tags
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- Note tags junction table policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own note tags" ON tools_note_note_tags;
CREATE POLICY "Users can view their own note tags" ON tools_note_note_tags
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_note_tags.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own note tags" ON tools_note_note_tags;
CREATE POLICY "Users can insert their own note tags" ON tools_note_note_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_note_tags.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
    AND
    EXISTS (
      SELECT 1 FROM tools_note_tags
      WHERE tools_note_tags.id = tools_note_note_tags.tag_id
      AND tools_note_tags.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own note tags" ON tools_note_note_tags;
CREATE POLICY "Users can update their own note tags" ON tools_note_note_tags
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_note_tags.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_note_tags.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
    AND
    EXISTS (
      SELECT 1 FROM tools_note_tags
      WHERE tools_note_tags.id = tools_note_note_tags.tag_id
      AND tools_note_tags.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own note tags" ON tools_note_note_tags;
CREATE POLICY "Users can delete their own note tags" ON tools_note_note_tags
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_note_tags.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- Security questions table policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own security questions" ON tools_note_security_questions;
CREATE POLICY "Users can view their own security questions" ON tools_note_security_questions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_security_questions.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own security questions" ON tools_note_security_questions;
CREATE POLICY "Users can insert their own security questions" ON tools_note_security_questions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_security_questions.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own security questions" ON tools_note_security_questions;
CREATE POLICY "Users can update their own security questions" ON tools_note_security_questions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_security_questions.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_security_questions.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own security questions" ON tools_note_security_questions;
CREATE POLICY "Users can delete their own security questions" ON tools_note_security_questions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_note_notes
      WHERE tools_note_notes.id = tools_note_security_questions.note_id
      AND tools_note_notes.user_id = (select auth.uid())
    )
  );


-- Notes attachments: multiple optional files per note.
-- Safe to re-run. After this succeeds, reload types:
--   npm run supabase:types
--
-- Files live in the existing `notes` storage bucket at
-- {userId}/{noteId}/{timestamp}-{filename}

CREATE TABLE IF NOT EXISTS tools_note_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES tools_note_notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_attachments_note_id ON tools_note_attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_note_attachments_user_id ON tools_note_attachments(user_id);

ALTER TABLE tools_note_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own note attachments" ON tools_note_attachments;
CREATE POLICY "Users can view their own note attachments" ON tools_note_attachments
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own note attachments" ON tools_note_attachments;
CREATE POLICY "Users can insert their own note attachments" ON tools_note_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own note attachments" ON tools_note_attachments;
CREATE POLICY "Users can update their own note attachments" ON tools_note_attachments
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own note attachments" ON tools_note_attachments;
CREATE POLICY "Users can delete their own note attachments" ON tools_note_attachments
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));


-- Trigger functions with a fixed search_path.
CREATE OR REPLACE FUNCTION update_note_notes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_note_tags_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_note_security_questions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- Storage policies for bucket "notes".
-- Create that bucket in Supabase Storage if it does not exist yet.
DROP POLICY IF EXISTS "notes: Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "notes: Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "notes: Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "notes: Users can delete their own files" ON storage.objects;

CREATE POLICY "notes: Users can upload to their own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'notes' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);

CREATE POLICY "notes: Users can read their own files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'notes' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);

CREATE POLICY "notes: Users can update their own files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'notes' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
)
WITH CHECK (
  bucket_id = 'notes' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);

CREATE POLICY "notes: Users can delete their own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'notes' AND
  (storage.foldername(name))[1] = (select auth.uid())::text
);


NOTIFY pgrst, 'reload schema';
