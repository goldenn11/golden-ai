"use client";

import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, ChevronDown, ChevronUp, ExternalLink, Copy, Check } from "lucide-react";
import { ErrorState } from "@/components/ErrorState";

/* ─── Types ─────────────────────────────────────────────────────── */

interface Prospect {
  id: string;
  name: string;
  company: string | null;
  title: string | null;
  location: string | null;
  linkedinUrl: string | null;
  researchBrief: string | null;
  dmText: string | null;
  status: string | null;
  dateAdded: string | null;
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_COLORS: Record<string, string> = {
  "Ready to Send": "var(--system-blue)",
  "Sent": "var(--text-tertiary)",
  "Replied": "#eab308",
  "Booked": "var(--system-green)",
  "Dead": "var(--system-red)",
};

function statusColor(status: string | null): string {
  if (!status) return "var(--text-tertiary)";
  return STATUS_COLORS[status] ?? "var(--text-secondary)";
}

/* ─── Stat Card ──────────────────────────────────────────────────── */

function StatCard({ label, count, color }: { label: string; count: number; color?: string }) {
  return (
    <div style={{ background: "var(--material-regular)", border: "1px solid var(--separator)", borderRadius: "var(--radius-md)", padding: "var(--space-4)" }}>
      <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-1)" }}>
        {label}
      </div>
      <div style={{ fontSize: "var(--text-title2)", color: color ?? "var(--text-primary)", fontWeight: "var(--weight-bold)" }}>
        {count}
      </div>
    </div>
  );
}

/* ─── Copy Button ────────────────────────────────────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="focus-ring"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        fontSize: "var(--text-caption2)",
        fontWeight: "var(--weight-semibold)",
        color: copied ? "var(--system-green)" : "var(--system-blue)",
        background: copied
          ? "color-mix(in srgb, var(--system-green) 10%, transparent)"
          : "color-mix(in srgb, var(--system-blue) 10%, transparent)",
        border: "none",
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
        transition: "all 150ms ease",
      }}
    >
      {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
    </button>
  );
}

/* ─── Expanded Row Detail ────────────────────────────────────────── */

