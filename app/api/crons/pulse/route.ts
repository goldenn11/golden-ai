import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAgent } from '@/lib/agents'
import { logCronRun } from '@/lib/cron-logger'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const agent = await getAgent('pulse')
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found: pulse' }, { status: 404 })
  }

  const systemPrompt = agent.soul
    ? `${agent.soul}\n\nYou are running as a scheduled cron job. Execute your daily task autonomously.`
    : `You are ${agent.name}, ${agent.title}. ${agent.description}`

  const taskPrompt = `Run your daily trend radar scan.

Your tasks:
1. Identify the hottest trending topics in AI, automation, and business technology from the last 24 hours
2. Flag signals relevant to Golden AI's ICP: SMB owners, agency operators, and teams adopting AI automation
3. Score each signal by relevance (high/medium/low) and urgency (act now / watch / background)
4. Identify content angles that LUMEN's SEO team or HERALD's LinkedIn pipeline could use today
5. Produce a Daily Trend Brief with ranked signals and recommended actions

Output your Daily Trend Brief in markdown format. Keep it scannable — bullet points and short descriptions.`

  const startTime = Date.now()

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: taskPrompt }],
    })

    const content = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')

    const durationMs = Date.now() - startTime
    logCronRun({ jobId: 'pulse', jobName: 'Pulse', status: 'ok', durationMs, summary: content.slice(0, 500) })

    return NextResponse.json({
      agent: 'pulse',
      status: 'ok',
      usage: message.usage,
      result: content,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    const durationMs = Date.now() - startTime
    logCronRun({ jobId: 'pulse', jobName: 'Pulse', status: 'error', durationMs, error: errMsg })
    console.error('Cron pulse error:', errMsg)
    return NextResponse.json(
      { agent: 'pulse', status: 'error', error: errMsg },
      { status: 500 }
    )
  }
}
