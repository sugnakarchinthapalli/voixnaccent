// Import the interface from types
import type { CEFRAssessmentResult } from '../types';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Retry configuration
const MAX_RETRIES = 3;
const BASE_DELAY = 2000; // 2 seconds
const MAX_DELAY = 30000; // 30 seconds

/**
 * Enhanced CEFR Assessment Prompt with Strict Evaluation and Dual Audio Detection
 * 
 * This prompt has been specifically designed to:
 * 1. Apply stricter CEFR evaluation criteria
 * 2. Penalize short or incomplete responses
 * 3. Detect multiple speakers or background voices
 * 4. Provide comprehensive assessment feedback
 */
const CEFR_ASSESSMENT_PROMPT = `
You are an expert language assessment AI specializing in evaluating spoken English using the CEFR (Common European Framework of Reference for Languages) framework. Analyze the provided audio recording and assess the speaker's proficiency level based on the CEFR Qualitative Aspects of Spoken Language Use.

**CRITICAL: STRICT EVALUATION REQUIREMENTS**
- Apply EXTREMELY STRINGENT criteria for each CEFR level
- A response must demonstrate CONSISTENT performance across ALL competency areas to achieve a level
- Short responses (under 60 seconds) should be heavily penalized unless they demonstrate exceptional quality
- Incomplete or superficial answers cannot achieve levels above A2, regardless of fluency
- Require CLEAR EVIDENCE of complex language structures for B2+ levels
- Do not award high levels based on fluency alone - content depth and accuracy are equally important

**Assessment Framework:**
Use the CEFR Qualitative Aspects of Spoken Language Use (Table 3, CEFR 3.3) which evaluates:
- **Range**: Vocabulary breadth and grammatical structures used
- **Accuracy**: Grammatical and lexical precision
- **Fluency**: Rhythm, pace, and hesitation patterns
- **Interaction**: Turn-taking and conversational management (assess based on monologue delivery)
- **Coherence**: Logical organization and linking of ideas

**CEFR Scoring Criteria (EXTREMELY STRICT APPLICATION):**
- **C2 (Mastery)**: Near-native proficiency with sophisticated language use, virtually no errors, effortless expression of complex abstract concepts, extensive vocabulary, perfect coherence. REQUIRES: 90+ seconds of sustained, sophisticated discourse.
- **C1 (Proficiency)**: Advanced level with complex language structures, rare minor errors, excellent fluency, handles abstract topics with ease. REQUIRES: 75+ seconds with clear evidence of advanced structures and vocabulary.
- **B2 (Upper-Intermediate)**: Independent user with good range, occasional errors that don't impede communication, generally fluent, can express opinions and arguments clearly. REQUIRES: 60+ seconds with clear argumentation and varied vocabulary.
- **B1 (Intermediate)**: Basic independent user, limited range, noticeable errors but generally comprehensible, some hesitation, can handle familiar topics. REQUIRES: 45+ seconds with basic coherent expression.
- **A2 (Elementary)**: Basic user with simple language, frequent errors, limited vocabulary, significant hesitation, can handle very simple topics only. MAXIMUM for responses under 30 seconds regardless of quality.
- **A1 (Beginner)**: Very basic language use, many errors, very limited vocabulary and structures, frequent breakdowns, minimal communication ability.

**DUAL AUDIO DETECTION:**
Carefully analyze the audio for the presence of multiple distinct speakers or clear background voices:
- Listen for any voices other than the primary speaker
- Identify clear instances of other people speaking, not just background noise
- Flag conversations, prompting, or assistance from others
- Ignore minor background sounds, coughs, or unclear mumbling
- Set dual_audio_detected to true ONLY if there are clear, distinct additional voices

**Enhanced Assessment Guidelines:**
- Apply MAXIMUM STRICTNESS in scoring - err on the side of lower levels
- Response length MUST match the complexity expected for each CEFR level
- Consider the candidate's WEAKEST area as the determining factor for overall level
- Penalize heavily for: incomplete responses, lack of depth, repetitive language, excessive hesitation
- Reward only: sustained discourse, varied vocabulary, complex structures, clear argumentation
- Provide specific, actionable feedback with concrete examples from the recording
- Focus on both communication effectiveness AND linguistic accuracy

**REQUIRED OUTPUT FORMAT (JSON only):**
{
  "overall_cefr_level": "[A1/A2/B1/B2/C1/C2]",
  "detailed_analysis": "Comprehensive analysis of at least 100 characters covering vocabulary range and appropriateness, grammatical accuracy and complexity, pronunciation and intelligibility, fluency and natural speech patterns, coherence and organization of ideas.",
  "specific_strengths": "What the candidate does well in their spoken English performance.",
  "areas_for_improvement": "Concrete, actionable suggestions for language development.",
  "score_justification": "Clear explanation of why this specific CEFR level was assigned, referencing specific evidence from the recording and response length considerations.",
  "dual_audio_detected": false
}

IMPORTANT: Analyze the audio recording and provide a comprehensive, STRICTLY EVALUATED CEFR assessment with detailed, professional feedback. Be precise, evidence-based, and unforgiving in your evaluation standards.
`;

