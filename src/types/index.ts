export interface Candidate {
  id: string;
  name: string;
  email: string;
  audio_source: string | null;
  source_type: 'auto' | 'manual';
  source_type: 'auto' | 'manual' | 'scheduled';
  snapshot_url: string | null;
  assessment_link_id: string | null;
  assessment_status: 'pending' | 'in_progress' | 'completed' | 'expired';
  proctoring_flags: Record<string, any> | null;
  session_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Assessment {
  id: string;
  candidate_id: string;
  assessment_scores: CompetencyScores;
  overall_grade: 'Red' | 'Amber' | 'Green' | null;
  ai_feedback: string | null;
  assessed_by: string;
  assessment_date: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  question_id: string | null;
  // New CEFR fields
  overall_cefr_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | null;
  detailed_analysis: string | null;
  specific_strengths: string | null;
  areas_for_improvement: string | null;
  score_justification: string | null;
  candidate?: Candidate;
  question?: Question;
}

export interface Question {
  id: string;
  text: string;
  competencies_targeted: string[];
  difficulty_level: 'easy' | 'medium' | 'hard';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompetencyScores {
  clarity_articulation: number;
  pace: number;
  tone_modulation: number;
  accent_neutrality: number;
  confidence_energy: number;
  grammar_fluency: number;
  feedback?: {
    clarity_articulation?: string;
    pace?: string;
    tone_modulation?: string;
    accent_neutrality?: string;
    confidence_energy?: string;
    grammar_fluency?: string;
    overall?: string;
  };
}

export interface QueueItem {
  id: string;
  candidate_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  batch_id: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
  candidate?: Candidate;
}

export interface AssessmentWithCandidate extends Assessment {
  candidate: Candidate;
}

export interface BatchProcessingStats {
  totalInQueue: number;
  currentlyProcessing: number;
  completed: number;
  failed: number;
}