import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface VocarooRequest {
  vocarooUrl: string;
}

interface VocarooResponse {
  success: boolean;
  audioBase64?: string;
  mimeType?: string;
  error?: string;
  details?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Vocaroo proxy function called')
    
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { vocarooUrl }: VocarooRequest = await req.json()
    
    if (!vocarooUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'vocarooUrl is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Processing Vocaroo URL: ${vocarooUrl}`)

    // Extract and fetch audio
    const result = await extractAndFetchVocarooAudio(vocarooUrl)
    
    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error in vocaroo-proxy:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function extractAndFetchVocarooAudio(vocarooUrl: string): Promise<VocarooResponse> {
  try {
    // Normalize the URL
    let normalizedUrl = normalizeVocarooUrl(vocarooUrl)
    console.log(`Normalized URL: ${normalizedUrl}`)

    // Add delay before first request
    await delay(1000)

    // Step 1: Fetch the HTML page
    console.log('Fetching Vocaroo HTML page...')
    const htmlResponse = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      }
    })

    if (!htmlResponse.ok) {
      throw new Error(`Failed to fetch Vocaroo page: ${htmlResponse.status} ${htmlResponse.statusText}`)
    }

    const html = await htmlResponse.text()
    console.log(`HTML fetched successfully, length: ${html.length}`)

    // Add delay before processing
    await delay(500)

    // Step 2: Extract direct audio URL
    const directAudioUrl = extractDirectAudioUrl(html, normalizedUrl)
    console.log(`Direct audio URL extracted: ${directAudioUrl}`)

    // Add delay before audio fetch
    await delay(1000)

    // Step 3: Fetch the audio file
    console.log('Fetching audio file...')
    const audioResponse = await fetch(directAudioUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Referer': normalizedUrl,
        'Sec-Fetch-Dest': 'audio',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'same-site',
        'Range': 'bytes=0-'
      }
    })

    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio file: ${audioResponse.status} ${audioResponse.statusText}`)
    }

    const contentType = audioResponse.headers.get('content-type')
    console.log(`Audio content type: ${contentType}`)

    if (!contentType || !contentType.startsWith('audio/')) {
      throw new Error(`Expected audio file, but got: ${contentType}`)
    }

    // Step 4: Convert to base64
    const audioArrayBuffer = await audioResponse.arrayBuffer()
    const audioBase64 = arrayBufferToBase64(audioArrayBuffer)
    
    console.log(`Audio converted to base64, length: ${audioBase64.length}`)

    return {
      success: true,
      audioBase64,
      mimeType: contentType
    }

  } catch (error) {
    console.error('Error in extractAndFetchVocarooAudio:', error)
    return {
      success: false,
      error: 'Failed to extract audio from Vocaroo',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

function normalizeVocarooUrl(url: string): string {
  let normalized = url.trim()
  
  // Convert voca.ro to vocaroo.com format
  if (normalized.includes('voca.ro/')) {
    const match = normalized.match(/voca\.ro\/([a-zA-Z0-9]+)/)
    if (match && match[1]) {
      normalized = `https://vocaroo.com/${match[1]}`
    }
  }
  
  // Ensure it starts with https://
  if (!normalized.startsWith('http')) {
    normalized = `https://${normalized}`
  }
  
  return normalized
}

function extractDirectAudioUrl(html: string, originalUrl: string): string {
  console.log('Extracting direct audio URL from HTML...')
  
  // Multiple patterns to try
  const patterns = [
    // Pattern 1: Look for media URLs in script tags
    /https:\/\/media\d*\.vocaroo\.com\/mp3\/[a-zA-Z0-9]+/g,
    // Pattern 2: Look for audio src attributes
    /src=["']([^"']*media\d*\.vocaroo\.com[^"']*\.mp3[^"']*)["']/g,
    // Pattern 3: Look for playback URLs in JavaScript
    /playbackUrl["']?\s*:\s*["']([^"']*media\d*\.vocaroo\.com[^"']*\.mp3[^"']*)["']/g,
    // Pattern 4: Look for any media.vocaroo.com URLs
    /["']([^"']*media\d*\.vocaroo\.com[^"']*\.mp3[^"']*)["']/g,
    // Pattern 5: Look for direct MP3 URLs
    /https:\/\/media\d*\.vocaroo\.com\/mp3\/[a-zA-Z0-9]+\.mp3/g
  ]
  
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i]
    const matches = html.match(pattern)
    
    if (matches && matches.length > 0) {
      console.log(`Pattern ${i + 1} found ${matches.length} matches`)
      
      for (const match of matches) {
        // Clean up the URL
        let directUrl = match
          .replace(/["']/g, '')
          .replace(/src=/, '')
          .replace(/playbackUrl\s*:\s*/, '')
        
        // Ensure it starts with https://
        if (!directUrl.startsWith('http')) {
          directUrl = `https://${directUrl}`
        }
        
        console.log(`Extracted potential URL: ${directUrl}`)
        
        // Test the URL before returning it
        if (await testAudioUrl(directUrl, originalUrl)) {
          return directUrl
        }
      }
    }
  }
  
  // Fallback: construct URL from original URL ID
  const idMatch = originalUrl.match(/vocaroo\.com\/([a-zA-Z0-9]+)/)
  if (idMatch && idMatch[1]) {
    const recordingId = idMatch[1]
    
    // Try multiple media server variations
    const possibleUrls = [
      `https://media1.vocaroo.com/mp3/${recordingId}`,
      `https://media.vocaroo.com/mp3/${recordingId}`,
      `https://media1.vocaroo.com/mp3/${recordingId}.mp3`,
      `https://media.vocaroo.com/mp3/${recordingId}.mp3`
    ]
    
    for (const url of possibleUrls) {
      console.log(`Testing fallback URL: ${url}`)
      if (await testAudioUrl(url, originalUrl)) {
        return url
      }
    }
  }
  
  throw new Error('Could not extract direct audio URL from HTML')
}

async function testAudioUrl(audioUrl: string, refererUrl: string): Promise<boolean> {
  try {
    console.log(`Testing audio URL: ${audioUrl}`)
    
    const response = await fetch(audioUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Referer': refererUrl,
        'Sec-Fetch-Dest': 'audio',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'same-site'
      }
    })
    
    if (response.ok) {
      const contentType = response.headers.get('content-type')
      const isAudio = contentType && contentType.startsWith('audio/')
      console.log(`URL test result: ${response.status}, Content-Type: ${contentType}, Is Audio: ${isAudio}`)
      return isAudio || false
    }
    
    console.log(`URL test failed: ${response.status} ${response.statusText}`)
    return false
    
  } catch (error) {
    console.log(`URL test error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return false
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}