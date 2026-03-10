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

  const agent = await getAgent('lumen')
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found: lumen' }, { status: 404 })
  }

  const systemPrompt = agent.soul
    ? `${agent.soul}\n\nYou are running as a scheduled cron job. Execute your weekly task autonomously.`
    : `You are ${agent.name}, ${agent.title}. ${agent.description}`

  const taskPrompt = `It is Monday morning. Run your weekly SEO content pipeline kickoff.

Your tasks:
1. Review PULSE's latest trend signals and ECHO's community voice brief for content opportunities
2. Identify 3-5 high-priority keyword targets for this week based on search volume, competition, and ICP relevance
3. For each target, outline the content angle, target keyword cluster, and estimated search intent
4. Assign pipeline stages: which topics go to SCOUT for research, which go directly to STRATEGIST for angle selection
5. Flag any existing content that needs updating or refreshing based on performance data
6. Produce a Weekly SEO Sprint Plan with prioritized content assignments

Output your Weekly SEO Sprint Plan in markdown format. Include keyword targets, content angles, and pipeline assignments.`

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
    logCronRun({ jobId: 'lumen', jobName: 'LUMEN', status: 'ok', durationMs, summary: content.slice(0, 500) })

    return NextResponse.json({
      agent: 'lumen',
      status: 'ok',
      usage: message.usage,
      result: content,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    const durationMs = Date.now() - startTime
    logCronRun({ jobId: 'lumen', jobName: 'LUMEN', status: 'error', durationMs, error: errMsg })
    console.error('Cron lumen error:', errMsg)
    return NextResponse.json(
      { agent: 'lumen', status: 'error', error: errMsg },
      { status: 500 }
    )
  }
}
