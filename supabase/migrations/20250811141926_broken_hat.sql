/*
# Add Questions Table and Snapshot Support

## Overview
Adds support for assessment questions library and candidate face snapshots
for the new candidate-facing assessment flow.

## Tables Created
1. **questions** - Stores assessment questions for candidate evaluation
2. **candidates** - Add snapshot_url column for face verification
3. **assessments** - Add question_id to link assessments to specific questions

## Security
- Row Level Security (RLS) enabled on questions table
- Policies restrict access to @mediamint.com email domain users only
- Public read access for questions (candidates need to fetch random questions)

## Performance
- Indexes on frequently queried columns
- Foreign key constraints for data integrity
*/

-- Create questions table for assessment questions library
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  text text NOT NULL,
  competencies_targeted text[] DEFAULT '{}',
  difficulty_level text DEFAULT 'medium' CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add snapshot_url column to candidates table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidates' AND column_name = 'snapshot_url'
  ) THEN
    ALTER TABLE candidates ADD COLUMN snapshot_url text;
  END IF;
END $$;

-- Add question_id column to assessments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assessments' AND column_name = 'question_id'
  ) THEN
    ALTER TABLE assessments ADD COLUMN question_id uuid REFERENCES questions(id);
  END IF;
END $$;

-- Enable Row Level Security on questions table
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for questions table
CREATE POLICY "Allow @mediamint.com users full access to questions"
  ON questions
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

-- Allow public read access to active questions for candidate assessment
CREATE POLICY "Allow public read access to active questions"
  ON questions
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_questions_is_active ON questions(is_active);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessments_question_id ON assessments(question_id);

-- Create trigger for updated_at on questions
CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample assessment questions
INSERT INTO questions (text, competencies_targeted, difficulty_level) VALUES
(
  'Please introduce yourself and describe your professional background. Talk about your current role, key responsibilities, and what motivates you in your work. You have 2 minutes to share your story.',
  ARRAY['clarity_articulation', 'confidence_energy', 'grammar_fluency'],
  'easy'
),
(
  'Describe a challenging project you worked on recently. Explain the problem you faced, the steps you took to solve it, and the outcome. Focus on your role and the impact of your solution.',
  ARRAY['clarity_articulation', 'pace', 'confidence_energy', 'grammar_fluency'],
  'medium'
),
(
  'If you had to explain a complex technical concept to someone without a technical background, how would you approach it? Choose any technical topic you are familiar with and demonstrate your explanation.',
  ARRAY['clarity_articulation', 'pace', 'tone_modulation', 'grammar_fluency'],
  'medium'
),
(
  'Tell me about a time when you had to work with a difficult team member or handle a conflict at work. How did you manage the situation and what was the result?',
  ARRAY['tone_modulation', 'confidence_energy', 'grammar_fluency'],
  'medium'
),
(
  'Describe your ideal work environment and company culture. What factors are most important to you when considering a new opportunity, and why?',
  ARRAY['clarity_articulation', 'tone_modulation', 'confidence_energy'],
  'easy'
),
(
  'Walk me through how you prioritize tasks when you have multiple deadlines approaching. Give me a specific example of how you managed competing priorities in the past.',
  ARRAY['clarity_articulation', 'pace', 'grammar_fluency'],
  'medium'
),
(
  'If you could implement one change in your current or previous workplace to improve productivity or team collaboration, what would it be and why?',
  ARRAY['tone_modulation', 'confidence_energy', 'grammar_fluency'],
  'hard'
),
(
  'Describe a situation where you had to learn something completely new for your job. How did you approach the learning process and what was the outcome?',
  ARRAY['clarity_articulation', 'confidence_energy', 'grammar_fluency'],
  'medium'
);