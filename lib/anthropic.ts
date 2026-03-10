/**
 * Anthropic SDK integration for vision (image) messages.
 *
 * Replaces the previous OpenClaw CLI gateway approach with direct
 * Anthropic API calls using @anthropic-ai/sdk.
 *
 * Flow: extract images → Anthropic messages API with vision → return response
 */

import Anthropic from '@anthropic-ai/sdk'
import type { ApiMessage, ContentPart } from './validation'

export interface OpenClawAttachment {
  mimeType: string
  content: string // base64
}

/**
 * Check if any message in the array contains image_url content parts.
 */
export function hasImageContent(messages: ApiMessage[]): boolean {
  return messages.some(m => {
    if (typeof m.content === 'string') return false
    return (m.content as ContentPart[]).some(p => p.type === 'image_url')
  })
}

/**
 * Extract all image attachments from messages in OpenClaw's format:
 * { mimeType: "image/png", content: "<base64>" }
 */
export function extractImageAttachments(messages: ApiMessage[]): OpenClawAttachment[] {
  const attachments: OpenClawAttachment[] = []

  for (const msg of messages) {
    if (typeof msg.content === 'string') continue
    for (const part of msg.content as ContentPart[]) {
      if (part.type === 'image_url') {
        const { mediaType, data } = parseDataUrl(part.image_url.url)
        attachments.push({ mimeType: mediaType, content: data })
      }
    }
  }

  return attachments
}

/**
 * Build a text prompt from the system prompt and conversation messages.
 * Extracts text from content arrays, skips system messages and image parts.
 */
export function buildTextPrompt(systemPrompt: string, messages: ApiMessage[]): string {
  const parts: string[] = []

  if (systemPrompt) {
    parts.push(systemPrompt)
  }

  for (const msg of messages) {
    if (msg.role === 'system') continue

    let text: string
    if (typeof msg.content === 'string') {
      text = msg.content
    } else {
      text = (msg.content as ContentPart[])
        .filter(p => p.type === 'text')
        .map(p => p.text)
        .join('\n')
    }

    if (text) {
      parts.push(`${msg.role}: ${text}`)
    }
  }

  return parts.join('\n\n')
}

/**
 * Send a vision message directly to the Anthropic API.
 *
 * Builds a messages API request with image content blocks and returns
 * the assistant's response text, or null on failure.
 */
export async function sendViaOpenClaw(opts: {
  gatewayToken: string
  message: string
  attachments: OpenClawAttachment[]
  sessionKey?: string
  timeoutMs?: number
}): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('sendViaOpenClaw: ANTHROPIC_API_KEY is not set')
    return null
  }

  const client = new Anthropic({ apiKey })

  // Build content blocks: text prompt + image attachments
  const content: Anthropic.MessageCreateParams['messages'][0]['content'] = []

  if (opts.message) {
    content.push({ type: 'text', text: opts.message })
  }

  for (const attachment of opts.attachments) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: attachment.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: attachment.content,
      },
    })
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content }],
    })

    // Extract text from response content blocks
    const textBlocks = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)

    return textBlocks.join('\n') || null
  } catch (err) {
    console.error('sendViaOpenClaw error:', err)
    return null
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
