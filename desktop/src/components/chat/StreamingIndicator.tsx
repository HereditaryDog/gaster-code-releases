import { useChatStore } from '../../stores/chatStore'
import { useTabStore } from '../../stores/tabStore'

const BRAND_G_PATH =
  'M512 449.142857l414.285714 0q6.857143 38.285714 6.857143 73.142857 0 124-52 221.428571t-148.285714 152.285714-220.857143 54.857143q-89.714286 0-170.857143-34.571429t-140-93.428571-93.428571-140-34.571429-170.857143 34.571429-170.857143 93.428571-140 140-93.428571 170.857143-34.571429q171.428571 0 294.285714 114.857143l-119.428571 114.857143q-70.285714-68-174.857143-68-73.714286 0-136.285714 37.142857t-99.142857 100.857143-36.571429 139.142857 36.571429 139.142857 99.142857 100.857143 136.285714 37.142857q49.714286 0 91.428571-13.714286t68.571429-34.285714 46.857143-46.857143 29.428571-49.714286 12.857143-44.571429l-249.142857 0 0-150.857143z'

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

export function StreamingIndicator() {
  const activeTabId = useTabStore((s) => s.activeTabId)
  const sessionState = useChatStore((s) => activeTabId ? s.sessions[activeTabId] : undefined)
  const chatState = sessionState?.chatState ?? 'idle'
  const statusVerb = sessionState?.statusVerb ?? ''
  const elapsedSeconds = sessionState?.elapsedSeconds ?? 0
  const tokenUsage = sessionState?.tokenUsage ?? { input_tokens: 0, output_tokens: 0 }
  let verb: string
  if (statusVerb) {
    verb = statusVerb
  } else {
    verb = chatState === 'thinking' ? 'Thinking' : chatState === 'tool_executing' ? 'Running' : 'Working'
  }

  return (
    <div className="mb-2 flex w-fit items-center gap-2 rounded-full border border-[var(--color-border)]/40 bg-[var(--color-surface-container-low)] px-3 py-1">
      <span className="chat-streaming-indicator__glyph text-[var(--color-brand)] animate-shimmer" aria-hidden="true">
        <svg viewBox="0 0 1024 1024" className="h-[0.7rem] w-[0.7rem] fill-current">
          <path d={BRAND_G_PATH} />
        </svg>
      </span>
      <span className="text-xs font-medium text-[var(--color-text-secondary)]">{verb}...</span>
      {elapsedSeconds > 0 && (
        <span className="text-[10px] text-[var(--color-text-tertiary)]">
          {formatElapsed(elapsedSeconds)}
        </span>
      )}
      {tokenUsage.output_tokens > 0 && (
        <span className="text-[10px] text-[var(--color-text-tertiary)]">
          · ↓ {tokenUsage.output_tokens}
        </span>
      )}
    </div>
  )
}
