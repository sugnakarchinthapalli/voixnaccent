import { GoogleSheetsEntry } from '../types';

const SHEETS_API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
const SHEET_ID = '1R_y2bPxb3evpk_u2VwvVC2PpT2FzxKPSRmGMvUJXaQo';
const RANGE = 'Form Responses!A:F';

export async function fetchGoogleSheetsData(): Promise<GoogleSheetsEntry[]> {
  if (!SHEETS_API_KEY) {
    throw new Error('Google Sheets API key not configured');
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${SHEETS_API_KEY}`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.values || !Array.isArray(data.values)) {
      return [];
    }

    // Skip header row and process data
    const entries: GoogleSheetsEntry[] = [];
    
    for (let i = 1; i < data.values.length; i++) {
      const row = data.values[i];
      
      // Check if we have the required data
      if (row.length >= 6 && row[1] && row[3] && row[5]) {
        const candidateName = row[1]?.toString().trim();
        const email = row[3]?.toString().trim();
        const audioSource = row[5]?.toString().trim();
        const timestamp = row[0]?.toString() || new Date().toISOString();

        // Validate email format and audio source
        if (candidateName && 
            email && 
            email.includes('@') && 
            audioSource && 
            (audioSource.includes('voca.ro') || audioSource.includes('vocaroo.com') || audioSource.includes('drive.google.com'))) {
          
          entries.push({
            rowId: `row_${i + 1}`,
            candidateName,
            email,
            audioSource,
            timestamp
          });
        }
      }
    }

    return entries;
    
  } catch (error) {
    console.error('Error fetching Google Sheets data:', error);
    throw error;
  }
}

export function validateAudioSource(audioSource: string): boolean {
  const trimmed = audioSource.trim();
  
  // Check for Vocaroo links
  if (trimmed.includes('voca.ro') || trimmed.includes('vocaroo.com')) {
    return /^https?:\/\/(www\.)?(voca\.ro|vocaroo\.com)\/[a-zA-Z0-9]+/i.test(trimmed);
  }
  
  // Check for Google Drive links
  if (trimmed.includes('drive.google.com')) {
    return /^https?:\/\/drive\.google\.com\/.*\/d\/[a-zA-Z0-9_-]+/i.test(trimmed);
  }
  
  return false;
}

export function convertGoogleDriveToDirectLink(driveUrl: string): string {
  // Extract file ID from Google Drive URL
  const match = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  
  if (match && match[1]) {
    const fileId = match[1];
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
  
  return driveUrl; // Return original if can't convert
}