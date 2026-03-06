'use client'

import { useEffect, useState } from 'react'
import type { CostSummary, CronJob, RunCost } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react'

/* ── Formatters ───────────────────────────────────────────────── */

function fmtCost(v: number): string {
  if (v < 0.01 && v > 0) return '<$0.01'
  return `$${v.toFixed(2)}`
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function fmtDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/* ── Summary Card ────────────────────────────────────────────── */

function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--material-regular)',
      border: '1px solid var(--separator)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4)',
    }}>
      <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-1)' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

/* ── Bar Chart ────────────────────────────────────────────────── */

function DailyCostChart({ dailyCosts }: { dailyCosts: CostSummary['dailyCosts'] }) {
  const [hover, setHover] = useState<number | null>(null)
  if (dailyCosts.length === 0) return null

  const maxCost = Math.max(...dailyCosts.map(d => d.cost))
  const W = 600
  const H = 200
  const PAD_L = 50
  const PAD_B = 24
  const PAD_T = 12
  const chartW = W - PAD_L
  const chartH = H - PAD_B - PAD_T
  const barW = Math.max(8, Math.min(40, (chartW - dailyCosts.length * 2) / dailyCosts.length))
  const gap = 2

  const ticks = maxCost > 0
    ? [0, maxCost * 0.25, maxCost * 0.5, maxCost * 0.75, maxCost]
    : [0]

  return (
    <div style={{
      background: 'var(--material-regular)',
      border: '1px solid var(--separator)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4)',
    }}>
      <div style={{
        fontSize: 'var(--text-caption1)',
        color: 'var(--text-tertiary)',
        fontWeight: 'var(--weight-medium)',
        marginBottom: 'var(--space-3)',
      }}>
        Daily Estimated Cost
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', maxHeight: 220, display: 'block' }}
      >
        {ticks.map((t, i) => {
          const y = PAD_T + chartH - (maxCost > 0 ? (t / maxCost) * chartH : 0)
          return (
            <g key={i}>
              <line x1={PAD_L} y1={y} x2={W} y2={y} stroke="var(--separator)" strokeWidth={0.5} />
              <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize={9} fill="var(--text-tertiary)">
                ${t.toFixed(2)}
              </text>
            </g>
          )
        })}
        {dailyCosts.map((d, i) => {
          const barH = maxCost > 0 ? (d.cost / maxCost) * chartH : 0
          const x = PAD_L + i * (barW + gap)
          const y = PAD_T + chartH - barH
          const isHovered = hover === i
          return (
            <g
              key={d.date}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'default' }}
            >
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(1, barH)}
                rx={2}
                fill={isHovered ? 'var(--text-primary)' : 'var(--accent)'}
                opacity={isHovered ? 1 : 0.8}
              />
              {(i === 0 || i === dailyCosts.length - 1 || i % 7 === 0) && (
                <text
                  x={x + barW / 2}
                  y={H - 4}
                  textAnchor="middle"
                  fontSize={8}
                  fill="var(--text-tertiary)"
                >
                  {d.date.slice(5)}
                </text>
              )}
              {isHovered && (
                <>
                  <rect
                    x={Math.min(x - 20, W - 100)}
                    y={Math.max(0, y - 30)}
                    width={90}
                    height={22}
                    rx={4}
                    fill="var(--material-thick)"
                  />
                  <text
                    x={Math.min(x - 20, W - 100) + 45}
                    y={Math.max(0, y - 30) + 15}
                    textAnchor="middle"
                    fontSize={10}
                    fill="var(--text-primary)"
                    fontWeight="600"
                  >
                    {d.date.slice(5)} — {fmtCost(d.cost)}
                  </text>
                </>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ── Donut Chart ──────────────────────────────────────────────── */

const DONUT_COLORS = ['var(--system-blue)', 'var(--system-green)', 'var(--accent)']

function TokenDonut({ data }: { data: CostSummary }) {
  const totalInput = data.runCosts.reduce((s, r) => s + r.inputTokens, 0)
  const totalOutput = data.runCosts.reduce((s, r) => s + r.outputTokens, 0)
  const totalCache = data.runCosts.reduce((s, r) => s + r.cacheTokens, 0)
  const total = totalInput + totalOutput + totalCache
  if (total === 0) return null

  const segments = [
    { label: 'Input', tokens: totalInput, color: DONUT_COLORS[0] },
    { label: 'Output', tokens: totalOutput, color: DONUT_COLORS[1] },
    { label: 'Cache', tokens: totalCache, color: DONUT_COLORS[2] },
  ].filter(s => s.tokens > 0)

  const R = 60
  const STROKE = 16
  const cx = 80
  const cy = 80
  const circumference = 2 * Math.PI * R
  let offset = 0

  return (
    <div style={{
      background: 'var(--material-regular)',
      border: '1px solid var(--separator)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4)',
    }}>
      <div style={{
        fontSize: 'var(--text-caption1)',
        color: 'var(--text-tertiary)',
        fontWeight: 'var(--weight-medium)',
        marginBottom: 'var(--space-3)',
      }}>
        Token Breakdown
      </div>
      <div className="flex items-center" style={{ gap: 'var(--space-6)', flexWrap: 'wrap' }}>
        <svg viewBox="0 0 160 160" style={{ width: 140, height: 140, flexShrink: 0 }}>
          {segments.map((seg) => {
            const pct = seg.tokens / total
            const dashLen = pct * circumference
            const dashGap = circumference - dashLen
            const currentOffset = offset
            offset += dashLen
            return (
              <circle
                key={seg.label}
                cx={cx}
                cy={cy}
                r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth={STROKE}
                strokeDasharray={`${dashLen} ${dashGap}`}
                strokeDashoffset={-currentOffset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            )
          })}
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize={12} fontWeight="700" fill="var(--text-primary)">
            {fmtTokens(total)}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill="var(--text-tertiary)">
            total
          </text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {segments.map(seg => (
            <div key={seg.label} className="flex items-center" style={{ gap: 'var(--space-2)', fontSize: 'var(--text-footnote)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
              <span style={{ color: 'var(--text-secondary)', fontWeight: 'var(--weight-medium)' }}>{seg.label}</span>
              <span style={{ color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                {fmtTokens(seg.tokens)} ({((seg.tokens / total) * 100).toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Most Expensive Crons ────────────────────────────────────── */

function TopCrons({ jobCosts, jobName }: { jobCosts: CostSummary['jobCosts']; jobName: (id: string) => string }) {
  const top = jobCosts.slice(0, 3)
  if (top.length === 0) return null

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <div style={{
        fontSize: 'var(--text-caption1)',
        color: 'var(--text-tertiary)',
        fontWeight: 'var(--weight-medium)',
        marginBottom: 'var(--space-3)',
      }}>
        Most Expensive Crons
      </div>
      <div className="top-crons-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
        {top.map((job) => (
          <div
            key={job.jobId}
            style={{
              background: 'var(--material-regular)',
              border: '1px solid var(--separator)',
              borderRadius: 'var(--radius-md)',
              borderLeft: '3px solid var(--accent)',
              padding: 'var(--space-4)',
            }}
          >
            <div style={{
              fontSize: 'var(--text-footnote)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: 'var(--space-2)',
            }}>
              {jobName(job.jobId)}
            </div>
            <div style={{
              fontSize: 'var(--text-title2)',
              fontWeight: 'var(--weight-bold)',
              color: 'var(--text-primary)',
              fontVariantNumeric: 'tabular-nums',
              marginBottom: 'var(--space-1)',
            }}>
              {fmtCost(job.totalCost)}
            </div>
            <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>
              {job.runs} run{job.runs !== 1 ? 's' : ''}
              {' \u00b7 '}
              avg {fmtCost(job.runs > 0 ? job.totalCost / job.runs : 0)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Per-Run Detail Table ────────────────────────────────────── */

function RunDetailTable({ runCosts, jobName }: { runCosts: RunCost[]; jobName: (id: string) => string }) {
  const [showAll, setShowAll] = useState(false)
  const sorted = [...runCosts].sort((a, b) => b.ts - a.ts)
  const visible = showAll ? sorted : sorted.slice(0, 50)
  const hasMore = sorted.length > 50

  if (sorted.length === 0) return null

  return (
    <div style={{
      background: 'var(--material-regular)',
      border: '1px solid var(--separator)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      marginTop: 'var(--space-4)',
    }}>
      <div style={{
        padding: 'var(--space-3) var(--space-4)',
        borderBottom: '1px solid var(--separator)',
        fontSize: 'var(--text-caption1)',
        color: 'var(--text-tertiary)',
        fontWeight: 'var(--weight-medium)',
      }}>
        Per-Run Detail ({sorted.length} run{sorted.length !== 1 ? 's' : ''})
      </div>

      {/* Header */}
      <div className="flex items-center run-detail-row" style={{
        padding: 'var(--space-2) var(--space-4)',
        borderBottom: '1px solid var(--separator)',
        fontSize: 'var(--text-caption1)',
        color: 'var(--text-tertiary)',
        fontWeight: 'var(--weight-medium)',
        gap: 'var(--space-3)',
      }}>
        <span style={{ width: 120, flexShrink: 0 }}>Time</span>
        <span style={{ flex: 2, minWidth: 0 }}>Job</span>
        <span className="hidden-mobile" style={{ width: 120 }}>Model</span>
        <span style={{ width: 60, textAlign: 'right' }}>Input</span>
        <span style={{ width: 60, textAlign: 'right' }}>Output</span>
        <span className="hidden-mobile" style={{ width: 60, textAlign: 'right' }}>Cache</span>
        <span style={{ width: 70, textAlign: 'right' }}>Cost</span>
      </div>

      {/* Rows */}
      {visible.map((rc, i) => (
        <div
          key={`${rc.ts}-${rc.jobId}-${i}`}
          className="flex items-center run-detail-row"
          style={{
            padding: 'var(--space-2) var(--space-4)',
            borderBottom: i < visible.length - 1 ? '1px solid var(--separator)' : undefined,
            fontSize: 'var(--text-footnote)',
            color: 'var(--text-primary)',
            gap: 'var(--space-3)',
          }}
        >
          <span style={{ width: 120, flexShrink: 0, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', fontSize: 'var(--text-caption1)' }}>
            {fmtDate(rc.ts)}
          </span>
          <span style={{ flex: 2, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 'var(--weight-medium)' }}>
            {jobName(rc.jobId)}
          </span>
          <span className="hidden-mobile" style={{ width: 120, color: 'var(--text-tertiary)', fontSize: 'var(--text-caption1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rc.model}
          </span>
          <span style={{ width: 60, textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtTokens(rc.inputTokens)}
          </span>
          <span style={{ width: 60, textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtTokens(rc.outputTokens)}
          </span>
          <span className="hidden-mobile" style={{ width: 60, textAlign: 'right', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtTokens(rc.cacheTokens)}
          </span>
          <span style={{ width: 70, textAlign: 'right', fontWeight: 'var(--weight-semibold)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtCost(rc.minCost)}
          </span>
        </div>
      ))}

      {/* Show more */}
      {hasMore && !showAll && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
          <button
            onClick={() => setShowAll(true)}
            style={{
              fontSize: 'var(--text-footnote)',
              color: 'var(--accent)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'var(--weight-medium)',
            }}
          >
            Show all {sorted.length} runs
          </button>
        </div>
      )}
    </div>
  )
}

/* ── CostsPage ───────────────────────────────────────────────── */

export function CostsPage() {
  const [data, setData] = useState<CostSummary | null>(null)
  const [jobNames, setJobNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      fetch('/api/costs').then(r => {
        if (!r.ok) throw new Error('Failed to load costs')
        return r.json()
      }),
      fetch('/api/crons').then(r => {
        if (!r.ok) throw new Error('Failed to load crons')
        return r.json()
      }),
    ])
      .then(([costData, cronData]: [CostSummary, { crons: CronJob[] }]) => {
        setData(costData)
        const names: Record<string, string> = {}
        for (const c of cronData.crons) {
          names[c.id] = c.name
        }
        setJobNames(names)
        setLoading(false)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setLoading(false)
      })
  }, [])

  const jobName = (id: string) => jobNames[id] || id

  // Date range from run costs
  const dateRange = data && data.runCosts.length > 0
    ? {
        oldest: new Date(Math.min(...data.runCosts.map(r => r.ts))),
        newest: new Date(Math.max(...data.runCosts.map(r => r.ts))),
      }
    : null

  return (
    <div className="h-full flex flex-col overflow-hidden animate-fade-in" style={{ background: 'var(--bg)' }}>
      {/* ── Sticky header ──────────────────────────────────────── */}
      <header
        className="sticky top-0 z-10 flex-shrink-0"
        style={{
          background: 'var(--material-regular)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderBottom: '1px solid var(--separator)',
          padding: 'var(--space-4) var(--space-6)',
        }}
      >
        <h1 style={{
          fontSize: 'var(--text-title1)',
          fontWeight: 'var(--weight-bold)',
          color: 'var(--text-primary)',
          letterSpacing: '-0.5px',
          lineHeight: 'var(--leading-tight)',
        }}>
          Costs
        </h1>
        {!loading && data && (
          <p style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
            {dateRange
              ? `${dateRange.oldest.toLocaleDateString()} - ${dateRange.newest.toLocaleDateString()}`
              : 'No data'}
            {' \u00b7 '}
            {data.runCosts.length} run{data.runCosts.length !== 1 ? 's' : ''} with cost data
          </p>
        )}
      </header>

      {/* ── Scrollable content ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ padding: 'var(--space-4) var(--space-6) var(--space-6)', minHeight: 0 }}>
        {error && (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-8)',
            color: 'var(--system-red)',
            fontSize: 'var(--text-footnote)',
          }}>
            {error}
          </div>
        )}

        {loading && (
          <div>
            <div className="costs-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ background: 'var(--material-regular)', border: '1px solid var(--separator)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                  <Skeleton style={{ width: 100, height: 10, marginBottom: 8 }} />
                  <Skeleton style={{ width: 60, height: 20 }} />
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--material-regular)', border: '1px solid var(--separator)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center" style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: i < 4 ? '1px solid var(--separator)' : undefined, gap: 'var(--space-3)' }}>
                  <Skeleton style={{ width: 140, height: 14 }} />
                  <Skeleton style={{ width: 60, height: 14, flex: 1 }} />
                  <Skeleton style={{ width: 80, height: 14 }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && (!data || data.runCosts.length === 0) && (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-8)',
            color: 'var(--text-tertiary)',
            fontSize: 'var(--text-footnote)',
          }}>
            No cost data -- runs without usage metadata will not appear here.
          </div>
        )}

        {!loading && !error && data && data.runCosts.length > 0 && (
          <>
            {/* ── Anomaly banner ─────────────────────────────────── */}
            {data.anomalies.length > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                background: 'rgba(255, 149, 0, 0.08)',
                border: '1px solid rgba(255, 149, 0, 0.25)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-4)',
                fontSize: 'var(--text-footnote)',
                color: 'var(--system-orange)',
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong>{data.anomalies.length} anomal{data.anomalies.length === 1 ? 'y' : 'ies'}</strong>
                  {' -- '}
                  {data.anomalies.slice(0, 3).map((a, i) => (
                    <span key={i}>
                      {i > 0 && ', '}
                      {jobName(a.jobId)} ({a.ratio.toFixed(1)}x median)
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Summary cards (4-col) ──────────────────────────── */}
            <div className="costs-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              {/* Total Estimated Cost */}
              <SummaryCard label="Total Estimated Cost">
                <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--text-title2)', color: 'var(--text-primary)', fontWeight: 'var(--weight-bold)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtCost(data.totalCost)}
                  </span>
                  {data.weekOverWeek.changePct !== null && (
                    <span className="flex items-center" style={{
                      fontSize: 'var(--text-caption1)',
                      fontWeight: 'var(--weight-semibold)',
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-sm)',
                      background: data.weekOverWeek.changePct <= 0 ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.12)',
                      color: data.weekOverWeek.changePct <= 0 ? 'var(--system-green)' : 'var(--system-red)',
                      gap: 2,
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}>
                      {data.weekOverWeek.changePct <= 0
                        ? <TrendingDown size={10} />
                        : <TrendingUp size={10} />}
                      {Math.abs(data.weekOverWeek.changePct).toFixed(0)}%
                    </span>
                  )}
                </div>
              </SummaryCard>

              {/* This Week vs Last Week */}
              <SummaryCard label="This Week">
                <div style={{ fontSize: 'var(--text-title2)', color: 'var(--text-primary)', fontWeight: 'var(--weight-bold)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtCost(data.weekOverWeek.thisWeek)}
                </div>
                <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  last week: {fmtCost(data.weekOverWeek.lastWeek)}
                </div>
              </SummaryCard>

              {/* Cache Savings */}
              <SummaryCard label="Cache Savings">
                <div style={{ fontSize: 'var(--text-title2)', color: 'var(--system-green)', fontWeight: 'var(--weight-bold)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtCost(data.cacheSavings.estimatedSavings)}
                </div>
                <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {fmtTokens(data.cacheSavings.cacheTokens)} cache tokens
                </div>
              </SummaryCard>

              {/* Anomalies */}
              <SummaryCard label="Anomalies">
                <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
                  {data.anomalies.length > 0 && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--system-orange)', flexShrink: 0 }} />
                  )}
                  <span style={{
                    fontSize: 'var(--text-title2)',
                    fontWeight: 'var(--weight-bold)',
                    color: data.anomalies.length > 0 ? 'var(--system-orange)' : 'var(--system-green)',
                  }}>
                    {data.anomalies.length}
                  </span>
                </div>
              </SummaryCard>
            </div>

            {/* ── Most Expensive Crons ───────────────────────────── */}
            <TopCrons jobCosts={data.jobCosts} jobName={jobName} />

            {/* ── Charts row: daily cost + token donut ────────────── */}
            <div className="charts-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <DailyCostChart dailyCosts={data.dailyCosts} />
              <TokenDonut data={data} />
            </div>

            {/* ── Job cost table ──────────────────────────────────── */}
            <div style={{
              background: 'var(--material-regular)',
              border: '1px solid var(--separator)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div className="flex items-center" style={{
                padding: 'var(--space-2) var(--space-4)',
                borderBottom: '1px solid var(--separator)',
                fontSize: 'var(--text-caption1)',
                color: 'var(--text-tertiary)',
                fontWeight: 'var(--weight-medium)',
                gap: 'var(--space-3)',
              }}>
                <span style={{ flex: 2, minWidth: 0 }}>Job</span>
                <span style={{ width: 50, textAlign: 'right' }}>Runs</span>
                <span style={{ width: 80, textAlign: 'right' }}>Input</span>
                <span style={{ width: 80, textAlign: 'right' }}>Output</span>
                <span className="hidden-mobile" style={{ width: 80, textAlign: 'right' }}>Cache</span>
                <span style={{ width: 80, textAlign: 'right' }}>Est. Cost</span>
              </div>

              {data.jobCosts.length === 0 ? (
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-footnote)' }}>
                  No jobs with cost data
                </div>
              ) : (
                data.jobCosts.map((job, i) => (
                  <div
                    key={job.jobId}
                    className="flex items-center"
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      borderBottom: i < data.jobCosts.length - 1 ? '1px solid var(--separator)' : undefined,
                      fontSize: 'var(--text-footnote)',
                      color: 'var(--text-primary)',
                      gap: 'var(--space-3)',
                    }}
                  >
                    <span style={{ flex: 2, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 'var(--weight-medium)' }}>
                      {jobName(job.jobId)}
                    </span>
                    <span style={{ width: 50, textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {job.runs}
                    </span>
                    <span style={{ width: 80, textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtTokens(job.totalInputTokens)}
                    </span>
                    <span style={{ width: 80, textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtTokens(job.totalOutputTokens)}
                    </span>
                    <span className="hidden-mobile" style={{ width: 80, textAlign: 'right', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtTokens(job.totalCacheTokens)}
                    </span>
                    <span style={{ width: 80, textAlign: 'right', fontWeight: 'var(--weight-semibold)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtCost(job.totalCost)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* ── Model breakdown (inline) ────────────────────────── */}
            {data.modelBreakdown.length > 0 && (
              <div style={{
                marginTop: 'var(--space-4)',
                display: 'flex',
                gap: 'var(--space-3)',
                flexWrap: 'wrap',
                fontSize: 'var(--text-caption1)',
                color: 'var(--text-tertiary)',
              }}>
                {data.modelBreakdown.map(m => (
                  <span key={m.model}>
                    <span style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)' }}>
                      {m.model}
                    </span>
                    {' '}
                    {m.pct.toFixed(0)}%
                  </span>
                ))}
              </div>
            )}

            {/* ── Per-run detail table ────────────────────────────── */}
            <RunDetailTable runCosts={data.runCosts} jobName={jobName} />
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .costs-summary-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .top-crons-grid {
            grid-template-columns: 1fr !important;
          }
          .charts-row {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .costs-summary-grid {
            grid-template-columns: 1fr !important;
          }
          .hidden-mobile { display: none !important; }
        }
      `}</style>
    </div>
  )
}
