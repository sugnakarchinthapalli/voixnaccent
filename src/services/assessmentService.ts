import { supabase } from '../lib/supabase';
import { Candidate, Assessment, QueueItem } from '../types';
import { assessAudioWithCEFR, mapCEFRToGrade } from './geminiService';
import type { CEFRAssessmentResult } from './geminiService';
import { storageService } from './storageService';

const MAX_CONCURRENT_ASSESSMENTS = 2;
const PROCESSING_DELAY = 1000; // 1 second between API calls for better throughput

export class AssessmentService {
  private isProcessing = false;
  private processingCount = 0;
  private queueMonitorInterval: NodeJS.Timeout | null = null;

  async createCandidate(candidateData: {
    name: string;
    email: string;
    audio_source: string;
    source_type: 'auto' | 'manual';
    snapshot_url?: string;
  }): Promise<Candidate> {
    console.log('Creating candidate with data:', candidateData);
    
    try {
      // Check for existing candidate with same email
      const { data: existingCandidate, error: checkError } = await supabase
        .from('candidates')
        .select('id, name, email')
        .eq('email', candidateData.email.trim())
        .maybeSingle(); // Use maybeSingle instead of single to avoid errors when no record found

      // Only throw error if there's a database error (not if no record found)
      if (checkError) {
        console.error('Error checking for existing candidate:', checkError);
        throw new Error(`Database error while checking for existing candidate: ${checkError.message}`);
      }

      if (existingCandidate) {
        console.log('Candidate already exists:', existingCandidate);
        throw new Error(`A candidate with email "${candidateData.email}" already exists: ${existingCandidate.name}`);
      }
    } catch (error) {
      // If it's our custom error about existing candidate, re-throw it
      if (error instanceof Error && error.message.includes('already exists')) {
        throw error;
      }
      // For other errors, log and continue (might be RLS policy issue)
      console.warn('Could not check for existing candidate, proceeding with creation:', error);
    }

    console.log('Inserting new candidate...');
    const { data, error } = await supabase
      .from('candidates')
      .insert(candidateData)
      .select()
      .single();

    if (error) {
      console.error('Error creating candidate:', error);
      throw new Error(`Failed to create candidate: ${error.message}`);
    }
    
    console.log('Candidate created successfully:', data);
    return data;
  }

