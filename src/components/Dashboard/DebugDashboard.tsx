import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../UI/Button';

export function DebugDashboard() {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const runDiagnostics = async () => {
    setLoading(true);
    const info: any = {
      timestamp: new Date().toISOString(),
      user: {
        email: user?.email,
        id: user?.id,
        isAuthorized: user?.email?.endsWith('@mediamint.com')
      },
      queries: {}
    };

    try {
      // 1. Test basic connection
      console.log('🔍 Testing Supabase connection...');
      const { data: connectionTest, error: connectionError } = await supabase
        .from('candidates')
        .select('count')
        .limit(1);
      
      info.queries.connectionTest = {
        success: !connectionError,
        error: connectionError?.message,
        data: connectionTest
      };

      // 2. Count total candidates
      console.log('📊 Counting total candidates...');
      const { count: totalCandidates, error: countError } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true });
      
      info.queries.totalCandidates = {
        count: totalCandidates,
        error: countError?.message
      };

      // 3. Count candidates by source type
      console.log('📊 Counting candidates by source type...');
      const { data: candidatesByType, error: typeError } = await supabase
        .from('candidates')
        .select('source_type')
        .then(result => {
          if (result.error) return result;
          const counts = result.data?.reduce((acc: any, curr: any) => {
            acc[curr.source_type] = (acc[curr.source_type] || 0) + 1;
            return acc;
          }, {});
          return { data: counts, error: null };
        });
      
      info.queries.candidatesByType = {
        data: candidatesByType,
        error: typeError?.message
      };

      // 4. Count total assessments
      console.log('📊 Counting total assessments...');
      const { count: totalAssessments, error: assessmentCountError } = await supabase
        .from('assessments')
        .select('*', { count: 'exact', head: true });
      
      info.queries.totalAssessments = {
        count: totalAssessments,
        error: assessmentCountError?.message
      };

      // 5. Test the exact getAllAssessments query - completed assessments
      console.log('🔍 Testing completed assessments query...');
      const { data: completedAssessments, error: completedError } = await supabase
        .from('assessments')
        .select(`
          *,
          candidate:candidates(*),
          question:questions(*)
        `)
        .eq('processing_status', 'completed')
        .order('assessment_date', { ascending: false });

      info.queries.completedAssessments = {
        count: completedAssessments?.length || 0,
        error: completedError?.message,
        sample: completedAssessments?.slice(0, 2).map(a => ({
          id: a.id,
          candidateName: a.candidate?.name,
          assessedBy: a.assessed_by,
          overallGrade: a.overall_grade,
          cefrLevel: a.overall_cefr_level
        }))
      };

      // 6. Test the exact getAllAssessments query - scheduled candidates
      console.log('🔍 Testing scheduled candidates query...');
      const { data: scheduledCandidates, error: scheduledError } = await supabase
        .from('candidates')
        .select('*')
        .eq('source_type', 'scheduled')
        .in('assessment_status', ['pending', 'in_progress', 'expired'])
        .order('created_at', { ascending: false });

      info.queries.scheduledCandidates = {
        count: scheduledCandidates?.length || 0,
        error: scheduledError?.message,
        sample: scheduledCandidates?.slice(0, 2).map(c => ({
          id: c.id,
          name: c.name,
          email: c.email,
          sourceType: c.source_type,
          assessmentStatus: c.assessment_status,
          createdAt: c.created_at
        }))
      };

      // 7. Get some sample candidates of any type
      console.log('🔍 Getting sample candidates...');
      const { data: sampleCandidates, error: sampleError } = await supabase
        .from('candidates')
        .select('id, name, email, source_type, assessment_status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      info.queries.sampleCandidates = {
        count: sampleCandidates?.length || 0,
        error: sampleError?.message,
        data: sampleCandidates
      };

      // 8. Test RLS policies directly
      console.log('🔍 Testing RLS policies...');
      const { data: rlsTest, error: rlsError } = await supabase.rpc('auth.jwt');
      info.queries.rlsTest = {
        jwtClaims: rlsTest,
        error: rlsError?.message
      };

    } catch (error) {
      console.error('Debug error:', error);
      info.error = error instanceof Error ? error.message : 'Unknown error';
    }

    setDebugInfo(info);
    setLoading(false);
    console.log('🐛 Debug info:', info);
  };

  const copyDebugInfo = () => {
    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
    alert('Debug info copied to clipboard!');
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Dashboard Debug Diagnostics</h2>
        
        <div className="flex items-center space-x-4 mb-6">
          <Button onClick={runDiagnostics} loading={loading}>
            Run Diagnostics
          </Button>
          {debugInfo.timestamp && (
            <Button onClick={copyDebugInfo} variant="outline">
              Copy Debug Info
            </Button>
          )}
        </div>

        {debugInfo.timestamp && (
          <div className="space-y-6">
            {/* User Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">User Information</h3>
              <pre className="text-sm text-gray-700">
                {JSON.stringify(debugInfo.user, null, 2)}
              </pre>
            </div>

            {/* Query Results */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Query Results</h3>
              
              {Object.entries(debugInfo.queries).map(([key, value]: [string, any]) => (
                <div key={key} className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-2">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </h4>
                  <pre className="text-sm text-gray-700 overflow-x-auto">
                    {JSON.stringify(value, null, 2)}
                  </pre>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Summary</h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p>• User authorized: {debugInfo.user.isAuthorized ? '✅' : '❌'}</p>
                <p>• Total candidates: {debugInfo.queries.totalCandidates?.count ?? 'Unknown'}</p>
                <p>• Completed assessments: {debugInfo.queries.completedAssessments?.count ?? 0}</p>
                <p>• Scheduled candidates: {debugInfo.queries.scheduledCandidates?.count ?? 0}</p>
                <p>• Connection working: {debugInfo.queries.connectionTest?.success ? '✅' : '❌'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
