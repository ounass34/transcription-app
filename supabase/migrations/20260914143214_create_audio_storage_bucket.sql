/*
# Create Audio Storage Bucket

## Overview
Creates a Supabase Storage bucket for user audio files (uploads and recordings).

## Changes
1. Creates a private storage bucket named `audio_files`
2. Creates storage policies allowing authenticated users to manage only their own files

## Security
- Only authenticated users can upload, read, and delete files
- Files are organized under user-specific folder paths (e.g., `user_id/filename`)
- Users can only access files within their own folder
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('audio_files', 'audio_files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own audio files" ON storage.objects;
CREATE POLICY "Users can upload own audio files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audio_files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can read own audio files" ON storage.objects;
CREATE POLICY "Users can read own audio files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'audio_files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own audio files" ON storage.objects;
CREATE POLICY "Users can delete own audio files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'audio_files' AND (storage.foldername(name))[1] = auth.uid()::text);
