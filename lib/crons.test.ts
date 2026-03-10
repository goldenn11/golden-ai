// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockReadFileSync } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
}))

vi.mock('fs', () => ({
  readFileSync: mockReadFileSync,
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  default: { readFileSync: mockReadFileSync, existsSync: vi.fn(), readdirSync: vi.fn() },
}))

vi.mock('@/lib/agents-registry', () => ({
  loadRegistry: () => [
    { id: 'scribe', description: 'Weekly memory compression. Silent worker.' },
    { id: 'echo', description: 'Scans ICP subreddits weekly.' },
    { id: 'pulse', description: 'Hype radar. Monitors trending signals.' },
    { id: 'lumen', description: 'SEO Team Director.' },
    { id: 'herald', description: 'LinkedIn content pipeline.' },
    { id: 'maven', description: 'Weekly LinkedIn strategy.' },
    { id: 'ledger', description: 'Tracks active client retainers.' },
    { id: 'relay', description: 'Manages client onboarding checklists.' },
  ],
}))

import { getCrons } from './crons'

function mockVercelJson(crons: { path: string; schedule: string }[]) {
  mockReadFileSync.mockReturnValue(JSON.stringify({ crons }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getCrons - reads vercel.json', () => {
  it('returns all 8 cron jobs from vercel.json', async () => {
    mockVercelJson([
      { path: '/api/crons/scribe', schedule: '0 9 * * 1' },
      { path: '/api/crons/echo', schedule: '0 8 * * 0' },
      { path: '/api/crons/pulse', schedule: '0 7 * * *' },
      { path: '/api/crons/lumen', schedule: '0 10 * * 1' },
      { path: '/api/crons/herald', schedule: '0 8 * * *' },
      { path: '/api/crons/maven', schedule: '0 11 * * 1' },
      { path: '/api/crons/ledger', schedule: '0 6 * * *' },
      { path: '/api/crons/relay', schedule: '0 9 * * *' },
    ])

    const crons = await getCrons()
    expect(crons).toHaveLength(8)
  })

  it('extracts agent ID from path', async () => {
    mockVercelJson([
      { path: '/api/crons/scribe', schedule: '0 9 * * 1' },
      { path: '/api/crons/pulse', schedule: '0 7 * * *' },
    ])

    const crons = await getCrons()
    expect(crons[0].agentId).toBe('scribe')
    expect(crons[0].id).toBe('scribe')
    expect(crons[0].name).toBe('scribe')
    expect(crons[1].agentId).toBe('pulse')
  })

  it('sets schedule and human-readable description', async () => {
    mockVercelJson([
      { path: '/api/crons/pulse', schedule: '0 7 * * *' },
      { path: '/api/crons/scribe', schedule: '0 9 * * 1' },
      { path: '/api/crons/echo', schedule: '0 8 * * 0' },
    ])

    const crons = await getCrons()
    const pulse = crons.find(c => c.id === 'pulse')!
    expect(pulse.schedule).toBe('0 7 * * *')
    expect(pulse.scheduleDescription).toBe('Daily at 7 AM')

    const scribe = crons.find(c => c.id === 'scribe')!
    expect(scribe.schedule).toBe('0 9 * * 1')
    expect(scribe.scheduleDescription).toBe('Mondays at 9 AM')

    const echo = crons.find(c => c.id === 'echo')!
    expect(echo.schedule).toBe('0 8 * * 0')
    expect(echo.scheduleDescription).toBe('Sundays at 8 AM')
  })

  it('enriches with agent description from registry', async () => {
    mockVercelJson([
      { path: '/api/crons/scribe', schedule: '0 9 * * 1' },
    ])

    const crons = await getCrons()
    expect(crons[0].description).toBe('Weekly memory compression. Silent worker.')
  })

  it('sets description to null for unknown agents', async () => {
    mockVercelJson([
      { path: '/api/crons/unknown-agent', schedule: '0 0 * * *' },
    ])

    const crons = await getCrons()
    expect(crons[0].description).toBeNull()
  })
})

describe('getCrons - next run computation', () => {
  it('computes a future nextRun for daily schedules', async () => {
    mockVercelJson([
      { path: '/api/crons/pulse', schedule: '0 7 * * *' },
    ])

    const crons = await getCrons()
    expect(crons[0].nextRun).toBeTruthy()
    const nextRun = new Date(crons[0].nextRun!)
    expect(nextRun.getTime()).toBeGreaterThan(Date.now() - 86400000) // within a day
  })

  it('computes nextRun on correct day of week for weekly schedules', async () => {
    mockVercelJson([
      { path: '/api/crons/scribe', schedule: '0 9 * * 1' }, // Mondays
    ])

    const crons = await getCrons()
    expect(crons[0].nextRun).toBeTruthy()
    const nextRun = new Date(crons[0].nextRun!)
    expect(nextRun.getUTCDay()).toBe(1) // Monday
    expect(nextRun.getUTCHours()).toBe(9)
    expect(nextRun.getUTCMinutes()).toBe(0)
  })

  it('computes nextRun for Sunday schedules', async () => {
    mockVercelJson([
      { path: '/api/crons/echo', schedule: '0 8 * * 0' }, // Sundays
    ])

    const crons = await getCrons()
    expect(crons[0].nextRun).toBeTruthy()
    const nextRun = new Date(crons[0].nextRun!)
    expect(nextRun.getUTCDay()).toBe(0) // Sunday
  })
})

describe('getCrons - defaults', () => {
  it('sets all jobs to idle status with no last run', async () => {
    mockVercelJson([
      { path: '/api/crons/pulse', schedule: '0 7 * * *' },
    ])

    const crons = await getCrons()
    expect(crons[0].status).toBe('idle')
    expect(crons[0].lastRun).toBeNull()
    expect(crons[0].lastError).toBeNull()
    expect(crons[0].enabled).toBe(true)
    expect(crons[0].delivery).toBeNull()
    expect(crons[0].lastDurationMs).toBeNull()
    expect(crons[0].consecutiveErrors).toBe(0)
    expect(crons[0].lastDeliveryStatus).toBeNull()
  })

  it('returns empty array when vercel.json has no crons', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({}))

    const crons = await getCrons()
    expect(crons).toEqual([])
  })

  it('returns empty array when vercel.json is unreadable', async () => {
    mockReadFileSync.mockImplementation(() => { throw new Error('ENOENT') })

    const crons = await getCrons()
    expect(crons).toEqual([])
  })
})
