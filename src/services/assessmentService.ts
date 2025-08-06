import { supabase } from '../lib/supabase';
import { Candidate, Assessment, QueueItem, CompetencyScores } from '../types';
import { assessAudioWithGemini, calculateOverallGrade } from './geminiService';
import { convertGoogleDriveToDirectLink } from './googleSheetsService';

const MAX_CONCURRENT_ASSESSMENTS = 2;
const PROCESSING_DELAY = 3000; // 3 seconds between API calls

export class AssessmentService {
  private isProcessing = false;
  private processingCount = 0;

  async createCandidate(candidateData: {
    name: string;
    email: string;
    audio_source: string;
    source_type: 'auto' | 'manual';
  }): Promise<Candidate> {
    const { data, error } = await supabase
      .from('candidates')
      .insert(candidateData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async addToQueue(candidateId: string, priority: number = 0): Promise<QueueItem> {
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

    if (error) throw error;

    // Start processing if not already running
    this.startQueueProcessing();
    
    return data;
  }

  async getQueueStatus(): Promise<{
    pending: number;
    processing: number;
    position: number | null;
  }> {
    const { data: queueItems, error } = await supabase
      .from('assessment_queue')
      .select('*')
      .in('status', ['pending', 'processing'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;

    const pending = queueItems.filter(item => item.status === 'pending').length;
    const processing = queueItems.filter(item => item.status === 'processing').length;
    
    return { pending, processing, position: pending > 0 ? 1 : null };
  }

  private async startQueueProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      while (await this.processNextBatch()) {
        await this.delay(PROCESSING_DELAY);
      }
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
      let audioUrl = candidate.audio_source;
      if (audioUrl.includes('drive.google.com')) {
        audioUrl = convertGoogleDriveToDirectLink(audioUrl);
      }

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

      // Determine assessed_by based on source_type
      const assessedBy = candidate.source_type === 'auto' ? 'Form Response' : await this.getCurrentUserEmail();

      // Save assessment
      const { error: assessmentError } = await supabase
        .from('assessments')
        .insert({
          candidate_id: candidate.id,
          assessment_scores: assessmentScores,
          overall_grade: overallGrade,
          ai_feedback: assessmentResult.overall_feedback,
          assessed_by: assessedBy,
          processing_status: 'completed'
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
      
      // Update retry count
      const newRetryCount = (queueItem.retry_count || 0) + 1;
      const maxRetries = 3;
      
      if (newRetryCount < maxRetries) {
        // Retry later
        await supabase
          .from('assessment_queue')
          .update({ 
            status: 'pending',
            retry_count: newRetryCount,
            error_message: error instanceof Error ? error.message : 'Unknown error',
            updated_at: new Date().toISOString()
          })
          .eq('id', queueItem.id);
      } else {
        // Mark as failed
        await supabase
          .from('assessment_queue')
          .update({ 
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
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
        candidate:candidates(*)
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
        candidate:candidates(*)
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
        candidate:candidates(*)
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
}

export const assessmentService = new AssessmentService();