import { supabaseServiceRole } from '../lib/supabaseServiceRole';
import { Candidate, QueueItem } from '../types';

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
          source_type: 'manual',
          snapshot_url: candidateData.snapshot_url || null
        })
        .select()
        .single();

      if (candidateError) {
        console.error('❌ Error creating candidate:', candidateError);
        throw new Error(`Failed to create candidate: ${candidateError.message}`);
      }

      console.log('✅ Candidate created successfully:', candidate);

      // Add to assessment queue using service role
      console.log('📋 Adding to assessment queue...');
      const { data: queueItem, error: queueError } = await supabaseServiceRole
        .from('assessment_queue')
        .insert({
          candidate_id: candidate.id,
          status: 'pending',
          priority: 10, // High priority for candidate submissions
          retry_count: 0
        })
        .select()
        .single();

      if (queueError) {
        console.error('❌ Error adding to queue:', queueError);
        // Try to cleanup candidate record if queue insertion fails
        await supabaseServiceRole
          .from('candidates')
          .delete()
          .eq('id', candidate.id);
        
        throw new Error(`Failed to add to assessment queue: ${queueError.message}`);
      }

      console.log('✅ Added to queue successfully:', queueItem);
      console.log('🎉 Candidate submission completed successfully!');

      return { candidate, queueItem };

    } catch (error) {
      console.error('💥 Candidate submission failed:', error);
      throw error;
    }
  }

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
}

export const candidateSubmissionService = new CandidateSubmissionService();