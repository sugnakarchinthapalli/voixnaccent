import { supabase } from '../lib/supabase';
import { fetchGoogleSheetsData, validateAudioSource } from './googleSheetsService';
import { assessmentService } from './assessmentService';

class SheetsMonitorService {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  startMonitoring(intervalMs: number = 60000) { // Check every minute
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
      const sheetsEntries = await fetchGoogleSheetsData();
      
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
      // Check if already processed
      const { data: existingEntry } = await supabase
        .from('processed_sheets_entries')
        .select('id')
        .eq('sheet_row_id', entry.rowId)
        .single();

      if (existingEntry) {
        return; // Already processed
      }

      // Validate audio source
      if (!validateAudioSource(entry.audioSource)) {
        console.warn(`Invalid audio source for entry ${entry.rowId}: ${entry.audioSource}`);
        return;
      }

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

      console.log(`Processed new entry: ${entry.candidateName} (${entry.email})`);
      
    } catch (error) {
      console.error(`Error processing entry ${entry.rowId}:`, error);
    }
  }

  async manualSync() {
    await this.checkForNewEntries();
  }
}

export const sheetsMonitorService = new SheetsMonitorService();