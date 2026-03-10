import { CronJob } from '@/lib/types'
import { describeCron } from './cron-utils'
import { loadRegistry } from '@/lib/agents-registry'
import { fetchCronRunHistory } from '@/lib/cron-logger'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Agent descriptions pulled from the registry, keyed by agent ID.
 * Used to enrich cron job entries with context about what the agent does.
 */
function getAgentDescriptions(): Map<string, string> {
  const registry = loadRegistry()
  return new Map(registry.map(a => [a.id, a.description]))
}

/**
 * Read cron job definitions from vercel.json.
 * Each entry has a path like "/api/crons/scribe" and a cron schedule.
 */
function readVercelCrons(): { path: string; schedule: string }[] {
  try {
    const vercelJsonPath = resolve(process.cwd(), 'vercel.json')
    const raw = readFileSync(vercelJsonPath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (parsed.crons && Array.isArray(parsed.crons)) {
      return parsed.crons
    }
    return []
  } catch {
    return []
  }
}

/**
 * Compute the next occurrence of a 5-field cron expression from a given date.
 * Supports: minute, hour, day-of-month(*), month(*), day-of-week.
 * Only handles the patterns we actually use (specific min/hour, * or specific dow).
 */
function computeNextRun(expression: string, from: Date = new Date()): Date | null {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) return null

  const [minStr, hourStr, , , dowStr] = parts
  const targetMin = parseInt(minStr, 10)
  const targetHour = parseInt(hourStr, 10)
  if (isNaN(targetMin) || isNaN(targetHour)) return null

  // Parse allowed days of week (0=Sun, 6=Sat)
  let allowedDays: number[] | null = null // null means every day
  if (dowStr !== '*') {
    if (dowStr.includes('-')) {
      const [start, end] = dowStr.split('-').map(Number)
      if (!isNaN(start) && !isNaN(end)) {
        allowedDays = []
        for (let d = start; d <= end; d++) allowedDays.push(d)
      }
    } else if (dowStr.includes(',')) {
      allowedDays = dowStr.split(',').map(Number).filter(n => !isNaN(n))
    } else {
      const d = parseInt(dowStr, 10)
      if (!isNaN(d)) allowedDays = [d]
    }
  }

  // Start searching from the current time
  const candidate = new Date(from)
  candidate.setUTCSeconds(0, 0)

  // If the target time today has already passed, start from tomorrow
  if (
    candidate.getUTCHours() > targetHour ||
    (candidate.getUTCHours() === targetHour && candidate.getUTCMinutes() >= targetMin)
  ) {
    candidate.setUTCDate(candidate.getUTCDate() + 1)
  }

  candidate.setUTCHours(targetHour, targetMin, 0, 0)

  // Find the next matching day (up to 8 days out)
  for (let i = 0; i < 8; i++) {
    const dow = candidate.getUTCDay()
    if (!allowedDays || allowedDays.includes(dow)) {
      return candidate
    }
    candidate.setUTCDate(candidate.getUTCDate() + 1)
  }

  return null
}

/**
 * Extract agent ID from a Vercel cron path like "/api/crons/scribe" -> "scribe"
 */
function extractAgentId(path: string): string {
  const segments = path.split('/')
  return segments[segments.length - 1] || ''
}

export async function getCrons(): Promise<CronJob[]> {
  const vercelCrons = readVercelCrons()
  const agentDescriptions = getAgentDescriptions()
  const now = new Date()

  // Fetch run history from Notion (gracefully returns empty map if unconfigured)
  const runHistory = await fetchCronRunHistory()

  return vercelCrons.map((entry) => {
    const agentId = extractAgentId(entry.path)
    const description = agentDescriptions.get(agentId) || null
    const nextRunDate = computeNextRun(entry.schedule, now)
    const history = runHistory.get(agentId)

    return {
      id: agentId,
      name: agentId,
      schedule: entry.schedule,
      scheduleDescription: describeCron(entry.schedule),
      timezone: null,
      status: history?.lastStatus ?? ('idle' as const),
      lastRun: history?.lastRun ?? null,
      nextRun: nextRunDate ? nextRunDate.toISOString() : null,
      lastError: history?.lastError ?? null,
      agentId,
      description,
      enabled: true,
      delivery: null,
      lastDurationMs: history?.lastDurationMs ?? null,
      consecutiveErrors: history?.consecutiveErrors ?? 0,
      lastDeliveryStatus: null,
    }
  })
}
