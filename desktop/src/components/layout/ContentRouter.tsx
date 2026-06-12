import { lazy, Suspense, type ReactNode } from 'react'
import { useTabStore } from '../../stores/tabStore'
import { EmptySession } from '../../pages/EmptySession'
import { TerminalSettings } from '../../pages/TerminalSettings'

const LazyActiveSession = lazy(() =>
  import('../../pages/ActiveSession').then(({ ActiveSession }) => ({ default: ActiveSession })),
)
const LazyScheduledTasks = lazy(() =>
  import('../../pages/ScheduledTasks').then(({ ScheduledTasks }) => ({ default: ScheduledTasks })),
)
const LazySettings = lazy(() =>
  import('../../pages/Settings').then(({ Settings }) => ({ default: Settings })),
)
const LazyDrawing = lazy(() =>
  import('../../pages/Drawing').then(({ Drawing }) => ({ default: Drawing })),
)

function LazyPageShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-0 flex-1 bg-[var(--color-bg)]" />}>
      {children}
    </Suspense>
  )
}

export function ContentRouter() {
  const activeTabId = useTabStore((s) => s.activeTabId)
  const tabs = useTabStore((s) => s.tabs)
  const activeTabType = tabs.find((t) => t.sessionId === activeTabId)?.type
  const terminalTabs = tabs.filter((tab) => tab.type === 'terminal')

  let page: ReactNode = null
  if (!activeTabId || !activeTabType) {
    page = <EmptySession />
  } else if (activeTabType === 'settings') {
    page = <LazyPageShell><LazySettings /></LazyPageShell>
  } else if (activeTabType === 'scheduled') {
    page = <LazyPageShell><LazyScheduledTasks /></LazyPageShell>
  } else if (activeTabType === 'drawing') {
    page = <LazyPageShell><LazyDrawing /></LazyPageShell>
  } else if (activeTabType !== 'terminal') {
    page = <LazyPageShell><LazyActiveSession /></LazyPageShell>
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      {page && (
        <div className="absolute inset-0 z-10 flex min-h-0 flex-col overflow-hidden">
          {page}
        </div>
      )}
      {terminalTabs.map((tab) => {
        const active = tab.sessionId === activeTabId
        const visible = activeTabType === 'terminal' && active
        return (
          <div
            key={tab.sessionId}
            aria-hidden={!visible}
            data-testid={`terminal-tab-panel-${tab.sessionId}`}
            className={`absolute inset-0 flex min-h-0 flex-col overflow-hidden ${
              visible ? 'z-20 opacity-100' : 'pointer-events-none z-0 opacity-0'
            }`}
          >
            <TerminalSettings
              active={active}
              cwd={tab.terminalCwd}
              workspace
              testId={`terminal-host-${tab.sessionId}`}
              onNewTerminal={() => useTabStore.getState().openTerminalTab(tab.terminalCwd)}
            />
          </div>
        )
      })}
    </div>
  )
}
