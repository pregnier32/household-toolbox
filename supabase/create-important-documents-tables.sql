-- Important Documents Tool Database Schema
-- All tables prefixed with 'tools_id_'

-- Main documents table - multiple documents per user allowed
CREATE TABLE IF NOT EXISTS tools_id_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  uploaded_date DATE NOT NULL,
  effective_date DATE,
  note TEXT,
  file_url TEXT, -- URL or path to stored file (e.g., Supabase Storage)
  file_name TEXT, -- Original filename
  file_size BIGINT CHECK (file_size IS NULL OR file_size <= 10485760), -- File size in bytes (10MB = 10 * 1024 * 1024)
  file_type TEXT, -- MIME type (e.g., 'application/pdf', 'image/jpeg')
  requires_password_for_download BOOLEAN DEFAULT false,
  download_password_hash TEXT, -- Hashed password using bcrypt or similar
  is_active BOOLEAN DEFAULT true,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  date_inactivated DATE, -- When document was inactivated
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tags table - user-defined tags for categorizing documents
CREATE TABLE IF NOT EXISTS tools_id_tags (
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

-- Junction table for many-to-many relationship between documents and tags
CREATE TABLE IF NOT EXISTS tools_id_document_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES tools_id_documents(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tools_id_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure a document can't have the same tag twice
  UNIQUE(document_id, tag_id)
);

-- Security questions table - stores security questions and answers for password recovery
CREATE TABLE IF NOT EXISTS tools_id_security_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES tools_id_documents(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL, -- References the question ID from the fixed list (q1, q2, etc.)
  answer_hash TEXT NOT NULL, -- Hashed answer using bcrypt or similar
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure a document can't have duplicate questions
  UNIQUE(document_id, question_id)
);

-- Create indexes for faster lookups
-- Documents table indexes
CREATE INDEX IF NOT EXISTS idx_id_documents_user_tool ON tools_id_documents(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_id_documents_is_active ON tools_id_documents(is_active);
CREATE INDEX IF NOT EXISTS idx_id_documents_uploaded_date ON tools_id_documents(uploaded_date);
CREATE INDEX IF NOT EXISTS idx_id_documents_effective_date ON tools_id_documents(effective_date) WHERE effective_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_id_documents_requires_password ON tools_id_documents(requires_password_for_download) WHERE requires_password_for_download = true;

-- Tags table indexes
CREATE INDEX IF NOT EXISTS idx_id_tags_user_tool ON tools_id_tags(user_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_id_tags_is_active ON tools_id_tags(is_active);
CREATE INDEX IF NOT EXISTS idx_id_tags_name ON tools_id_tags(name);

-- Document tags junction table indexes
CREATE INDEX IF NOT EXISTS idx_id_document_tags_document_id ON tools_id_document_tags(document_id);
CREATE INDEX IF NOT EXISTS idx_id_document_tags_tag_id ON tools_id_document_tags(tag_id);

-- Security questions table indexes
CREATE INDEX IF NOT EXISTS idx_id_security_questions_document_id ON tools_id_security_questions(document_id);

-- Functions to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_id_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_id_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_id_security_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_id_documents_updated_at ON tools_id_documents;
CREATE TRIGGER trigger_update_id_documents_updated_at
  BEFORE UPDATE ON tools_id_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_id_documents_updated_at();

DROP TRIGGER IF EXISTS trigger_update_id_tags_updated_at ON tools_id_tags;
CREATE TRIGGER trigger_update_id_tags_updated_at
  BEFORE UPDATE ON tools_id_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_id_tags_updated_at();

DROP TRIGGER IF EXISTS trigger_update_id_security_questions_updated_at ON tools_id_security_questions;
CREATE TRIGGER trigger_update_id_security_questions_updated_at
  BEFORE UPDATE ON tools_id_security_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_id_security_questions_updated_at();

-- Enable Row Level Security
ALTER TABLE tools_id_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_id_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_id_document_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools_id_security_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
-- Drop existing policies if they exist, then create them

-- ============================================================================
-- Documents table policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own documents" ON tools_id_documents;
CREATE POLICY "Users can view their own documents" ON tools_id_documents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own documents" ON tools_id_documents;
CREATE POLICY "Users can insert their own documents" ON tools_id_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own documents" ON tools_id_documents;
CREATE POLICY "Users can update their own documents" ON tools_id_documents
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own documents" ON tools_id_documents;
CREATE POLICY "Users can delete their own documents" ON tools_id_documents
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- Tags table policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own tags" ON tools_id_tags;
CREATE POLICY "Users can view their own tags" ON tools_id_tags
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own tags" ON tools_id_tags;
CREATE POLICY "Users can insert their own tags" ON tools_id_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own tags" ON tools_id_tags;
CREATE POLICY "Users can update their own tags" ON tools_id_tags
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own tags" ON tools_id_tags;
CREATE POLICY "Users can delete their own tags" ON tools_id_tags
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- Document tags junction table policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own document tags" ON tools_id_document_tags;
CREATE POLICY "Users can view their own document tags" ON tools_id_document_tags
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_document_tags.document_id
      AND tools_id_documents.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own document tags" ON tools_id_document_tags;
CREATE POLICY "Users can insert their own document tags" ON tools_id_document_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_document_tags.document_id
      AND tools_id_documents.user_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM tools_id_tags
      WHERE tools_id_tags.id = tools_id_document_tags.tag_id
      AND tools_id_tags.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own document tags" ON tools_id_document_tags;
CREATE POLICY "Users can update their own document tags" ON tools_id_document_tags
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_document_tags.document_id
      AND tools_id_documents.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_document_tags.document_id
      AND tools_id_documents.user_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM tools_id_tags
      WHERE tools_id_tags.id = tools_id_document_tags.tag_id
      AND tools_id_tags.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own document tags" ON tools_id_document_tags;
CREATE POLICY "Users can delete their own document tags" ON tools_id_document_tags
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_document_tags.document_id
      AND tools_id_documents.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Security questions table policies
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own security questions" ON tools_id_security_questions;
CREATE POLICY "Users can view their own security questions" ON tools_id_security_questions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_security_questions.document_id
      AND tools_id_documents.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own security questions" ON tools_id_security_questions;
CREATE POLICY "Users can insert their own security questions" ON tools_id_security_questions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_security_questions.document_id
      AND tools_id_documents.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own security questions" ON tools_id_security_questions;
CREATE POLICY "Users can update their own security questions" ON tools_id_security_questions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_security_questions.document_id
      AND tools_id_documents.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_security_questions.document_id
      AND tools_id_documents.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own security questions" ON tools_id_security_questions;
CREATE POLICY "Users can delete their own security questions" ON tools_id_security_questions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tools_id_documents
      WHERE tools_id_documents.id = tools_id_security_questions.document_id
      AND tools_id_documents.user_id = auth.uid()
    )
  );
