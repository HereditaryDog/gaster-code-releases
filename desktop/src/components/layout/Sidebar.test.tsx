import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'

vi.mock('./ProjectFilter', () => ({
  ProjectFilter: () => <div data-testid="project-filter" />,
}))

vi.mock('../../i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, string | number>) => {
    const translations: Record<string, string> = {
      'sidebar.newSession': 'New Session',
      'sidebar.scheduled': 'Scheduled',
      'sidebar.terminal': 'Terminal',
      'sidebar.drawing': 'Drawing',
      'sidebar.settings': 'Settings',
      'sidebar.searchPlaceholder': 'Search sessions',
      'sidebar.noSessions': 'No sessions',
      'sidebar.noMatching': 'No matching sessions',
      'sidebar.sessionListFailed': 'Session list failed',
      'common.retry': 'Retry',
      'common.loading': 'Loading...',
      'common.cancel': 'Cancel',
      'common.delete': 'Delete',
      'common.rename': 'Rename',
      'sidebar.timeGroup.today': 'Today',
      'sidebar.timeGroup.yesterday': 'Yesterday',
      'sidebar.timeGroup.last7days': 'Last 7 Days',
      'sidebar.timeGroup.last30days': 'Last 30 Days',
      'sidebar.timeGroup.older': 'Older',
      'sidebar.missingDir': 'Missing',
      'sidebar.confirmDelete': 'Delete this session? This cannot be undone.',
      'sidebar.batchManage': 'Batch manage',
      'sidebar.batchSelectedCount': '{count} selected',
      'sidebar.batchSelectAll': 'Select all',
      'sidebar.batchDeselectAll': 'Deselect all',
      'sidebar.batchSelectGroup': 'Select {group}',
      'sidebar.batchDeleteSelected': 'Delete selected ({count})',
      'sidebar.batchDeleteConfirm': 'Delete {count} sessions? This cannot be undone.',
      'sidebar.batchDeleteConfirmBody': 'The following sessions will be deleted:',
      'sidebar.batchDeleteMore': '...and {count} more',
      'sidebar.batchExit': 'Cancel batch mode',
      'sidebar.batchDeleteSucceeded': 'Deleted {count} sessions.',
      'sidebar.batchDeleteFailed': '{count} sessions could not be deleted.',
      'sidebar.collapse': 'Collapse sidebar',
      'sidebar.expand': 'Expand sidebar',
      'sidebar.resize': 'Resize sidebar',
    }

    let text = translations[key] ?? key
    for (const [name, value] of Object.entries(params ?? {})) {
      text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value))
    }
    return text
  },
}))

import { Sidebar } from './Sidebar'
import { useChatStore, type PerSessionState } from '../../stores/chatStore'
import { useSessionStore } from '../../stores/sessionStore'
import { useTabStore } from '../../stores/tabStore'
import { SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MIN_WIDTH, useUIStore } from '../../stores/uiStore'
import type { SessionListItem } from '../../types/session'

