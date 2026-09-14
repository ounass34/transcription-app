/*
# Create Transcription App Schema

## Overview
This migration creates the core database schema for a transcription and report generation application.
Users can upload audio files, have them transcribed, create custom templates, and generate structured reports.

## New Tables

1. **transcriptions** - Stores audio file references and transcription text
   - `id` (uuid, primary key)
   - `user_id` (uuid, references auth.users, defaults to authenticated user)
   - `title` (text, name given by user)
   - `audio_file_path` (text, storage path of the audio file)
   - `audio_file_name` (text, original filename)
   - `audio_duration` (float8, duration in seconds, nullable)
   - `raw_text` (text, the transcribed text, nullable until processing completes)
   - `status` (text: pending, processing, completed, failed)
   - `created_at`, `updated_at` (timestamps)

2. **templates** - User-defined report templates with structure prompts
   - `id` (uuid, primary key)
   - `user_id` (uuid, references auth.users, defaults to authenticated user)
   - `title` (text, template name)
   - `description` (text, optional description)
   - `structure_prompt` (text, instructions for report structure)
   - `created_at`, `updated_at` (timestamps)

3. **reports** - Generated reports linked to transcriptions and templates
   - `id` (uuid, primary key)
   - `user_id` (uuid, references auth.users, defaults to authenticated user)
   - `transcription_id` (uuid, references transcriptions, cascade delete)
   - `template_id` (uuid, references templates, nullable, set null on delete)
   - `title` (text, report title)
   - `format` (text: structured, pdf, word, excel)
   - `content` (text, the generated report content)
   - `created_at` (timestamp)

## Security
- RLS enabled on all tables
- Owner-scoped CRUD: each authenticated user can only access their own rows
- All user_id columns default to auth.uid() so inserts work even when the client omits user_id

## Important Notes
1. All tables use uuid primary keys with gen_random_uuid() defaults
2. Foreign keys cascade appropriately (deleting a transcription deletes its reports)
3. updated_at columns auto-update via triggers
*/

-- Updated_at trigger function (shared)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================
-- Table: transcriptions
-- ============================
CREATE TABLE IF NOT EXISTS transcriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  audio_file_path text NOT NULL,
  audio_file_name text NOT NULL,
  audio_duration float8,
  raw_text text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_transcriptions" ON transcriptions;
CREATE POLICY "select_own_transcriptions" ON transcriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_transcriptions" ON transcriptions;
CREATE POLICY "insert_own_transcriptions" ON transcriptions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_transcriptions" ON transcriptions;
CREATE POLICY "update_own_transcriptions" ON transcriptions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_transcriptions" ON transcriptions;
CREATE POLICY "delete_own_transcriptions" ON transcriptions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_transcriptions_user_id ON transcriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_created_at ON transcriptions(created_at DESC);

DROP TRIGGER IF EXISTS trigger_transcriptions_updated_at ON transcriptions;
CREATE TRIGGER trigger_transcriptions_updated_at
  BEFORE UPDATE ON transcriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================
-- Table: templates
-- ============================
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  structure_prompt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_templates" ON templates;
CREATE POLICY "select_own_templates" ON templates FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_templates" ON templates;
CREATE POLICY "insert_own_templates" ON templates FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_templates" ON templates;
CREATE POLICY "update_own_templates" ON templates FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_templates" ON templates;
CREATE POLICY "delete_own_templates" ON templates FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);

DROP TRIGGER IF EXISTS trigger_templates_updated_at ON templates;
CREATE TRIGGER trigger_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================
-- Table: reports
-- ============================
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  transcription_id uuid NOT NULL REFERENCES transcriptions(id) ON DELETE CASCADE,
  template_id uuid REFERENCES templates(id) ON DELETE SET NULL,
  title text NOT NULL,
  format text NOT NULL DEFAULT 'structured' CHECK (format IN ('structured', 'pdf', 'word', 'excel')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_reports" ON reports;
CREATE POLICY "select_own_reports" ON reports FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_reports" ON reports;
CREATE POLICY "insert_own_reports" ON reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_reports" ON reports;
CREATE POLICY "update_own_reports" ON reports FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_reports" ON reports;
CREATE POLICY "delete_own_reports" ON reports FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_transcription_id ON reports(transcription_id);
