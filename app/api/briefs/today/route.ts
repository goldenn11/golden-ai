export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.NOTION_API_KEY
  const dbId = process.env.NOTION_DAILY_BRIEFS_DB_ID

  if (!apiKey || !dbId) {
    return NextResponse.json(
      { error: 'NOTION_API_KEY and NOTION_DAILY_BRIEFS_DB_ID must be set' },
      { status: 500 }
    )
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
        page_size: 1,
        filter: {
          property: 'Status',
          select: { equals: 'published' },
        },
        sorts: [{ property: 'Date', direction: 'descending' }],
      }),
    })

    if (!res.ok) {
      const errorBody = await res.text()
      console.error('Notion API error:', res.status, errorBody)
      return NextResponse.json({ error: `Notion API error (${res.status})` }, { status: res.status })
    }

    const data = await res.json()

    if (!data.results || data.results.length === 0) {
      return NextResponse.json({ brief: null })
    }

    const page = data.results[0]
    const props = page.properties as Record<string, {
      title?: { plain_text: string }[]
      rich_text?: { plain_text: string }[]
      date?: { start: string } | null
      select?: { name: string } | null
    }>

    const title = props['Title']?.title?.map(t => t.plain_text).join('') || ''
    const date = props['Date']?.date?.start || null
    const summary = props['Summary']?.rich_text?.map(t => t.plain_text).join('') || ''
    const highlightsRaw = props['Highlights']?.rich_text?.map(t => t.plain_text).join('') || ''
    const focus = props['Focus']?.rich_text?.map(t => t.plain_text).join('') || ''

    // Highlights are stored as newline-separated text
    const highlights = highlightsRaw.split('\n').filter(h => h.trim())

    return NextResponse.json({
      brief: { title, date, summary, highlights, focus },
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('briefs/today error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
