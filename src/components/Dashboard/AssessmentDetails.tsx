import React from 'react';
import { X, User, Calendar, Mic, Mail, ExternalLink, Download, AlertTriangle, Users, Eye, EyeOff } from 'lucide-react';
import { Assessment } from '../../types';
import { Button } from '../UI/Button';
import { exportAssessmentToPDF } from '../../utils/pdfExport';
import { supabase } from '../../lib/supabase';

interface AssessmentDetailsProps {
  assessment: Assessment;
  onClose: () => void;
}

const cefrLevelDescriptions = {
  'C2': 'Mastery - Near-native proficiency with sophisticated language use',
  'C1': 'Proficiency - Advanced level with complex language structures',
  'B2': 'Upper-Intermediate - Independent user with good range',
  'B1': 'Intermediate - Basic independent user with limited range',
  'A2': 'Elementary - Basic user with simple language',
  'A1': 'Beginner - Very basic language use'
};

export function AssessmentDetails({ assessment, onClose }: AssessmentDetailsProps) {
  const [exportingPDF, setExportingPDF] = React.useState(false);
  const [updatingFlags, setUpdatingFlags] = React.useState(false);
  const [proctoringFlags, setProctoringFlags] = React.useState(
    assessment.candidate?.proctoring_flags || {}
  );

  /**
   * Handles the removal of the dual audio detection flag
   * This allows assessors to manually override false positives
   */
  const handleRemoveDualAudioFlag = async () => {
    if (!assessment.candidate?.id) {
      console.error('No candidate ID available');
      return;
    }

    setUpdatingFlags(true);
    try {
      console.log('🔄 Removing dual audio flag for candidate:', assessment.candidate.id);
      
      // Update the proctoring flags to remove the dual audio detection
      const updatedFlags = {
        ...proctoringFlags,
        dual_audio_detected: false,
        manual_override_timestamp: new Date().toISOString(),
        manual_override_by: 'assessor' // Could be enhanced to include actual user email
      };

      // Update in Supabase
      const { error } = await supabase
        .from('candidates')
        .update({ proctoring_flags: updatedFlags })
        .eq('id', assessment.candidate.id);

      if (error) {
        console.error('Error updating proctoring flags:', error);
        alert('Failed to update proctoring flags. Please try again.');
        return;
      }

      // Update local state
      setProctoringFlags(updatedFlags);
      console.log('✅ Dual audio flag removed successfully');
      
    } catch (error) {
      console.error('Error removing dual audio flag:', error);
      alert('An error occurred while updating the flag. Please try again.');
    } finally {
      setUpdatingFlags(false);
    }
  };

  const getCEFRColor = (level: string) => {
    switch (level) {
      case 'C2':
      case 'C1':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'B2':
      case 'B1':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'A2':
      case 'A1':
      default:
        return 'text-red-600 bg-red-50 border-red-200';
    }
  };

  const handleAudioClick = () => {
    if (assessment.candidate?.audio_source) {
      window.open(assessment.candidate.audio_source, '_blank');
    }
  };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      await exportAssessmentToPDF(assessment);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to generate PDF report. Please try again.');
    } finally {
      setExportingPDF(false);
    }
  };

  const isNewCEFRAssessment = assessment.overall_cefr_level;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Assessment Details</h2>
            {isNewCEFRAssessment ? (
              <p className="text-sm text-blue-600 font-medium">CEFR Framework Assessment</p>
            ) : (
              <p className="text-sm text-orange-600 font-medium">Legacy Competency Assessment</p>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={handleExportPDF}
              loading={exportingPDF}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Download PDF</span>
            </Button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Proctoring Information Section */}
          {(proctoringFlags.tab_focus_lost || proctoringFlags.dual_audio_detected) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-yellow-800 mb-4 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Proctoring Alerts
              </h3>
              <div className="space-y-3">
                {/* Tab Focus Lost Alert */}
                {proctoringFlags.tab_focus_lost && (
                  <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-md">
                    <div className="flex items-center">
                      <Eye className="h-4 w-4 text-orange-600 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-orange-800">Tab Focus Lost</p>
                        <p className="text-xs text-orange-700">
                          Candidate switched tabs or minimized window during assessment
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dual Audio Detection Alert */}
                {proctoringFlags.dual_audio_detected && (
                  <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 text-red-600 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-red-800">Dual Audio Detected</p>
                        <p className="text-xs text-red-700">
                          AI detected multiple voices or background speech in the recording
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        onClick={handleAudioClick}
                        variant="outline"
                        size="sm"
                        className="flex items-center space-x-1 text-xs"
                      >
                        <Mic className="h-3 w-3" />
                        <span>Listen</span>
                      </Button>
                      <Button
                        onClick={handleRemoveDualAudioFlag}
                        loading={updatingFlags}
                        variant="outline"
                        size="sm"
                        className="flex items-center space-x-1 text-xs text-red-600 hover:text-red-700"
                      >
                        <EyeOff className="h-3 w-3" />
                        <span>Remove Flag</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Proctoring Metadata */}
              {proctoringFlags.ai_analysis_timestamp && (
                <div className="mt-4 pt-3 border-t border-yellow-200">
                  <p className="text-xs text-yellow-700">
                    AI Analysis: {new Date(proctoringFlags.ai_analysis_timestamp).toLocaleString()}
                    {proctoringFlags.manual_override_timestamp && (
                      <span className="ml-2">
                        • Manual Override: {new Date(proctoringFlags.manual_override_timestamp).toLocaleString()}
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Candidate Information */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User className="h-5 w-5 mr-2" />
              Candidate Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">Name</label>
                <p className="text-lg font-medium text-gray-900">
                  {assessment.candidate?.name || 'Unknown Candidate'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Email</label>
                <p className="text-lg text-gray-900 flex items-center">
                  <Mail className="h-4 w-4 mr-2" />
                  {assessment.candidate?.email || 'No email'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Assessment Date</label>
                <p className="text-lg text-gray-900 flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  {new Date(assessment.assessment_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Assessed By</label>
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  assessment.assessed_by === 'Form Response' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {assessment.assessed_by}
                </div>
              </div>
              {assessment.candidate?.snapshot_url && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-2">Candidate Verification</label>
                  <img
                    src={assessment.candidate.snapshot_url}
                    alt="Candidate verification snapshot"
                    className="w-32 h-32 object-cover rounded-lg border shadow-sm"
                  />
                </div>
              )}
              {assessment.question && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-2">Assessment Question</label>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-gray-700">{assessment.question.text}</p>
                    <div className="mt-2 flex items-center text-xs text-blue-600">
                      <span className="bg-blue-100 px-2 py-1 rounded">
                        {assessment.question.difficulty_level}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {assessment.candidate?.audio_source && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-2">Audio Source</label>
                  <Button
                    onClick={handleAudioClick}
                    variant="outline"
                    className="flex items-center space-x-2"
                  >
                    <Mic className="h-4 w-4" />
                    <span>Open Audio File</span>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Assessment Result */}
          {isNewCEFRAssessment ? (
            /* CEFR Assessment Display */
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">CEFR Assessment Result</h3>
              <div className={`inline-flex items-center justify-center space-x-4 px-8 py-6 rounded-xl border-2 ${getCEFRColor(assessment.overall_cefr_level!)}`}>
                <div className="text-center">
                  <div className="text-5xl font-bold mb-2">
                    {assessment.overall_cefr_level}
                  </div>
                  <div className="text-sm font-medium">
                    {cefrLevelDescriptions[assessment.overall_cefr_level as keyof typeof cefrLevelDescriptions]}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Legacy Competency Assessment Display */
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Assessment (Competency System)</h3>
              <div className="flex items-center justify-center space-x-4">
                <div className="text-4xl font-bold text-gray-900">
                  {(() => {
                    const scores = assessment.assessment_scores;
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
                  })()}
                </div>
                <div className={`w-6 h-6 rounded-full ${
                  (() => {
                    const scores = assessment.assessment_scores;
                    if (!scores || typeof scores !== 'object') return 'bg-gray-500';
                    const competencyScores = [
                      scores.clarity_articulation || 0,
                      scores.pace || 0,
                      scores.tone_modulation || 0,
                      scores.accent_neutrality || 0,
                      scores.confidence_energy || 0,
                      scores.grammar_fluency || 0
                    ];
                    const avg = competencyScores.reduce((sum, score) => sum + score, 0) / competencyScores.length;
                    return avg >= 4 ? 'bg-green-500' : avg >= 3 ? 'bg-yellow-500' : 'bg-red-500';
                  })()
                }`} title={`Overall Grade: ${assessment.overall_grade}`}></div>
              </div>
            </div>
          )}

          {/* Assessment Content */}
          {isNewCEFRAssessment ? (
            /* CEFR Assessment Content */
            <>
              {/* Detailed Analysis */}
              {assessment.detailed_analysis && (
                <div className="bg-blue-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Analysis</h3>
                  <p className="text-gray-700 leading-relaxed">{assessment.detailed_analysis}</p>
                </div>
              )}

              {/* Strengths and Areas for Improvement */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {assessment.specific_strengths && (
                  <div className="bg-green-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-green-800 mb-4">Specific Strengths</h3>
                    <p className="text-green-700 leading-relaxed">{assessment.specific_strengths}</p>
                  </div>
                )}

                {assessment.areas_for_improvement && (
                  <div className="bg-orange-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-orange-800 mb-4">Areas for Improvement</h3>
                    <p className="text-orange-700 leading-relaxed">{assessment.areas_for_improvement}</p>
                  </div>
                )}
              </div>

              {/* Score Justification */}
              {assessment.score_justification && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Justification</h3>
                  <p className="text-gray-700 leading-relaxed">{assessment.score_justification}</p>
                </div>
              )}
            </>
          ) : (
            /* Legacy Competency Assessment Content */
            <>
              {/* Competency Scores */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Competency Breakdown</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {assessment.assessment_scores && typeof assessment.assessment_scores === 'object' && (
                    Object.entries({
                      clarity_articulation: 'Clarity & Articulation',
                      pace: 'Pace',
                      tone_modulation: 'Tone & Modulation',
                      accent_neutrality: 'Accent Neutrality',
                      confidence_energy: 'Confidence & Energy',
                      grammar_fluency: 'Grammar & Fluency'
                    }).map(([key, label]) => {
                      const score = assessment.assessment_scores[key] || 0;
                      const feedback = assessment.assessment_scores.feedback?.[key];
                      
                      return (
                        <div key={key} className="bg-white border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-gray-900">{label}</h4>
                            <span className="text-lg font-bold text-gray-700">{score}/5</span>
                          </div>
                          {feedback && (
                            <p className="text-sm text-gray-600 leading-relaxed">{feedback}</p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Overall Feedback */}
              {assessment.ai_feedback && (
                <div className="bg-blue-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Feedback</h3>
                  <p className="text-gray-700 leading-relaxed">{assessment.ai_feedback}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}