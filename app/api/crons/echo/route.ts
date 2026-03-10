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

  const agent = await getAgent('echo')
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found: echo' }, { status: 404 })
  }

  const systemPrompt = agent.soul
    ? `${agent.soul}\n\nYou are running as a scheduled cron job. Execute your weekly task autonomously.`
    : `You are ${agent.name}, ${agent.title}. ${agent.description}`

  const taskPrompt = `It is Sunday morning. Run your weekly community voice scan.

Your tasks:
1. Identify the top ICP subreddits and communities to monitor (AI automation, SMB operations, agency owners, SaaS founders)
2. Extract verbatim customer language — exact phrases, pain points, and desires people use when discussing their problems
3. Note recurring themes, emerging frustrations, and unmet needs
4. Categorize findings by topic: pain points, desired outcomes, objections, buying signals
5. Produce a Community Voice Brief with direct quotes and trend analysis

Output your Community Voice Brief in markdown format. Use exact quotes where possible.`

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
    logCronRun({ jobId: 'echo', jobName: 'ECHO', status: 'ok', durationMs, summary: content.slice(0, 500) })

    return NextResponse.json({
      agent: 'echo',
      status: 'ok',
      usage: message.usage,
      result: content,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    const durationMs = Date.now() - startTime
    logCronRun({ jobId: 'echo', jobName: 'ECHO', status: 'error', durationMs, error: errMsg })
    console.error('Cron echo error:', errMsg)
    return NextResponse.json(
      { agent: 'echo', status: 'error', error: errMsg },
      { status: 500 }
    )
  }
}
