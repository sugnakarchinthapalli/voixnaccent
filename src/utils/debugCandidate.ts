import { supabaseServiceRole } from '../lib/supabaseServiceRole';

export async function debugCandidateSearch(sessionId: string) {
  console.log('🔍 Debug: Searching for candidate with sessionId:', sessionId);
  
  try {
    // Check if service role is configured
    const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    console.log('🔧 Service role configured:', !!serviceRoleKey && serviceRoleKey !== 'YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE');
    console.log('🔧 Service role key length:', serviceRoleKey ? serviceRoleKey.length : 0);
    
    // First, try to query all candidates to see if the table is accessible
    console.log('🔍 Testing basic table access...');
    const { data: allCandidates, error: allError } = await supabaseServiceRole
      .from('candidates')
      .select('id, name, assessment_link_id')
      .limit(5);
    
    console.log('📋 Basic table query result:', { allCandidates, allError });
    console.log('📋 Total candidates found (limit 5):', allCandidates?.length || 0);
    
    // Try the specific query
    console.log('🎯 Now searching for specific sessionId:', sessionId);
    const { data: candidates, error: candidateError } = await supabaseServiceRole
      .from('candidates')
      .select('*')
      .eq('assessment_link_id', sessionId);
    
    console.log('📊 Specific query result:', { candidates, candidateError });
    console.log('📈 Number of matching candidates found:', candidates?.length || 0);
    
    if (candidates && candidates.length > 0) {
      console.log('✅ First candidate:', candidates[0]);
    }
    
    return { candidates, candidateError };
  } catch (error) {
    console.error('💥 Debug query failed:', error);
    return { candidates: null, candidateError: error };
  }
}
