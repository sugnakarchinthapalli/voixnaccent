// Import the interface from types
import type { CEFRAssessmentResult } from '../types';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;

// Retry configuration
const MAX_RETRIES = 5; // Increased retries for better reliability
const BASE_DELAY = 1000; // 1 second - faster initial retry
const MAX_DELAY = 20000; // 20 seconds - reduced max delay

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
You are an expert multilingual language assessment AI specializing in evaluating spoken language using the CEFR (Common European Framework of Reference for Languages) framework. You can assess ANY language, not just English. Analyze the provided audio recording and assess the speaker's proficiency level based on the CEFR Qualitative Aspects of Spoken Language Use.

**AUDIO VALIDATION (CRITICAL FIRST STEP):**
Before proceeding with any assessment:
- Verify that clear, audible human speech is present in the recording
- If NO SPEECH is detected or audio is inaudible/corrupted, immediately return:
  - overall_cefr_level: "A1"
  - Include in detailed_analysis: "No audible speech detected in the provided audio recording. Assessment cannot be performed."
  - Set dual_audio_detected: false
- Only proceed with full assessment if clear human speech is confirmed

**CASE STUDY CONTEXT EVALUATION:**
When assessing candidates, you will be provided with specific case studies and questions. Evaluate whether the candidate's responses demonstrate:
- **Contextual Understanding**: Did they address the specific case study elements?
- **Content Accuracy**: Are their answers factually correct based on the provided information?
- **Question Relevance**: Did they directly answer what was asked?

**CASE STUDY REFERENCE MATERIALS:**
Case Study: Apex Media & FinSmart Finance Brand Awareness Trial on Spotify
The Client & Agency
Agency: Apex Media, a full-service media agency, led by Managing Director Elias Vance.
Client: FinSmart, a new finance brand providing advice on superannuation and debt reduction.
Goal: Drive brand awareness and reach in major Australian capital cities.
The Challenge
FinSmart needed to run a trial campaign for a niche audience but had two major constraints:
Niche Audience: Individuals aged 45–60 nearing retirement with an interest in finance and business.
No Creative: FinSmart was a startup and lacked any audio ad assets for the proposed $2,000–$5,000 trial budget.
The Solution (Spotify Ads Manager)
Anya Sharma (Spotify specialist) guided Apex Media on using the self-serve platform:
Free Creative: Solved the asset issue by offering free audio ad production with a 24–48 hour turnaround; FinSmart only needed to provide a script.
Targeting: Demonstrated using comprehensive controls for the niche audience (45–60, Australian capitals, finance/business interest), confirming the ability to target across music and podcasts.
Account Setup: Apex Media successfully created an agency MCC (My Client Center) account for efficient management of FinSmart and future small clients.
Planning: Showed how the platform provides estimated results and benchmark CPMs instantly based on targeting selections, aiding Apex Media's budget proposals.
Outcome
Apex Media gained the necessary tools and support (free creative, niche targeting, agency management structure) to move forward with proposing the low-budget, high-value brand awareness trial to FinSmart.

1. What was the most significant challenge FinSmart (the client) faced regarding its creative assets, and how did Anya Sharma (Spotify) solve this immediately?

2. What is the primary marketing objective for FinSmart's campaign, and what are the two core elements of their target audience (Age & Interest)?

3. What would you do differently in order to provide a solution to the client?

**LANGUAGE IDENTIFICATION:**
- Automatically identify the language being spoken
- Apply CEFR criteria appropriate to that specific language's linguistic features
- Consider language-specific characteristics (e.g., tonal languages, grammatical complexity, phonetic systems)
- Note the identified language in your assessment

**BALANCED EVALUATION REQUIREMENTS:**
- Apply RIGOROUS but FAIR criteria for each CEFR level
- A response should demonstrate STRONG performance across competency areas to achieve a level
- Consider response length as ONE factor among many, not the primary determinant
- Quality and complexity of language use should outweigh pure duration
- Allow for natural variation in response styles and speaking preferences

**Assessment Framework:**
Use the CEFR Qualitative Aspects of Spoken Language Use which evaluates:
- **Range**: Vocabulary breadth and grammatical structures used
- **Accuracy**: Grammatical and lexical precision
- **Fluency**: Rhythm, pace, and hesitation patterns
- **Interaction**: Turn-taking and conversational management (adapt for monologue)
- **Coherence**: Logical organization and linking of ideas

**CEFR Scoring Criteria (BALANCED APPLICATION):**

**C2 (Mastery)**: Near-native proficiency with sophisticated language use, virtually no errors, effortless expression of complex/abstract concepts, extensive precise vocabulary, perfect coherence and natural flow.
- EVIDENCE REQUIRED: Complex grammatical structures, sophisticated vocabulary, nuanced expression, minimal errors

**C1 (Proficiency)**: Advanced level with varied complex language structures, rare minor errors that don't affect communication, excellent fluency with natural rhythm, handles abstract/complex topics confidently.
- EVIDENCE REQUIRED: Advanced structures, wide vocabulary range, clear argumentation, good coherence

**B2 (Upper-Intermediate)**: Independent user with good grammatical and lexical range, occasional errors that don't impede understanding, generally fluent with some hesitation, can express opinions clearly and develop arguments.
- EVIDENCE REQUIRED: Varied vocabulary, complex sentences, clear viewpoints, mostly accurate grammar

