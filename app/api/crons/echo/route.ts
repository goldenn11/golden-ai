import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { logCronRun } from '@/lib/cron-logger'

export const runtime = 'nodejs'
export const maxDuration = 300

const SYSTEM_PROMPT = `You are ECHO, the Community Voice Monitor for Golden AI Solutions.
Golden AI sells VAPI voice agents + Make.com automation to home restoration companies.
The ICP is restoration company owners with 2-50 employees who are losing jobs to missed calls.
Your job: scan the target subreddits and extract intelligence that helps with content and sales.
Use web_search to find recent posts and comments in these subreddits about:
- Missed calls, phone coverage, after-hours calls
- Losing jobs to competitors, slow response times
- Hiring receptionists or admin staff
- Being too busy, overwhelmed, can't keep up
- AI tools, automation, phone systems

For each subreddit return a JSON object:
{
  "subreddit": "r/Contractor",
  "verbatim_quotes": ["exact quote 1", "exact quote 2", "exact quote 3"],
  "pain_themes": ["theme 1", "theme 2"],
  "content_angles": ["LinkedIn post idea 1", "LinkedIn post idea 2"]
}
Respond with a JSON array of these objects. No markdown, no preamble.`

const SUBREDDITS = ['r/Contractor', 'r/HomeImprovement', 'r/smallbusiness', 'r/restoration']

interface ScanResult {
  subreddit: string
  verbatim_quotes: string[]
  pain_themes: string[]
  content_angles: string[]
}

/**
 * Write one Notion row per subreddit scan result.
 */
async function writeScanToNotion(scan: ScanResult, today: string): Promise<void> {
  const apiKey = process.env.NOTION_API_KEY
  const dbId = process.env.NOTION_COMMUNITY_SCANS_DB_ID
  if (!apiKey || !dbId) return

  const properties: Record<string, unknown> = {
    'Title': { title: [{ text: { content: `ECHO - ${today} - ${scan.subreddit}` } }] },
    'Date': { date: { start: today } },
    'Subreddit': { rich_text: [{ text: { content: scan.subreddit } }] },
    'Verbatim Quotes': { rich_text: [{ text: { content: scan.verbatim_quotes.join('\n').slice(0, 2000) } }] },
    'Pain Themes': { rich_text: [{ text: { content: scan.pain_themes.join('\n').slice(0, 2000) } }] },
    'Content Angles': { rich_text: [{ text: { content: scan.content_angles.join('\n').slice(0, 2000) } }] },
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

  const startTime = Date.now()

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const userMessage = `Scan these subreddits for recent posts and comments relevant to our ICP: ${SUBREDDITS.join(', ')}. Today's date is ${new Date().toISOString().split('T')[0]}. Search each subreddit individually for recent discussions about missed calls, phone coverage, hiring receptionists, being overwhelmed, losing jobs to faster competitors, and AI/automation tools for service businesses.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 10 }],
      messages: [{ role: 'user', content: userMessage }],
    })

    // Extract the final text content from the response (after tool use)
    const textBlocks = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')

    // If the model needed more turns for tool use, run a continuation loop
    let finalText = textBlocks
    let currentMessage = message

    while (currentMessage.stop_reason === 'tool_use') {
      // Collect tool results
      const toolUseBlocks = currentMessage.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      )

      // For web_search, the SDK handles results automatically via server-side tool use
      // If stop_reason is tool_use, we need to continue the conversation
      const toolResults = toolUseBlocks.map((block) => ({
        type: 'tool_result' as const,
        tool_use_id: block.id,
        content: 'Continue with the search results you found.',
      }))

      currentMessage = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 10 }],
        messages: [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: message.content },
          { role: 'user', content: toolResults },
        ],
      })

      const newText = currentMessage.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n')

      if (newText) finalText = newText
    }

    // Parse the JSON response - find the JSON array in the text
    let scans: ScanResult[] = []
    const jsonMatch = finalText.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      scans = JSON.parse(jsonMatch[0]) as ScanResult[]
    }

    // Write each scan result to Notion
    const today = new Date().toISOString().split('T')[0]
    const writePromises = scans.map((scan) =>
      writeScanToNotion(scan, today).catch((err) => {
        console.error(`echo: failed to write ${scan.subreddit} to Notion:`, err instanceof Error ? err.message : err)
      })
    )
    await Promise.all(writePromises)

    const totalQuotes = scans.reduce((sum, s) => sum + s.verbatim_quotes.length, 0)
    const summary = `Scanned ${scans.length} subreddits, extracted ${totalQuotes} verbatim quotes`

    const durationMs = Date.now() - startTime
    logCronRun({ jobId: 'echo', jobName: 'ECHO', status: 'ok', durationMs, summary })

    return NextResponse.json({
      agent: 'echo',
      status: 'ok',
      usage: message.usage,
      scansWritten: scans.length,
      totalQuotes,
      scans,
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