  async addToQueue(candidateId: string, priority: number = 0, questionId?: string): Promise<QueueItem> {
    console.log('Adding to queue:', { candidateId, priority, questionId });
    
    const { data, error } = await supabase
      .from('assessment_queue')
      .insert({
        candidate_id: candidateId,
        status: 'pending',
        priority,
        retry_count: 0
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding to queue:', error);
      throw new Error(`Failed to add to assessment queue: ${error.message}`);
    }

    console.log('Added to queue successfully:', data);
    
    // Start queue monitoring if not already running
    this.startQueueMonitoring();
    
    return data;
  }

  async getQueueStatus(): Promise<{
    pending: number;
    processing: number;
    position: number | null;
    failed: number;
  }> {
    const { data: queueItems, error } = await supabase
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

  // Start continuous queue monitoring
  public startQueueMonitoring() {
    if (this.queueMonitorInterval) {
      console.log('Queue monitoring already running');
      return;
    }

    console.log('🚀 Starting queue monitoring...');
    
    // Process immediately
    this.processQueue();
    
    // Then process every 10 seconds
    this.queueMonitorInterval = setInterval(() => {
      this.processQueue();
    }, 5000); // Check every 5 seconds for better responsiveness
  }

  // Stop queue monitoring
  public stopQueueMonitoring() {
    if (this.queueMonitorInterval) {
      clearInterval(this.queueMonitorInterval);
      this.queueMonitorInterval = null;
      console.log('⏹️ Queue monitoring stopped');
    }
  }

  private async processQueue() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    console.log('🔄 Processing queue...');
    
    try {
      const processed = await this.processNextBatch();
      if (processed) {
        console.log('✅ Batch processed successfully');
      } else {
        console.log('📭 No pending items to process');
      }
    } catch (error) {
      console.error('❌ Error processing queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processNextBatch(): Promise<boolean> {
    // Increase concurrent processing for higher load
    const maxConcurrent = Math.min(MAX_CONCURRENT_ASSESSMENTS * 2, 4); // Allow up to 4 concurrent
    
    if (this.processingCount >= maxConcurrent) {
      console.log(`⏳ Max concurrent assessments reached (${this.processingCount}/${maxConcurrent})`);
      return false;
    }

    // Get pending items from queue (including failed items for retry)
    const { data: pendingItems, error } = await supabase
      .from('assessment_queue')
      .select(`
        *,
        candidate:candidates(*)
      `)
      .in('status', ['pending', 'failed'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(maxConcurrent - this.processingCount);

    if (error) {
      console.error('Error fetching queue items:', error);
      return false;
    }

    if (!pendingItems || pendingItems.length === 0) {
      console.log('📭 No pending or failed items in queue');
      return false;
    }

    console.log(`📋 Found ${pendingItems.length} items to process`);

    // Process items concurrently
    const processingPromises = pendingItems.map(item => this.processQueueItem(item));
    await Promise.allSettled(processingPromises);

    return pendingItems.length > 0;
  }

  private async processQueueItem(queueItem: any) {
    this.processingCount++;
    console.log(`🔄 Processing queue item for candidate: ${queueItem.candidate?.name || 'Unknown'}`);
    
    try {
      // Mark as processing
      // Reset retry count if this was a failed item being retried
      const updateData: any = { 
        status: 'processing',
        updated_at: new Date().toISOString()
      };
      
      if (queueItem.status === 'failed') {
        console.log(`🔄 Retrying failed assessment for: ${queueItem.candidate?.name}`);
        updateData.error_message = null; // Clear previous error
      }
      
      await supabase
        .from('assessment_queue')
        .update(updateData)
        .eq('id', queueItem.id);

      const candidate = queueItem.candidate;
      if (!candidate) {
        throw new Error('Candidate not found');
      }

      // Process audio URL
      const audioUrl = candidate.audio_source;

      // Assess with CEFR framework using Gemini
      console.log('🤖 Starting CEFR assessment with Gemini...');
      const cefrResult: CEFRAssessmentResult = await assessAudioWithCEFR(audioUrl);
      console.log('🎯 CEFR assessment completed:', {
        level: cefrResult.overall_cefr_level,
        hasAnalysis: !!cefrResult.detailed_analysis,
        hasStrengths: !!cefrResult.specific_strengths,
        hasImprovements: !!cefrResult.areas_for_improvement,
        hasJustification: !!cefrResult.score_justification
      });
      
      // Map CEFR level to traditional grade for backward compatibility
      const overallGrade = mapCEFRToGrade(cefrResult.overall_cefr_level);

      // Update candidate's proctoring flags with dual audio detection
      console.log('📝 Updating candidate proctoring flags...');
      try {
        // Fetch current proctoring flags
        const { data: currentCandidate, error: fetchError } = await supabase
          .from('candidates')
          .select('proctoring_flags')
          .eq('id', candidate.id)
          .single();

        if (fetchError) {
          console.warn('Could not fetch current proctoring flags:', fetchError);
        }

        // Merge existing flags with new dual audio detection
        const updatedProctoringFlags = {
          ...(currentCandidate?.proctoring_flags || {}),
          dual_audio_detected: cefrResult.dual_audio_detected || false,
          ai_analysis_timestamp: new Date().toISOString()
        };

        // Update candidate record with enhanced proctoring flags
        const { error: updateError } = await supabase
          .from('candidates')
          .update({ proctoring_flags: updatedProctoringFlags })
          .eq('id', candidate.id);

        if (updateError) {
          console.warn('Could not update proctoring flags:', updateError);
        } else {
          console.log('✅ Proctoring flags updated successfully');
        }
      } catch (error) {
        console.warn('Error updating proctoring flags:', error);
        // Don't fail the entire assessment for proctoring flag update issues
      }

      // All new assessments use CEFR framework
      // Determine who assessed this based on the candidate source
      let assessedBy = 'Candidate Submission'; // Default for candidate submissions
      
      // If this was a manual upload by an authenticated user, use their email
      if (candidate.source_type === 'manual') {
        try {
          const userEmail = await this.getCurrentUserEmail();
          if (userEmail && userEmail !== 'Unknown User' && userEmail.includes('@mediamint.com')) {
            assessedBy = userEmail;
          }
        } catch (error) {
          console.log('Could not get user email, using default assessed_by');
        }
      }

      // Save assessment
      const { error: assessmentError } = await supabase
        .from('assessments')
        .insert({
          candidate_id: candidate.id,
          assessment_scores: {}, // Empty - using CEFR framework
          overall_grade: overallGrade,
          ai_feedback: null, // Using detailed_analysis instead
          assessed_by: assessedBy,
          processing_status: 'completed',
          question_id: queueItem.question_id || null,
          // CEFR framework fields
          overall_cefr_level: cefrResult.overall_cefr_level,
          detailed_analysis: cefrResult.detailed_analysis,
          specific_strengths: cefrResult.specific_strengths,
          areas_for_improvement: cefrResult.areas_for_improvement,
          score_justification: cefrResult.score_justification
        });

      if (assessmentError) throw assessmentError;

      // Mark queue item as completed
      await supabase
        .from('assessment_queue')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', queueItem.id);

      console.log(`✅ CEFR assessment completed for: ${candidate.name} - Level: ${cefrResult.overall_cefr_level}`);
    } catch (error) {
      console.error('Error processing queue item:', error);
      
      // Create user-friendly error message
      let userFriendlyMessage = 'An error occurred while processing the assessment';
      
      if (error instanceof Error) {
        if (error.name === 'GeminiOverloadedError') {
          userFriendlyMessage = 'AI service is currently overloaded. The assessment will be retried automatically in a few minutes.';
        } else if (error.name === 'GeminiRateLimitError') {
          userFriendlyMessage = 'AI service rate limit reached. The assessment will be retried automatically.';
        } else if (error.name === 'GeminiServerError') {
          userFriendlyMessage = 'AI service is temporarily unavailable. The assessment will be retried automatically.';
        } else if (error.message.includes('Invalid assessment result')) {
          userFriendlyMessage = 'AI service returned invalid results. The assessment will be retried automatically.';
        } else if (error.message.includes('Failed to fetch audio')) {
          userFriendlyMessage = 'Could not access the audio file. Please check the audio URL and try again.';
        }
      }

      // If there's a snapshot, try to delete it from storage
      if (candidate.snapshot_url && candidate.snapshot_url.includes('supabase')) {
        try {
          await storageService.deleteImageFile(candidate.snapshot_url);
        } catch (error) {
          console.warn('Could not delete snapshot from storage:', error);
          // Don't throw error for storage cleanup failures
        }
      }
      
      // Update retry count
      const newRetryCount = (queueItem.retry_count || 0) + 1;
      const maxRetries = 5; // Increased retry attempts
      
      if (newRetryCount < maxRetries) {
        console.log(`🔄 Scheduling retry ${newRetryCount}/${maxRetries} for candidate: ${candidate.name}`);
        
        // Calculate exponential backoff delay (but don't actually delay, let the monitor handle timing)
        const backoffMinutes = Math.min(Math.pow(2, newRetryCount - 1) * 5, 60); // 5, 10, 20, 40, 60 minutes max
        console.log(`⏰ Next retry will be attempted in ~${backoffMinutes} minutes by queue monitor`);
        
        await supabase
          .from('assessment_queue')
          .update({ 
            status: 'failed', // Keep as failed, will be picked up by monitor
            retry_count: newRetryCount,
            error_message: userFriendlyMessage,
            updated_at: new Date().toISOString()
          })
          .eq('id', queueItem.id);
      } else {
        console.log(`❌ Assessment failed permanently after ${maxRetries} attempts for candidate: ${candidate.name}`);
        // Mark as failed
        await supabase
          .from('assessment_queue')
          .update({ 
            status: 'failed',
            error_message: `Assessment failed permanently after ${maxRetries} attempts: ${userFriendlyMessage}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', queueItem.id);
      }
    } finally {
      this.processingCount--;
    }
  }

  private async getCurrentUserEmail(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.email || 'Unknown User';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getAllAssessments(): Promise<Assessment[]> {
    // Fetch completed assessments
    const { data: completedAssessments, error: assessmentsError } = await supabase
      .from('assessments')
      .select(`
        *,
        candidate:candidates(*),
        question:questions(*)
      `)
      .eq('processing_status', 'completed')
      .order('assessment_date', { ascending: false });

    if (assessmentsError) throw assessmentsError;

    // Fetch scheduled candidates that don't have completed assessments yet
    const { data: scheduledCandidates, error: candidatesError } = await supabase
      .from('candidates')
      .select('*')
      .eq('source_type', 'scheduled')
      .in('assessment_status', ['pending', 'in_progress', 'expired'])
      .order('created_at', { ascending: false });

    if (candidatesError) throw candidatesError;

    // Create mock assessment objects for scheduled candidates
    const mockAssessments: Assessment[] = (scheduledCandidates || []).map(candidate => ({
      id: `scheduled-${candidate.id}`, // Prefix to distinguish from real assessments
      candidate_id: candidate.id,
      assessment_scores: {},
      overall_grade: null,
      ai_feedback: null,
      assessed_by: 'Candidate Submission', // Show as candidate submission for scheduled ones
      assessment_date: candidate.created_at, // Use creation date as placeholder
      processing_status: candidate.assessment_status as 'pending' | 'processing' | 'completed' | 'failed',
      question_id: null,
      overall_cefr_level: null,
      detailed_analysis: null,
      specific_strengths: null,
      areas_for_improvement: null,
      score_justification: null,
      candidate: candidate,
      question: null
    }));

    // Combine completed assessments and mock assessments
    const allAssessments = [...(completedAssessments || []), ...mockAssessments];

    // Sort by assessment_date/created_at in descending order
    allAssessments.sort((a, b) => new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime());

    return allAssessments;
  }

  async searchAssessments(query: string): Promise<Assessment[]> {
    const { data, error } = await supabase
      .from('assessments')
      .select(`
        *,
        candidate:candidates(*),
        question:questions(*)
      `)
      .eq('processing_status', 'completed')
      .or(`candidate.name.ilike.%${query}%,candidate.email.ilike.%${query}%,assessed_by.ilike.%${query}%`)
      .order('assessment_date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async filterAssessments(filters: {
    assessedBy?: string;
    overallGrade?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Assessment[]> {
    let query = supabase
      .from('assessments')
      .select(`
        *,
        candidate:candidates(*),
        question:questions(*)
      `)
      .eq('processing_status', 'completed');

    if (filters.assessedBy) {
      query = query.eq('assessed_by', filters.assessedBy);
    }

    if (filters.overallGrade) {
      query = query.eq('overall_grade', filters.overallGrade);
    }

    if (filters.dateFrom) {
      query = query.gte('assessment_date', filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte('assessment_date', filters.dateTo);
    }

    query = query.order('assessment_date', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async deleteAssessment(assessmentId: string): Promise<void> {
    try {
      console.log('Starting deletion process for assessment:', assessmentId);
      
      // Check if this is a scheduled candidate (mock assessment) or real assessment
      if (assessmentId.startsWith('scheduled-')) {
        // Extract candidate ID from the mock assessment ID
        const candidateId = assessmentId.replace('scheduled-', '');
        console.log('Deleting scheduled candidate:', candidateId);
        
        // Get candidate data for cleanup
        const { data: candidate, error: candidateError } = await supabase
          .from('candidates')
          .select('*')
          .eq('id', candidateId)
          .single();

        if (candidateError) {
          console.error('Error fetching candidate for deletion:', candidateError);
          throw new Error(`Failed to fetch candidate: ${candidateError.message}`);
        }

        if (!candidate) {
          throw new Error('Candidate not found');
        }

        console.log('Found scheduled candidate:', candidate.name);

        // Delete the candidate - this will CASCADE delete any related records
        const { error: deleteError } = await supabase
          .from('candidates')
          .delete()
          .eq('id', candidateId);

        if (deleteError) {
          console.error('Error deleting candidate:', deleteError);
          throw new Error(`Failed to delete candidate: ${deleteError.message}`);
        }

        console.log('Successfully deleted scheduled candidate');
        return;
      }

      // Handle regular completed assessment deletion
      // First, get the assessment with candidate data
      const { data: assessment, error: fetchError } = await supabase
        .from('assessments')
        .select(`
          *,
          candidate:candidates(*)
        `)
        .eq('id', assessmentId)
        .single();

      if (fetchError) {
        console.error('Error fetching assessment for deletion:', fetchError);
        throw new Error(`Failed to fetch assessment: ${fetchError.message}`);
      }

      if (!assessment || !assessment.candidate) {
        throw new Error('Assessment or candidate not found');
      }

      console.log('Found assessment for candidate:', assessment.candidate.name);
      console.log('Audio source:', assessment.candidate.audio_source);

      // Store audio source for cleanup
      const audioSource = assessment.candidate.audio_source;

      // Delete the candidate - this will CASCADE delete assessments and queue items
      console.log('Deleting candidate (will cascade to assessments and queue)...');
      const { error: candidateDeleteError } = await supabase
        .from('candidates')
        .delete()
        .eq('id', assessment.candidate_id);

      if (candidateDeleteError) {
        console.error('Error deleting candidate:', candidateDeleteError);
        throw new Error(`Failed to delete candidate: ${candidateDeleteError.message}`);
      }

      console.log('Successfully deleted candidate and associated records');

      // Clean up audio file from storage if it's an uploaded file
      if (audioSource && 
          !audioSource.includes('vocaroo') && 
          !audioSource.includes('voca.ro') &&
          audioSource.includes('supabase')) {
        try {
          console.log('Cleaning up audio file from storage:', audioSource);
          await storageService.deleteAudioFile(audioSource);
          console.log('Audio file deleted from storage');
        } catch (error) {
          console.warn('Could not delete audio file from storage:', error);
          // Don't throw error for storage cleanup failures
        }
      } else {
        console.log('Skipping storage cleanup - not an uploaded file');
      }
      
      console.log('Deletion process completed successfully');
    } catch (error) {
      console.error('Error in deleteAssessment:', error);
      throw error;
    }
  }

  async deleteCandidate(candidateId: string): Promise<void> {
    // Get candidate data to access audio source
    const { data: candidate, error: fetchError } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', candidateId)
      .single();

    if (fetchError) throw fetchError;

    // Delete the candidate (this will cascade delete assessments and queue items)
    const { error: deleteError } = await supabase
      .from('candidates')
      .delete()
      .eq('id', candidateId);

    if (deleteError) throw deleteError;

    // If the audio source is a file upload, try to delete it from storage
    if (candidate.audio_source && 
        !candidate.audio_source.includes('vocaroo') && 
        !candidate.audio_source.includes('voca.ro') &&
        candidate.audio_source.includes('supabase')) {
      try {
        await storageService.deleteAudioFile(candidate.audio_source);
      } catch (error) {
        console.warn('Could not delete audio file from storage:', error);
        // Don't throw error for storage cleanup failures
      }
    }
  }
}

export const assessmentService = new AssessmentService();