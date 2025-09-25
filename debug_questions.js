import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tgtbfkxjvfwzjgcqucgj.supabase.co';
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRndGJma3hqdmZ3empnY3F1Y2dqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNjc3MTI3OCwiZXhwIjoyMDQyMzQ3Mjc4fQ.6w99Ie2YlokHZ8sO8hCGvwKXJxN82SdHqJzP0K8_vbo';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function debugQuestions() {
  console.log('🔍 Checking questions in database...\n');
  
  try {
    // Get all questions (without any filters)
    const { data: allQuestions, error: allError } = await supabase
      .from('questions')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (allError) {
      console.error('❌ Error fetching all questions:', allError);
      return;
    }
    
    console.log(`📊 Total questions in database: ${allQuestions?.length || 0}`);
    
    if (allQuestions && allQuestions.length > 0) {
      console.log('\n📝 All questions:');
      allQuestions.forEach((q, index) => {
        console.log(`  ${index + 1}. ID: ${q.id}`);
        console.log(`     Text: "${q.text}"`);
        console.log(`     Difficulty: ${q.difficulty_level}`);
        console.log(`     Active: ${q.is_active}`);
        console.log(`     Created: ${q.created_at}`);
        console.log();
      });
    } else {
      console.log('❌ No questions found in database');
    }
    
    // Get only active questions
    const { data: activeQuestions, error: activeError } = await supabase
      .from('questions')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
      
    if (activeError) {
      console.error('❌ Error fetching active questions:', activeError);
      return;
    }
    
    console.log(`✅ Active questions: ${activeQuestions?.length || 0}`);
    
    if (activeQuestions && activeQuestions.length > 0) {
      console.log('\n🟢 Active questions:');
      activeQuestions.forEach((q, index) => {
        console.log(`  ${index + 1}. "${q.text}" (${q.difficulty_level})`);
      });
    } else {
      console.log('⚠️  No active questions found');
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the debug function
debugQuestions();
