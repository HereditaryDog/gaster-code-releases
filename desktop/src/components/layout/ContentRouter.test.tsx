import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const {
  scheduledTasksModuleLoaded,
  settingsModuleLoaded,
  drawingModuleLoaded,
} = vi.hoisted(() => ({
  scheduledTasksModuleLoaded: vi.fn(),
  settingsModuleLoaded: vi.fn(),
  drawingModuleLoaded: vi.fn(),
}))

vi.mock('../../pages/EmptySession', () => ({
  EmptySession: () => <div data-testid="empty-session" />,
}))

vi.mock('../../pages/ActiveSession', () => ({
  ActiveSession: () => <div data-testid="active-session" />,
}))

vi.mock('../../pages/ScheduledTasks', () => {
  scheduledTasksModuleLoaded()
  return { ScheduledTasks: () => <div data-testid="scheduled-tasks" /> }
})

vi.mock('../../pages/Settings', () => {
  settingsModuleLoaded()
  return { Settings: () => <div data-testid="settings-page" /> }
})

vi.mock('../../pages/Drawing', () => {
  drawingModuleLoaded()
  return { Drawing: () => <div data-testid="drawing-page" /> }
})

vi.mock('../../pages/TerminalSettings', () => ({
  TerminalSettings: ({ active, cwd, onNewTerminal, testId }: { active: boolean; cwd?: string; onNewTerminal: () => void; testId: string }) => (
    <div data-active={active ? 'true' : 'false'} data-cwd={cwd ?? ''} data-testid={testId}>
      <button type="button" onClick={onNewTerminal}>New Terminal</button>
    </div>
  ),
}))

import { ContentRouter } from './ContentRouter'
import { useTabStore } from '../../stores/tabStore'

describe('ContentRouter terminal tabs', () => {
  afterEach(() => {
    useTabStore.setState({ tabs: [], activeTabId: null })
    scheduledTasksModuleLoaded.mockClear()
    settingsModuleLoaded.mockClear()
    drawingModuleLoaded.mockClear()
  })

  it('does not load secondary page modules for the active chat route', async () => {
    useTabStore.setState({
      tabs: [{ sessionId: 'session-1', title: 'Chat', type: 'session', status: 'idle' }],
      activeTabId: 'session-1',
    })

    render(<ContentRouter />)

    expect(await screen.findByTestId('active-session')).toBeInTheDocument()
    expect(scheduledTasksModuleLoaded).not.toHaveBeenCalled()
    expect(settingsModuleLoaded).not.toHaveBeenCalled()
    expect(drawingModuleLoaded).not.toHaveBeenCalled()
  })

  it('renders the active terminal tab as main content', () => {
    useTabStore.setState({
      tabs: [{ sessionId: '__terminal__1', title: 'Terminal 1', type: 'terminal', status: 'idle', terminalCwd: '/tmp/project' }],
      activeTabId: '__terminal__1',
    })

    render(<ContentRouter />)

    expect(screen.getByTestId('terminal-host-__terminal__1')).toHaveAttribute('data-active', 'true')
    expect(screen.getByTestId('terminal-host-__terminal__1')).toHaveAttribute('data-cwd', '/tmp/project')
    expect(screen.queryByTestId('active-session')).not.toBeInTheDocument()
  })

  it('keeps terminal tabs mounted while chat content is active', async () => {
    useTabStore.setState({
      tabs: [
        { sessionId: '__terminal__1', title: 'Terminal 1', type: 'terminal', status: 'idle' },
        { sessionId: 'session-1', title: 'Chat', type: 'session', status: 'idle' },
      ],
      activeTabId: 'session-1',
    })

    render(<ContentRouter />)

    expect(screen.getByTestId('terminal-host-__terminal__1')).toHaveAttribute('data-active', 'false')
    expect(await screen.findByTestId('active-session')).toBeInTheDocument()
  })

  it('can open another terminal tab from a terminal page', () => {
    useTabStore.setState({
      tabs: [{ sessionId: '__terminal__1', title: 'Terminal 1', type: 'terminal', status: 'idle', terminalCwd: '/tmp/project' }],
      activeTabId: '__terminal__1',
    })

    render(<ContentRouter />)
    fireEvent.click(screen.getByRole('button', { name: 'New Terminal' }))

    expect(useTabStore.getState().tabs.filter((tab) => tab.type === 'terminal')).toHaveLength(2)
    expect(useTabStore.getState().activeTabId).not.toBe('__terminal__1')
    expect(useTabStore.getState().tabs.find((tab) => tab.sessionId === useTabStore.getState().activeTabId)?.terminalCwd).toBe('/tmp/project')
  })
})
