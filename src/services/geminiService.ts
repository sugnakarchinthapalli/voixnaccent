interface CompetencyScore {
  score: number;
  feedback: string;
}

interface GeminiAssessmentResult {
  clarity_articulation: CompetencyScore;
  pace: CompetencyScore;
  tone_modulation: CompetencyScore;
  accent_neutrality: CompetencyScore;
  confidence_energy: CompetencyScore;
  grammar_fluency: CompetencyScore;
  overall_feedback: string;
}

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const ASSESSMENT_PROMPT = `
You are an expert voice assessment AI. Analyze the provided audio and score it based on these 6 competencies using a 1-5 scale:

**Scoring Criteria:**
1. **Clarity & Articulation** (1-5):
   - 1: Speech unclear, heavy mumbling, excessive fillers
   - 2: Mostly unclear, frequent mumbling/fillers
   - 3: Fairly clear, occasional fillers but understandable
   - 4: Clear and articulate, minimal fillers
   - 5: Exceptionally clear, crisp pronunciation, no fillers

2. **Pace** (1-5):
   - 1: Very fast or slow, impacts comprehension significantly
   - 2: Often too fast or slow, listener needs effort to follow
   - 3: Generally appropriate, some rushed/sluggish segments
   - 4: Consistent and easy-to-follow pace
   - 5: Natural, professional pacing enhances clarity

3. **Tone & Modulation** (1-5):
   - 1: Monotonous or jarring, lacks emotion/inflection
   - 2: Minimal variation, mostly flat or mechanical
   - 3: Some modulation, attempts engagement but inconsistent
   - 4: Good tone variation, expressive and engaging
   - 5: Excellent modulation, dynamic and impactful

4. **Accent Neutrality** (1-5):
   - 1: Strong accent significantly affects understanding
   - 2: Noticeable accent, listener struggles at times
   - 3: Accent present but doesn't majorly affect comprehension
   - 4: Slight accent, easily understandable and neutral
   - 5: Completely neutral accent, universally understandable

5. **Confidence & Energy** (1-5):
   - 1: Lacks confidence, nervous or flat tone
   - 2: Some hesitation, low or inconsistent energy
   - 3: Average confidence, some ups and downs
   - 4: Confident and well-composed, good energy
   - 5: High energy, poised, commanding presence

6. **Grammar & Fluency** (1-5):
   - 1: Frequent errors, hard to understand, broken sentences
   - 2: Several errors affect fluency, unnatural phrasing
   - 3: Occasional grammar slips, overall understandable
   - 4: Mostly grammatically correct and fluent
   - 5: Flawless grammar and smooth, natural fluency

**Response Format (JSON only):**
{
  "clarity_articulation": {"score": X, "feedback": "Brief explanation"},
  "pace": {"score": X, "feedback": "Brief explanation"},
  "tone_modulation": {"score": X, "feedback": "Brief explanation"},
  "accent_neutrality": {"score": X, "feedback": "Brief explanation"},
  "confidence_energy": {"score": X, "feedback": "Brief explanation"},
  "grammar_fluency": {"score": X, "feedback": "Brief explanation"},
  "overall_feedback": "2-3 sentence summary of the assessment"
}

Analyze the audio and provide scores with brief, constructive feedback for each competency.
`;

export async function assessAudioWithGemini(audioUrl: string): Promise<GeminiAssessmentResult> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

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
              text: ASSESSMENT_PROMPT
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
        maxOutputTokens: 1024,
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
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
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
    const requiredFields = ['clarity_articulation', 'pace', 'tone_modulation', 'accent_neutrality', 'confidence_energy', 'grammar_fluency'];
    for (const field of requiredFields) {
      if (!assessmentResult[field] || typeof assessmentResult[field].score !== 'number') {
        console.error(`Invalid assessment result: missing or invalid ${field}`, assessmentResult);
        throw new Error(`Invalid assessment result: missing or invalid ${field}`);
      }
    }

    console.log('Assessment completed successfully');
    return assessmentResult;
    
  } catch (error) {
    console.error('Error assessing audio with Gemini:', error);
    throw error;
  }
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