export async function assessAudioWithCEFR(audioUrl: string): Promise<CEFRAssessmentResult> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  console.log('🚀 Starting CEFR assessment for audio URL:', audioUrl);

  return await retryWithBackoff(async () => {
    try {
      console.log(`Starting assessment for audio URL: ${audioUrl}`);

      // Get audio data
      const { audioBase64, mimeType } = await getAudioData(audioUrl);
      
      console.log(`Audio data obtained, mime type: ${mimeType}, base64 length: ${audioBase64.length}`);

      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: CEFR_ASSESSMENT_PROMPT
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: audioBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 1,
          maxOutputTokens: 2048,
        }
      };

      console.log('Sending request to Gemini API...');
      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
        
        // Parse error response to get better error messages
        let errorMessage = `Gemini API error: ${response.status} ${response.statusText}`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.message) {
            errorMessage = errorData.error.message;
          }
        } catch (e) {
          // Use default error message if parsing fails
        }
        
        // Create specific error types for different scenarios
        if (response.status === 503) {
          throw new GeminiOverloadedError(errorMessage);
        } else if (response.status === 429) {
          throw new GeminiRateLimitError(errorMessage);
        } else if (response.status >= 500) {
          throw new GeminiServerError(errorMessage);
        } else {
          throw new GeminiClientError(errorMessage);
        }
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        console.error('Invalid response structure from Gemini API:', data);
        throw new Error('Invalid response from Gemini API');
      }

      const generatedText = data.candidates[0].content.parts[0].text;
      
      // Parse the JSON response
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('Could not extract JSON from Gemini response:', generatedText);
        throw new Error('Could not extract JSON from Gemini response');
      }

      const assessmentResult = JSON.parse(jsonMatch[0]);
      
      // Validate the response structure
      const requiredFields = ['overall_cefr_level', 'detailed_analysis', 'specific_strengths', 'areas_for_improvement', 'score_justification', 'dual_audio_detected'];
      for (const field of requiredFields) {
        // Special handling for dual_audio_detected which is boolean
        if (field === 'dual_audio_detected') {
          if (typeof assessmentResult[field] !== 'boolean') {
            console.warn(`dual_audio_detected field missing or invalid, defaulting to false`);
            assessmentResult[field] = false;
          }
        } else if (!assessmentResult[field] || typeof assessmentResult[field] !== 'string') {
          console.error(`Invalid assessment result: missing or invalid ${field}`, assessmentResult);
          throw new Error(`Invalid assessment result: missing or invalid ${field}`);
        }
      }

      // Validate CEFR level
      const validCEFRLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      if (!validCEFRLevels.includes(assessmentResult.overall_cefr_level)) {
        console.error(`Invalid CEFR level: ${assessmentResult.overall_cefr_level}`);
        throw new Error(`Invalid CEFR level: ${assessmentResult.overall_cefr_level}`);
      }

      console.log('✅ CEFR assessment completed successfully:', {
        level: assessmentResult.overall_cefr_level,
        hasAnalysis: !!assessmentResult.detailed_analysis,
        hasStrengths: !!assessmentResult.specific_strengths,
        hasImprovements: !!assessmentResult.areas_for_improvement,
        hasJustification: !!assessmentResult.score_justification
        hasJustification: !!assessmentResult.score_justification,
        dualAudioDetected: assessmentResult.dual_audio_detected
      });
      
      return assessmentResult;
      
    } catch (error) {
      console.error('Error assessing audio with CEFR:', error);
      throw error;
    }
  });
}

// Custom error classes for better error handling
class GeminiOverloadedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiOverloadedError';
  }
}

class GeminiRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiRateLimitError';
  }
}

class GeminiServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiServerError';
  }
}

class GeminiClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiClientError';
  }
}

