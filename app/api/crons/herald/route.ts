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

  const agent = await getAgent('herald')
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found: herald' }, { status: 404 })
  }

  const systemPrompt = agent.soul
    ? `${agent.soul}\n\nYou are running as a scheduled cron job. Execute your daily task autonomously.`
    : `You are ${agent.name}, ${agent.title}. ${agent.description}`

  const taskPrompt = `Run your daily LinkedIn content pipeline.

Your tasks:
1. Review PULSE's latest trend signals for today's hot topics in AI, automation, and business operations
2. Pick 1-2 angles that would resonate with Golden AI's LinkedIn audience (SMB owners, agency operators, AI-curious executives)
3. For each angle, draft a content brief for QUILL: hook line, key message, target emotion, CTA direction
4. Ensure variety in post format rotation (story, insight, contrarian take, case study, how-to)
5. Flag any trending conversations worth commenting on or reacting to
6. Produce a Daily LinkedIn Brief with content briefs and engagement opportunities

Output your Daily LinkedIn Brief in markdown format. Keep briefs concise so QUILL can expand them.`

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
    logCronRun({ jobId: 'herald', jobName: 'HERALD', status: 'ok', durationMs, summary: content.slice(0, 500) })

    return NextResponse.json({
      agent: 'herald',
      status: 'ok',
      usage: message.usage,
      result: content,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    const durationMs = Date.now() - startTime
    logCronRun({ jobId: 'herald', jobName: 'HERALD', status: 'error', durationMs, error: errMsg })
    console.error('Cron herald error:', errMsg)
    return NextResponse.json(
      { agent: 'herald', status: 'error', error: errMsg },
      { status: 500 }
    )
  }
}
