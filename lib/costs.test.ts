// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  getModelPricing,
  toRunCosts,
  computeJobCosts,
  computeDailyCosts,
  computeModelBreakdown,
  detectAnomalies,
  computeCostSummary,
  computeWeekOverWeek,
  computeCacheSavings,
} from './costs'
import type { CronRun } from './types'

function makeRun(overrides: Partial<CronRun> & { jobId: string; ts: number }): CronRun {
  return {
    status: 'ok',
    summary: null,
    error: null,
    durationMs: 100,
    deliveryStatus: null,
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    usage: { input_tokens: 1000, output_tokens: 200, total_tokens: 1200 },
    ...overrides,
  }
}

describe('getModelPricing', () => {
  it('returns exact match pricing', () => {
    const p = getModelPricing('claude-sonnet-4-6')
    expect(p.inputPer1M).toBe(3)
    expect(p.outputPer1M).toBe(15)
  })

  it('returns prefix match for versioned models', () => {
    const p = getModelPricing('claude-sonnet-4-6-20250514')
    expect(p.inputPer1M).toBe(3)
  })

  it('returns haiku pricing', () => {
    const p = getModelPricing('claude-haiku-4-5')
    expect(p.inputPer1M).toBe(0.80)
    expect(p.outputPer1M).toBe(4)
  })

  it('returns default pricing for unknown model', () => {
    const p = getModelPricing('gpt-4o')
    expect(p.inputPer1M).toBe(3)
    expect(p.outputPer1M).toBe(15)
  })
})

describe('toRunCosts', () => {
  it('filters runs without usage', () => {
    const runs = [
      makeRun({ jobId: 'a', ts: 1000 }),
      makeRun({ jobId: 'b', ts: 2000, usage: null }),
    ]
    const costs = toRunCosts(runs)
    expect(costs).toHaveLength(1)
    expect(costs[0].jobId).toBe('a')
  })

  it('computes minCost from input + output tokens', () => {
    const runs = [makeRun({
      jobId: 'a', ts: 1000,
      usage: { input_tokens: 1_000_000, output_tokens: 100_000, total_tokens: 1_100_000 },
    })]
    const costs = toRunCosts(runs)
    // (1M * $3 + 100K * $15) / 1M = $3 + $1.50 = $4.50
    expect(costs[0].minCost).toBeCloseTo(4.5, 2)
  })

  it('computes cache tokens as remainder', () => {
    const runs = [makeRun({
      jobId: 'a', ts: 1000,
      usage: { input_tokens: 500, output_tokens: 200, total_tokens: 1000 },
    })]
    const costs = toRunCosts(runs)
    expect(costs[0].cacheTokens).toBe(300)
  })
})

describe('computeJobCosts', () => {
  it('groups by jobId and sorts by cost desc', () => {
    const runCosts = toRunCosts([
      makeRun({ jobId: 'cheap', ts: 1000, usage: { input_tokens: 100, output_tokens: 10, total_tokens: 110 } }),
      makeRun({ jobId: 'expensive', ts: 2000, usage: { input_tokens: 10000, output_tokens: 5000, total_tokens: 15000 } }),
      makeRun({ jobId: 'expensive', ts: 3000, usage: { input_tokens: 10000, output_tokens: 5000, total_tokens: 15000 } }),
    ])
    const jobs = computeJobCosts(runCosts)
    expect(jobs[0].jobId).toBe('expensive')
    expect(jobs[0].runs).toBe(2)
    expect(jobs[1].jobId).toBe('cheap')
    expect(jobs[1].runs).toBe(1)
  })

  it('computes median cost for a job', () => {
    const runCosts = toRunCosts([
      makeRun({ jobId: 'a', ts: 1, usage: { input_tokens: 100, output_tokens: 10, total_tokens: 110 } }),
      makeRun({ jobId: 'a', ts: 2, usage: { input_tokens: 300, output_tokens: 30, total_tokens: 330 } }),
      makeRun({ jobId: 'a', ts: 3, usage: { input_tokens: 200, output_tokens: 20, total_tokens: 220 } }),
    ])
    const jobs = computeJobCosts(runCosts)
    // Median of 3 values = middle value (sorted by cost)
    const middleCost = (200 * 3 + 20 * 15) / 1_000_000
    expect(jobs[0].medianCost).toBeCloseTo(middleCost, 8)
  })
})

