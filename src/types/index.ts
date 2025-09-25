export interface Candidate {
  id: string;
  name: string;
  email: string;
  audio_source: string | null;
  source_type: 'auto' | 'manual' | 'scheduled';
  snapshot_url: string | null;
  assessment_link_id: string | null;
  assessment_status: 'pending' | 'in_progress' | 'completed' | 'expired';
  proctoring_flags: Record<string, any> | null;
  session_expires_at: string | null;
  assigned_question_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Assessment {
  id: string;
  candidate_id: string;
  assessment_scores: Record<string, any>; // Legacy field, empty for CEFR assessments
  overall_grade: 'Red' | 'Amber' | 'Green' | null;
  ai_feedback: string | null;
  assessed_by: string;
  assessment_date: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  question_id: string | null;
  // CEFR framework fields (current system)
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
  difficulty_level: 'easy' | 'medium' | 'hard';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Enhanced CEFR Assessment Result with dual audio detection
export interface CEFRAssessmentResult {
  overall_cefr_level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  detailed_analysis: string;
  specific_strengths: string;
  areas_for_improvement: string;
  score_justification: string;
  dual_audio_detected?: boolean; // New field for dual audio detection
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