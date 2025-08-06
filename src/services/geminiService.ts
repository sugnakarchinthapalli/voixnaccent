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
    // Process the audio URL to get the direct link
    const directAudioUrl = await getDirectAudioUrl(audioUrl);
    
    // Fetch the audio file using the direct URL
    const audioResponse = await fetch(directAudioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio from ${directAudioUrl}: ${audioResponse.statusText}`);
    }

    const audioBlob = await audioResponse.blob();
    
    // Validate that we got an audio file
    if (!audioBlob.type.startsWith('audio/')) {
      throw new Error(`Expected audio file, but got: ${audioBlob.type}`);
    }
    
    const audioBase64 = await blobToBase64(audioBlob);
    
    // Remove the data URL prefix if present
    const base64Data = audioBase64.split(',')[1] || audioBase64;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: ASSESSMENT_PROMPT
            },
            {
              inline_data: {
                mime_type: audioBlob.type,
                data: base64Data
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

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response from Gemini API');
    }

    const generatedText = data.candidates[0].content.parts[0].text;
    
    // Parse the JSON response
    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from Gemini response');
    }

    const assessmentResult = JSON.parse(jsonMatch[0]);
    
    // Validate the response structure
    const requiredFields = ['clarity_articulation', 'pace', 'tone_modulation', 'accent_neutrality', 'confidence_energy', 'grammar_fluency'];
    for (const field of requiredFields) {
      if (!assessmentResult[field] || typeof assessmentResult[field].score !== 'number') {
        throw new Error(`Invalid assessment result: missing or invalid ${field}`);
      }
    }

    return assessmentResult;
    
  } catch (error) {
    console.error('Error assessing audio with Gemini:', error);
    throw error;
  }
}

async function getDirectAudioUrl(audioUrl: string): Promise<string> {
  // Check if it's a voca.ro link that needs processing
  if (audioUrl.includes('voca.ro/') || audioUrl.includes('vocaroo.com/')) {
    return await extractVocarooDirectLink(audioUrl);
  }
  
  // For other URLs (like Google Drive), return as-is or process accordingly
  return audioUrl;
}

async function extractVocarooDirectLink(vocarooUrl: string): Promise<string> {
  try {
    console.log(`Extracting direct link from: ${vocarooUrl}`);
    
    // Normalize the URL to ensure it's in the correct format
    let normalizedUrl = vocarooUrl.trim();
    
    // Convert voca.ro to vocaroo.com format for consistency
    if (normalizedUrl.includes('voca.ro/')) {
      const match = normalizedUrl.match(/voca\.ro\/([a-zA-Z0-9]+)/);
      if (match && match[1]) {
        normalizedUrl = `https://vocaroo.com/${match[1]}`;
      }
    }
    
    // Ensure it starts with https://
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    
    console.log(`Fetching HTML from: ${normalizedUrl}`);
    
    // Fetch the HTML page
    const response = await fetch(normalizedUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch Vocaroo page: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    console.log('HTML fetched successfully, extracting audio URL...');
    
    // Try multiple patterns to extract the direct audio URL
    const patterns = [
      // Pattern 1: Look for media URLs in script tags
      /https:\/\/media\d*\.vocaroo\.com\/mp3\/[a-zA-Z0-9]+/g,
      // Pattern 2: Look for audio src attributes
      /src=["']([^"']*media\d*\.vocaroo\.com[^"']*\.mp3[^"']*)["']/g,
      // Pattern 3: Look for playback URLs in JavaScript
      /playbackUrl["']?\s*:\s*["']([^"']*media\d*\.vocaroo\.com[^"']*\.mp3[^"']*)["']/g,
      // Pattern 4: Look for any media.vocaroo.com URLs
      /["']([^"']*media\d*\.vocaroo\.com[^"']*\.mp3[^"']*)["']/g
    ];
    
    for (const pattern of patterns) {
      const matches = html.match(pattern);
      if (matches && matches.length > 0) {
        // Extract the URL from the match
        let directUrl = matches[0];
        
        // Clean up the URL if it has quotes or other characters
        directUrl = directUrl.replace(/["']/g, '');
        directUrl = directUrl.replace(/src=/, '');
        directUrl = directUrl.replace(/playbackUrl\s*:\s*/, '');
        
        // Ensure it starts with https://
        if (!directUrl.startsWith('http')) {
          directUrl = `https://${directUrl}`;
        }
        
        console.log(`Direct audio URL extracted: ${directUrl}`);
        return directUrl;
      }
    }
    
    // If no direct URL found, try to construct it from the ID
    const idMatch = normalizedUrl.match(/vocaroo\.com\/([a-zA-Z0-9]+)/);
    if (idMatch && idMatch[1]) {
      const recordingId = idMatch[1];
      // Try common media server patterns
      const possibleUrls = [
        `https://media1.vocaroo.com/mp3/${recordingId}`,
        `https://media.vocaroo.com/mp3/${recordingId}`,
        `https://media1.vocaroo.com/mp3/${recordingId}.mp3`,
        `https://media.vocaroo.com/mp3/${recordingId}.mp3`
      ];
      
      // Test each URL to see which one works
      for (const testUrl of possibleUrls) {
        try {
          const testResponse = await fetch(testUrl, { method: 'HEAD' });
          if (testResponse.ok && testResponse.headers.get('content-type')?.startsWith('audio/')) {
            console.log(`Direct audio URL found via testing: ${testUrl}`);
            return testUrl;
          }
        } catch (e) {
          // Continue to next URL
        }
      }
    }
    
    throw new Error('Could not extract direct audio URL from Vocaroo page');
    
  } catch (error) {
    console.error('Error extracting Vocaroo direct link:', error);
    throw new Error(`Failed to extract direct audio link from Vocaroo: ${error instanceof Error ? error.message : 'Unknown error'}`);
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