describe('computeDailyCosts', () => {
  it('groups by UTC date and sorts asc', () => {
    const runCosts = toRunCosts([
      makeRun({ jobId: 'a', ts: new Date('2025-01-15T10:00:00Z').getTime() }),
      makeRun({ jobId: 'a', ts: new Date('2025-01-14T08:00:00Z').getTime() }),
      makeRun({ jobId: 'a', ts: new Date('2025-01-15T22:00:00Z').getTime() }),
    ])
    const daily = computeDailyCosts(runCosts)
    expect(daily).toHaveLength(2)
    expect(daily[0].date).toBe('2025-01-14')
    expect(daily[0].runs).toBe(1)
    expect(daily[1].date).toBe('2025-01-15')
    expect(daily[1].runs).toBe(2)
  })
})

describe('computeModelBreakdown', () => {
  it('computes percentage per model', () => {
    const runCosts = toRunCosts([
      makeRun({ jobId: 'a', ts: 1, model: 'claude-sonnet-4-6', usage: { input_tokens: 800, output_tokens: 200, total_tokens: 1000 } }),
      makeRun({ jobId: 'b', ts: 2, model: 'claude-haiku-4-5', usage: { input_tokens: 2000, output_tokens: 1000, total_tokens: 3000 } }),
    ])
    const breakdown = computeModelBreakdown(runCosts)
    expect(breakdown).toHaveLength(2)
    expect(breakdown[0].model).toBe('claude-haiku-4-5')
    expect(breakdown[0].pct).toBeCloseTo(75, 0)
    expect(breakdown[1].model).toBe('claude-sonnet-4-6')
    expect(breakdown[1].pct).toBeCloseTo(25, 0)
  })

  it('returns empty for no data', () => {
    expect(computeModelBreakdown([])).toEqual([])
  })
})

describe('detectAnomalies', () => {
  it('flags runs exceeding 5x median tokens', () => {
    const runs = [
      makeRun({ jobId: 'a', ts: 1, usage: { input_tokens: 100, output_tokens: 100, total_tokens: 200 } }),
      makeRun({ jobId: 'a', ts: 2, usage: { input_tokens: 100, output_tokens: 100, total_tokens: 200 } }),
      makeRun({ jobId: 'a', ts: 3, usage: { input_tokens: 100, output_tokens: 100, total_tokens: 200 } }),
      makeRun({ jobId: 'a', ts: 4, usage: { input_tokens: 5000, output_tokens: 5000, total_tokens: 10000 } }),
    ]
    const runCosts = toRunCosts(runs)
    const jobCosts = computeJobCosts(runCosts)
    const anomalies = detectAnomalies(runCosts, jobCosts)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0].ts).toBe(4)
    expect(anomalies[0].ratio).toBeGreaterThan(5)
  })

  it('skips jobs with fewer than 3 runs', () => {
    const runs = [
      makeRun({ jobId: 'a', ts: 1, usage: { input_tokens: 100, output_tokens: 100, total_tokens: 200 } }),
      makeRun({ jobId: 'a', ts: 2, usage: { input_tokens: 5000, output_tokens: 5000, total_tokens: 10000 } }),
    ]
    const runCosts = toRunCosts(runs)
    const jobCosts = computeJobCosts(runCosts)
    const anomalies = detectAnomalies(runCosts, jobCosts)
    expect(anomalies).toHaveLength(0)
  })
})

