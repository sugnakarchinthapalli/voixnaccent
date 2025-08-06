import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Eye, Calendar, User, Mail, Trash2 } from 'lucide-react';
import { Assessment } from '../../types';
import { ScoreBadge } from '../UI/ScoreBadge';
import { AssessmentDetails } from './AssessmentDetails';
import { assessmentService } from '../../services/assessmentService';
import { Button } from '../UI/Button';

interface AssessmentTableProps {
  assessments: Assessment[];
  onAssessmentDeleted?: () => void;
}

export function AssessmentTable({ assessments, onAssessmentDeleted }: AssessmentTableProps) {
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [sortField, setSortField] = useState<keyof Assessment>('assessment_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSort = (field: keyof Assessment) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedAssessments = [...assessments].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];

    // Handle nested candidate data
    if (sortField === 'candidate' && a.candidate && b.candidate) {
      aValue = a.candidate.name;
      bValue = b.candidate.name;
    }

    if (sortField === 'assessment_date') {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    }

    if (aValue < bValue) {
      return sortDirection === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortDirection === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const SortableHeader = ({ field, children }: { field: keyof Assessment; children: React.ReactNode }) => (
    <th
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortField === field && (
          sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        )}
      </div>
    </th>
  );

  const getOverallScore = (scores: any) => {
    if (!scores || typeof scores !== 'object') return 0;
    
    const competencyScores = [
      scores.clarity_articulation || 0,
      scores.pace || 0,
      scores.tone_modulation || 0,
      scores.accent_neutrality || 0,
      scores.confidence_energy || 0,
      scores.grammar_fluency || 0
    ];

    return Math.round(competencyScores.reduce((sum, score) => sum + score, 0) / competencyScores.length * 10) / 10;
  };

  const handleDeleteAssessment = async (assessmentId: string, candidateName: string) => {
    if (!confirm(`Are you sure you want to delete the assessment for ${candidateName}? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(assessmentId);
    try {
      console.log('Starting deletion process for assessment:', assessmentId);
      await assessmentService.deleteAssessment(assessmentId);
      console.log('Assessment deleted successfully, refreshing table...');
      if (onAssessmentDeleted) {
        await onAssessmentDeleted();
      }
      console.log('Table refresh completed');
    } catch (error) {
      console.error('Error deleting assessment:', error);
      alert(`Failed to delete assessment: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    } finally {
      setDeletingId(null);
    }
  };

  if (assessments.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-12 text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center bg-gray-100 rounded-full mb-4">
            <Eye className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No assessments found</h3>
          <p className="text-gray-500 mb-6">
            Start by uploading an audio file or wait for new Google Sheets entries to be processed automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader field="candidate">Candidate</SortableHeader>
                <SortableHeader field="assessment_date">Date Assessed</SortableHeader>
                <SortableHeader field="overall_grade">Overall Grade</SortableHeader>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Competency Scores
                </th>
                <SortableHeader field="assessed_by">Assessed By</SortableHeader>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedAssessments.map((assessment) => (
                <tr key={assessment.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="flex items-center">
                        <User className="h-4 w-4 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {assessment.candidate?.name || 'Unknown Candidate'}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center">
                            <Mail className="h-3 w-3 mr-1" />
                            {assessment.candidate?.email || 'No email'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                      {new Date(assessment.assessment_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {assessment.overall_grade && (
                        <ScoreBadge 
                          score={getOverallScore(assessment.assessment_scores)} 
                          showScore={false} 
                        />
                      )}
                      <span className="text-sm font-medium text-gray-700">
                        {getOverallScore(assessment.assessment_scores)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {assessment.assessment_scores && typeof assessment.assessment_scores === 'object' && (
                        <>
                          <ScoreBadge 
                            score={assessment.assessment_scores.clarity_articulation || 0}
                            competency="C"
                          />
                          <ScoreBadge 
                            score={assessment.assessment_scores.pace || 0}
                            competency="P"
                          />
                          <ScoreBadge 
                            score={assessment.assessment_scores.tone_modulation || 0}
                            competency="T"
                          />
                          <ScoreBadge 
                            score={assessment.assessment_scores.accent_neutrality || 0}
                            competency="A"
                          />
                          <ScoreBadge 
                            score={assessment.assessment_scores.confidence_energy || 0}
                            competency="E"
                          />
                          <ScoreBadge 
                            score={assessment.assessment_scores.grammar_fluency || 0}
                            competency="G"
                          />
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      assessment.assessed_by === 'Form Response' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {assessment.assessed_by}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedAssessment(assessment)}
                        className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View</span>
                      </button>
                      <button
                        onClick={() => handleDeleteAssessment(assessment.id, assessment.candidate?.name || 'Unknown')}
                        disabled={deletingId === assessment.id}
                        className="text-red-600 hover:text-red-900 flex items-center space-x-1 disabled:opacity-50"
                      >
                        {deletingId === assessment.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        <span>Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedAssessment && (
        <AssessmentDetails
          assessment={selectedAssessment}
          onClose={() => setSelectedAssessment(null)}
        />
      )}
    </>
  );
}