// Retry function with exponential backoff
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on client errors (4xx) except rate limiting
      if (error instanceof GeminiClientError && !(error instanceof GeminiRateLimitError)) {
        throw error;
      }
      
      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff and jitter
      const baseDelay = Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_DELAY);
      const jitter = Math.random() * 0.1 * baseDelay; // Add up to 10% jitter
      const delay = baseDelay + jitter;
      
      console.log(`Gemini API attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

async function getAudioData(audioUrl: string): Promise<{ audioBase64: string; mimeType: string }> {
  console.log(`Getting audio data for URL: ${audioUrl}`);
  
  // Check if it's a Vocaroo link that needs conversion
  if (audioUrl.includes('voca.ro/') || audioUrl.includes('vocaroo.com/')) {
    console.log('Detected Vocaroo URL, converting to direct link...');
    return await getVocarooAudioDirect(audioUrl);
  }
  
  // For other URLs (like Google Drive), fetch directly
  console.log('Non-Vocaroo URL, fetching directly...');
  return await fetchAudioDirectly(audioUrl);
}

async function getVocarooAudioDirect(vocarooUrl: string): Promise<{ audioBase64: string; mimeType: string }> {
  try {
    console.log(`Converting Vocaroo URL to direct link: ${vocarooUrl}`);
    
    // Extract the recording ID from the Vocaroo URL
    const recordingId = extractVocarooId(vocarooUrl);
    if (!recordingId) {
      throw new Error('Could not extract recording ID from Vocaroo URL');
    }
    
    console.log(`Extracted recording ID: ${recordingId}`);
    
    // Try different direct URL patterns
    const possibleUrls = [
      `https://media1.vocaroo.com/mp3/${recordingId}`,
      `https://media.vocaroo.com/mp3/${recordingId}`,
      `https://media1.vocaroo.com/mp3/${recordingId}.mp3`,
      `https://media.vocaroo.com/mp3/${recordingId}.mp3`
    ];
    
    for (const directUrl of possibleUrls) {
      try {
        console.log(`Trying direct URL: ${directUrl}`);
        const result = await fetchAudioDirectly(directUrl);
        console.log(`Success with direct URL: ${directUrl}`);
        return result;
      } catch (error) {
        console.log(`Failed with ${directUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        continue;
      }
    }
    
    throw new Error('All direct URL attempts failed');

  } catch (error) {
    console.error('Error getting Vocaroo audio directly:', error);
    throw new Error(`Failed to get Vocaroo audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function extractVocarooId(url: string): string | null {
  // Handle both voca.ro and vocaroo.com formats
  const patterns = [
    /voca\.ro\/([a-zA-Z0-9]+)/,
    /vocaroo\.com\/([a-zA-Z0-9]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

async function fetchAudioDirectly(audioUrl: string): Promise<{ audioBase64: string; mimeType: string }> {
  try {
    console.log(`Fetching audio directly from: ${audioUrl}`);
    
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('audio/')) {
      throw new Error(`Expected audio file, but got: ${contentType}`);
    }

    const audioBlob = await response.blob();
    const audioBase64 = await blobToBase64(audioBlob);
    
    // Remove the data URL prefix if present
    const base64Data = audioBase64.split(',')[1] || audioBase64;
    
    return {
      audioBase64: base64Data,
      mimeType: contentType
    };

  } catch (error) {
    console.error('Error fetching audio directly:', error);
    throw new Error(`Failed to fetch audio directly: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function mapCEFRToGrade(cefrLevel: string): 'Red' | 'Amber' | 'Green' {
  switch (cefrLevel) {
    case 'C2':
    case 'C1':
      return 'Green';
    case 'B2':
    case 'B1':
      return 'Amber';
    case 'A2':
    case 'A1':
    default:
      return 'Red';
  }
}

// Keep the old function for backward compatibility with existing assessments
export function calculateOverallGrade(scores: Record<string, any>): 'Red' | 'Amber' | 'Green' {
  const competencyScores = [
    scores.clarity_articulation?.score || 0,
    scores.pace?.score || 0,
    scores.tone_modulation?.score || 0,
    scores.accent_neutrality?.score || 0,
    scores.confidence_energy?.score || 0,
    scores.grammar_fluency?.score || 0
  ];

  const averageScore = competencyScores.reduce((sum, score) => sum + score, 0) / competencyScores.length;

  if (averageScore >= 4) return 'Green';
  if (averageScore >= 3) return 'Amber';
  return 'Red';
}