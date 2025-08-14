import { Assessment } from '../types';

export function exportToCSV(assessments: Assessment[], filename: string = 'voice_assessments') {
  const headers = [
    'Candidate Name',
    'Email',
    'Assessment Date',
    'Assessment Type',
    'CEFR Level',
    'Overall Grade', 
    'Competency Score',
    'Detailed Analysis',
    'Specific Strengths',
    'Areas for Improvement',
    'Score Justification',
    'Assessed By',
    'Audio Source',
    'Overall Feedback'
  ];

  const getLegacyOverallScore = (scores: any) => {
    if (!scores || typeof scores !== 'object' || !scores.clarity_articulation) return '';
    
    const competencyScores = [
      scores.clarity_articulation || 0,
      scores.pace || 0,
      scores.tone_modulation || 0,
      scores.accent_neutrality || 0,
      scores.confidence_energy || 0,
      scores.grammar_fluency || 0
    ];

    return (competencyScores.reduce((sum, score) => sum + score, 0) / competencyScores.length).toFixed(1);
  };

  const rows = assessments.map(assessment => [
    assessment.candidate?.name || '',
    assessment.candidate?.email || '',
    new Date(assessment.assessment_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    assessment.overall_cefr_level ? 'CEFR Assessment' : 'Competency Assessment',
    assessment.overall_cefr_level || '',
    assessment.overall_grade || '',
    getLegacyOverallScore(assessment.assessment_scores),
    assessment.detailed_analysis?.replace(/"/g, '""') || '',
    assessment.specific_strengths?.replace(/"/g, '""') || '',
    assessment.areas_for_improvement?.replace(/"/g, '""') || '',
    assessment.score_justification?.replace(/"/g, '""') || '',
    assessment.assessed_by,
    assessment.candidate?.audio_source || '',
    assessment.ai_feedback?.replace(/"/g, '""') || '' // Overall feedback for competency assessments
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}