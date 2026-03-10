export const runtime = 'nodejs'

export async function POST(request: Request) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Expected multipart form data' }, { status: 400 })
  }

  const audioFile = formData.get('audio')
  if (!audioFile || !(audioFile instanceof File)) {
    return Response.json({ error: 'Missing audio file' }, { status: 400 })
  }

  // Use OpenAI-compatible Whisper API if OPENAI_API_KEY is set
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    return Response.json(
      { error: 'Transcription not available. Set OPENAI_API_KEY in .env.local for Whisper support.' },
      { status: 503 }
    )
  }

  try {
    const body = new FormData()
    body.append('file', audioFile)
    body.append('model', 'whisper-1')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
      },
      body,
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Whisper API error:', response.status, errText)
      return Response.json(
        { error: `Transcription failed (${response.status})` },
        { status: 502 }
      )
    }

    const result = await response.json()
    return Response.json({ text: result.text })
  } catch (err) {
    console.error('Transcription error:', err)
    return Response.json(
      { error: 'Transcription failed. Check OPENAI_API_KEY configuration.' },
      { status: 500 }
    )
  }
}
