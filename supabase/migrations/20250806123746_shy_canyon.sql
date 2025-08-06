/*
# Storage RLS Policies for Voice Assessment Tool

## Overview
Sets up Row Level Security policies for the voice-assessments storage bucket
to allow @mediamint.com users to upload, read, and delete audio files.

## Policies Created
1. **Allow @mediamint.com users to upload files**
2. **Allow @mediamint.com users to read files**  
3. **Allow @mediamint.com users to delete files**

## Security
- All policies restrict access to users with @mediamint.com email addresses
- Policies apply to the 'voice-assessments' bucket only
*/

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy for uploading files to voice-assessments bucket
CREATE POLICY "Allow @mediamint.com users to upload to voice-assessments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'voice-assessments' AND
    CASE WHEN auth.jwt() ->> 'email' IS NULL THEN false
    ELSE auth.jwt() ->> 'email' LIKE '%@mediamint.com'
    END
  );

-- Policy for reading files from voice-assessments bucket
CREATE POLICY "Allow @mediamint.com users to read from voice-assessments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'voice-assessments' AND
    CASE WHEN auth.jwt() ->> 'email' IS NULL THEN false
    ELSE auth.jwt() ->> 'email' LIKE '%@mediamint.com'
    END
  );

-- Policy for deleting files from voice-assessments bucket
CREATE POLICY "Allow @mediamint.com users to delete from voice-assessments"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'voice-assessments' AND
    CASE WHEN auth.jwt() ->> 'email' IS NULL THEN false
    ELSE auth.jwt() ->> 'email' LIKE '%@mediamint.com'
    END
  );

-- Policy for updating files in voice-assessments bucket (if needed)
CREATE POLICY "Allow @mediamint.com users to update in voice-assessments"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'voice-assessments' AND
    CASE WHEN auth.jwt() ->> 'email' IS NULL THEN false
    ELSE auth.jwt() ->> 'email' LIKE '%@mediamint.com'
    END
  )
  WITH CHECK (
    bucket_id = 'voice-assessments' AND
    CASE WHEN auth.jwt() ->> 'email' IS NULL THEN false
    ELSE auth.jwt() ->> 'email' LIKE '%@mediamint.com'
    END
  );