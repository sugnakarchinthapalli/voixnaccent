import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Eye, Calendar, User, Mail, Trash2 } from 'lucide-react';
import { Assessment } from '../../types';
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

  const getDisplayAssessedBy = (assessedBy: string) => {
    if (assessedBy === 'Form Response') return 'Form Response';
    if (assessedBy === 'Candidate Submission') return 'Candidate Submission';
    
    // For email addresses, truncate if too long
    if (assessedBy.includes('@')) {
      if (assessedBy.length > 20) {
        const [username, domain] = assessedBy.split('@');
        if (username.length > 8) {
          return `${username.substring(0, 8)}...@${domain}`;
        }
        return assessedBy;
      }
    }
    
    return assessedBy;
  };

  const getCEFRColor = (level: string) => {
    switch (level) {
      case 'C2':
      case 'C1':
        return 'bg-green-500';
      case 'B2':
      case 'B1':
        return 'bg-yellow-500';
      case 'A2':
      case 'A1':
      default:
        return 'bg-red-500';
    }
  };

  const getGradeFromCEFR = (level: string) => {
    switch (level) {
      case 'C2':
      case 'C1':
        return 'Green';
      case 'B2':
      case 'B1':
        return 'Amber';
      case 'A2':
      case 'A1':
      default:
        return 'Red';
    }
  };

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
    // For legacy assessments with old scoring system
    if (scores && typeof scores === 'object' && scores.clarity_articulation) {
      const competencyScores = [
        scores.clarity_articulation || 0,
        scores.pace || 0,
        scores.tone_modulation || 0,
        scores.accent_neutrality || 0,
        scores.confidence_energy || 0,
        scores.grammar_fluency || 0
      ];
      return Math.round(competencyScores.reduce((sum, score) => sum + score, 0) / competencyScores.length * 10) / 10;
    }
    return 0;
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
                <SortableHeader field="overall_grade">Assessment Result</SortableHeader>
                <SortableHeader field="overall_cefr_level">Framework</SortableHeader>
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
                            {/* Only show status tag if assessment is pending */}
                            {assessment.candidate?.assessment_status === 'pending' && (
                              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                Pending
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                      {assessment.processing_status === 'pending' || assessment.processing_status === 'in_progress' || assessment.processing_status === 'expired' ? (
                        <span className="text-gray-500 italic">Awaiting Assessment</span>
                      ) : (
                        new Date(assessment.assessment_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {assessment.processing_status === 'pending' || assessment.processing_status === 'in_progress' || assessment.processing_status === 'expired' ? (
                      // Scheduled assessment - no result yet
                      <div className="flex items-center justify-center">
                        <span className="text-sm text-gray-500 font-medium">-</span>
                      </div>
                    ) : assessment.overall_cefr_level ? (
                      // CEFR Assessment
                      <div className="flex items-center justify-center">
                        <div className={`w-3 h-3 rounded-full ${getCEFRColor(assessment.overall_cefr_level)}`} 
                             title={`CEFR Level: ${assessment.overall_cefr_level}`}></div>
                        <span className="text-sm font-bold text-gray-900 ml-2">
                          {assessment.overall_cefr_level}
                        </span>
                      </div>
                    ) : (
                      // Legacy Competency Assessment
                      <div className="flex items-center justify-center">
                        {assessment.overall_grade && (
                          <div className={`w-3 h-3 rounded-full ${
                            getOverallScore(assessment.assessment_scores) >= 4 
                              ? 'bg-green-500' 
                              : getOverallScore(assessment.assessment_scores) >= 3 
                              ? 'bg-yellow-500' 
                              : 'bg-red-500'
                          }`} title={`Grade: ${assessment.overall_grade}`}></div>
                        )}
                        <span className="text-sm font-medium text-gray-700 ml-2">
                          {getOverallScore(assessment.assessment_scores)}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {assessment.processing_status === 'pending' || assessment.processing_status === 'in_progress' || assessment.processing_status === 'expired' ? (
                      <span className="text-sm font-medium text-blue-700">CEFR</span>
                    ) : assessment.overall_cefr_level ? (
                      <span className="text-sm font-medium text-blue-700">CEFR</span>
                    ) : (
                      <span className="text-sm font-medium text-orange-700">Competency</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      assessment.assessed_by === 'Form Response' || assessment.assessed_by === 'Scheduled Assessment'
                        ? 'bg-blue-100 text-blue-800'
                        : assessment.assessed_by === 'Candidate Submission'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {assessment.candidate?.source_type === 'scheduled' && assessment.processing_status !== 'completed'
                        ? 'Candidate Submission'
                        : getDisplayAssessedBy(assessment.assessed_by)}
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