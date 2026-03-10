'use client'

import { useCallback, useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react'

interface CronRunEntry {
  id: string
  jobId: string
  jobName: string
  status: string
  durationMs: number | null
  ranAt: string
  error: string | null
  summary: string | null
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '--'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export default function ActivityPage() {
  const [entries, setEntries] = useState<CronRunEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setRefreshing(true)
    setError(null)
    fetch('/api/logs')
      .then(r => {
        if (!r.ok) throw new Error('Failed to load activity')
        return r.json()
      })
      .then((data: { entries: CronRunEntry[] }) => {
        setEntries(data.entries)
        setLoading(false)
        setRefreshing(false)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setLoading(false)
        setRefreshing(false)
      })
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 60000)
    return () => clearInterval(interval)
  }, [refresh])

  const errorCount = entries.filter(e => e.status === 'error').length
  const okCount = entries.filter(e => e.status === 'ok').length

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
              Activity Console
            </h1>
            {!loading && (
              <p style={{ fontSize: 'var(--text-footnote)', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
                {entries.length} cron run{entries.length !== 1 ? 's' : ''}
                {errorCount > 0 && (
                  <span style={{ color: 'var(--system-red)' }}>
                    {' \u00b7 '}{errorCount} error{errorCount !== 1 ? 's' : ''}
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={refresh}
            className="focus-ring"
            aria-label="Refresh activity data"
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
          <>
            {/* Summary skeleton */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }} className="activity-cards-grid">
              {[1, 2, 3].map(i => (
                <div key={i} style={{ background: 'var(--material-regular)', border: '1px solid var(--separator)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                  <Skeleton style={{ width: 80, height: 10, marginBottom: 8 }} />
                  <Skeleton style={{ width: 48, height: 20 }} />
                </div>
              ))}
            </div>
            {/* Row skeletons */}
            <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--material-regular)', border: '1px solid var(--separator)' }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center" style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: i < 5 ? '1px solid var(--separator)' : undefined, gap: 'var(--space-3)' }}>
                  <Skeleton style={{ width: 8, height: 8, borderRadius: '50%' }} />
                  <Skeleton style={{ width: 100, height: 12 }} />
                  <Skeleton style={{ width: 60, height: 18, borderRadius: 4 }} />
                  <Skeleton style={{ width: 80, height: 12 }} />
                </div>
              ))}
            </div>
          </>
        ) : error && entries.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-12)',
            color: 'var(--text-tertiary)',
            textAlign: 'center',
          }}>
            <XCircle size={32} style={{ marginBottom: 'var(--space-3)', opacity: 0.5 }} />
            <p style={{ fontSize: 'var(--text-body)', marginBottom: 'var(--space-3)' }}>{error}</p>
            <button
              onClick={refresh}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--accent)',
                color: 'var(--accent-contrast)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--text-footnote)',
                fontWeight: 'var(--weight-semibold)',
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }} className="activity-cards-grid">
              <div style={{ background: 'var(--material-regular)', border: '1px solid var(--separator)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-1)' }}>
                  Total Runs
                </div>
                <div style={{ fontSize: 'var(--text-title2)', color: 'var(--text-primary)', fontWeight: 'var(--weight-bold)' }}>
                  {entries.length}
                </div>
              </div>
              <div style={{ background: 'var(--material-regular)', border: '1px solid var(--separator)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-1)' }}>
                  Successful
                </div>
                <div style={{ fontSize: 'var(--text-title2)', color: 'var(--system-green)', fontWeight: 'var(--weight-bold)' }}>
                  {okCount}
                </div>
              </div>
              <div style={{ background: 'var(--material-regular)', border: '1px solid var(--separator)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-1)' }}>
                  Errors
                </div>
                <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
                  {errorCount > 0 && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--system-red)', flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: 'var(--text-title2)', fontWeight: 'var(--weight-bold)', color: errorCount > 0 ? 'var(--system-red)' : 'var(--system-green)' }}>
                    {errorCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Run list */}
            {entries.length === 0 ? (
              <div style={{
                background: 'var(--material-regular)',
                border: '1px solid var(--separator)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-8)',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
              }}>
                <Clock size={24} style={{ margin: '0 auto var(--space-3)', opacity: 0.5 }} />
                <p style={{ fontSize: 'var(--text-body)' }}>No cron runs recorded yet</p>
                <p style={{ fontSize: 'var(--text-footnote)', marginTop: 'var(--space-1)' }}>
                  Data populates as scheduled crons fire
                </p>
              </div>
            ) : (
              <div style={{
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                background: 'var(--material-regular)',
                border: '1px solid var(--separator)',
              }}>
                {entries.map((entry, idx) => (
                  <div key={entry.id}>
                    <button
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        padding: 'var(--space-3) var(--space-4)',
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        borderTop: idx > 0 ? '1px solid var(--separator)' : undefined,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {/* Status dot */}
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: entry.status === 'ok' ? 'var(--system-green)' : 'var(--system-red)',
                        flexShrink: 0,
                      }} />

                      {/* Job name */}
                      <span style={{
                        fontSize: 'var(--text-body)',
                        fontWeight: 'var(--weight-semibold)',
                        color: 'var(--text-primary)',
                        minWidth: 80,
                      }}>
                        {entry.jobName || entry.jobId}
                      </span>

                      {/* Status badge */}
                      <span style={{
                        fontSize: 'var(--text-caption2)',
                        fontWeight: 'var(--weight-semibold)',
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: entry.status === 'ok'
                          ? 'color-mix(in srgb, var(--system-green) 15%, transparent)'
                          : 'color-mix(in srgb, var(--system-red) 15%, transparent)',
                        color: entry.status === 'ok' ? 'var(--system-green)' : 'var(--system-red)',
                        textTransform: 'uppercase',
                      }}>
                        {entry.status}
                      </span>

                      {/* Duration */}
                      <span style={{
                        fontSize: 'var(--text-caption1)',
                        color: 'var(--text-tertiary)',
                        minWidth: 60,
                      }}>
                        {formatDuration(entry.durationMs)}
                      </span>

                      {/* Time ago */}
                      <span style={{
                        fontSize: 'var(--text-caption1)',
                        color: 'var(--text-tertiary)',
                        marginLeft: 'auto',
                      }}>
                        {timeAgo(entry.ranAt)}
                      </span>
                    </button>

                    {/* Expanded detail */}
                    {expandedId === entry.id && (
                      <div style={{
                        padding: '0 var(--space-4) var(--space-3)',
                        paddingLeft: 'calc(var(--space-4) + 8px + var(--space-3))',
                        borderTop: '1px solid var(--separator)',
                        background: 'color-mix(in srgb, var(--bg) 50%, transparent)',
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--space-1) var(--space-3)', padding: 'var(--space-3) 0', fontSize: 'var(--text-footnote)' }}>
                          <span style={{ color: 'var(--text-tertiary)' }}>Job ID</span>
                          <span style={{ color: 'var(--text-primary)' }}>{entry.jobId}</span>

                          <span style={{ color: 'var(--text-tertiary)' }}>Ran at</span>
                          <span style={{ color: 'var(--text-primary)' }}>{new Date(entry.ranAt).toLocaleString()}</span>

                          {entry.durationMs != null && (
                            <>
                              <span style={{ color: 'var(--text-tertiary)' }}>Duration</span>
                              <span style={{ color: 'var(--text-primary)' }}>{formatDuration(entry.durationMs)}</span>
                            </>
                          )}

                          {entry.error && (
                            <>
                              <span style={{ color: 'var(--system-red)' }}>Error</span>
                              <span style={{ color: 'var(--system-red)', wordBreak: 'break-word' }}>{entry.error}</span>
                            </>
                          )}

                          {entry.summary && (
                            <>
                              <span style={{ color: 'var(--text-tertiary)' }}>Summary</span>
                              <span style={{ color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                                {entry.summary.length > 300 ? entry.summary.slice(0, 300) + '...' : entry.summary}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .activity-cards-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
