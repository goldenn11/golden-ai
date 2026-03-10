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

  const agent = await getAgent('ledger')
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found: ledger' }, { status: 404 })
  }

  const systemPrompt = agent.soul
    ? `${agent.soul}\n\nYou are running as a scheduled cron job. Execute your daily task autonomously.`
    : `You are ${agent.name}, ${agent.title}. ${agent.description}`

  const taskPrompt = `Run your daily client account health check.

Your tasks:
1. Review all active client retainers and their current status
2. Check for upcoming renewal dates within the next 14 days and flag them
3. Identify at-risk accounts based on engagement signals (low activity, missed check-ins, unresolved issues)
4. Flag any accounts with overdue deliverables or stalled onboarding
5. Calculate account health scores: healthy, watch, at-risk
6. Produce a Daily Account Pulse with status updates, renewal alerts, and risk flags

Output your Daily Account Pulse in markdown format. Lead with urgent items (renewals, at-risk) then healthy accounts.`

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
    logCronRun({ jobId: 'ledger', jobName: 'LEDGER', status: 'ok', durationMs, summary: content.slice(0, 500) })

    return NextResponse.json({
      agent: 'ledger',
      status: 'ok',
      usage: message.usage,
      result: content,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    const durationMs = Date.now() - startTime
    logCronRun({ jobId: 'ledger', jobName: 'LEDGER', status: 'error', durationMs, error: errMsg })
    console.error('Cron ledger error:', errMsg)
    return NextResponse.json(
      { agent: 'ledger', status: 'error', error: errMsg },
      { status: 500 }
    )
  }
}
