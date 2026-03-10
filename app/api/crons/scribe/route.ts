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

  const agent = await getAgent('scribe')
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found: scribe' }, { status: 404 })
  }

  const systemPrompt = agent.soul
    ? `${agent.soul}\n\nYou are running as a scheduled cron job. Execute your weekly task autonomously.`
    : `You are ${agent.name}, ${agent.title}. ${agent.description}`

  const taskPrompt = `It is Monday morning. Run your weekly memory compression cycle.

Your tasks:
1. Review all memory files and daily logs from the past week
2. Identify key patterns, decisions, and insights worth preserving
3. Compress redundant or outdated entries into concise summaries
4. Flag any stale memories that should be archived or removed
5. Produce a brief compression report: what was kept, what was compressed, what was flagged

Output your compression report in markdown format.`

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
    logCronRun({ jobId: 'scribe', jobName: 'SCRIBE', status: 'ok', durationMs, summary: content.slice(0, 500) })

    return NextResponse.json({
      agent: 'scribe',
      status: 'ok',
      usage: message.usage,
      result: content,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    const durationMs = Date.now() - startTime
    logCronRun({ jobId: 'scribe', jobName: 'SCRIBE', status: 'error', durationMs, error: errMsg })
    console.error('Cron scribe error:', errMsg)
    return NextResponse.json(
      { agent: 'scribe', status: 'error', error: errMsg },
      { status: 500 }
    )
  }
}