describe('computeWeekOverWeek', () => {
  it('computes change across two weeks of data', () => {
    const now = Date.now()
    const ONE_DAY = 86_400_000
    const runCosts = toRunCosts([
      // This week
      makeRun({ jobId: 'a', ts: now - ONE_DAY, usage: { input_tokens: 10000, output_tokens: 2000, total_tokens: 12000 } }),
      makeRun({ jobId: 'a', ts: now - 2 * ONE_DAY, usage: { input_tokens: 10000, output_tokens: 2000, total_tokens: 12000 } }),
      // Last week
      makeRun({ jobId: 'a', ts: now - 8 * ONE_DAY, usage: { input_tokens: 5000, output_tokens: 1000, total_tokens: 6000 } }),
    ])
    const wow = computeWeekOverWeek(runCosts)
    expect(wow.thisWeek).toBeGreaterThan(0)
    expect(wow.lastWeek).toBeGreaterThan(0)
    expect(wow.changePct).not.toBeNull()
    expect(wow.changePct!).toBeGreaterThan(0) // this week spent more
  })

  it('returns null changePct when no last week data', () => {
    const now = Date.now()
    const runCosts = toRunCosts([
      makeRun({ jobId: 'a', ts: now - 86_400_000, usage: { input_tokens: 1000, output_tokens: 200, total_tokens: 1200 } }),
    ])
    const wow = computeWeekOverWeek(runCosts)
    expect(wow.thisWeek).toBeGreaterThan(0)
    expect(wow.lastWeek).toBe(0)
    expect(wow.changePct).toBeNull()
  })
})

describe('computeCacheSavings', () => {
  it('estimates savings from cache tokens', () => {
    const runCosts = toRunCosts([
      makeRun({ jobId: 'a', ts: 1000, model: 'claude-sonnet-4-6', usage: { input_tokens: 500, output_tokens: 200, total_tokens: 1000 } }),
    ])
    // cacheTokens = 1000 - 500 - 200 = 300
    expect(runCosts[0].cacheTokens).toBe(300)
    const savings = computeCacheSavings(runCosts)
    expect(savings.cacheTokens).toBe(300)
    // 300 tokens * $3/1M = $0.0009
    expect(savings.estimatedSavings).toBeCloseTo(0.0009, 6)
  })

  it('returns zero when no cache tokens', () => {
    const runCosts = toRunCosts([
      makeRun({ jobId: 'a', ts: 1000, usage: { input_tokens: 1000, output_tokens: 200, total_tokens: 1200 } }),
    ])
    expect(runCosts[0].cacheTokens).toBe(0)
    const savings = computeCacheSavings(runCosts)
    expect(savings.cacheTokens).toBe(0)
    expect(savings.estimatedSavings).toBe(0)
  })
})

describe('computeCostSummary', () => {
  it('returns complete summary', () => {
    const runs = [
      makeRun({ jobId: 'a', ts: 1000, usage: { input_tokens: 5000, output_tokens: 1000, total_tokens: 6000 } }),
      makeRun({ jobId: 'b', ts: 2000, usage: { input_tokens: 10000, output_tokens: 2000, total_tokens: 12000 } }),
    ]
    const summary = computeCostSummary(runs)
    expect(summary.totalCost).toBeGreaterThan(0)
    expect(summary.topSpender?.jobId).toBe('b')
    expect(summary.jobCosts).toHaveLength(2)
    expect(summary.dailyCosts.length).toBeGreaterThanOrEqual(1)
    expect(summary.modelBreakdown.length).toBeGreaterThanOrEqual(1)
    expect(summary.runCosts).toHaveLength(2)
  })

  it('handles empty input', () => {
    const summary = computeCostSummary([])
    expect(summary.totalCost).toBe(0)
    expect(summary.topSpender).toBeNull()
    expect(summary.anomalies).toEqual([])
    expect(summary.jobCosts).toEqual([])
    expect(summary.dailyCosts).toEqual([])
    expect(summary.modelBreakdown).toEqual([])
    expect(summary.runCosts).toEqual([])
  })

  it('handles runs without usage gracefully', () => {
    const runs = [
      makeRun({ jobId: 'a', ts: 1000, usage: null }),
      makeRun({ jobId: 'b', ts: 2000, model: null, usage: null }),
    ]
    const summary = computeCostSummary(runs)
    expect(summary.totalCost).toBe(0)
    expect(summary.runCosts).toEqual([])
  })
})
