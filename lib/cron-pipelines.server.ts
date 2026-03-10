/**
 * Server-only pipeline loader — reads pipeline definitions from
 * data/pipelines.json in the project directory.
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import type { Pipeline } from './cron-pipelines'

/** Resolve the pipelines.json path within the project's data/ directory. */
export function getPipelinesPath(): string {
  return resolve(process.cwd(), 'data', 'pipelines.json')
}

/** Load pipelines from project data. Returns [] if not configured. */
export function loadPipelines(): Pipeline[] {
  const pipelinesPath = getPipelinesPath()
  if (!existsSync(pipelinesPath)) return []

  try {
    const raw = readFileSync(pipelinesPath, 'utf-8')
    return JSON.parse(raw) as Pipeline[]
  } catch {
    return []
  }
}
