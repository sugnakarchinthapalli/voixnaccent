/*
# Assessment Link Generation System

## Overview
Adds support for generating unique assessment links that can be shared with candidates.
This allows admins to pre-create candidate records and generate custom assessment URLs.

## Changes
1. **Modify candidates table** - Make audio_source nullable and add new source_type
2. **Add assessment_link_id column** - Unique identifier for generated assessment links
3. **Add assessment_status column** - Track the status of scheduled assessments

## New Features
- Pre-create candidate records without audio
- Generate unique assessment links
- Track assessment completion status
- Support bulk candidate creation

## Security
- All existing RLS policies apply to modified columns
- New columns follow same security model
*/

-- Make audio_source nullable to allow pre-created candidates
ALTER TABLE candidates ALTER COLUMN audio_source DROP NOT NULL;

-- Add new source_type option for scheduled assessments
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_source_type_check;
ALTER TABLE candidates ADD CONSTRAINT candidates_source_type_check 
  CHECK (source_type IN ('auto', 'manual', 'scheduled'));

-- Add assessment_link_id for unique assessment URLs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'assessment_link_id'
  ) THEN
    ALTER TABLE candidates ADD COLUMN assessment_link_id uuid UNIQUE;
  END IF;
END $$;

-- Add assessment_status to track completion
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'assessment_status'
  ) THEN
    ALTER TABLE candidates ADD COLUMN assessment_status text DEFAULT 'pending' 
      CHECK (assessment_status IN ('pending', 'in_progress', 'completed', 'expired'));
  END IF;
END $$;

-- Add proctoring_flags column for storing proctoring data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'proctoring_flags'
  ) THEN
    ALTER TABLE candidates ADD COLUMN proctoring_flags jsonb DEFAULT '{}';
  END IF;
END $$;

-- Add session_expires_at for timed assessments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'session_expires_at'
  ) THEN
    ALTER TABLE candidates ADD COLUMN session_expires_at timestamptz;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_candidates_assessment_link_id ON candidates(assessment_link_id);
CREATE INDEX IF NOT EXISTS idx_candidates_assessment_status ON candidates(assessment_status);
CREATE INDEX IF NOT EXISTS idx_candidates_session_expires_at ON candidates(session_expires_at);

-- Add comments for documentation
COMMENT ON COLUMN candidates.assessment_link_id IS 'Unique identifier for generated assessment links';
COMMENT ON COLUMN candidates.assessment_status IS 'Status of the assessment: pending, in_progress, completed, expired';
COMMENT ON COLUMN candidates.proctoring_flags IS 'JSON object storing proctoring flags like tab_focus_lost';
COMMENT ON COLUMN candidates.session_expires_at IS 'Timestamp when the assessment session expires';