export const runtime = 'nodejs'

import { getAgent } from '@/lib/agents'
import OpenAI from 'openai'

const openai = new OpenAI({
  baseURL: 'http://localhost:18789/v1',
  apiKey: process.env.OPENCLAW_GATEWAY_TOKEN,
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

  let body: { messages?: unknown; ticket?: unknown }
  try {
    body = await request.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { messages, ticket } = body as {
    messages: { role: 'user' | 'assistant'; content: string }[]
    ticket: {
      title: string
      description: string
      status: string
      priority: string
      assigneeRole: string | null
      workResult: string | null
    }
  }

  if (!Array.isArray(messages)) {
    return new Response(
      JSON.stringify({ error: 'messages must be an array' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Build system prompt with ticket context
  const workContext = ticket?.workResult
    ? `\n\nYou already completed work on this ticket. Here is what you produced:\n${ticket.workResult}\n\nReference this work when answering follow-up questions. Build on it, don't repeat it unless asked.`
    : ''

  const ticketContext = ticket
    ? `You are working on ticket: "${ticket.title}".
Description: ${ticket.description || 'No description provided.'}
Status: ${ticket.status}
Priority: ${ticket.priority}
Your role: ${ticket.assigneeRole || 'unassigned'}${workContext}

Help the user with this ticket. Stay in character as ${agent.name}, ${agent.title}. Be concise — 2-4 sentences unless detail is asked for. No em dashes.`
    : `You are ${agent.name}, ${agent.title}. Respond in character. Be concise. No em dashes.`

  const systemPrompt = agent.soul
    ? `${agent.soul}\n\n${ticketContext}`
    : ticketContext

  try {
    const stream = await openai.chat.completions.create({
      model: 'claude-sonnet-4-6',
      stream: true,
      messages: [
        { role: 'system' as const, content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ] as OpenAI.ChatCompletionMessageParam[],
    })

    const streamBody = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
              )
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err) {
          console.error('Kanban chat stream error:', err)
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
  } catch (err) {
    console.error('Kanban chat API error:', err)
    return new Response(
      JSON.stringify({ error: 'Chat failed. Make sure OpenClaw gateway is running.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