**B1 (Intermediate)**: Independent user with adequate range for familiar topics, noticeable errors but meaning is clear, some hesitation and reformulation, can maintain conversation on familiar subjects.
- EVIDENCE REQUIRED: Basic complex structures, adequate vocabulary for topics, understandable despite errors

**A2 (Elementary)**: Basic user with simple language patterns, frequent basic errors, limited vocabulary, noticeable hesitation, can handle routine exchanges and simple topics.
- EVIDENCE REQUIRED: Simple sentences, basic vocabulary, frequent pauses, basic communication achieved

**A1 (Beginner)**: Very basic language use with memorized phrases, many fundamental errors, very limited vocabulary, frequent communication breakdown, relies on simple words and gestures.
- EVIDENCE REQUIRED: Isolated words/phrases, basic errors, minimal coherent communication

**DUAL AUDIO DETECTION:**
Listen carefully for multiple speakers:
- Detect any voices other than the primary speaker
- Identify clear instances of conversation, prompting, or assistance
- Distinguish between background noise and actual speech
- Set dual_audio_detected to true ONLY for clear additional human voices
- Ignore ambient sounds, electronic interference, or unclear background audio

**Assessment Guidelines:**
- **FAIR CALIBRATION**: Match established CEFR standards without over-penalizing
- **HOLISTIC EVALUATION**: Consider overall communicative effectiveness alongside accuracy
- **CONTEXTUAL JUDGMENT**: Account for topic difficulty and speaking task requirements
- **EVIDENCE-BASED**: Reference specific examples from the audio
- **CONSTRUCTIVE FEEDBACK**: Provide actionable improvement suggestions
- **CONSISTENCY**: Apply standards uniformly across all languages and speakers

**Length Considerations:**
- Short responses (under 30 seconds): Can still achieve B2+ if demonstrating clear complexity and accuracy
- Medium responses (30-60 seconds): Standard evaluation applies
- Longer responses (60+ seconds): Consider sustained performance and consistency
- Focus on QUALITY of language use rather than quantity of speech

**REQUIRED OUTPUT FORMAT (JSON only):**
{
  "overall_cefr_level": "[A1/A2/B1/B2/C1/C2]",
  "detailed_analysis": "Comprehensive analysis covering: vocabulary range and appropriateness, grammatical accuracy and complexity, pronunciation and intelligibility, fluency and natural speech patterns, coherence and organization of ideas. Include 1-2 bullet points summarizing whether the candidate answered the case study questions correctly and in context. Minimum 150 characters with specific examples from the recording.",
  "specific_strengths": "What the candidate demonstrates well in their spoken language performance, with concrete examples. If the language is identified as Japanese, where does the speaker stand in the standard JLPT levels (N5 to N1)?, for other languages, relate to CEFR levels.",
  "areas_for_improvement": "Specific, actionable suggestions for language development based on observed weaknesses.",
  "score_justification": "Clear explanation of why this specific CEFR level was assigned, referencing specific linguistic evidence from the recording and addressing key competency areas.",
  "dual_audio_detected": false
}

**IMPORTANT REMINDERS:**
- First verify audio contains speech - if not, assign A1 and explain
- Identify the language being assessed
- Apply CEFR standards appropriately but not excessively strict
- Focus on communicative competence AND linguistic accuracy
- Provide specific, evidence-based feedback
- Consider the speaker's strongest demonstrated abilities while noting areas needing development
- Evaluate contextual understanding and accuracy of responses to case study questions `;

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
          maxOutputTokens: 4096,
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

      console.log('Raw Gemini response:', generatedText.substring(0, 500) + '...');

      // Parse the JSON response - handle both plain JSON and markdown-wrapped JSON
      let jsonString = '';

      // First try to extract JSON from markdown code blocks
      const markdownJsonMatch = generatedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (markdownJsonMatch) {
        jsonString = markdownJsonMatch[1].trim();
        console.log('Extracted JSON from markdown code block');
      } else {
        // Fall back to extracting plain JSON
        const plainJsonMatch = generatedText.match(/\{[\s\S]*\}/);
        if (plainJsonMatch) {
          jsonString = plainJsonMatch[0];
          console.log('Extracted plain JSON from response');
        }
      }

      if (!jsonString) {
        console.error('Could not extract JSON from Gemini response:', generatedText.substring(0, 1000));
        throw new Error('Could not extract JSON from Gemini response');
      }

      console.log('Extracted JSON string length:', jsonString.length);
      console.log('JSON string preview:', jsonString.substring(0, 200) + '...');

      let assessmentResult;
      try {
        assessmentResult = JSON.parse(jsonString);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Failed to parse JSON string:', jsonString.substring(0, 500));

        // Check if the JSON was truncated (incomplete)
        if (!jsonString.trim().endsWith('}')) {
          console.error('JSON appears to be truncated - response was likely cut off due to token limit');
          throw new Error('Gemini response was truncated - JSON incomplete. Try with shorter prompt or higher token limit.');
        }

        throw new Error(`Could not parse JSON from Gemini response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

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
      const baseDelay = Math.min(BASE_DELAY * Math.pow(1.5, attempt), MAX_DELAY); // Gentler backoff
      const jitter = Math.random() * 0.2 * baseDelay; // Add up to 20% jitter for better distribution
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