function ExpandedDetail({ prospect }: { prospect: Prospect }) {
  return (
    <div
      className="animate-slide-down"
      style={{
        padding: "var(--space-3) var(--space-4)",
        background: "var(--fill-secondary)",
        borderBottom: "1px solid var(--separator)",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "var(--space-2) var(--space-4)", maxWidth: 700 }}>
        {prospect.researchBrief && (
          <>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)", paddingTop: 2 }}>Research Brief</span>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>{prospect.researchBrief}</span>
          </>
        )}
        {prospect.dmText && (
          <>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)", paddingTop: 6 }}>DM Text</span>
            <div>
              <pre
                style={{
                  fontSize: "var(--text-caption1)",
                  color: "var(--text-primary)",
                  background: "var(--fill-tertiary)",
                  border: "1px solid var(--separator)",
                  borderRadius: "var(--radius-sm)",
                  padding: "var(--space-3)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  margin: "0 0 var(--space-2) 0",
                  fontFamily: "var(--font-mono)",
                  lineHeight: 1.5,
                }}
              >
                {prospect.dmText}
              </pre>
              <CopyButton text={prospect.dmText} />
            </div>
          </>
        )}
        {prospect.location && (
          <>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>Location</span>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-secondary)" }}>{prospect.location}</span>
          </>
        )}
        {prospect.linkedinUrl && (
          <>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>LinkedIn</span>
            <a
              href={prospect.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ fontSize: "var(--text-caption1)", color: "var(--system-blue)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              Open Profile <ExternalLink size={11} />
            </a>
          </>
        )}
        {prospect.dateAdded && (
          <>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>Date Added</span>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-secondary)" }}>{formatDate(prospect.dateAdded)}</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Page Component ─────────────────────────────────────────────── */

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const refresh = useCallback(() => {
    setRefreshing(true);
    setError(null);
    fetch("/api/notion/prospects")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch prospects (${r.status})`);
        return r.json();
      })
      .then((data) => {
        setProspects(data.prospects ?? []);
        setLoading(false);
        setRefreshing(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = search
    ? prospects.filter(p => {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.company?.toLowerCase().includes(q))
        );
      })
    : prospects;

  const byStatus = (s: string) => prospects.filter(p => p.status === s).length;

  if (error && prospects.length === 0) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden animate-fade-in" style={{ background: "var(--bg)" }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-10 flex-shrink-0"
        style={{
          background: "var(--material-regular)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderBottom: "1px solid var(--separator)",
        }}
      >
        <div className="flex items-center justify-between" style={{ padding: "var(--space-4) var(--space-6)" }}>
          <div>
            <h1 style={{ fontSize: "var(--text-title1)", fontWeight: "var(--weight-bold)", color: "var(--text-primary)", letterSpacing: "-0.5px", lineHeight: "var(--leading-tight)" }}>
              Prospects
            </h1>
            {!loading && (
              <p style={{ fontSize: "var(--text-footnote)", color: "var(--text-secondary)", marginTop: "var(--space-1)" }}>
                {prospects.length} prospect{prospects.length !== 1 ? "s" : ""} from Notion
              </p>
            )}
          </div>
          <button
            onClick={refresh}
            className="focus-ring"
            aria-label="Refresh prospects"
            style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-sm)", border: "none", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer" }}
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "var(--space-4) var(--space-6) var(--space-6)", minHeight: 0 }}>
        {loading ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "var(--space-3)", marginBottom: "var(--space-4)" }} className="prospects-cards-grid">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ background: "var(--material-regular)", border: "1px solid var(--separator)", borderRadius: "var(--radius-md)", padding: "var(--space-4)" }}>
                  <Skeleton style={{ width: 80, height: 10, marginBottom: 8 }} />
                  <Skeleton style={{ width: 50, height: 20 }} />
                </div>
              ))}
            </div>
            <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--material-regular)" }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center" style={{ padding: "var(--space-3) var(--space-4)", borderBottom: i < 5 ? "1px solid var(--separator)" : undefined, gap: "var(--space-3)" }}>
                  <Skeleton style={{ width: 160, height: 14 }} />
                  <Skeleton style={{ width: 80, height: 12 }} />
                  <div className="ml-auto flex" style={{ gap: "var(--space-3)" }}>
                    <Skeleton style={{ width: 60, height: 12 }} />
                    <Skeleton style={{ width: 60, height: 12 }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "var(--space-3)", marginBottom: "var(--space-4)" }} className="prospects-cards-grid">
              <StatCard label="Total Prospects" count={prospects.length} />
              <StatCard label="Ready to Send" count={byStatus("Ready to Send")} color="var(--system-blue)" />
              <StatCard label="Sent" count={byStatus("Sent")} />
              <StatCard label="Replied" count={byStatus("Replied")} color="#eab308" />
              <StatCard label="Booked" count={byStatus("Booked")} color="var(--system-green)" />
            </div>

            {/* Search */}
            <div style={{ marginBottom: "var(--space-3)" }}>
              <input
                type="text"
                placeholder="Search by name or company..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="focus-ring"
                style={{
                  width: "100%",
                  maxWidth: 320,
                  padding: "6px 12px",
                  fontSize: "var(--text-footnote)",
                  background: "var(--fill-secondary)",
                  border: "1px solid var(--separator)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center" style={{ height: 200, color: "var(--text-secondary)", gap: "var(--space-2)" }}>
                <span style={{ fontSize: "var(--text-subheadline)", fontWeight: "var(--weight-medium)" }}>
                  {prospects.length === 0 ? "No prospects found" : "No prospects match your search"}
                </span>
                <span style={{ fontSize: "var(--text-footnote)", color: "var(--text-tertiary)" }}>
                  {prospects.length === 0 ? "Add prospects to your Notion database to see them here." : "Try a different search term."}
                </span>
              </div>
            ) : (
              <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--material-regular)", border: "1px solid var(--separator)" }}>
                {/* Column headers */}
                <div
                  className="flex items-center"
                  style={{
                    padding: "var(--space-2) var(--space-4)",
                    borderBottom: "1px solid var(--separator)",
                    background: "var(--fill-secondary)",
                    fontSize: "var(--text-caption1)",
                    fontWeight: "var(--weight-semibold)",
                    color: "var(--text-tertiary)",
                    letterSpacing: "0.02em",
                    textTransform: "uppercase",
                  }}
                >
                  <span style={{ flex: 2, minWidth: 0 }}>Name</span>
                  <span className="hidden md:inline" style={{ flex: 2, minWidth: 0 }}>Company</span>
                  <span className="hidden lg:inline" style={{ width: 160, flexShrink: 0 }}>Title</span>
                  <span style={{ width: 110, flexShrink: 0 }}>Status</span>
                  <span style={{ width: 100, flexShrink: 0 }}>Date</span>
                  <span style={{ width: 32, flexShrink: 0 }} />
                </div>

                {/* Data rows */}
                {filtered.map((prospect) => {
                  const isExpanded = expanded === prospect.id;
                  return (
                    <div key={prospect.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onClick={() => setExpanded(isExpanded ? null : prospect.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(isExpanded ? null : prospect.id); } }}
                        className="flex items-center cursor-pointer hover-bg focus-ring"
                        style={{
                          padding: "var(--space-2) var(--space-4)",
                          minHeight: 44,
                          borderBottom: isExpanded ? undefined : "1px solid var(--separator)",
                        }}
                      >
                        {/* Name */}
                        <span className="truncate" style={{ flex: 2, minWidth: 0, fontSize: "var(--text-footnote)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)" }}>
                          {prospect.name}
                        </span>

                        {/* Company */}
                        <span className="hidden md:inline truncate" style={{ flex: 2, minWidth: 0, fontSize: "var(--text-caption1)", color: "var(--text-secondary)" }}>
                          {prospect.company ?? "\u2014"}
                        </span>

                        {/* Title */}
                        <span className="hidden lg:inline truncate" style={{ width: 160, flexShrink: 0, fontSize: "var(--text-caption1)", color: "var(--text-secondary)" }}>
                          {prospect.title ?? "\u2014"}
                        </span>

                        {/* Status */}
                        <span style={{ width: 110, flexShrink: 0 }}>
                          {prospect.status ? (
                            <span style={{
                              display: "inline-block",
                              fontSize: "var(--text-caption2)",
                              fontWeight: "var(--weight-semibold)",
                              padding: "1px 8px",
                              borderRadius: 10,
                              background: `color-mix(in srgb, ${statusColor(prospect.status)} 12%, transparent)`,
                              color: statusColor(prospect.status),
                              whiteSpace: "nowrap",
                            }}>
                              {prospect.status}
                            </span>
                          ) : (
                            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>{"\u2014"}</span>
                          )}
                        </span>

                        {/* Date */}
                        <span style={{ width: 100, flexShrink: 0, fontSize: "var(--text-caption1)", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                          {formatDate(prospect.dateAdded)}
                        </span>

                        {/* Expand chevron */}
                        <span style={{ width: 32, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                          {isExpanded ? <ChevronUp size={14} style={{ color: "var(--text-tertiary)" }} /> : <ChevronDown size={14} style={{ color: "var(--text-tertiary)" }} />}
                        </span>
                      </div>

                      {isExpanded && <ExpandedDetail prospect={prospect} />}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .prospects-cards-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        @media (max-width: 480px) {
          .prospects-cards-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
