export const runtime = 'nodejs'

import { getAgent } from '@/lib/agents'
import { validateChatMessages } from '@/lib/validation'
import { hasImageContent, extractImageAttachments, buildTextPrompt, sendViaOpenClaw } from '@/lib/anthropic'
import Anthropic from '@anthropic-ai/sdk'
import type { ContentPart } from '@/lib/validation'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const agent = await getAgent(id)

  if (!agent) {
    return new Response(JSON.stringify({ error: 'Agent not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const result = validateChatMessages(body)
  if (!result.ok) {
    return new Response(
      JSON.stringify({ error: result.error }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { messages } = result

  const rawBody = body as Record<string, unknown>
  const operatorName = typeof rawBody.operatorName === 'string' ? rawBody.operatorName : 'Operator'

  const systemPrompt = agent.soul
    ? `${agent.soul}\n\nYou are speaking directly with ${operatorName}, your operator. Stay fully in character. Be concise — this is a live chat. 2-4 sentences unless detail is asked for. No em dashes.`
    : `You are ${agent.name}, ${agent.title}. Respond in character. Be concise. No em dashes.`

  // When the LATEST user message contains images, use the vision pipeline.
  // Only check the last message — older messages with images should not
  // force all future messages through this path.
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
  const latestHasImages = lastUserMsg ? hasImageContent([lastUserMsg]) : false

  if (latestHasImages) {
    const attachments = extractImageAttachments([lastUserMsg!])
    const textPrompt = buildTextPrompt(systemPrompt, messages)

    const response = await sendViaOpenClaw({
      gatewayToken: process.env.ANTHROPIC_API_KEY || '',
      message: textPrompt,
      attachments,
    })

    // Return as a non-streaming SSE response (complete text at once)
    const encoder = new TextEncoder()
    const content = response || 'I had trouble processing that image. Could you try again or describe what you see?'
    const streamBody = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    return new Response(streamBody, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }

  try {
    // Convert messages to Anthropic format: filter out system messages,
    // convert content arrays from OpenAI format to Anthropic format
    const anthropicMessages: Anthropic.MessageParam[] = messages
      .filter(m => m.role !== 'system')
      .map(m => {
        if (typeof m.content === 'string') {
          return { role: m.role as 'user' | 'assistant', content: m.content }
        }

        // Convert content parts from OpenAI format to Anthropic format
        const parts = (m.content as ContentPart[]).map(part => {
          if (part.type === 'text') {
            return { type: 'text' as const, text: part.text }
          }
          // image_url parts — convert to Anthropic base64 image blocks
          const { mediaType, data } = parseDataUrl(part.image_url.url)
          return {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data,
            },
          }
        })

        return { role: m.role as 'user' | 'assistant', content: parts }
      })

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: anthropicMessages,
    })

    const streamBody = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const content = event.delta.text
              if (content) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                )
              }
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err) {
          console.error('Stream error:', err)
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(streamBody, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err: unknown) {
    console.error('Chat API error:', err)

    let userMessage = 'Chat failed. Make sure ANTHROPIC_API_KEY is set correctly.'
    if (err instanceof Anthropic.APIError) {
      userMessage = `Anthropic API error (${err.status}): ${err.message}`
    }

    return new Response(
      JSON.stringify({ error: userMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

function parseDataUrl(url: string): { mediaType: string; data: string } {
  if (!url.startsWith('data:')) {
    return { mediaType: 'image/png', data: url }
  }

  const commaIdx = url.indexOf(',')
  if (commaIdx === -1) {
    return { mediaType: 'image/png', data: url }
  }

  const header = url.slice(5, commaIdx)
  const data = url.slice(commaIdx + 1)
  const mediaType = header.split(';')[0] || 'image/png'

  return { mediaType, data }
}
