import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { logCronRun } from '@/lib/cron-logger'

export const runtime = 'nodejs'
export const maxDuration = 300

const SYSTEM_PROMPT = `You are HERALD, the LinkedIn Content Director for Golden AI Solutions.
Golden AI sells VAPI voice agents + Make.com automation to home restoration companies in Phoenix.
The ICP is restoration company owners with 2-50 employees losing jobs to missed calls.
The primary CTA for all content is the free audit at goldenaiaudit.com.
Zach's voice: direct, specific, no buzzwords, talks in real numbers not vague claims.
Never use: "leverage", "synergy", "game-changer", em dashes.
Best performing content: specific numbers, real scenarios, missed call math.

Content pillars:
- 40% Educational (teach them about the missed call problem)
- 25% Social Proof (results, data, benchmarks)
- 25% Product Awareness (what the AI does, demos)
- 10% Culture (building Golden AI, Zach's story)

Weekly cadence: 7 posts. Mix of TOF/MOF/BOF.
Lead magnet CTA: "comment AUDIT and I'll send you the calculator"

Given the ECHO community scan data provided, produce a weekly content brief.
Respond with JSON only — no markdown, no preamble:
{
  "theme": "one sentence unifying theme for the week",
  "lead_magnet": "which lead magnet to push and why",
  "posts": [
    {
      "day": "Monday",
      "funnel_stage": "TOF",
      "pillar": "Educational",
      "angle": "specific post angle in one sentence",
      "hook": "opening line — 4-10 words max",
      "key_stat": "the number or fact that anchors this post",
      "cta": "exact CTA for this post"
    }
  ]
}`

interface EchoScan {
  subreddit: string
  verbatimQuotes: string
  painThemes: string
  contentAngles: string
}

interface PostBrief {
  day: string
  funnel_stage: string
  pillar: string
  angle: string
  hook: string
  key_stat: string
  cta: string
}

interface HeraldBrief {
  theme: string
  lead_magnet: string
  posts: PostBrief[]
}

/**
 * Fetch the most recent 4 ECHO community scans from Notion.
 */
async function fetchEchoScans(): Promise<EchoScan[]> {
  const apiKey = process.env.NOTION_API_KEY
  const dbId = process.env.NOTION_COMMUNITY_SCANS_DB_ID
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
        page_size: 4,
        filter: { property: 'Status', select: { equals: 'published' } },
        sorts: [{ property: 'Date', direction: 'descending' }],
      }),
    })

    if (!res.ok) return []
    const data = await res.json()

    return data.results.map((page: {
      properties: Record<string, {
        rich_text?: { plain_text: string }[]
      }>
    }) => {
      const props = page.properties
      const rt = (key: string) => props[key]?.rich_text?.map(t => t.plain_text).join('') || ''
      return {
        subreddit: rt('Subreddit'),
        verbatimQuotes: rt('Verbatim Quotes'),
        painThemes: rt('Pain Themes'),
        contentAngles: rt('Content Angles'),
      }
    })
  } catch {
    return []
  }
}

/**
 * Fetch the most recent Content Brief to avoid repeating angles.
 */
async function fetchLastBrief(): Promise<string | null> {
  const apiKey = process.env.NOTION_API_KEY
  const dbId = process.env.NOTION_CONTENT_BRIEFS_DB_ID
  if (!apiKey || !dbId) return null

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page_size: 1,
        filter: { property: 'Status', select: { equals: 'published' } },
        sorts: [{ property: 'Date', direction: 'descending' }],
      }),
    })

    if (!res.ok) return null
    const data = await res.json()
    if (!data.results?.length) return null

    const props = data.results[0].properties as Record<string, {
      rich_text?: { plain_text: string }[]
    }>
    const rt = (key: string) => props[key]?.rich_text?.map(t => t.plain_text).join('') || ''

    const parts = ['Theme: ' + rt('Theme')]
    for (let i = 1; i <= 7; i++) {
      const post = rt(`Post ${i}`)
      if (post) parts.push(`Post ${i}: ${post}`)
    }
    return parts.join('\n')
  } catch {
    return null
  }
}

