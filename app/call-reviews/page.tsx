"use client";

import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, ArrowUp, ArrowDown, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { ErrorState } from "@/components/ErrorState";

/* ─── Types ─────────────────────────────────────────────────────── */

interface CallReview {
  id: string;
  name: string;
  date: string | null;
  outcome: string | null;
  objection: string | null;
  overcome: boolean;
  contractValue: number | null;
  cashCollected: number | null;
  topActions: string | null;
  summary: string | null;
  fathomLink: string | null;
  createdAt: string;
}

type SortField = "name" | "date" | "outcome" | "contractValue" | "cashCollected" | "createdAt";
type SortDir = "asc" | "desc";

/* ─── Helpers ────────────────────────────────────────────────────── */

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(value: number | null): string {
  if (value == null) return "\u2014";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

const OUTCOME_COLORS: Record<string, string> = {
  sale: "var(--system-green)",
  no_sale: "var(--system-red)",
};

function outcomeColor(outcome: string | null): string {
  if (!outcome) return "var(--text-tertiary)";
  return OUTCOME_COLORS[outcome] ?? "var(--text-secondary)";
}

function outcomeLabel(outcome: string | null): string {
  if (!outcome) return "\u2014";
  if (outcome === "sale") return "Sale";
  if (outcome === "no_sale") return "No Sale";
  return outcome;
}

function sortReviews(reviews: CallReview[], field: SortField, dir: SortDir): CallReview[] {
  return [...reviews].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "date":
        cmp = (a.date ?? "").localeCompare(b.date ?? "");
        break;
      case "outcome":
        cmp = (a.outcome ?? "").localeCompare(b.outcome ?? "");
        break;
      case "contractValue":
        cmp = (a.contractValue ?? -1) - (b.contractValue ?? -1);
        break;
      case "cashCollected":
        cmp = (a.cashCollected ?? -1) - (b.cashCollected ?? -1);
        break;
      case "createdAt":
        cmp = a.createdAt.localeCompare(b.createdAt);
        break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

/* ─── Summary Cards ──────────────────────────────────────────────── */

function TotalCard({ count }: { count: number }) {
  return (
    <div style={{ background: "var(--material-regular)", border: "1px solid var(--separator)", borderRadius: "var(--radius-md)", padding: "var(--space-4)" }}>
      <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-1)" }}>
        Total Reviews
      </div>
      <div style={{ fontSize: "var(--text-title2)", color: "var(--text-primary)", fontWeight: "var(--weight-bold)" }}>
        {count}
      </div>
    </div>
  );
}

function OutcomeCard({ reviews }: { reviews: CallReview[] }) {
  const sales = reviews.filter(r => r.outcome === "sale").length;
  const pct = reviews.length > 0 ? Math.round((sales / reviews.length) * 100) : 0;
  return (
    <div style={{ background: "var(--material-regular)", border: "1px solid var(--separator)", borderRadius: "var(--radius-md)", padding: "var(--space-4)" }}>
      <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-1)" }}>
        Positive Outcomes
      </div>
      <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
        <span style={{ fontSize: "var(--text-title2)", color: "var(--system-green)", fontWeight: "var(--weight-bold)" }}>
          {sales}
        </span>
        <span style={{ fontSize: "var(--text-footnote)", color: "var(--text-tertiary)" }}>
          ({pct}%)
        </span>
      </div>
    </div>
  );
}

function RevenueCard({ reviews }: { reviews: CallReview[] }) {
  const total = reviews
    .filter(r => r.outcome === "sale")
    .reduce((sum, r) => sum + (r.contractValue ?? 0), 0);
  return (
    <div style={{ background: "var(--material-regular)", border: "1px solid var(--separator)", borderRadius: "var(--radius-md)", padding: "var(--space-4)" }}>
      <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-1)" }}>
        Total Revenue
      </div>
      <div style={{ fontSize: "var(--text-title2)", color: "var(--system-green)", fontWeight: "var(--weight-bold)" }}>
        {formatCurrency(total)}
      </div>
    </div>
  );
}

function CashCard({ reviews }: { reviews: CallReview[] }) {
  const total = reviews.reduce((sum, r) => sum + (r.cashCollected ?? 0), 0);
  return (
    <div style={{ background: "var(--material-regular)", border: "1px solid var(--separator)", borderRadius: "var(--radius-md)", padding: "var(--space-4)" }}>
      <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)", fontWeight: "var(--weight-medium)", marginBottom: "var(--space-1)" }}>
        Cash Collected
      </div>
      <div style={{ fontSize: "var(--text-title2)", color: "var(--text-primary)", fontWeight: "var(--weight-bold)" }}>
        {formatCurrency(total)}
      </div>
    </div>
  );
}

