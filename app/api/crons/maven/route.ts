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

  const agent = await getAgent('maven')
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found: maven' }, { status: 404 })
  }

  const systemPrompt = agent.soul
    ? `${agent.soul}\n\nYou are running as a scheduled cron job. Execute your weekly task autonomously.`
    : `You are ${agent.name}, ${agent.title}. ${agent.description}`

  const taskPrompt = `It is Monday morning. Produce the weekly LinkedIn content strategy and calendar.

Your tasks:
1. Analyze last week's content performance themes (what resonated, what fell flat)
2. Review PULSE's trend signals and ECHO's community voice data for this week's opportunities
3. Plan 5 LinkedIn posts for the week with specific publish days (Mon-Fri)
4. For each post: topic, format (story/insight/how-to/contrarian/case study), target audience segment, key message
5. Ensure strategic variety: mix educational, thought leadership, and engagement-driven posts
6. Identify 2-3 strategic comment opportunities on high-visibility posts in the AI/automation space
7. Produce a Weekly LinkedIn Calendar with day-by-day content plan

Output your Weekly LinkedIn Calendar in markdown format with a clear day-by-day schedule.`

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
    logCronRun({ jobId: 'maven', jobName: 'MAVEN', status: 'ok', durationMs, summary: content.slice(0, 500) })

    return NextResponse.json({
      agent: 'maven',
      status: 'ok',
      usage: message.usage,
      result: content,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    const durationMs = Date.now() - startTime
    logCronRun({ jobId: 'maven', jobName: 'MAVEN', status: 'error', durationMs, error: errMsg })
    console.error('Cron maven error:', errMsg)
    return NextResponse.json(
      { agent: 'maven', status: 'error', error: errMsg },
      { status: 500 }
    )
  }
}
