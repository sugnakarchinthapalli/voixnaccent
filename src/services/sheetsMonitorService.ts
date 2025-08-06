import { supabase } from '../lib/supabase';
import { fetchGoogleSheetsData, validateAudioSource } from './googleSheetsService';
import { assessmentService } from './assessmentService';

class SheetsMonitorService {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  startMonitoring(intervalMs: number = 30000) { // Check every 30 seconds
    if (this.intervalId) {
      this.stopMonitoring();
    }

    this.intervalId = setInterval(() => {
      this.checkForNewEntries();
    }, intervalMs);

    // Initial check
    this.checkForNewEntries();
  }

  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async checkForNewEntries() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      console.log('Checking Google Sheets for new entries...');
      const sheetsEntries = await fetchGoogleSheetsData();
      console.log(`Found ${sheetsEntries.length} entries in Google Sheets`);
      
      for (const entry of sheetsEntries) {
        await this.processEntry(entry);
      }
    } catch (error) {
      console.error('Error monitoring Google Sheets:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processEntry(entry: any) {
    try {
      console.log(`Processing entry: ${entry.candidateName} (${entry.email})`);
      
      // Check if already processed
      const { data: existingEntry } = await supabase
        .from('processed_sheets_entries')
        .select('id')
        .eq('sheet_row_id', entry.rowId)
        .single();

      if (existingEntry) {
        console.log(`Entry ${entry.rowId} already processed, skipping`);
        return; // Already processed
      }

      // Validate audio source
      if (!validateAudioSource(entry.audioSource)) {
        console.warn(`Invalid audio source for entry ${entry.rowId}: ${entry.audioSource}`);
        return;
      }

      try {
        // Create candidate
        const candidate = await assessmentService.createCandidate({
          name: entry.candidateName,
          email: entry.email,
          audio_source: entry.audioSource,
          source_type: 'auto'
        });

        // Add to assessment queue with normal priority
        await assessmentService.addToQueue(candidate.id, 0);

        // Mark as processed
        await supabase
          .from('processed_sheets_entries')
          .insert({
            sheet_row_id: entry.rowId,
            candidate_id: candidate.id
          });

        console.log(`Successfully processed new entry: ${entry.candidateName} (${entry.email})`);
      } catch (candidateError) {
        if (candidateError instanceof Error && candidateError.message.includes('already exists')) {
          console.log(`Candidate ${entry.email} already exists, marking as processed`);
          // Mark as processed even if candidate exists to avoid reprocessing
          await supabase
            .from('processed_sheets_entries')
            .insert({
              sheet_row_id: entry.rowId,
              candidate_id: null
            });
        } else {
          throw candidateError;
        }
      }
      
    } catch (error) {
      console.error(`Error processing entry ${entry.rowId}:`, error);
    }
  }

  async manualSync() {
    await this.checkForNewEntries();
  }
}

export const sheetsMonitorService = new SheetsMonitorService();