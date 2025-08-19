import { supabaseServiceRole } from '../lib/supabaseServiceRole';
import { Candidate, QueueItem } from '../types';
import { assessAudioWithCEFR, mapCEFRToGrade } from './geminiService';
import type { CEFRAssessmentResult } from './geminiService';
import { storageService } from './storageService';

export class CandidateSubmissionService {
  async createCandidateSubmission(candidateData: {
    name: string;
    email: string;
    audio_source: string;
    snapshot_url?: string;
    question_id?: string;
  }): Promise<{ candidate: Candidate; queueItem: QueueItem }> {
    try {
      console.log('🚀 Starting candidate submission with service role...');
      console.log('📝 Candidate data:', {
        name: candidateData.name,
        email: candidateData.email,
        hasAudio: !!candidateData.audio_source,
        hasSnapshot: !!candidateData.snapshot_url,
        questionId: candidateData.question_id
      });

      // Check for existing candidate with same email
      console.log('🔍 Checking for existing candidate...');
      const { data: existingCandidate } = await supabaseServiceRole
        .from('candidates')
        .select('id, name, email')
        .eq('email', candidateData.email.trim())
        .single();

      if (existingCandidate) {
        console.log('❌ Candidate already exists:', existingCandidate);
        throw new Error(`A candidate with email "${candidateData.email}" already exists: ${existingCandidate.name}`);
      }

      // Create candidate record using service role (bypasses RLS)
      console.log('👤 Creating candidate record...');
      const { data: candidate, error: candidateError } = await supabaseServiceRole
        .from('candidates')
        .insert({
          name: candidateData.name.trim(),
          email: candidateData.email.trim(),
          audio_source: candidateData.audio_source,
          source_type: 'manual', // Mark as 'manual' for candidate submissions
          snapshot_url: candidateData.snapshot_url || null
        })
        .select()
        .single();

      if (candidateError) {
        console.error('❌ Error creating candidate:', candidateError);
        throw new Error(`Failed to create candidate: ${candidateError.message}`);
      }

      console.log('✅ Candidate created successfully:', candidate);

      // Process assessment immediately using CEFR system
      console.log('🤖 Starting immediate CEFR assessment...');
      const cefrResult: CEFRAssessmentResult = await assessAudioWithCEFR(candidateData.audio_source);
      console.log('🎯 CEFR assessment completed:', {
        level: cefrResult.overall_cefr_level,
        hasAnalysis: !!cefrResult.detailed_analysis,
        hasStrengths: !!cefrResult.specific_strengths,
        hasImprovements: !!cefrResult.areas_for_improvement,
        hasJustification: !!cefrResult.score_justification
      });
      
      // Map CEFR level to traditional grade for backward compatibility
      const overallGrade = mapCEFRToGrade(cefrResult.overall_cefr_level);

      // Save assessment directly using service role
      console.log('💾 Saving CEFR assessment...');
      const { data: assessment, error: assessmentError } = await supabaseServiceRole
        .from('assessments')
        .insert({
          candidate_id: candidate.id,
          assessment_scores: {}, // Empty - using CEFR framework
          overall_grade: overallGrade,
          ai_feedback: null, // Using detailed_analysis instead
          assessed_by: 'Candidate Submission',
          processing_status: 'completed',
          question_id: candidateData.question_id || null,
          // CEFR framework fields
          overall_cefr_level: cefrResult.overall_cefr_level,
          detailed_analysis: cefrResult.detailed_analysis,
          specific_strengths: cefrResult.specific_strengths,
          areas_for_improvement: cefrResult.areas_for_improvement,
          score_justification: cefrResult.score_justification
        })
        .select()
        .single();

      if (assessmentError) {
        console.error('❌ Error saving assessment:', assessmentError);
        // Try to cleanup candidate record and uploaded files if assessment fails
        await supabaseServiceRole
          .from('candidates')
          .delete()
          .eq('id', candidate.id);
        
        // Clean up uploaded files
        if (candidateData.audio_source.includes('supabase')) {
          try {
            await storageService.deleteAudioFile(candidateData.audio_source);
          } catch (error) {
            console.warn('Could not delete audio file during cleanup:', error);
          }
        }
        
        if (candidateData.snapshot_url && candidateData.snapshot_url.includes('supabase')) {
          try {
            await storageService.deleteImageFile(candidateData.snapshot_url);
          } catch (error) {
            console.warn('Could not delete snapshot during cleanup:', error);
          }
        }
        
        throw new Error(`Failed to save assessment: ${assessmentError.message}`);
      }

      console.log('✅ Assessment saved successfully:', assessment);
      console.log('🎉 Candidate submission completed successfully!');

      // Create a mock queue item for backward compatibility
      const mockQueueItem: QueueItem = {
        id: 'immediate-processing',
        candidate_id: candidate.id,
        status: 'completed',
        priority: 10,
        batch_id: null,
        error_message: null,
        retry_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      return { candidate, queueItem: mockQueueItem };

    } catch (error) {
      console.error('💥 Candidate submission failed:', error);
      
      // Enhanced error handling with cleanup
      if (candidateData.audio_source.includes('supabase')) {
        try {
          await storageService.deleteAudioFile(candidateData.audio_source);
        } catch (cleanupError) {
          console.warn('Could not delete audio file during error cleanup:', cleanupError);
        }
      }
      
      if (candidateData.snapshot_url && candidateData.snapshot_url.includes('supabase')) {
        try {
          await storageService.deleteImageFile(candidateData.snapshot_url);
        } catch (cleanupError) {
          console.warn('Could not delete snapshot during error cleanup:', cleanupError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Processes assessment for an existing candidate who has submitted audio via assessment link
   * This method is called after a candidate completes their assessment through the generated link
   * 
   * @param candidateId - The ID of the candidate to process
   * @param questionId - Optional question ID that was answered
   */
  async getQueueStatus(): Promise<{
    pending: number;
    processing: number;
    position: number | null;
    failed: number;
  }> {
    const { data: queueItems, error } = await supabaseServiceRole
      .from('assessment_queue')
      .select('*')
      .in('status', ['pending', 'processing', 'failed'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;

    const pending = queueItems.filter(item => item.status === 'pending').length;
    const processing = queueItems.filter(item => item.status === 'processing').length;
    const failed = queueItems.filter(item => item.status === 'failed').length;
    
    return { pending, processing, failed, position: pending > 0 ? 1 : null };
  }

  async processExistingCandidate(candidateId: string, questionId?: string): Promise<void> {
    try {
      console.log('🚀 Processing existing candidate assessment...');
      
      // Fetch the candidate record with audio source
      const { data: candidate, error: candidateError } = await supabaseServiceRole
        .from('candidates')
        .select('*')
        .eq('id', candidateId)
        .single();

      if (candidateError || !candidate) {
        console.error('❌ Failed to fetch candidate:', candidateError);
        throw new Error(`Failed to fetch candidate: ${candidateError?.message || 'Not found'}`);
      }

      if (!candidate.audio_source) {
        console.error('❌ No audio source found for candidate:', candidate.name);
        throw new Error('No audio source found for candidate');
      }

      console.log('🤖 Starting CEFR assessment for candidate:', candidate.name);
      const cefrResult: CEFRAssessmentResult = await assessAudioWithCEFR(candidate.audio_source);
      console.log('🎯 CEFR assessment completed:', {
        level: cefrResult.overall_cefr_level,
        hasAnalysis: !!cefrResult.detailed_analysis,
        hasStrengths: !!cefrResult.specific_strengths,
        hasImprovements: !!cefrResult.areas_for_improvement,
        hasJustification: !!cefrResult.score_justification
      });
      
      // Convert CEFR level to color-coded grade system
      const overallGrade = mapCEFRToGrade(cefrResult.overall_cefr_level);

      // Create assessment record in database
      console.log('💾 Saving CEFR assessment for existing candidate...');
      const { data: assessment, error: assessmentError } = await supabaseServiceRole
        .from('assessments')
        .insert({
          candidate_id: candidateId,
          assessment_scores: {}, // Empty for CEFR assessments (legacy field)
          overall_grade: overallGrade,
          ai_feedback: null, // Using CEFR detailed_analysis field instead
          assessed_by: 'Candidate Submission', // Indicates this was submitted by candidate
          processing_status: 'completed',
          question_id: questionId || null,
          // CEFR assessment framework data
          overall_cefr_level: cefrResult.overall_cefr_level,
          detailed_analysis: cefrResult.detailed_analysis,
          specific_strengths: cefrResult.specific_strengths,
          areas_for_improvement: cefrResult.areas_for_improvement,
          score_justification: cefrResult.score_justification
        })
        .select()
        .single();

      if (assessmentError) {
        console.error('❌ Error saving assessment:', assessmentError);
        throw new Error(`Failed to save assessment: ${assessmentError.message}`);
      }

      console.log('✅ Assessment processing completed successfully for:', candidate.name);
      
    } catch (error) {
      console.error('💥 Failed to process existing candidate assessment:', error);
      throw error;
    }
  }
}

export const candidateSubmissionService = new CandidateSubmissionService();

