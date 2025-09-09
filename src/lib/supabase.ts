import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

export type Database = {
  public: {
    Tables: {
      candidates: {
        Row: {
          id: string;
          name: string;
          email: string;
          audio_source: string;
          source_type: 'auto' | 'manual';
          snapshot_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['candidates']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['candidates']['Insert']>;
      };
      assessments: {
        Row: {
          id: string;
          candidate_id: string;
          assessment_scores: Record<string, any>;
          overall_grade: 'Red' | 'Amber' | 'Green' | null;
          ai_feedback: string | null;
          assessed_by: string;
          assessment_date: string;
          processing_status: 'pending' | 'processing' | 'completed' | 'failed';
          question_id: string | null;
        };
        Insert: Omit<Database['public']['Tables']['assessments']['Row'], 'id' | 'assessment_date'>;
        Update: Partial<Database['public']['Tables']['assessments']['Insert']>;
      };
      questions: {
        Row: {
          id: string;
          text: string;
          difficulty_level: 'easy' | 'medium' | 'hard';
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['questions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['questions']['Insert']>;
      };
      assessment_queue: {
        Row: {
          id: string;
          candidate_id: string;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          priority: number;
          batch_id: string | null;
          error_message: string | null;
          retry_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['assessment_queue']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['assessment_queue']['Insert']>;
      };
      processed_sheets_entries: {
        Row: {
          id: string;
          sheet_row_id: string;
          candidate_id: string | null;
          processed_at: string;
        };
        Insert: Omit<Database['public']['Tables']['processed_sheets_entries']['Row'], 'id' | 'processed_at'>;
        Update: Partial<Database['public']['Tables']['processed_sheets_entries']['Insert']>;
      };
    };
  };
};