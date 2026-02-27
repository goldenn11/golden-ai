"use client";
import { useEffect, useState } from "react";
import type { MemoryFile } from "@/lib/types";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function simpleMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /^#### (.+)$/gm,
      '<h4 class="text-[15px] font-semibold" style="color:var(--text-primary);margin-top:1rem;margin-bottom:0.25rem">$1</h4>'
    )
    .replace(
      /^### (.+)$/gm,
      '<h3 class="text-[17px] font-semibold" style="color:var(--text-primary);margin-top:1.25rem;margin-bottom:0.375rem">$1</h3>'
    )
    .replace(
      /^## (.+)$/gm,
      '<h2 class="text-[22px] font-semibold" style="color:var(--text-primary);margin-top:1.5rem;margin-bottom:0.5rem;padding-bottom:0.25rem;border-bottom:1px solid var(--separator)">$1</h2>'
    )
    .replace(
      /^# (.+)$/gm,
      '<h1 class="text-[28px] font-bold" style="color:var(--text-primary);margin-top:1rem;margin-bottom:0.75rem">$1</h1>'
    )
    .replace(
      /\*\*(.+?)\*\*/g,
      '<strong class="font-semibold" style="color:var(--text-primary)">$1</strong>'
    )
    .replace(
      /`([^`]+)`/g,
      '<code style="background:var(--fill-secondary);color:var(--accent);padding:2px 6px;border-radius:6px;font-size:13px;font-family:var(--font-mono)">$1</code>'
    )
    .replace(
      /^- (.+)$/gm,
      '<li class="ml-4 text-[15px] leading-[1.7] list-disc" style="color:var(--text-secondary)">$1</li>'
    )
    .replace(
      /^(\d+)\. (.+)$/gm,
      '<li class="ml-4 text-[15px] leading-[1.7] list-decimal" style="color:var(--text-secondary)">$2</li>'
    )
    .replace(
      /\n{2,}/g,
      '</p><p class="mb-3" style="color:var(--text-secondary)">'
    )
    .replace(/\n/g, "<br/>");
}

function colorizeJson(json: string): string {
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /"([^"]+)"(?=\s*:)/g,
      '<span style="color:var(--accent)">"$1"</span>'
    )
    .replace(
      /:\s*"([^"]*?)"/g,
      ': <span style="color:var(--system-green)">"$1"</span>'
    )
    .replace(
      /:\s*(\d+\.?\d*)/g,
      ': <span style="color:var(--system-blue)">$1</span>'
    )
    .replace(
      /:\s*(true|false)/g,
      ': <span style="color:#bf5af2">$1</span>'
    )
    .replace(
      /:\s*(null)/g,
      ': <span style="color:var(--text-tertiary)">$1</span>'
    );
}

export default function MemoryPage() {
  const [files, setFiles] = useState<MemoryFile[]>([]);
  const [selected, setSelected] = useState<MemoryFile | null>(null);
  const [loading, setLoading] = useState(true);

  function refresh() {
    fetch("/api/memory")
      .then((r) => r.json())
      .then((data: MemoryFile[]) => {
        setFiles(data);
        if (data.length > 0 && !selected) setSelected(data[0]);
        setLoading(false);
      });
  }

  useEffect(() => {
    refresh();
  }, []);

  const isJSON =
    selected?.label.includes("JSON") || selected?.path.endsWith(".json");

  let renderedContent: React.ReactNode = null;
  if (selected) {
    if (isJSON) {
      try {
        const pretty = JSON.stringify(JSON.parse(selected.content), null, 2);
        const lines = pretty.split("\n");
        renderedContent = (
          <div
            style={{
              background: "var(--fill-secondary)",
              borderRadius: "var(--radius-md)",
              padding: 16,
            }}
          >
            <div className="flex">
              {/* Line numbers */}
              <div
                className="flex-shrink-0 pr-4 mr-4 select-none"
                style={{
                  borderRight: "1px solid var(--separator)",
                }}
              >
                {lines.map((_, i) => (
                  <div
                    key={i}
                    className="font-mono text-[11px] leading-relaxed text-right min-w-[2.5ch]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
              {/* Syntax highlighted content */}
              <pre
                className="font-mono text-[13px] whitespace-pre-wrap leading-relaxed flex-1"
                style={{ color: "var(--text-secondary)" }}
                dangerouslySetInnerHTML={{
                  __html: colorizeJson(pretty),
                }}
              />
            </div>
          </div>
        );
      } catch {
        renderedContent = (
          <div
            style={{
              background: "var(--fill-secondary)",
              borderRadius: "var(--radius-md)",
              padding: 16,
            }}
          >
            <pre
              className="font-mono text-[13px] whitespace-pre-wrap"
              style={{ color: "var(--system-red)" }}
            >
              {selected.content}
            </pre>
          </div>
        );
      }
    } else {
      renderedContent = (
        <div
          className="text-[15px] leading-[1.7]"
          style={{ color: "var(--text-secondary)" }}
          dangerouslySetInnerHTML={{
            __html: `<p class="mb-3" style="color:var(--text-secondary)">${simpleMarkdown(selected.content)}</p>`,
          }}
        />
      );
    }
  }

  const lineCount = selected ? selected.content.split("\n").length : 0;
  const words = selected ? wordCount(selected.content) : 0;

  return (
    <div className="flex h-full" style={{ background: "var(--bg)" }}>
      {/* Sidebar */}
      <div
        className="w-[240px] flex-shrink-0 flex flex-col"
        style={{
          background: "var(--material-regular)",
          backdropFilter: "var(--sidebar-backdrop)",
          WebkitBackdropFilter: "var(--sidebar-backdrop)",
          borderRight: "1px solid var(--separator)",
        }}
      >
        {/* Sidebar header */}
        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--separator)",
          }}
        >
          <span
            className="text-[17px] font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Memory
          </span>
          <button
            onClick={refresh}
            className="hover:opacity-80 transition-opacity text-[16px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            &#8635;
          </button>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div
              className="p-4 text-[14px] animate-pulse"
              style={{ color: "var(--text-secondary)" }}
            >
              Loading...
            </div>
          ) : (
            files.map((file) => {
              const isActive = selected?.path === file.path;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelected(file)}
                  className="w-full text-left transition-colors"
                  style={{
                    height: 52,
                    padding: "12px 16px",
                    background: isActive
                      ? "var(--fill-secondary)"
                      : undefined,
                    borderLeft: isActive
                      ? "3px solid var(--accent)"
                      : "3px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      e.currentTarget.style.background =
                        "var(--material-ultra-thin)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      e.currentTarget.style.background = "";
                  }}
                >
                  <div
                    className="text-[14px] font-medium truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {file.label}
                  </div>
                  <div
                    className="text-[11px] mt-0.5"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {timeAgo(file.lastModified)}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main content */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={{ background: "var(--bg)" }}
      >
        {selected ? (
          <>
            {/* Content area */}
            <div
              className="flex-1 overflow-y-auto"
              style={{ padding: "32px 40px" }}
            >
              <div style={{ maxWidth: 760, margin: "0 auto" }}>
                {/* File title */}
                <h1
                  className="text-[28px] font-bold"
                  style={{
                    color: "var(--text-primary)",
                    letterSpacing: "-0.5px",
                  }}
                >
                  {selected.label}
                </h1>

                {/* Meta */}
                <div
                  className="text-[12px] mt-1 mb-6"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isJSON ? (
                    <>
                      {lineCount} lines &middot; Modified{" "}
                      {timeAgo(selected.lastModified)}
                    </>
                  ) : (
                    <>
                      {words.toLocaleString()} words &middot;{" "}
                      {lineCount} lines &middot; Modified{" "}
                      {timeAgo(selected.lastModified)}
                    </>
                  )}
                </div>

                {/* Content */}
                {renderedContent}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <span
              className="text-[15px]"
              style={{ color: "var(--text-secondary)" }}
            >
              Select a file from the sidebar
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
