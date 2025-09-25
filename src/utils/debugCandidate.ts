import { supabaseServiceRole } from '../lib/supabaseServiceRole';

export async function debugCandidateSearch(sessionId: string) {
  console.log('🔍 Debug: Searching for candidate with sessionId:', sessionId);
  
  try {
    // Check if service role is configured
    console.log('🔧 Service role configured:', !!process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);
    
    // Try the query
    const { data: candidates, error: candidateError } = await supabaseServiceRole
      .from('candidates')
      .select('*')
      .eq('assessment_link_id', sessionId);
    
    console.log('📊 Query result:', { candidates, candidateError });
    console.log('📈 Number of candidates found:', candidates?.length || 0);
    
    if (candidates && candidates.length > 0) {
      console.log('✅ First candidate:', candidates[0]);
    }
    
    return { candidates, candidateError };
  } catch (error) {
    console.error('💥 Debug query failed:', error);
    return { candidates: null, candidateError: error };
  }
}
