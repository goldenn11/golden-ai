export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

interface CronRunEntry {
  id: string
  jobId: string
  jobName: string
  status: string
  durationMs: number | null
  ranAt: string
  error: string | null
  summary: string | null
}

export async function GET() {
  const apiKey = process.env.NOTION_API_KEY
  const dbId = process.env.NOTION_CRON_RUNS_DB_ID

  if (!apiKey || !dbId) {
    return NextResponse.json({
      entries: [],
      summary: { totalEntries: 0, errorCount: 0 },
    })
  }

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
        sorts: [{ property: 'Ran At', direction: 'descending' }],
      }),
    })

    if (!res.ok) {
      return NextResponse.json({
        entries: [],
        summary: { totalEntries: 0, errorCount: 0 },
      })
    }

    const data = await res.json()

    const entries: CronRunEntry[] = data.results.map((page: {
      id: string
      created_time: string
      properties: Record<string, {
        title?: { plain_text: string }[]
        rich_text?: { plain_text: string }[]
        select?: { name: string } | null
        number?: number | null
        date?: { start: string } | null
      }>
    }) => {
      const props = page.properties
      return {
        id: page.id,
        jobId: props['Job ID']?.title?.map(t => t.plain_text).join('') || '',
        jobName: props['Job Name']?.rich_text?.map(t => t.plain_text).join('') || '',
        status: props['Status']?.select?.name ?? 'unknown',
        durationMs: props['Duration Ms']?.number ?? null,
        ranAt: props['Ran At']?.date?.start ?? page.created_time,
        error: props['Error']?.rich_text?.map(t => t.plain_text).join('') || null,
        summary: props['Summary']?.rich_text?.map(t => t.plain_text).join('') || null,
      }
    })

    const errorCount = entries.filter(e => e.status === 'error').length

    return NextResponse.json({
      entries,
      summary: { totalEntries: entries.length, errorCount },
    })
  } catch (err) {
    console.error('logs API error:', err instanceof Error ? err.message : err)
    return NextResponse.json({
      entries: [],
      summary: { totalEntries: 0, errorCount: 0 },
    })
  }
}
