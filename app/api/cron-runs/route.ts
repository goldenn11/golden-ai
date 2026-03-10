export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.NOTION_API_KEY
  const dbId = process.env.NOTION_CRON_RUNS_DB_ID

  if (!apiKey || !dbId) {
    return NextResponse.json([])
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
        page_size: 100,
        sorts: [{ property: 'Ran At', direction: 'descending' }],
      }),
    })

    if (!res.ok) return NextResponse.json([])

    const data = await res.json()

    const runs = data.results.map((page: {
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

    return NextResponse.json(runs)
  } catch (err) {
    console.error('cron-runs API error:', err instanceof Error ? err.message : err)
    return NextResponse.json([])
  }
}
