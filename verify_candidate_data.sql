-- Verify candidate data and debugging queries
-- Run these in your Supabase SQL editor

-- 1. Check if the specific candidate exists
SELECT 
    id, 
    name, 
    email, 
    assessment_link_id, 
    assessment_status, 
    assigned_question_id,
    created_at
FROM candidates 
WHERE assessment_link_id = '3a270a91-8958-43d5-8526-a3295037e65e';

-- 2. Check all recent candidates (last 10)
SELECT 
    id, 
    name, 
    email, 
    assessment_link_id, 
    assessment_status,
    created_at
FROM candidates 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. Check if questions table has active questions
SELECT 
    id, 
    text, 
    difficulty_level, 
    is_active 
FROM questions 
WHERE is_active = true
LIMIT 5;

-- 4. Check if assigned_question_id column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'candidates' 
  AND column_name = 'assigned_question_id';

-- 5. Check RLS policies on candidates table
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd 
FROM pg_policies 
WHERE tablename = 'candidates';

-- 6. Test service role access (if you have service role access in SQL editor)
-- This might not work in the web SQL editor, but you can try
SELECT current_user, current_role;
