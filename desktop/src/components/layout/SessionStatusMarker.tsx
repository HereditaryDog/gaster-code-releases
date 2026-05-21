import { useId } from 'react'
import type { ChatState } from '../../types/chat'

export type SidebarSessionActivityState = Extract<
  ChatState,
  'idle' | 'thinking' | 'streaming' | 'tool_executing' | 'permission_pending'
>

type SessionStatusMarkerProps = {
  state: SidebarSessionActivityState
  selected: boolean
}

const BRAND_G_PATH =
  'M512 449.142857l414.285714 0q6.857143 38.285714 6.857143 73.142857 0 124-52 221.428571t-148.285714 152.285714-220.857143 54.857143q-89.714286 0-170.857143-34.571429t-140-93.428571-93.428571-140-34.571429-170.857143 34.571429-170.857143 93.428571-140 140-93.428571 170.857143-34.571429q171.428571 0 294.285714 114.857143l-119.428571 114.857143q-70.285714-68-174.857143-68-73.714286 0-136.285714 37.142857t-99.142857 100.857143-36.571429 139.142857 36.571429 139.142857 99.142857 100.857143 136.285714 37.142857q49.714286 0 91.428571-13.714286t68.571429-34.285714 46.857143-46.857143 29.428571-49.714286 12.857143-44.571429l-249.142857 0 0-150.857143z'

function StreamingMask({ scopeId }: { scopeId: string }) {
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const clipPathId = `sidebar-streaming-clip-${scopeId}-${instanceId}`
  const gradientId = `sidebar-streaming-glint-${scopeId}-${instanceId}`

  return (
    <svg viewBox="0 0 1024 1024" className="sidebar-session-status-marker__streaming-mask" aria-hidden="true">
      <defs>
        <clipPath id={clipPathId}>
          <path d={BRAND_G_PATH} />
        </clipPath>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
          <stop offset="42%" stopColor="#fff" stopOpacity="0.52" />
          <stop offset="54%" stopColor="currentColor" stopOpacity="0.92" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${clipPathId})`}>
        <rect
          className="sidebar-session-status-marker__streaming-glint sidebar-session-status-marker__streaming-glint--one"
          x="-635"
          y="-164"
          width="451"
          height="1352"
          rx="226"
          fill={`url(#${gradientId})`}
        />
        <rect
          className="sidebar-session-status-marker__streaming-glint sidebar-session-status-marker__streaming-glint--two"
          x="-635"
          y="-164"
          width="451"
          height="1352"
          rx="226"
          fill={`url(#${gradientId})`}
        />
      </g>
    </svg>
  )
}

export function SessionStatusMarker({ state, selected }: SessionStatusMarkerProps) {
  const stateClass =
    state === 'thinking'
      ? 'sidebar-session-status-marker--thinking'
      : state === 'streaming'
        ? 'sidebar-session-status-marker--streaming'
        : state === 'tool_executing'
          ? 'sidebar-session-status-marker--tool-executing'
          : state === 'permission_pending'
            ? 'sidebar-session-status-marker--permission-pending'
            : 'sidebar-session-status-marker--idle'

  if (state === 'idle') {
    return (
      <span
        data-testid="session-status-marker"
        data-state="idle"
        aria-hidden="true"
        className={`sidebar-session-status-marker ${stateClass}`}
        style={{
          backgroundColor: selected ? 'var(--color-brand)' : 'var(--color-text-tertiary)',
          opacity: selected ? 1 : 0.5,
        }}
      />
    )
  }

  return (
    <span
      data-testid="session-status-marker"
      data-state={state}
      aria-hidden="true"
      className={`sidebar-session-status-marker ${stateClass}`}
    >
      <span className="sidebar-session-status-marker__pulse">
        <span className="sidebar-session-status-marker__glyph-shell">
          <svg
            viewBox="0 0 1024 1024"
            className="sidebar-session-status-marker__glyph"
            focusable="false"
            aria-hidden="true"
          >
            <path d={BRAND_G_PATH} />
          </svg>
          {state === 'thinking' && (
            <span className="sidebar-session-status-marker__thinking-arc" aria-hidden="true" />
          )}
          {state === 'streaming' && (
            <StreamingMask scopeId={selected ? 'selected' : 'background'} />
          )}
          {state === 'tool_executing' && (
            <span className="sidebar-session-status-marker__tool-ring" aria-hidden="true" />
          )}
          {state === 'permission_pending' && (
            <span className="sidebar-session-status-marker__permission-ring" aria-hidden="true" />
          )}
        </span>
      </span>
    </span>
  )
}
