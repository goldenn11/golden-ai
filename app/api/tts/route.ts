export const runtime = 'nodejs'

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || ''

// Default ElevenLabs voice IDs
const VOICE_MAP: Record<string, string> = {
  alloy: 'pNInz6obpgDQGcFmaJgB',    // Adam
  echo: 'VR6AewLTigWG4xSOukaG',      // Arnold
  fable: 'jBpfuIE2acCO8z3wKNLl',     // Callum
  nova: 'ThT5KcBeYPX3keUQqHPh',      // Dorothy
  shimmer: 'AZnzlk1XvdvUeBnXmlld',   // Domi
  onyx: 'yoZ06aMxZJJ28mfd3POQ',      // Sam
}

export async function POST(request: Request) {
  if (!ELEVENLABS_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'TTS not available. Set ELEVENLABS_API_KEY in .env.local.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    const { text, voice } = await request.json()

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid "text" field' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const voiceId = VOICE_MAP[voice || 'alloy'] || VOICE_MAP.alloy

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('ElevenLabs TTS error:', response.status, errText)
      return new Response(
        JSON.stringify({ error: `TTS failed (${response.status})` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    return new Response(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    console.error('TTS API error:', err)
    return new Response(
      JSON.stringify({ error: 'TTS failed. Check ELEVENLABS_API_KEY configuration.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
