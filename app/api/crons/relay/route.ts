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

  const agent = await getAgent('relay')
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found: relay' }, { status: 404 })
  }

  const systemPrompt = agent.soul
    ? `${agent.soul}\n\nYou are running as a scheduled cron job. Execute your daily task autonomously.`
    : `You are ${agent.name}, ${agent.title}. ${agent.description}`

  const taskPrompt = `Run your daily onboarding status check.

Your tasks:
1. Review all active client onboarding checklists and their completion status
2. Check each setup track: VAPI configuration, Make.com scenarios, GHL integration, dashboard deployment
3. Identify blockers: any step that has been pending for more than 48 hours
4. Flag clients whose onboarding is behind schedule or stalled
5. Note any dependencies between setup tracks that could create bottlenecks
6. Produce a Daily Onboarding Report with per-client progress and blocker alerts

Output your Daily Onboarding Report in markdown format. Use progress indicators (percentage or checklist) for each client.`

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
    logCronRun({ jobId: 'relay', jobName: 'RELAY', status: 'ok', durationMs, summary: content.slice(0, 500) })

    return NextResponse.json({
      agent: 'relay',
      status: 'ok',
      usage: message.usage,
      result: content,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    const durationMs = Date.now() - startTime
    logCronRun({ jobId: 'relay', jobName: 'RELAY', status: 'error', durationMs, error: errMsg })
    console.error('Cron relay error:', errMsg)
    return NextResponse.json(
      { agent: 'relay', status: 'error', error: errMsg },
      { status: 500 }
    )
  }
}
