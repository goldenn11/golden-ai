"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { Agent, CronJob } from "@/lib/types";

const ManorMap = dynamic(
  () => import("@/components/ManorMap").then((m) => ({ default: m.ManorMap })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }} className="animate-pulse">
          Scanning the manor...
        </div>
      </div>
    ),
  }
);

const TOOL_ICONS: Record<string, string> = {
  web_search: "\uD83D\uDD0D", read: "\uD83D\uDCC1", write: "\u270F\uFE0F", exec: "\uD83D\uDCBB",
  web_fetch: "\uD83C\uDF10", message: "\uD83D\uDD14", tts: "\uD83D\uDCAC",
};

function StatusDot({ status }: { status: CronJob["status"] }) {
  return (
    <span style={{
      display: 'inline-block',
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      flexShrink: 0,
      background: status === 'ok' ? 'var(--system-green)' : status === 'error' ? 'var(--system-red)' : 'var(--text-tertiary)',
    }} />
  );
}

export default function ManorPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [crons, setCrons] = useState<CronJob[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/agents").then((r) => r.json()),
      fetch("/api/crons").then((r) => r.json()),
    ])
      .then(([a, c]) => { setAgents(a); setCrons(c); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const agentCrons = selected ? crons.filter((c) => c.agentId === selected.id) : [];

  if (error) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--system-red)', fontSize: '13px' }}>
        Error loading manor: {error}
      </div>
    );
  }

  return (
    <div className="flex h-full" style={{ background: 'var(--bg)' }}>
      {/* Map */}
      <div className="flex-1 h-full">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }} className="animate-pulse">
              Scanning the manor...
            </div>
          </div>
        ) : (
          <ManorMap agents={agents} crons={crons} onNodeClick={setSelected} />
        )}
      </div>

      {/* Detail panel */}
      {selected ? (
        <div
          className="animate-slide-in-right"
          style={{
            width: '340px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            background: 'var(--material-regular)',
            backdropFilter: 'var(--sidebar-backdrop)',
            WebkitBackdropFilter: 'var(--sidebar-backdrop)',
            boxShadow: 'var(--shadow-overlay)',
          }}
        >
          {/* Color strip */}
          <div style={{ height: '4px', background: selected.color, flexShrink: 0 }} />

          {/* Close */}
          <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setSelected(null)}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--fill-secondary)',
                color: 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                transition: 'all 150ms var(--ease-spring)',
              }}
            >
              ✕
            </button>
          </div>

          {/* Header */}
          <div style={{ padding: '8px 24px 20px' }}>
            {/* Emoji on squircle */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: `${selected.color}26`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              marginBottom: '12px',
            }}>
              {selected.emoji}
            </div>

            <h2 style={{
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '-0.5px',
              color: 'var(--text-primary)',
              margin: 0,
              lineHeight: 1.2,
            }}>
              {selected.name}
            </h2>

            <p style={{
              fontSize: '15px',
              fontWeight: 400,
              color: 'var(--text-secondary)',
              margin: '2px 0 0',
            }}>
              {selected.title}
            </p>

            {/* Color badge */}
            <span style={{
              display: 'inline-block',
              marginTop: '8px',
              padding: '2px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 500,
              background: `${selected.color}33`,
              color: selected.color,
            }}>
              {selected.color}
            </span>
          </div>

          {/* Description */}
          <div style={{ padding: '0 24px 16px' }}>
            <p style={{
              fontSize: '14px',
              lineHeight: 1.65,
              color: 'var(--text-secondary)',
              margin: 0,
            }}>
              {selected.description}
            </p>
          </div>

          {/* Tools */}
          <div style={{ padding: '0 24px 16px' }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
              color: 'var(--text-tertiary)',
              marginBottom: '8px',
            }}>
              Tools
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selected.tools.map((t) => (
                <span key={t} style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'var(--fill-secondary)',
                  borderRadius: '8px',
                  padding: '5px 10px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                }}>
                  {TOOL_ICONS[t] && <span style={{ fontSize: '11px' }}>{TOOL_ICONS[t]}</span>}
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Crons */}
          {agentCrons.length > 0 && (
            <div style={{ padding: '0 24px 16px' }}>
              <div style={{
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
                color: 'var(--text-tertiary)',
                marginBottom: '8px',
              }}>
                Crons
              </div>
              <div style={{
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
              }}>
                {agentCrons.map((c, idx) => (
                  <div key={c.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    minHeight: '44px',
                    padding: '0 12px',
                    borderTop: idx > 0 ? '1px solid var(--separator)' : undefined,
                  }}>
                    <StatusDot status={c.status} />
                    <span style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {c.name}
                    </span>
                    <span style={{
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-tertiary)',
                      flexShrink: 0,
                    }}>
                      {c.schedule}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div style={{ marginTop: 'auto', padding: '20px 24px' }}>
            <button
              onClick={() => router.push(`/chat/${selected.id}`)}
              style={{
                width: '100%',
                height: '50px',
                borderRadius: '14px',
                background: 'var(--accent)',
                color: '#000',
                fontWeight: 600,
                fontSize: '15px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 150ms var(--ease-spring)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(0.98)';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(245,197,24,0.30)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.96)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(0.98)';
              }}
            >
              Open Chat
            </button>
          </div>
        </div>
      ) : (
        /* Empty state */
        <div style={{
          width: '340px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--material-regular)',
          backdropFilter: 'var(--sidebar-backdrop)',
          WebkitBackdropFilter: 'var(--sidebar-backdrop)',
          boxShadow: 'var(--shadow-overlay)',
        }}>
          <div style={{ textAlign: 'center', padding: '0 24px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>{"\uD83D\uDD75\uFE0F"}</div>
            <div style={{
              fontSize: '17px',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}>
              Select an agent
            </div>
            <div style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              marginTop: '4px',
            }}>
              Click any node on the map to inspect
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
