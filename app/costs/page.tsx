'use client'

import { useCallback, useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw, DollarSign } from 'lucide-react'

interface CronRunEntry {
  jobId: string
  jobName: string
  status: string
  durationMs: number | null
  ranAt: string
}

interface CostCategory {
  label: string
  description: string
  estimate: string
  color: string
}

const COST_CATEGORIES: CostCategory[] = [
  {
    label: 'Anthropic API',
    description: 'Claude Sonnet token usage across all cron agents',
    estimate: 'Sonnet: $3/$15 per 1M tokens (in/out)',
    color: 'var(--system-blue)',
  },
  {
    label: 'VAPI Minutes',
    description: 'Voice agent call minutes for client deployments',
    estimate: '$0.05-0.15/min depending on provider',
    color: 'var(--system-green)',
  },
  {
    label: 'Make.com Operations',
    description: 'Automation scenario executions',
    estimate: 'Based on plan tier and operation count',
    color: 'var(--system-purple)',
  },
  {
    label: 'Vercel',
    description: 'Hosting, serverless functions, cron invocations',
    estimate: 'Pro plan + function execution time',
    color: 'var(--system-orange)',
  },
]

function formatDuration(ms: number | null): string {
  if (ms == null) return '--'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export default function CostsRoute() {
  const [runs, setRuns] = useState<CronRunEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(() => {
    setRefreshing(true)
    fetch('/api/logs')
      .then(r => r.ok ? r.json() : { entries: [] })
      .then((data: { entries: CronRunEntry[] }) => {
        setRuns(data.entries || [])
        setLoading(false)
        setRefreshing(false)
      })
      .catch(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Compute basic stats from cron runs
  const totalRuns = runs.length
  const totalDurationMs = runs.reduce((sum, r) => sum + (r.durationMs ?? 0), 0)
  const avgDurationMs = totalRuns > 0 ? Math.round(totalDurationMs / totalRuns) : 0

  // Group runs by job for the breakdown
  const jobMap = new Map<string, { name: string; count: number; totalMs: number }>()
  for (const run of runs) {
    const key = run.jobId
    const existing = jobMap.get(key)
    if (existing) {
      existing.count++
      existing.totalMs += run.durationMs ?? 0
    } else {
      jobMap.set(key, { name: run.jobName || run.jobId, count: 1, totalMs: run.durationMs ?? 0 })
    }
  }
  const jobBreakdown = Array.from(jobMap.values()).sort((a, b) => b.count - a.count)

  return (
    <div className="h-full flex flex-col overflow-hidden animate-fade-in" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex-shrink-0"
        style={{
          background: 'var(--material-regular)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderBottom: '1px solid var(--separator)',
        }}
      >
        <div className="flex items-center justify-between" style={{ padding: 'var(--space-4) var(--space-6)' }}>
          <div>
            <h1 style={{
              fontSize: 'var(--text-title1)',
              fontWeight: 'var(--weight-bold)',
              color: 'var(--text-primary)',
              letterSpacing: '-0.5px',
              lineHeight: 'var(--leading-tight)',
            }}>
              Costs
            </h1>
            <p style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
              Infrastructure cost tracking
            </p>
          </div>
          <button
            onClick={refresh}
            className="focus-ring"
            aria-label="Refresh cost data"
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: 'var(--space-4) var(--space-6) var(--space-6)', minHeight: 0 }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)' }} className="costs-grid">
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ background: 'var(--material-regular)', border: '1px solid var(--separator)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                <Skeleton style={{ width: 100, height: 10, marginBottom: 8 }} />
                <Skeleton style={{ width: 60, height: 24, marginBottom: 8 }} />
                <Skeleton style={{ width: 160, height: 10 }} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Cost category cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }} className="costs-grid">
              {COST_CATEGORIES.map((cat) => (
                <div key={cat.label} style={{
                  background: 'var(--material-regular)',
                  border: '1px solid var(--separator)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-4)',
                }}>
                  <div className="flex items-center" style={{ gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <DollarSign size={14} style={{ color: cat.color }} />
                    <span style={{ fontSize: 'var(--text-caption1)', fontWeight: 'var(--weight-semibold)', color: cat.color, textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' }}>
                      {cat.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--text-title2)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                    $0.00
                  </div>
                  <p style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', lineHeight: 'var(--leading-normal)' }}>
                    {cat.description}
                  </p>
                  <p style={{ fontSize: 'var(--text-caption2)', color: 'var(--text-quaternary)', marginTop: 'var(--space-1)' }}>
                    {cat.estimate}
                  </p>
                </div>
              ))}
            </div>

            {/* Data populates note */}
            <div style={{
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-sm)',
              background: 'color-mix(in srgb, var(--system-blue) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--system-blue) 20%, transparent)',
              marginBottom: 'var(--space-6)',
              fontSize: 'var(--text-footnote)',
              color: 'var(--text-secondary)',
            }}>
              Cost tracking populates as crons run and usage data accumulates. Detailed per-token cost breakdowns will appear here once sufficient data is collected.
            </div>

            {/* Cron execution summary */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h2 style={{
                fontSize: 'var(--text-headline)',
                fontWeight: 'var(--weight-bold)',
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-3)',
              }}>
                Cron Execution Summary
              </h2>

              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }} className="costs-grid">
                <div style={{ background: 'var(--material-regular)', border: '1px solid var(--separator)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                  <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-1)' }}>
                    Total Executions
                  </div>
                  <div style={{ fontSize: 'var(--text-title2)', color: 'var(--text-primary)', fontWeight: 'var(--weight-bold)' }}>
                    {totalRuns}
                  </div>
                </div>
                <div style={{ background: 'var(--material-regular)', border: '1px solid var(--separator)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                  <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-1)' }}>
                    Total Compute Time
                  </div>
                  <div style={{ fontSize: 'var(--text-title2)', color: 'var(--text-primary)', fontWeight: 'var(--weight-bold)' }}>
                    {formatDuration(totalDurationMs)}
                  </div>
                </div>
                <div style={{ background: 'var(--material-regular)', border: '1px solid var(--separator)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                  <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-1)' }}>
                    Avg Duration
                  </div>
                  <div style={{ fontSize: 'var(--text-title2)', color: 'var(--text-primary)', fontWeight: 'var(--weight-bold)' }}>
                    {formatDuration(avgDurationMs)}
                  </div>
                </div>
              </div>

              {/* Job breakdown table */}
              {jobBreakdown.length > 0 ? (
                <div style={{
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  background: 'var(--material-regular)',
                  border: '1px solid var(--separator)',
                }}>
                  {/* Table header */}
                  <div className="flex items-center" style={{
                    padding: 'var(--space-2) var(--space-4)',
                    borderBottom: '1px solid var(--separator)',
                    fontSize: 'var(--text-caption1)',
                    fontWeight: 'var(--weight-semibold)',
                    color: 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: 'var(--tracking-wide)',
                  }}>
                    <span style={{ flex: 1 }}>Agent</span>
                    <span style={{ width: 80, textAlign: 'right' }}>Runs</span>
                    <span style={{ width: 100, textAlign: 'right' }}>Total Time</span>
                    <span style={{ width: 100, textAlign: 'right' }}>Avg Time</span>
                  </div>
                  {jobBreakdown.map((job, idx) => (
                    <div
                      key={job.name}
                      className="flex items-center"
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        borderTop: idx > 0 ? '1px solid var(--separator)' : undefined,
                      }}
                    >
                      <span style={{ flex: 1, fontSize: 'var(--text-body)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                        {job.name}
                      </span>
                      <span style={{ width: 80, textAlign: 'right', fontSize: 'var(--text-footnote)', color: 'var(--text-secondary)' }}>
                        {job.count}
                      </span>
                      <span style={{ width: 100, textAlign: 'right', fontSize: 'var(--text-footnote)', color: 'var(--text-secondary)' }}>
                        {formatDuration(job.totalMs)}
                      </span>
                      <span style={{ width: 100, textAlign: 'right', fontSize: 'var(--text-footnote)', color: 'var(--text-secondary)' }}>
                        {formatDuration(job.count > 0 ? Math.round(job.totalMs / job.count) : 0)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  background: 'var(--material-regular)',
                  border: '1px solid var(--separator)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-8)',
                  textAlign: 'center',
                  color: 'var(--text-tertiary)',
                }}>
                  <DollarSign size={24} style={{ margin: '0 auto var(--space-3)', opacity: 0.5 }} />
                  <p style={{ fontSize: 'var(--text-body)' }}>No execution data yet</p>
                  <p style={{ fontSize: 'var(--text-footnote)', marginTop: 'var(--space-1)' }}>
                    Data populates as crons run
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .costs-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
