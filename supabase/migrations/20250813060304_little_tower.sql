/*
# Fix RLS Policy for Candidate Assessment Submissions

## Overview
Allows anonymous users to submit candidate assessments while maintaining
security for other operations. This enables the public candidate assessment
page to work without requiring authentication.

## Changes
1. Add policy to allow anonymous INSERT into candidates table
2. Add policy to allow anonymous INSERT into assessment_queue table
3. Maintain existing security for other operations

## Security
- Anonymous users can only INSERT (create new records)
- Anonymous users cannot READ, UPDATE, or DELETE existing records
- @mediamint.com users retain full access to all operations
*/

-- Allow anonymous users to insert candidates (for public assessment submissions)
CREATE POLICY "Allow anonymous candidate submissions"
  ON candidates
  FOR INSERT
  TO anon
  WITH CHECK (
    source_type = 'manual' AND
    name IS NOT NULL AND
    email IS NOT NULL AND
    audio_source IS NOT NULL
  );

-- Allow anonymous users to add items to assessment queue
CREATE POLICY "Allow anonymous assessment queue submissions"
  ON assessment_queue
  FOR INSERT
  TO anon
  WITH CHECK (
    candidate_id IS NOT NULL AND
    status = 'pending'
  );

-- Allow anonymous users to insert processed sheets entries (if needed)
CREATE POLICY "Allow anonymous processed sheets entries"
  ON processed_sheets_entries
  FOR INSERT
  TO anon
  WITH CHECK (
    sheet_row_id IS NOT NULL AND
    candidate_id IS NOT NULL
  );