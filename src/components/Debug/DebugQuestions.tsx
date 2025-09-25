import React, { useState, useEffect } from 'react';
import { questionService } from '../../services/questionService';
import { supabase } from '../../lib/supabase';
import { Question } from '../../types';
import { addTestQuestions } from '../../utils/addTestQuestions';

export function DebugQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingQuestions, setAddingQuestions] = useState(false);
  const [error, setError] = useState<string>('');

  const checkQuestions = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('🔍 Checking questions in database...');
      
      // Get all questions directly via Supabase
      const { data: allQs, error: allError } = await supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (allError) {
        console.error('❌ Error fetching all questions:', allError);
        setError(`Error fetching questions: ${allError.message}`);
        return;
      }
      
      console.log(`📊 Total questions: ${allQs?.length || 0}`);
      setQuestions(allQs || []);
      
      // Get active questions via service
      const activeQs = await questionService.getActiveQuestions();
      console.log(`✅ Active questions via service: ${activeQs.length}`);
      setActiveQuestions(activeQs);
      
    } catch (err) {
      console.error('💥 Error:', err);
      setError(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTestQuestions = async () => {
    setAddingQuestions(true);
    setError('');
    
    try {
      await addTestQuestions();
      // Refresh questions after adding
      await checkQuestions();
    } catch (err) {
      console.error('Error adding test questions:', err);
      setError(`Failed to add test questions: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setAddingQuestions(false);
    }
  };

  useEffect(() => {
    checkQuestions();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug Questions</h1>
      
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2">Loading questions...</p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* All Questions */}
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">All Questions ({questions.length})</h2>
          {questions.length === 0 ? (
            <p className="text-gray-500">No questions found in database</p>
          ) : (
            <div className="space-y-3">
              {questions.map((q, index) => (
                <div key={q.id} className="border-l-4 border-blue-500 pl-4 py-2">
                  <p className="font-medium">#{index + 1}</p>
                  <p className="text-sm text-gray-600">ID: {q.id}</p>
                  <p className="text-sm">{q.text}</p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                    <span>Difficulty: {q.difficulty_level}</span>
                    <span className={q.is_active ? 'text-green-600' : 'text-red-600'}>
                      {q.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Active Questions */}
        <div className="bg-white border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Active Questions ({activeQuestions.length})</h2>
          {activeQuestions.length === 0 ? (
            <p className="text-gray-500">No active questions found</p>
          ) : (
            <div className="space-y-3">
              {activeQuestions.map((q, index) => (
                <div key={q.id} className="border-l-4 border-green-500 pl-4 py-2">
                  <p className="font-medium">#{index + 1}</p>
                  <p className="text-sm">{q.text}</p>
                  <div className="text-xs text-gray-500 mt-1">
                    <span>Difficulty: {q.difficulty_level}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-6 flex space-x-4">
        <button
          onClick={checkQuestions}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh Questions'}
        </button>
        
        {questions.length === 0 && (
          <button
            onClick={handleAddTestQuestions}
            disabled={addingQuestions || loading}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {addingQuestions ? 'Adding Questions...' : 'Add Test Questions'}
          </button>
        )}
      </div>
    </div>
  );
}
