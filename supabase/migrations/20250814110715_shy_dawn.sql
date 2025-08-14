/*
# Add CEFR Assessment Columns

## Overview
Adds new columns to the assessments table to support the CEFR (Common European Framework of Reference for Languages) assessment framework alongside the existing legacy competency-based system.

## Changes
1. **New CEFR Columns** - Add columns for CEFR assessment data
2. **Constraints** - Add check constraint for valid CEFR levels
3. **Backward Compatibility** - Existing assessments remain unchanged

## CEFR Framework
- **A1-A2**: Basic User (Red grade equivalent)
- **B1-B2**: Independent User (Amber grade equivalent) 
- **C1-C2**: Proficient User (Green grade equivalent)

## Security
- All existing RLS policies apply to new columns
- No changes to authentication or authorization
*/

-- Add new CEFR columns to assessments table
ALTER TABLE public.assessments 
ADD COLUMN IF NOT EXISTS overall_cefr_level text,
ADD COLUMN IF NOT EXISTS detailed_analysis text,
ADD COLUMN IF NOT EXISTS specific_strengths text,
ADD COLUMN IF NOT EXISTS areas_for_improvement text,
ADD COLUMN IF NOT EXISTS score_justification text;

-- Add check constraint for CEFR levels
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_cefr_level' 
    AND table_name = 'assessments'
  ) THEN
    ALTER TABLE public.assessments 
    ADD CONSTRAINT check_cefr_level 
    CHECK (overall_cefr_level IS NULL OR overall_cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));
  END IF;
END $$;

-- Create index for CEFR level queries (optional but recommended for performance)
CREATE INDEX IF NOT EXISTS idx_assessments_cefr_level ON public.assessments(overall_cefr_level);

-- Add comment to document the new columns
COMMENT ON COLUMN public.assessments.overall_cefr_level IS 'CEFR proficiency level: A1, A2, B1, B2, C1, or C2';
COMMENT ON COLUMN public.assessments.detailed_analysis IS 'Comprehensive CEFR-based analysis (minimum 100 characters)';
COMMENT ON COLUMN public.assessments.specific_strengths IS 'What the candidate does well in their spoken English';
COMMENT ON COLUMN public.assessments.areas_for_improvement IS 'Concrete suggestions for language development';
COMMENT ON COLUMN public.assessments.score_justification IS 'Explanation of why this specific CEFR level was assigned';