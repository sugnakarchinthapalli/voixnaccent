import { supabase } from '../lib/supabase';
import { Candidate, Assessment, QueueItem, CompetencyScores } from '../types';
import { assessAudioWithGemini, calculateOverallGrade } from './geminiService';
import { storageService } from './storageService';

const MAX_CONCURRENT_ASSESSMENTS = 2;
const PROCESSING_DELAY = 3000; // 3 seconds between API calls

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
    
    // Check for existing candidate with same email
    const { data: existingCandidate } = await supabase
      .from('candidates')
      .select('id, name, email')
      .eq('email', candidateData.email.trim())
      .single();

    if (existingCandidate) {
      console.log('Candidate already exists:', existingCandidate);
      throw new Error(`A candidate with email "${candidateData.email}" already exists: ${existingCandidate.name}`);
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
    }, 10000); // Check every 10 seconds
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
    if (this.processingCount >= MAX_CONCURRENT_ASSESSMENTS) {
      return false;
    }

    // Get pending items from queue
    const { data: pendingItems, error } = await supabase
      .from('assessment_queue')
      .select(`
        *,
        candidate:candidates(*)
      `)
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(MAX_CONCURRENT_ASSESSMENTS - this.processingCount);

    if (error) {
      console.error('Error fetching queue items:', error);
      return false;
    }

    if (!pendingItems || pendingItems.length === 0) {
      return false;
    }

    // Process items concurrently
    const processingPromises = pendingItems.map(item => this.processQueueItem(item));
    await Promise.allSettled(processingPromises);

    return pendingItems.length > 0;
  }

  private async processQueueItem(queueItem: any) {
    this.processingCount++;
    
    try {
      // Mark as processing
      await supabase
        .from('assessment_queue')
        .update({ 
          status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', queueItem.id);

      const candidate = queueItem.candidate;
      if (!candidate) {
        throw new Error('Candidate not found');
      }

      // Process audio URL
      const audioUrl = candidate.audio_source;

      // Assess with Gemini
      const assessmentResult = await assessAudioWithGemini(audioUrl);
      
      // Calculate overall grade
      const overallGrade = calculateOverallGrade(assessmentResult);

      // Create assessment scores object
      const assessmentScores: CompetencyScores = {
        clarity_articulation: assessmentResult.clarity_articulation.score,
        pace: assessmentResult.pace.score,
        tone_modulation: assessmentResult.tone_modulation.score,
        accent_neutrality: assessmentResult.accent_neutrality.score,
        confidence_energy: assessmentResult.confidence_energy.score,
        grammar_fluency: assessmentResult.grammar_fluency.score,
        feedback: {
          clarity_articulation: assessmentResult.clarity_articulation.feedback,
          pace: assessmentResult.pace.feedback,
          tone_modulation: assessmentResult.tone_modulation.feedback,
          accent_neutrality: assessmentResult.accent_neutrality.feedback,
          confidence_energy: assessmentResult.confidence_energy.feedback,
          grammar_fluency: assessmentResult.grammar_fluency.feedback,
          overall: assessmentResult.overall_feedback
        }
      };

      // All assessments are now manual
      const assessedBy = 'Candidate Submission';

      // Save assessment
      const { error: assessmentError } = await supabase
        .from('assessments')
        .insert({
          candidate_id: candidate.id,
          assessment_scores: assessmentScores,
          overall_grade: overallGrade,
          ai_feedback: assessmentResult.overall_feedback,
          assessed_by: assessedBy,
          processing_status: 'completed',
          question_id: queueItem.question_id || null
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
      const maxRetries = 3;
      
      if (newRetryCount < maxRetries) {
        console.log(`Retrying assessment (attempt ${newRetryCount + 1}/${maxRetries + 1}) for candidate: ${candidate.name}`);
        // Retry later
        await supabase
          .from('assessment_queue')
          .update({ 
            status: 'pending',
            retry_count: newRetryCount,
            error_message: userFriendlyMessage,
            updated_at: new Date().toISOString()
          })
          .eq('id', queueItem.id);
      } else {
        console.log(`Assessment failed permanently after ${maxRetries + 1} attempts for candidate: ${candidate.name}`);
        // Mark as failed
        await supabase
          .from('assessment_queue')
          .update({ 
            status: 'failed',
            error_message: `Assessment failed after ${maxRetries + 1} attempts: ${userFriendlyMessage}`,
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
    const { data, error } = await supabase
      .from('assessments')
      .select(`
        *,
        candidate:candidates(*),
        question:questions(*)
      `)
      .eq('processing_status', 'completed')
      .order('assessment_date', { ascending: false });

    if (error) throw error;
    return data || [];
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