/* ─── Sortable Column Header ─────────────────────────────────────── */

function SortHeader({
  label,
  field,
  currentField,
  currentDir,
  onSort,
  style,
}: {
  label: string;
  field: SortField;
  currentField: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
  style?: React.CSSProperties;
}) {
  const isActive = currentField === field;
  return (
    <button
      onClick={() => onSort(field)}
      className="focus-ring"
      style={{
        ...style,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        fontSize: "var(--text-caption1)",
        fontWeight: "var(--weight-semibold)",
        color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {label}
      {isActive && (currentDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
    </button>
  );
}

/* ─── Expanded Row Detail ────────────────────────────────────────── */

function ExpandedDetail({ review }: { review: CallReview }) {
  return (
    <div
      className="animate-slide-down"
      style={{
        padding: "var(--space-3) var(--space-4)",
        background: "var(--fill-secondary)",
        borderBottom: "1px solid var(--separator)",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "var(--space-1) var(--space-4)", maxWidth: 640 }}>
        {review.summary && (
          <>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>Summary</span>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>{review.summary}</span>
          </>
        )}
        {review.topActions && (
          <>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>Top Actions</span>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>{review.topActions}</span>
          </>
        )}
        {review.objection && (
          <>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>Objection</span>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-secondary)" }}>
              {review.objection}
              {review.overcome ? (
                <span style={{ marginLeft: 8, color: "var(--system-green)", fontWeight: "var(--weight-semibold)" }}>Overcome</span>
              ) : (
                <span style={{ marginLeft: 8, color: "var(--system-red)", fontWeight: "var(--weight-semibold)" }}>Not overcome</span>
              )}
            </span>
          </>
        )}
        <>
          <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>Contract Value</span>
          <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-primary)", fontWeight: "var(--weight-semibold)", fontVariantNumeric: "tabular-nums" }}>
            {formatCurrency(review.contractValue)}
          </span>
        </>
        <>
          <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>Cash Collected</span>
          <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-primary)", fontWeight: "var(--weight-semibold)", fontVariantNumeric: "tabular-nums" }}>
            {formatCurrency(review.cashCollected)}
          </span>
        </>
        {review.fathomLink && (
          <>
            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>Recording</span>
            <a
              href={review.fathomLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ fontSize: "var(--text-caption1)", color: "var(--system-blue)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              Open in Fathom <ExternalLink size={11} />
            </a>
          </>
        )}
        <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>Created</span>
        <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-secondary)" }}>{formatDate(review.createdAt)}</span>
      </div>
    </div>
  );
}

/* ─── Page Component ─────────────────────────────────────────────── */

export default function CallReviewsPage() {
  const [reviews, setReviews] = useState<CallReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const refresh = useCallback(() => {
    setRefreshing(true);
    setError(null);
    fetch("/api/notion/call-reviews")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch call reviews (${r.status})`);
        return r.json();
      })
      .then((data) => {
        setReviews(data.reviews ?? []);
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

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const filtered = search
    ? reviews.filter(r => {
        const q = search.toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          (r.outcome?.toLowerCase().includes(q)) ||
          (r.objection?.toLowerCase().includes(q)) ||
          (r.summary?.toLowerCase().includes(q)) ||
          (r.topActions?.toLowerCase().includes(q))
        );
      })
    : reviews;

  const sorted = sortReviews(filtered, sortField, sortDir);

  if (error && reviews.length === 0) {
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
              Call Reviews
            </h1>
            {!loading && (
              <p style={{ fontSize: "var(--text-footnote)", color: "var(--text-secondary)", marginTop: "var(--space-1)" }}>
                {reviews.length} review{reviews.length !== 1 ? "s" : ""} from Notion
              </p>
            )}
          </div>
          <button
            onClick={refresh}
            className="focus-ring"
            aria-label="Refresh call reviews"
            style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-sm)", border: "none", background: "transparent", color: "var(--text-tertiary)", cursor: "pointer" }}
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "var(--space-4) var(--space-6) var(--space-6)" }}>
        {loading ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-3)", marginBottom: "var(--space-4)" }} className="summary-cards-grid">
              {[1, 2, 3, 4].map(i => (
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
            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-3)", marginBottom: "var(--space-4)" }} className="summary-cards-grid">
              <TotalCard count={reviews.length} />
              <OutcomeCard reviews={reviews} />
              <RevenueCard reviews={reviews} />
              <CashCard reviews={reviews} />
            </div>

            {/* Search */}
            <div style={{ marginBottom: "var(--space-3)" }}>
              <input
                type="text"
                placeholder="Search reviews..."
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
            {sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center" style={{ height: 200, color: "var(--text-secondary)", gap: "var(--space-2)" }}>
                <span style={{ fontSize: "var(--text-subheadline)", fontWeight: "var(--weight-medium)" }}>
                  {reviews.length === 0 ? "No call reviews found" : "No reviews match your search"}
                </span>
                <span style={{ fontSize: "var(--text-footnote)", color: "var(--text-tertiary)" }}>
                  {reviews.length === 0 ? "Connect your Notion Call Reviews database to see data here." : "Try a different search term."}
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
                  }}
                >
                  <SortHeader label="Name" field="name" currentField={sortField} currentDir={sortDir} onSort={handleSort} style={{ flex: 2, minWidth: 0 }} />
                  <SortHeader label="Date" field="date" currentField={sortField} currentDir={sortDir} onSort={handleSort} style={{ width: 110, flexShrink: 0 }} />
                  <SortHeader label="Outcome" field="outcome" currentField={sortField} currentDir={sortDir} onSort={handleSort} style={{ width: 100, flexShrink: 0 }} />
                  <span className="hidden md:flex" style={{ width: 110, flexShrink: 0 }}>
                    <SortHeader label="Contract" field="contractValue" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                  </span>
                  <span className="hidden md:flex" style={{ width: 100, flexShrink: 0 }}>
                    <SortHeader label="Collected" field="cashCollected" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                  </span>
                  <span style={{ width: 60, flexShrink: 0, fontSize: "var(--text-caption1)", fontWeight: "var(--weight-semibold)", color: "var(--text-tertiary)", letterSpacing: "0.02em", textTransform: "uppercase" }}>
                    Fathom
                  </span>
                  <span style={{ width: 32, flexShrink: 0 }} />
                </div>

                {/* Data rows */}
                {sorted.map((review) => {
                  const isExpanded = expanded === review.id;
                  return (
                    <div key={review.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onClick={() => setExpanded(isExpanded ? null : review.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(isExpanded ? null : review.id); } }}
                        className="flex items-center cursor-pointer hover-bg focus-ring"
                        style={{
                          padding: "var(--space-2) var(--space-4)",
                          minHeight: 44,
                          borderBottom: isExpanded ? undefined : "1px solid var(--separator)",
                        }}
                      >
                        {/* Name */}
                        <span className="truncate" style={{ flex: 2, minWidth: 0, fontSize: "var(--text-footnote)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)" }}>
                          {review.name}
                        </span>

                        {/* Date */}
                        <span style={{ width: 110, flexShrink: 0, fontSize: "var(--text-caption1)", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                          {formatDate(review.date)}
                        </span>

                        {/* Outcome */}
                        <span style={{ width: 100, flexShrink: 0 }}>
                          {review.outcome ? (
                            <span style={{
                              display: "inline-block",
                              fontSize: "var(--text-caption2)",
                              fontWeight: "var(--weight-semibold)",
                              padding: "1px 8px",
                              borderRadius: 10,
                              background: `color-mix(in srgb, ${outcomeColor(review.outcome)} 12%, transparent)`,
                              color: outcomeColor(review.outcome),
                            }}>
                              {outcomeLabel(review.outcome)}
                            </span>
                          ) : (
                            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>{"\u2014"}</span>
                          )}
                        </span>

                        {/* Contract Value */}
                        <span className="hidden md:inline" style={{ width: 110, flexShrink: 0, fontSize: "var(--text-caption1)", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                          {formatCurrency(review.contractValue)}
                        </span>

                        {/* Cash Collected */}
                        <span className="hidden md:inline" style={{ width: 100, flexShrink: 0, fontSize: "var(--text-caption1)", color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                          {formatCurrency(review.cashCollected)}
                        </span>

                        {/* Fathom Link */}
                        <span style={{ width: 60, flexShrink: 0, display: "flex", alignItems: "center" }}>
                          {review.fathomLink ? (
                            <a
                              href={review.fathomLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="focus-ring"
                              aria-label={`Fathom recording for ${review.name}`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                fontSize: "var(--text-caption2)",
                                color: "var(--system-blue)",
                                textDecoration: "none",
                                fontWeight: "var(--weight-medium)",
                              }}
                            >
                              <ExternalLink size={12} /> Open
                            </a>
                          ) : (
                            <span style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>{"\u2014"}</span>
                          )}
                        </span>

                        {/* Expand chevron */}
                        <span style={{ width: 32, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                          {isExpanded ? <ChevronUp size={14} style={{ color: "var(--text-tertiary)" }} /> : <ChevronDown size={14} style={{ color: "var(--text-tertiary)" }} />}
                        </span>
                      </div>

                      {isExpanded && <ExpandedDetail review={review} />}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .summary-cards-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 400px) {
          .summary-cards-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
