"use client";
import { Handle, Position } from "@xyflow/react";
import type { Agent } from "@/lib/types";

interface AgentNodeProps {
  data: Agent & Record<string, unknown>;
}

export function AgentNode({ data }: AgentNodeProps) {
  const hasCrons = data.crons && data.crons.length > 0;
  const hasError = hasCrons && data.crons.some(c => c.status === 'error');
  const hasOk = hasCrons && data.crons.some(c => c.status === 'ok');

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "transparent", border: "none", width: 6, height: 6 }}
      />
      <div
        style={{
          width: '164px',
          padding: '14px',
          borderRadius: '18px',
          background: 'var(--material-thin)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: 'var(--shadow-card)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'all 200ms var(--ease-spring)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
          e.currentTarget.style.boxShadow = 'var(--shadow-overlay)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
          e.currentTarget.style.boxShadow = 'var(--shadow-card)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        {/* Top: emoji + status dot */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '18px', lineHeight: 1 }}>{data.emoji}</span>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: hasError ? 'var(--system-red)' : hasOk ? 'var(--system-green)' : 'var(--text-tertiary)',
            flexShrink: 0,
          }} />
        </div>

        {/* Name */}
        <div style={{
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '-0.2px',
          color: 'var(--text-primary)',
          marginTop: '8px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {data.name}
        </div>

        {/* Title */}
        <div style={{
          fontSize: '11px',
          fontWeight: 400,
          color: 'var(--text-secondary)',
          letterSpacing: '0.01em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginTop: '2px',
        }}>
          {data.title}
        </div>

        {/* Cron pill */}
        {hasCrons && (
          <div style={{
            marginTop: '8px',
            display: 'inline-block',
            background: 'var(--fill-tertiary)',
            borderRadius: '6px',
            padding: '2px 8px',
            fontSize: '10px',
            fontWeight: 500,
            color: 'var(--text-secondary)',
          }}>
            {data.crons.length} cron{data.crons.length > 1 ? 's' : ''}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "transparent", border: "none", width: 6, height: 6 }}
      />
    </>
  );
}

export const nodeTypes = { agentNode: AgentNode };
