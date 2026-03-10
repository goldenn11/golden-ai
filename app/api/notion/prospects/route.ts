export const runtime = 'nodejs'

import { NextResponse } from 'next/server'

interface NotionRichText {
  plain_text: string
}

interface NotionProperty {
  type: string
  title?: NotionRichText[]
  rich_text?: NotionRichText[]
  select?: { name: string } | null
  date?: { start: string; end: string | null } | null
  url?: string | null
}

function extractTitle(prop: NotionProperty | undefined): string | null {
  if (!prop?.title) return null
  return prop.title.map(t => t.plain_text).join('') || null
}

function extractRichText(prop: NotionProperty | undefined): string | null {
  if (!prop?.rich_text) return null
  return prop.rich_text.map(t => t.plain_text).join('') || null
}

function extractSelect(prop: NotionProperty | undefined): string | null {
  if (!prop?.select) return null
  return prop.select.name
}

function extractDate(prop: NotionProperty | undefined): string | null {
  if (!prop?.date) return null
  return prop.date.start
}

function extractUrl(prop: NotionProperty | undefined): string | null {
  if (!prop?.url) return null
  return prop.url
}

export async function GET() {
  const apiKey = process.env.NOTION_API_KEY
  const dbId = process.env.NOTION_PROSPECTS_DB_ID

  if (!apiKey || !dbId) {
    return NextResponse.json(
      { error: 'NOTION_API_KEY and NOTION_PROSPECTS_DB_ID must be set' },
      { status: 500 }
    )
  }

  try {
    const results: {
      id: string
      name: string
      company: string | null
      title: string | null
      location: string | null
      linkedinUrl: string | null
      researchBrief: string | null
      dmText: string | null
      status: string | null
      dateAdded: string | null
    }[] = []

    let hasMore = true
    let startCursor: string | undefined

    while (hasMore) {
      const body: Record<string, unknown> = {
        page_size: 100,
        sorts: [{ property: 'Date Added', direction: 'descending' }],
      }
      if (startCursor) body.start_cursor = startCursor

      const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorBody = await res.text()
        console.error('Notion API error:', res.status, errorBody)
        return NextResponse.json(
          { error: `Notion API error (${res.status})` },
          { status: res.status }
        )
      }

      const data = await res.json()

      for (const page of data.results) {
        const props = page.properties as Record<string, NotionProperty>

        results.push({
          id: page.id,
          name: extractTitle(props['Name']) || 'Untitled',
          company: extractRichText(props['Company']),
          title: extractRichText(props['Title']),
          location: extractRichText(props['Location']),
          linkedinUrl: extractUrl(props['LinkedIn URL']),
          researchBrief: extractRichText(props['Research Brief']),
          dmText: extractRichText(props['DM Text']),
          status: extractSelect(props['Status']),
          dateAdded: extractDate(props['Date Added']),
        })
      }

      hasMore = data.has_more
      startCursor = data.next_cursor
    }

    return NextResponse.json({ prospects: results })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Notion prospects error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
