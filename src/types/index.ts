export interface Candidate {
  id: string;
  name: string;
  email: string;
  audio_source: string;
  source_type: 'auto' | 'manual';
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
  candidate?: Candidate;
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

export interface GoogleSheetsEntry {
  rowId: string;
  candidateName: string;
  email: string;
  audioSource: string;
  timestamp: string;
}