/**
 * Write the content brief to Notion.
 */
async function writeBriefToNotion(brief: HeraldBrief, today: string): Promise<void> {
  const apiKey = process.env.NOTION_API_KEY
  const dbId = process.env.NOTION_CONTENT_BRIEFS_DB_ID
  if (!apiKey || !dbId) return

  // Compute week-of date (next Monday)
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek)
  const nextMonday = new Date(now)
  nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday)
  const weekOf = nextMonday.toISOString().split('T')[0]

  const properties: Record<string, unknown> = {
    'Title': { title: [{ text: { content: `Content Brief - ${today}` } }] },
    'Date': { date: { start: today } },
    'Week Of': { rich_text: [{ text: { content: weekOf } }] },
    'Theme': { rich_text: [{ text: { content: brief.theme.slice(0, 2000) } }] },
    'Lead Magnet': { rich_text: [{ text: { content: brief.lead_magnet.slice(0, 2000) } }] },
    'Status': { select: { name: 'published' } },
  }

  // Map posts to Post 1-7 fields
  for (let i = 0; i < Math.min(brief.posts.length, 7); i++) {
    const post = brief.posts[i]
    const text = [
      `${post.day} | ${post.funnel_stage} | ${post.pillar}`,
      `Angle: ${post.angle}`,
      `Hook: "${post.hook}"`,
      `Key stat: ${post.key_stat}`,
      `CTA: ${post.cta}`,
    ].join('\n')
    properties[`Post ${i + 1}`] = { rich_text: [{ text: { content: text.slice(0, 2000) } }] }
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

  const startTime = Date.now()

  try {
    // Gather context data in parallel
    const [echoScans, lastBrief] = await Promise.all([
      fetchEchoScans(),
      fetchLastBrief(),
    ])

    const now = new Date()
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayOfWeek = days[now.getUTCDay()]
    const today = now.toISOString().split('T')[0]

    // Build user message
    let userMessage = `Today is ${dayOfWeek}, ${today}.\n\n`

    // ECHO scan data
    if (echoScans.length > 0) {
      userMessage += 'ECHO COMMUNITY SCANS (recent ICP intelligence):\n\n'
      for (const scan of echoScans) {
        userMessage += `--- ${scan.subreddit} ---\n`
        if (scan.verbatimQuotes) userMessage += `Verbatim quotes:\n${scan.verbatimQuotes}\n`
        if (scan.painThemes) userMessage += `Pain themes: ${scan.painThemes}\n`
        if (scan.contentAngles) userMessage += `Content angles: ${scan.contentAngles}\n`
        userMessage += '\n'
      }
    } else {
      userMessage += 'ECHO COMMUNITY SCANS: No scan data available yet. Use your knowledge of the ICP (restoration company owners, missed calls, speed-to-lead) to plan content.\n\n'
    }

    // Last week's brief to avoid repetition
    if (lastBrief) {
      userMessage += `LAST WEEK'S BRIEF (do not repeat these angles):\n${lastBrief}\n\n`
    }

    userMessage += 'Produce this week\'s content brief with 7 posts.'

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const content = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('HERALD did not return valid JSON')
    }
    const brief = JSON.parse(jsonMatch[0]) as HeraldBrief

    // Write to Notion
    await writeBriefToNotion(brief, today).catch((err) => {
      console.error('herald: failed to write brief to Notion:', err instanceof Error ? err.message : err)
    })

    const durationMs = Date.now() - startTime
    const summary = `Theme: ${brief.theme}. ${brief.posts.length} posts planned.`
    logCronRun({ jobId: 'herald', jobName: 'HERALD', status: 'ok', durationMs, summary: summary.slice(0, 500) })

    return NextResponse.json({
      agent: 'herald',
      status: 'ok',
      usage: message.usage,
      brief,
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
