import React from 'react';
import { X, User, Calendar, Mic, Mail, ExternalLink } from 'lucide-react';
import { Assessment } from '../../types';
import { ScoreBadge } from '../UI/ScoreBadge';
import { Button } from '../UI/Button';

interface AssessmentDetailsProps {
  assessment: Assessment;
  onClose: () => void;
}

const competencyLabels = {
  clarity_articulation: 'Clarity & Articulation',
  pace: 'Pace',
  tone_modulation: 'Tone & Modulation',
  accent_neutrality: 'Accent Neutrality',
  confidence_energy: 'Confidence & Energy',
  grammar_fluency: 'Grammar & Fluency'
};

export function AssessmentDetails({ assessment, onClose }: AssessmentDetailsProps) {
  const getOverallScore = () => {
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
  };

  const handleAudioClick = () => {
    if (assessment.candidate?.audio_source) {
      window.open(assessment.candidate.audio_source, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Assessment Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-8">
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

          {/* Overall Score */}
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Assessment</h3>
            <div className="flex items-center justify-center space-x-4">
              <div className="text-4xl font-bold text-gray-900">
                {getOverallScore()}
              </div>
              <div className={`w-6 h-6 rounded-full ${
                getOverallScore() >= 4 
                  ? 'bg-green-500' 
                  : getOverallScore() >= 3 
                  ? 'bg-yellow-500' 
                  : 'bg-red-500'
              }`} title={`Overall Grade: ${assessment.overall_grade}`}></div>
            </div>
          </div>

          {/* Competency Scores */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Competency Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {assessment.assessment_scores && typeof assessment.assessment_scores === 'object' && (
                Object.entries(competencyLabels).map(([key, label]) => {
                  const score = assessment.assessment_scores[key as keyof typeof competencyLabels] || 0;
                  const feedback = assessment.assessment_scores.feedback?.[key as keyof typeof competencyLabels];
                  
                  return (
                    <div key={key} className="bg-white border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">{label}</h4>
                        <ScoreBadge score={score} showScore={true} />
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

          {/* AI Feedback */}
          {assessment.ai_feedback && (
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Feedback</h3>
              <p className="text-gray-700 leading-relaxed">{assessment.ai_feedback}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}