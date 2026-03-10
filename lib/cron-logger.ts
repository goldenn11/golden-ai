/**
 * Fire-and-forget logger that writes cron run results to a Notion database.
 * Never throws, never blocks the cron response.
 */

interface CronRunLog {
  jobId: string
  jobName: string
  status: 'ok' | 'error'
  durationMs: number
  summary?: string | null
  error?: string | null
}

/**
 * Log a cron run to the Notion "Cron Runs" database.
 * Silently no-ops if env vars are missing or the request fails.
 */
export function logCronRun(run: CronRunLog): void {
  const apiKey = process.env.NOTION_API_KEY
  const dbId = process.env.NOTION_CRON_RUNS_DB_ID

  if (!apiKey || !dbId) return

  const properties: Record<string, unknown> = {
    'Job ID': { title: [{ text: { content: run.jobId } }] },
    'Job Name': { rich_text: [{ text: { content: run.jobName } }] },
    'Status': { select: { name: run.status } },
    'Duration Ms': { number: run.durationMs },
    'Ran At': { date: { start: new Date().toISOString() } },
  }

  if (run.summary) {
    // Notion rich_text limit is 2000 chars
    properties['Summary'] = { rich_text: [{ text: { content: run.summary.slice(0, 2000) } }] }
  }

  if (run.error) {
    properties['Error'] = { rich_text: [{ text: { content: run.error.slice(0, 2000) } }] }
  }

  fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ parent: { database_id: dbId }, properties }),
  }).catch((err) => {
    console.error('cron-logger: failed to write to Notion:', err instanceof Error ? err.message : err)
  })
}

/**
 * Fetch recent cron runs from Notion, grouped by job ID.
 * Returns a map of jobId -> { lastRun, lastStatus, lastDurationMs, lastError, consecutiveErrors }.
 */
export async function fetchCronRunHistory(): Promise<Map<string, {
  lastRun: string
  lastStatus: 'ok' | 'error'
  lastDurationMs: number | null
  lastError: string | null
  consecutiveErrors: number
}>> {
  const result = new Map<string, {
    lastRun: string
    lastStatus: 'ok' | 'error'
    lastDurationMs: number | null
    lastError: string | null
    consecutiveErrors: number
  }>()

  const apiKey = process.env.NOTION_API_KEY
  const dbId = process.env.NOTION_CRON_RUNS_DB_ID

  if (!apiKey || !dbId) return result

  try {
    // Fetch recent runs sorted by Ran At descending
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

    if (!res.ok) return result

    const data = await res.json()

    // Track consecutive errors per job: once we see an 'ok' for a job, stop counting
    const seenOk = new Set<string>()

    for (const page of data.results) {
      const props = page.properties as Record<string, {
        title?: { plain_text: string }[]
        rich_text?: { plain_text: string }[]
        select?: { name: string } | null
        number?: number | null
        date?: { start: string } | null
      }>

      const jobId = props['Job ID']?.title?.map(t => t.plain_text).join('') || ''
      if (!jobId) continue

      const status = (props['Status']?.select?.name ?? 'error') as 'ok' | 'error'
      const durationMs = props['Duration Ms']?.number ?? null
      const ranAt = props['Ran At']?.date?.start ?? page.created_time
      const errorText = props['Error']?.rich_text?.map(t => t.plain_text).join('') || null

      if (!result.has(jobId)) {
        // First (most recent) entry for this job
        result.set(jobId, {
          lastRun: ranAt,
          lastStatus: status,
          lastDurationMs: durationMs,
          lastError: status === 'error' ? errorText : null,
          consecutiveErrors: status === 'error' ? 1 : 0,
        })
        if (status === 'ok') seenOk.add(jobId)
      } else if (!seenOk.has(jobId) && status === 'error') {
        // Still counting consecutive errors
        const entry = result.get(jobId)!
        entry.consecutiveErrors++
      } else {
        seenOk.add(jobId)
      }
    }

    return result
  } catch (err) {
    console.error('cron-logger: failed to fetch run history:', err instanceof Error ? err.message : err)
    return result
  }
}
