import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAgent } from '@/lib/agents'
import { logCronRun } from '@/lib/cron-logger'

export const runtime = 'nodejs'
export const maxDuration = 300

const SYSTEM_PROMPT = `You are PULSE, the daily briefing agent for Golden AI Solutions.
Every morning you produce a concise, actionable brief for Zach Golden.
Zach runs an AI automation consultancy (VAPI + Make.com + GHL) targeting home restoration companies in Phoenix.
He is also an active closer for Deal Scout Elite — a $5,000 real estate education offer.
Keep briefs direct and specific. Surface what matters, skip what doesn't.
Respond with JSON only — no markdown, no preamble:
{
  "summary": "2-3 sentence overview of where things stand",
  "highlights": ["highlight 1", "highlight 2", "highlight 3"],
  "focus": "The single most important thing to do today"
}`

/**
 * Fetch call reviews from the last 7 days from Notion.
 */
async function fetchRecentCallReviews(): Promise<{ outcome: string | null; contractValue: number | null; objection: string | null }[]> {
  const apiKey = process.env.NOTION_API_KEY
  const dbId = process.env.NOTION_CALL_REVIEWS_DB_ID
  if (!apiKey || !dbId) return []

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page_size: 50,
        filter: {
          property: 'Date',
          date: { on_or_after: sevenDaysAgo.toISOString().split('T')[0] },
        },
        sorts: [{ property: 'Date', direction: 'descending' }],
      }),
    })

    if (!res.ok) return []
    const data = await res.json()

    return data.results.map((page: { properties: Record<string, { select?: { name: string } | null; number?: number | null }> }) => {
      const props = page.properties
      return {
        outcome: props['Outcome']?.select?.name ?? null,
        contractValue: props['Contract Value']?.number ?? null,
        objection: props['Objection']?.select?.name ?? null,
      }
    })
  } catch {
    return []
  }
}

/**
 * Fetch the last 5 cron run records from Notion.
 */
async function fetchRecentCronRuns(): Promise<{ jobId: string; status: string; error: string | null }[]> {
  const apiKey = process.env.NOTION_API_KEY
  const dbId = process.env.NOTION_CRON_RUNS_DB_ID
  if (!apiKey || !dbId) return []

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page_size: 5,
        sorts: [{ property: 'Ran At', direction: 'descending' }],
      }),
    })

    if (!res.ok) return []
    const data = await res.json()

    return data.results.map((page: { properties: Record<string, { title?: { plain_text: string }[]; select?: { name: string } | null; rich_text?: { plain_text: string }[] }> }) => {
      const props = page.properties
      return {
        jobId: props['Job ID']?.title?.map((t: { plain_text: string }) => t.plain_text).join('') || '',
        status: props['Status']?.select?.name ?? 'unknown',
        error: props['Error']?.rich_text?.map((t: { plain_text: string }) => t.plain_text).join('') || null,
      }
    })
  } catch {
    return []
  }
}

/**
 * Write a brief to the Notion Daily Briefs database.
 */
async function writeBriefToNotion(brief: { summary: string; highlights: string[]; focus: string }): Promise<void> {
  const apiKey = process.env.NOTION_API_KEY
  const dbId = process.env.NOTION_DAILY_BRIEFS_DB_ID
  if (!apiKey || !dbId) return

  const today = new Date().toISOString().split('T')[0]

  const properties: Record<string, unknown> = {
    'Title': { title: [{ text: { content: `Brief - ${today}` } }] },
    'Date': { date: { start: today } },
    'Summary': { rich_text: [{ text: { content: brief.summary.slice(0, 2000) } }] },
    'Highlights': { rich_text: [{ text: { content: brief.highlights.join('\n').slice(0, 2000) } }] },
    'Focus': { rich_text: [{ text: { content: brief.focus.slice(0, 2000) } }] },
    'Status': { select: { name: 'published' } },
  }

  await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ parent: { database_id: dbId }, properties }),
  })
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const agent = await getAgent('pulse')
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found: pulse' }, { status: 404 })
  }

  const startTime = Date.now()

  try {
    // Gather context data in parallel
    const [callReviews, cronRuns] = await Promise.all([
      fetchRecentCallReviews(),
      fetchRecentCronRuns(),
    ])

    const now = new Date()
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayOfWeek = days[now.getUTCDay()]
    const todayStr = now.toISOString().split('T')[0]

    // Build user message with real data
    let userMessage = `Today is ${dayOfWeek}, ${todayStr}.\n\n`

    // Call review data
    if (callReviews.length > 0) {
      userMessage += `CALL REVIEWS (last 7 days): ${callReviews.length} calls\n`
      const sales = callReviews.filter(r => r.outcome === 'sale')
      const totalValue = sales.reduce((sum, r) => sum + (r.contractValue ?? 0), 0)
      userMessage += `- Sales: ${sales.length} of ${callReviews.length}\n`
      if (totalValue > 0) userMessage += `- Total contract value: $${totalValue.toLocaleString()}\n`
      const objections = callReviews.filter(r => r.objection).map(r => r.objection)
      if (objections.length > 0) {
        const uniqueObjections = [...new Set(objections)]
        userMessage += `- Objections encountered: ${uniqueObjections.join(', ')}\n`
      }
    } else {
      userMessage += 'CALL REVIEWS (last 7 days): No call review data available.\n'
    }

    userMessage += '\n'

    // Cron run data
    if (cronRuns.length > 0) {
      const errors = cronRuns.filter(r => r.status === 'error')
      userMessage += `CRON RUNS (last 5): ${cronRuns.length} runs\n`
      if (errors.length > 0) {
        userMessage += `- ERRORS: ${errors.length} failed\n`
        for (const e of errors) {
          userMessage += `  - ${e.jobId}: ${e.error || 'Unknown error'}\n`
        }
      } else {
        userMessage += '- All recent cron runs successful\n'
      }
    } else {
      userMessage += 'CRON RUNS: No recent cron run data available.\n'
    }

    userMessage += '\nProduce today\'s brief.'

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const content = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')

    // Parse the JSON response
    const brief = JSON.parse(content) as {
      summary: string
      highlights: string[]
      focus: string
    }

    // Write to Notion (fire and forget)
    writeBriefToNotion(brief).catch((err) => {
      console.error('pulse: failed to write brief to Notion:', err instanceof Error ? err.message : err)
    })

    const durationMs = Date.now() - startTime
    logCronRun({ jobId: 'pulse', jobName: 'PULSE', status: 'ok', durationMs, summary: brief.summary.slice(0, 500) })

    return NextResponse.json({
      agent: 'pulse',
      status: 'ok',
      usage: message.usage,
      brief,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    const durationMs = Date.now() - startTime
    logCronRun({ jobId: 'pulse', jobName: 'PULSE', status: 'error', durationMs, error: errMsg })
    console.error('Cron pulse error:', errMsg)
    return NextResponse.json(
      { agent: 'pulse', status: 'error', error: errMsg },
      { status: 500 }
    )
  }
}