describe('Sidebar', () => {
  const connectToSession = vi.fn()
  const disconnectSession = vi.fn()
  const fetchSessions = vi.fn()
  const createSession = vi.fn()
  const deleteSession = vi.fn()
  const deleteSessions = vi.fn()
  const addToast = vi.fn()

  beforeEach(() => {
    connectToSession.mockReset()
    disconnectSession.mockReset()
    fetchSessions.mockReset()
    createSession.mockReset()
    deleteSession.mockReset()
    deleteSessions.mockReset()
    addToast.mockReset()

    window.localStorage.clear()
    useTabStore.setState({ tabs: [], activeTabId: null })
    act(() => {
      useSessionStore.setState({
        sessions: [],
        activeSessionId: null,
        isLoading: false,
        error: null,
        selectedProjects: [],
        availableProjects: [],
        isBatchMode: false,
        selectedSessionIds: new Set(),
        fetchSessions,
        createSession,
        deleteSession,
        deleteSessions,
      })
      useChatStore.setState({
        connectToSession,
        disconnectSession,
      } as Partial<ReturnType<typeof useChatStore.getState>>)
      useUIStore.setState({
        sidebarOpen: true,
        sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
        sidebarResizing: false,
        addToast,
      } as Partial<ReturnType<typeof useUIStore.getState>>)
    })
  })

  afterEach(() => {
    act(() => {
      useTabStore.setState({ tabs: [], activeTabId: null })
    })
  })

  function buildSession(overrides: Partial<SessionListItem> = {}): SessionListItem {
    return {
      id: 'session-1',
      title: 'Open Session',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      messageCount: 1,
      projectPath: '/workspace/project',
      workDir: '/workspace/project',
      workDirExists: true,
      ...overrides,
    }
  }

  function buildLiveSessionState(overrides: Partial<PerSessionState> = {}): PerSessionState {
    return {
      messages: [],
      chatState: 'idle',
      connectionState: 'connected',
      streamingText: '',
      streamingToolInput: '',
      activeToolUseId: null,
      activeToolName: null,
      activeThinkingId: null,
      pendingPermission: null,
      pendingComputerUsePermission: null,
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
      elapsedSeconds: 0,
      statusVerb: '',
      slashCommands: [],
      agentTaskNotifications: {},
      elapsedTimer: null,
      composerPrefill: null,
      ...overrides,
    }
  }

  it('opens a new tab when creating a session from the sidebar', async () => {
    createSession.mockResolvedValue('session-new-1')

    render(<Sidebar />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'New Session' }))
    })

    await waitFor(() => {
      expect(createSession).toHaveBeenCalled()
      expect(connectToSession).toHaveBeenCalledWith('session-new-1')
    })

    expect(useTabStore.getState().tabs).toEqual([
      { sessionId: 'session-new-1', title: 'New Session', type: 'session', status: 'idle' },
    ])
    expect(useTabStore.getState().activeTabId).toBe('session-new-1')
    expect(screen.getByRole('complementary')).not.toHaveAttribute('data-tauri-drag-region')
  })

  it('shows a toast when session creation fails', async () => {
    createSession.mockRejectedValue(new Error('boom'))

    render(<Sidebar />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'New Session' }))
    })

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith({
        type: 'error',
        message: 'boom',
      })
    })

    expect(useTabStore.getState().tabs).toEqual([])
  })

  it('requires confirmation before deleting a session from the sidebar', async () => {
    deleteSession.mockResolvedValue(undefined)
    useSessionStore.setState({
      sessions: [
        {
          id: 'session-1',
          title: 'Open Session',
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          messageCount: 1,
          projectPath: '/workspace/project',
          workDir: '/workspace/project',
          workDirExists: true,
        },
      ],
    })
    useTabStore.setState({
      tabs: [{ sessionId: 'session-1', title: 'Open Session', type: 'session', status: 'idle' }],
      activeTabId: 'session-1',
    })

    render(<Sidebar />)

    fireEvent.contextMenu(screen.getByRole('button', { name: /Open Session/ }))

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(deleteSession).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('Delete this session? This cannot be undone.')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    })

    await waitFor(() => {
      expect(deleteSession).toHaveBeenCalledWith('session-1')
      expect(disconnectSession).toHaveBeenCalledWith('session-1')
    })

    expect(useTabStore.getState().tabs).toEqual([])
    expect(useTabStore.getState().activeTabId).toBeNull()
  })

  it('selects and deletes multiple sessions from batch mode', async () => {
    deleteSessions.mockResolvedValue({
      ok: true,
      successes: ['session-1', 'session-2'],
      failures: [],
    })
    const now = new Date().toISOString()
    useSessionStore.setState({
      sessions: [
        buildSession({ id: 'session-1', title: 'First Session', createdAt: now, modifiedAt: now }),
        buildSession({ id: 'session-2', title: 'Second Session', createdAt: now, modifiedAt: now }),
      ],
    })
    useTabStore.setState({
      tabs: [
        { sessionId: 'session-1', title: 'First Session', type: 'session', status: 'idle' },
        { sessionId: 'session-2', title: 'Second Session', type: 'session', status: 'idle' },
      ],
      activeTabId: 'session-1',
    })

    render(<Sidebar />)

    fireEvent.click(screen.getByRole('button', { name: 'Batch manage' }))
    fireEvent.click(screen.getByRole('button', { name: /First Session/ }))
    fireEvent.click(screen.getByRole('button', { name: /Second Session/ }))

    expect(screen.getByText('2 selected')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete selected (2)' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Delete 2 sessions? This cannot be undone.')).toBeInTheDocument()
    expect(within(dialog).getByText('First Session')).toBeInTheDocument()
    expect(within(dialog).getByText('Second Session')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    })

    await waitFor(() => {
      expect(deleteSessions).toHaveBeenCalledWith(['session-1', 'session-2'])
      expect(disconnectSession).toHaveBeenCalledWith('session-1')
      expect(disconnectSession).toHaveBeenCalledWith('session-2')
    })
    expect(useTabStore.getState().tabs).toEqual([])
    expect(addToast).toHaveBeenCalledWith({
      type: 'success',
      message: 'Deleted 2 sessions.',
    })
  })

  it('renders batch-selected sessions as separated selected rows', () => {
    const now = new Date().toISOString()
    useSessionStore.setState({
      sessions: [
        buildSession({ id: 'session-1', title: 'First Session', createdAt: now, modifiedAt: now }),
        buildSession({ id: 'session-2', title: 'Second Session', createdAt: now, modifiedAt: now }),
        buildSession({ id: 'session-3', title: 'Third Session', createdAt: now, modifiedAt: now }),
      ],
    })
    useTabStore.setState({
      tabs: [{ sessionId: 'session-2', title: 'Second Session', type: 'session', status: 'idle' }],
      activeTabId: 'session-2',
    })

    render(<Sidebar />)

    fireEvent.click(screen.getByRole('button', { name: 'Batch manage' }))
    fireEvent.click(screen.getByRole('button', { name: /First Session/ }))

    expect(screen.getByRole('button', { name: /First Session/ }).parentElement).toHaveClass('mb-1.5')
    expect(screen.getByRole('button', { name: /First Session/ })).toHaveClass('sidebar-session-row--selected')
    expect(screen.getByRole('button', { name: /Second Session/ })).toHaveClass('sidebar-session-row--active')
    expect(screen.getByRole('button', { name: /Third Session/ })).toHaveClass('sidebar-session-row--idle')
  })

  it('collapses into an icon rail and expands back', async () => {
    render(<Sidebar />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    })

    expect(useUIStore.getState().sidebarOpen).toBe(false)
    expect(screen.queryByPlaceholderText('Search sessions')).not.toBeInTheDocument()
    expect(screen.getByRole('complementary')).toHaveAttribute('data-state', 'closed')
    expect(screen.getByTestId('sidebar-expand-button')).toHaveClass('sidebar-toggle-button--collapsed')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    })

    expect(useUIStore.getState().sidebarOpen).toBe(true)
    expect(screen.getByPlaceholderText('Search sessions')).toBeInTheDocument()
    expect(screen.getByRole('complementary')).toHaveAttribute('data-state', 'open')
  })

  it('updates sidebar width immediately while resizing and persists it on release', () => {
    render(<Sidebar />)

    const resizeHandle = screen.getByRole('separator', { name: 'Resize sidebar' })

    act(() => {
      fireEvent(resizeHandle, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: SIDEBAR_DEFAULT_WIDTH }))
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: SIDEBAR_DEFAULT_WIDTH + 60 }))
    })

    expect(useUIStore.getState().sidebarResizing).toBe(true)
    expect(useUIStore.getState().sidebarWidth).toBe(SIDEBAR_DEFAULT_WIDTH + 60)
    expect(window.localStorage.getItem('gaster-code-sidebar-width')).toBeNull()

    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup'))
    })

    expect(useUIStore.getState().sidebarResizing).toBe(false)
    expect(window.localStorage.getItem('gaster-code-sidebar-width')).toBe(String(SIDEBAR_DEFAULT_WIDTH + 60))
  })

  it('collapses into the icon rail when resized past the left threshold', () => {
    useUIStore.setState({ sidebarOpen: true, sidebarWidth: 320, sidebarResizing: false })
    render(<Sidebar />)

    const resizeHandle = screen.getByRole('separator', { name: 'Resize sidebar' })

    act(() => {
      fireEvent(resizeHandle, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 320 }))
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 200 }))
    })

    expect(useUIStore.getState().sidebarOpen).toBe(true)
    expect(useUIStore.getState().sidebarWidth).toBe(SIDEBAR_MIN_WIDTH)

    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup'))
    })

    expect(useUIStore.getState().sidebarOpen).toBe(false)
    expect(useUIStore.getState().sidebarWidth).toBe(320)
    expect(window.localStorage.getItem('gaster-code-sidebar-width')).toBeNull()
    expect(screen.getByRole('complementary')).toHaveAttribute('data-state', 'closed')
  })

  it('keeps the project filter section overflow visible for dropdown menus', () => {
    render(<Sidebar />)

    expect(screen.getByTestId('sidebar-project-filter-section')).toHaveStyle({ overflow: 'visible' })
    expect(screen.getByTestId('sidebar-project-filter-section')).toHaveClass('relative', 'z-20')
  })

  it('keeps the session list section in a constrained flex column for scrolling', () => {
    render(<Sidebar />)

    expect(screen.getByTestId('sidebar-session-list-section')).toHaveClass('flex', 'flex-1', 'min-h-0', 'flex-col')
  })

  it('uses clearer Codex-like typography for session history rows', () => {
    useSessionStore.setState({
      sessions: [buildSession({ title: 'Explain analysis mode behavior' })],
    })

    render(<Sidebar />)

    const groupLabel = screen.getByText('Today')
    const sessionButton = screen.getByRole('button', { name: /Explain analysis mode behavior/ })
    const title = within(sessionButton).getByText('Explain analysis mode behavior')
    const relativeTime = within(sessionButton).getByText(/now|\d+[smhd]/)

    expect(groupLabel).toHaveClass('text-[12px]', 'font-semibold')
    expect(sessionButton).toHaveClass('py-2.5', 'text-sm')
    expect(title).toHaveClass('font-semibold', 'tracking-normal')
    expect(title).not.toHaveClass('tracking-[-0.01em]')
    expect(relativeTime).toHaveClass('text-[11px]')
  })

  it('shows a loading state instead of an empty session list while initial fetch is pending', () => {
    useSessionStore.setState({ isLoading: true, sessions: [] })

    render(<Sidebar />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByText('No sessions')).not.toBeInTheDocument()
  })

  it('renders the existing idle dot when a session has no live runtime state', () => {
    useSessionStore.setState({
      sessions: [buildSession({ title: 'Idle Session' })],
    })

    render(<Sidebar />)

    const sessionButton = screen.getByRole('button', { name: /Idle Session/ })
    const marker = within(sessionButton).getByTestId('session-status-marker')

    expect(marker).toHaveAttribute('data-state', 'idle')
    expect(marker).toHaveClass('sidebar-session-status-marker', 'sidebar-session-status-marker--idle')
    expect(marker.querySelector('svg')).toBeNull()
  })

  it.each([
    ['thinking', 'thinking', 'sidebar-session-status-marker--thinking'],
    ['streaming', 'streaming', 'sidebar-session-status-marker--streaming'],
    ['tool_executing', 'tool_executing', 'sidebar-session-status-marker--tool-executing'],
    ['permission_pending', 'permission_pending', 'sidebar-session-status-marker--permission-pending'],
  ] as const)('renders the brand G marker for %s sessions', (chatState, expectedState, expectedClass) => {
    useSessionStore.setState({
      sessions: [buildSession({ title: `${chatState} session` })],
    })
    useChatStore.setState({
      sessions: {
        'session-1': buildLiveSessionState({ chatState }),
      },
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    render(<Sidebar />)

    const sessionButton = screen.getByRole('button', { name: new RegExp(`${chatState} session`, 'i') })
    const marker = within(sessionButton).getByTestId('session-status-marker')

    expect(marker).toHaveAttribute('data-state', expectedState)
    expect(marker).toHaveClass('sidebar-session-status-marker', expectedClass)
    expect(marker.querySelector('svg')).not.toBeNull()
  })

  it('renders tool executing with the lighter, faster orbit distinct from thinking', () => {
    useSessionStore.setState({
      sessions: [
        buildSession({ id: 'thinking-session', title: 'Thinking Session' }),
        buildSession({ id: 'tool-session', title: 'Tool Session' }),
      ],
    })
    useChatStore.setState({
      sessions: {
        'thinking-session': buildLiveSessionState({ chatState: 'thinking' }),
        'tool-session': buildLiveSessionState({ chatState: 'tool_executing' }),
      },
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    render(<Sidebar />)

    const thinkingMarker = within(screen.getByRole('button', { name: /Thinking Session/ })).getByTestId('session-status-marker')
    const toolMarker = within(screen.getByRole('button', { name: /Tool Session/ })).getByTestId('session-status-marker')

    expect(thinkingMarker.querySelector('.sidebar-session-status-marker__thinking-arc')).not.toBeNull()
    expect(toolMarker.querySelector('.sidebar-session-status-marker__tool-ring')).not.toBeNull()
    expect(toolMarker.querySelector('.sidebar-session-status-marker__thinking-arc')).toBeNull()
    expect(toolMarker.querySelector('.sidebar-session-status-marker__tool-ring circle')).toBeNull()
  })

  it('uses a static shell for active markers while keeping internal ornaments state-specific', () => {
    useSessionStore.setState({
      sessions: [
        buildSession({ id: 'session-1', title: 'Thinking Session' }),
        buildSession({ id: 'session-2', title: 'Streaming Session' }),
      ],
    })
    useChatStore.setState({
      sessions: {
        'session-1': buildLiveSessionState({ chatState: 'thinking' }),
        'session-2': buildLiveSessionState({ chatState: 'streaming' }),
      },
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    render(<Sidebar />)

    const thinkingMarker = within(screen.getByRole('button', { name: /Thinking Session/ })).getByTestId('session-status-marker')
    const streamingMarker = within(screen.getByRole('button', { name: /Streaming Session/ })).getByTestId('session-status-marker')

    expect(thinkingMarker.querySelector('.sidebar-session-status-marker__pulse')).not.toBeNull()
    expect(streamingMarker.querySelector('.sidebar-session-status-marker__pulse')).not.toBeNull()
    expect(thinkingMarker.querySelector('.sidebar-session-status-marker__trail')).toBeNull()
    expect(streamingMarker.querySelector('.sidebar-session-status-marker__trail')).toBeNull()
    expect(thinkingMarker.querySelector('.sidebar-session-status-marker__halo')).toBeNull()
    expect(streamingMarker.querySelector('.sidebar-session-status-marker__halo')).toBeNull()
    expect(thinkingMarker.querySelector('.sidebar-session-status-marker__ring')).toBeNull()
    expect(streamingMarker.querySelector('.sidebar-session-status-marker__ring')).toBeNull()
  })

  it.each([
    ['thinking', '.sidebar-session-status-marker__thinking-arc'],
    ['streaming', '.sidebar-session-status-marker__streaming-mask'],
    ['tool_executing', '.sidebar-session-status-marker__tool-ring'],
    ['permission_pending', '.sidebar-session-status-marker__permission-ring'],
  ] as const)('renders the redesigned internal ornament for %s', (chatState, expectedSelector) => {
    useSessionStore.setState({
      sessions: [buildSession({ title: `${chatState} ornament session` })],
    })
    useChatStore.setState({
      sessions: {
        'session-1': buildLiveSessionState({ chatState }),
      },
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    render(<Sidebar />)

    const marker = within(
      screen.getByRole('button', { name: new RegExp(`${chatState} ornament session`, 'i') }),
    ).getByTestId('session-status-marker')

    expect(marker.querySelector(expectedSelector)).not.toBeNull()
  })

  it('renders permission pending as the preview-matching waiting ring instead of pause bars', () => {
    useSessionStore.setState({
      sessions: [buildSession({ title: 'Pending Session' })],
    })
    useChatStore.setState({
      sessions: {
        'session-1': buildLiveSessionState({ chatState: 'permission_pending' }),
      },
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    render(<Sidebar />)

    const marker = within(screen.getByRole('button', { name: /Pending Session/ })).getByTestId('session-status-marker')

    expect(marker.querySelector('.sidebar-session-status-marker__permission-ring')).not.toBeNull()
    expect(marker.querySelector('.sidebar-session-status-marker__permission-pause')).toBeNull()
  })

  it('renders streaming as a preview-matching in-glyph shimmer mask instead of fallback bars', () => {
    useSessionStore.setState({
      sessions: [buildSession({ title: 'Streaming Session' })],
    })
    useChatStore.setState({
      sessions: {
        'session-1': buildLiveSessionState({ chatState: 'streaming' }),
      },
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    render(<Sidebar />)

    const marker = within(screen.getByRole('button', { name: /Streaming Session/ })).getByTestId('session-status-marker')

    expect(marker.querySelector('.sidebar-session-status-marker__streaming-mask')).not.toBeNull()
    expect(marker.querySelector('.sidebar-session-status-marker__streaming-glint--one')).not.toBeNull()
    expect(marker.querySelector('.sidebar-session-status-marker__streaming-glint--two')).not.toBeNull()
    expect(marker.querySelector('foreignObject, foreignobject')).toBeNull()
    expect(marker.querySelector('.sidebar-session-status-marker__streaming-bars')).toBeNull()
  })

  it('renders preview-matching ring layers for thinking and tool states', () => {
    useSessionStore.setState({
      sessions: [
        buildSession({ id: 'session-1', title: 'Preview Thinking' }),
        buildSession({ id: 'session-2', title: 'Preview Tool' }),
      ],
    })
    useChatStore.setState({
      sessions: {
        'session-1': buildLiveSessionState({ chatState: 'thinking' }),
        'session-2': buildLiveSessionState({ chatState: 'tool_executing' }),
      },
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    render(<Sidebar />)

    const thinkingMarker = within(screen.getByRole('button', { name: /Preview Thinking/ })).getByTestId('session-status-marker')
    const toolMarker = within(screen.getByRole('button', { name: /Preview Tool/ })).getByTestId('session-status-marker')

    expect(thinkingMarker.querySelector('.sidebar-session-status-marker__thinking-arc')).not.toBeNull()
    expect(toolMarker.querySelector('.sidebar-session-status-marker__tool-ring')).not.toBeNull()
    expect(thinkingMarker.querySelector('.sidebar-session-status-marker__thinking-arc circle')).toBeNull()
    expect(toolMarker.querySelector('.sidebar-session-status-marker__tool-ring circle')).toBeNull()
  })

  it('keeps row selection styling while showing live markers for selected and non-selected sessions', () => {
    useSessionStore.setState({
      sessions: [
        buildSession({ id: 'session-1', title: 'Selected Live Session' }),
        buildSession({ id: 'session-2', title: 'Background Live Session' }),
      ],
    })
    useTabStore.setState({
      tabs: [
        { sessionId: 'session-1', title: 'Selected Live Session', type: 'session', status: 'running' },
        { sessionId: 'session-2', title: 'Background Live Session', type: 'session', status: 'running' },
      ],
      activeTabId: 'session-1',
    })
    useChatStore.setState({
      sessions: {
        'session-1': buildLiveSessionState({ chatState: 'thinking' }),
        'session-2': buildLiveSessionState({ chatState: 'streaming' }),
      },
    } as Partial<ReturnType<typeof useChatStore.getState>>)

    render(<Sidebar />)

    const selectedButton = screen.getByRole('button', { name: /Selected Live Session/ })
    const backgroundButton = screen.getByRole('button', { name: /Background Live Session/ })

    expect(selectedButton.className).toContain('bg-[var(--color-sidebar-item-active)]')
    expect(backgroundButton.className).toContain('hover:bg-[var(--color-sidebar-item-hover)]')
    expect(within(selectedButton).getByTestId('session-status-marker')).toHaveAttribute('data-state', 'thinking')
    expect(within(backgroundButton).getByTestId('session-status-marker')).toHaveAttribute('data-state', 'streaming')
  })

  it('uses the Gaster G mark and wordmark styling for the sidebar brand', () => {
    const { container } = render(<Sidebar />)

    const logo = container.querySelector('aside img')
    expect(logo).toHaveAttribute('src', '/app-icon.svg')
    expect(logo).toHaveClass('sidebar-brand-logo')

    const wordmark = screen.getByText('Gaster Code')
    expect(wordmark).toHaveClass('uppercase', 'tracking-[0.145em]')
    expect(wordmark).toHaveStyle({
      fontFamily: '"Helvetica Neue", "Arial Narrow", Arial, sans-serif',
      transform: 'scaleX(0.94)',
    })
  })

  it('links the sidebar GitHub button to the author profile', () => {
    render(<Sidebar />)

    expect(screen.getByTitle('GitHub')).toHaveAttribute('href', 'https://github.com/HereditaryDog')
  })
})
