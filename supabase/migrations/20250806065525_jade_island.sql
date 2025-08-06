/*
# Voice Assessment Tool Database Schema

## Overview
Complete database setup for the voice assessment application with automated Google Sheets integration and AI processing capabilities.

## Tables Created
1. **candidates** - Stores candidate information from both manual uploads and Google Sheets
2. **assessments** - Stores AI-generated assessment results with competency scores
3. **assessment_queue** - Manages batch processing queue for AI assessments
4. **processed_sheets_entries** - Tracks processed Google Sheets entries to prevent duplicates

## Security
- Row Level Security (RLS) enabled on all tables
- Policies restrict access to @mediamint.com email domain users only
- assessed_by field is immutable once set

## Performance
- Indexes on frequently queried columns
- Foreign key constraints for data integrity
- Optimized for dashboard queries and filtering
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create candidates table
CREATE TABLE IF NOT EXISTS candidates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  email text NOT NULL,
  audio_source text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('auto', 'manual')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create assessments table
CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE,
  assessment_scores jsonb NOT NULL DEFAULT '{}',
  overall_grade text CHECK (overall_grade IN ('Red', 'Amber', 'Green')),
  ai_feedback text,
  assessed_by text NOT NULL,
  assessment_date timestamptz DEFAULT now(),
  processing_status text DEFAULT 'completed' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Create assessment queue table for batch processing
CREATE TABLE IF NOT EXISTS assessment_queue (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority integer DEFAULT 0,
  batch_id uuid,
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create processed sheets entries table
CREATE TABLE IF NOT EXISTS processed_sheets_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sheet_row_id text UNIQUE NOT NULL,
  candidate_id uuid REFERENCES candidates(id),
  processed_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_sheets_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for candidates
CREATE POLICY "Allow @mediamint.com users to read candidates"
  ON candidates
  FOR SELECT
  TO authenticated
  USING (
    CASE WHEN auth.jwt() ->> 'email' IS NULL THEN false
    ELSE auth.jwt() ->> 'email' LIKE '%@mediamint.com'
    END
  );

CREATE POLICY "Allow @mediamint.com users to insert candidates"
  ON candidates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    CASE WHEN auth.jwt() ->> 'email' IS NULL THEN false
    ELSE auth.jwt() ->> 'email' LIKE '%@mediamint.com'
    END
  );

CREATE POLICY "Allow @mediamint.com users to update candidates"
  ON candidates
  FOR UPDATE
  TO authenticated
  USING (
    CASE WHEN auth.jwt() ->> 'email' IS NULL THEN false
    ELSE auth.jwt() ->> 'email' LIKE '%@mediamint.com'
    END
  );

-- RLS Policies for assessments
CREATE POLICY "Allow @mediamint.com users to read assessments"
  ON assessments
  FOR SELECT
  TO authenticated
  USING (
    CASE WHEN auth.jwt() ->> 'email' IS NULL THEN false
    ELSE auth.jwt() ->> 'email' LIKE '%@mediamint.com'
    END
  );

CREATE POLICY "Allow @mediamint.com users to insert assessments"
  ON assessments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    CASE WHEN auth.jwt() ->> 'email' IS NULL THEN false
    ELSE auth.jwt() ->> 'email' LIKE '%@mediamint.com'
    END
  );

CREATE POLICY "Allow @mediamint.com users to update assessments"
  ON assessments
  FOR UPDATE
  TO authenticated
  USING (
    CASE WHEN auth.jwt() ->> 'email' IS NULL THEN false
    ELSE auth.jwt() ->> 'email' LIKE '%@mediamint.com'
    END
  );

-- RLS Policies for assessment_queue
CREATE POLICY "Allow @mediamint.com users full access to assessment_queue"
  ON assessment_queue
  FOR ALL
  TO authenticated
  USING (
    CASE WHEN auth.jwt() ->> 'email' IS NULL THEN false
    ELSE auth.jwt() ->> 'email' LIKE '%@mediamint.com'
    END
  )
  WITH CHECK (
    CASE WHEN auth.jwt() ->> 'email' IS NULL THEN false
    ELSE auth.jwt() ->> 'email' LIKE '%@mediamint.com'
    END
  );

-- RLS Policies for processed_sheets_entries
CREATE POLICY "Allow @mediamint.com users full access to processed_sheets_entries"
  ON processed_sheets_entries
  FOR ALL
  TO authenticated
  USING (
    CASE WHEN auth.jwt() ->> 'email' IS NULL THEN false
    ELSE auth.jwt() ->> 'email' LIKE '%@mediamint.com'
    END
  )
  WITH CHECK (
    CASE WHEN auth.jwt() ->> 'email' IS NULL THEN false
    ELSE auth.jwt() ->> 'email' LIKE '%@mediamint.com'
    END
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON candidates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_source_type ON candidates(source_type);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);

CREATE INDEX IF NOT EXISTS idx_assessments_candidate_id ON assessments(candidate_id);
CREATE INDEX IF NOT EXISTS idx_assessments_assessment_date ON assessments(assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_assessments_assessed_by ON assessments(assessed_by);
CREATE INDEX IF NOT EXISTS idx_assessments_overall_grade ON assessments(overall_grade);

CREATE INDEX IF NOT EXISTS idx_queue_status ON assessment_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_priority ON assessment_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_queue_created_at ON assessment_queue(created_at);

CREATE INDEX IF NOT EXISTS idx_processed_entries_sheet_row ON processed_sheets_entries(sheet_row_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON candidates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queue_updated_at BEFORE UPDATE ON assessment_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to prevent assessed_by field updates (immutable)
CREATE OR REPLACE FUNCTION prevent_assessed_by_update()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.assessed_by IS NOT NULL AND OLD.assessed_by != NEW.assessed_by THEN
        RAISE EXCEPTION 'assessed_by field cannot be modified once set';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Trigger to enforce assessed_by immutability
CREATE TRIGGER prevent_assessed_by_change BEFORE UPDATE ON assessments
    FOR EACH ROW EXECUTE FUNCTION prevent_assessed_by_update();