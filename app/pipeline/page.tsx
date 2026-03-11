"use client";

import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { ErrorState } from "@/components/ErrorState";

/* ─── Types ─────────────────────────────────────────────────────── */

interface Contact {
  id: string;
  name: string;
  company: string | null;
  source: string | null;
  stage: string | null;
  dateAdded: string | null;
  email: string | null;
  phone: string | null;
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STAGE_COLORS: Record<string, string> = {
  "Audit Requested": "var(--system-blue)",
  "Call Booked": "#eab308",
  "Live Call": "var(--system-orange, #f97316)",
  "Closed Won": "var(--system-green)",
};

function stageColor(stage: string | null): string {
  if (!stage) return "var(--text-tertiary)";
  return STAGE_COLORS[stage] ?? "var(--text-secondary)";
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

/* ─── Expanded Row Detail ────────────────────────────────────────── */

function ExpandedDetail({ contact }: { contact: Contact }) {
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
        {contact.email && (
          <>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>Email</span>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-secondary)" }}>{contact.email}</span>
          </>
        )}
        {contact.phone && (
          <>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>Phone</span>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-secondary)" }}>{contact.phone}</span>
          </>
        )}
        {contact.source && (
          <>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>Source</span>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-secondary)" }}>{contact.source}</span>
          </>
        )}
        {contact.dateAdded && (
          <>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>Date Added</span>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-secondary)" }}>{formatDate(contact.dateAdded)}</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Page Component ─────────────────────────────────────────────── */

export default function PipelinePage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const refresh = useCallback(() => {
    setRefreshing(true);
    setError(null);
    fetch("/api/ghl/pipeline")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch pipeline data (${r.status})`);
        return r.json();
      })
      .then((data) => {
        setContacts(data.contacts ?? []);
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
    ? contacts.filter(c => {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.company?.toLowerCase().includes(q)) ||
          (c.source?.toLowerCase().includes(q))
        );
      })
    : contacts;

  const byStage = (s: string) => contacts.filter(c => c.stage === s).length;

  if (error && contacts.length === 0) {
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
              Pipeline
            </h1>
            {!loading && (
              <p style={{ fontSize: "var(--text-footnote)", color: "var(--text-secondary)", marginTop: "var(--space-1)" }}>
                {contacts.length} contact{contacts.length !== 1 ? "s" : ""} from GHL
              </p>
            )}
          </div>
          <button
            onClick={refresh}
            className="focus-ring"
            aria-label="Refresh pipeline"
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "var(--space-3)", marginBottom: "var(--space-4)" }} className="pipeline-cards-grid">
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "var(--space-3)", marginBottom: "var(--space-4)" }} className="pipeline-cards-grid">
              <StatCard label="Total Contacts" count={contacts.length} />
              <StatCard label="Audit Requested" count={byStage("Audit Requested")} color="var(--system-blue)" />
              <StatCard label="Call Booked" count={byStage("Call Booked")} color="#eab308" />
              <StatCard label="Live Call" count={byStage("Live Call")} color="var(--system-orange, #f97316)" />
              <StatCard label="Closed Won" count={byStage("Closed Won")} color="var(--system-green)" />
            </div>

            {/* Search */}
            <div style={{ marginBottom: "var(--space-3)" }}>
              <input
                type="text"
                placeholder="Search by name, company, or source..."
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
                  {contacts.length === 0 ? "No contacts found" : "No contacts match your search"}
                </span>
                <span style={{ fontSize: "var(--text-footnote)", color: "var(--text-tertiary)" }}>
                  {contacts.length === 0 ? "Contacts from your GHL pipeline will appear here." : "Try a different search term."}
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
                  <span className="hidden lg:inline" style={{ width: 140, flexShrink: 0 }}>Source</span>
                  <span style={{ width: 130, flexShrink: 0 }}>Stage</span>
                  <span style={{ width: 100, flexShrink: 0 }}>Date Added</span>
                  <span style={{ width: 32, flexShrink: 0 }} />
                </div>

                {/* Data rows */}
                {filtered.map((contact) => {
                  const isExpanded = expanded === contact.id;
                  return (
                    <div key={contact.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onClick={() => setExpanded(isExpanded ? null : contact.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(isExpanded ? null : contact.id); } }}
                        className="flex items-center cursor-pointer hover-bg focus-ring"
                        style={{
                          padding: "var(--space-2) var(--space-4)",
                          minHeight: 44,
                          borderBottom: isExpanded ? undefined : "1px solid var(--separator)",
                        }}
                      >
                        {/* Name */}
                        <span className="truncate" style={{ flex: 2, minWidth: 0, fontSize: "var(--text-footnote)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)" }}>
                          {contact.name}
                        </span>

                        {/* Company */}
                        <span className="hidden md:inline truncate" style={{ flex: 2, minWidth: 0, fontSize: "var(--text-caption1)", color: "var(--text-secondary)" }}>
                          {contact.company ?? "\u2014"}
                        </span>

                        {/* Source */}
                        <span className="hidden lg:inline truncate" style={{ width: 140, flexShrink: 0, fontSize: "var(--text-caption1)", color: "var(--text-secondary)" }}>
                          {contact.source ?? "\u2014"}
                        </span>

                        {/* Stage */}
                        <span style={{ width: 130, flexShrink: 0 }}>
                          {contact.stage ? (
                            <span style={{
                              display: "inline-block",
                              fontSize: "var(--text-caption2)",
                              fontWeight: "var(--weight-semibold)",
                              padding: "1px 8px",
                              borderRadius: 10,
                              background: `color-mix(in srgb, ${stageColor(contact.stage)} 12%, transparent)`,
                              color: stageColor(contact.stage),
                              whiteSpace: "nowrap",
                            }}>
                              {contact.stage}
                            </span>
                          ) : (
                            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>{"\u2014"}</span>
                          )}
                        </span>

                        {/* Date Added */}
                        <span style={{ width: 100, flexShrink: 0, fontSize: "var(--text-caption1)", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                          {formatDate(contact.dateAdded)}
                        </span>

                        {/* Expand chevron */}
                        <span style={{ width: 32, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                          {isExpanded ? <ChevronUp size={14} style={{ color: "var(--text-tertiary)" }} /> : <ChevronDown size={14} style={{ color: "var(--text-tertiary)" }} />}
                        </span>
                      </div>

                      {isExpanded && <ExpandedDetail contact={contact} />}
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
          .pipeline-cards-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        @media (max-width: 480px) {
          .pipeline-cards-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
