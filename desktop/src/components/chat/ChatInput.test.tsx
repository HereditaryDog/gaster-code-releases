import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'
import { act } from 'react'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
  getGitInfo: vi.fn(),
  getRepositoryContext: vi.fn(),
  getRecentProjects: vi.fn(),
  search: vi.fn(),
  browse: vi.fn(),
  wsSend: vi.fn(),
}))

vi.mock('../../api/sessions', () => ({
  sessionsApi: {
    create: mocks.create,
    delete: mocks.delete,
    list: mocks.list,
    getGitInfo: mocks.getGitInfo,
    getRepositoryContext: mocks.getRepositoryContext,
    getRecentProjects: mocks.getRecentProjects,
  },
}))

vi.mock('../../api/filesystem', () => ({
  filesystemApi: {
    search: mocks.search,
    browse: mocks.browse,
  },
}))

vi.mock('../../api/websocket', () => ({
  wsManager: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    onMessage: vi.fn(() => () => {}),
    clearHandlers: vi.fn(),
    send: mocks.wsSend,
  },
}))

vi.mock('../controls/PermissionModeSelector', () => ({
  PermissionModeSelector: () => <button type="button">Permissions</button>,
}))

vi.mock('../controls/ModelSelector', () => ({
  ModelSelector: () => <button type="button">Model</button>,
}))

import { ChatInput } from './ChatInput'
import { useChatStore } from '../../stores/chatStore'
import { useSessionStore } from '../../stores/sessionStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useTabStore } from '../../stores/tabStore'
import { useWorkspaceChatContextStore } from '../../stores/workspaceChatContextStore'

describe('ChatInput file mentions', () => {
  const sessionId = 'session-file-mention'
  const initialChatState = useChatStore.getInitialState()
  const initialSessionState = useSessionStore.getInitialState()
  const initialTabState = useTabStore.getInitialState()
  const initialWorkspaceContextState = useWorkspaceChatContextStore.getInitialState()

  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    useSettingsStore.setState({ locale: 'en' })
    useChatStore.setState(initialChatState, true)
    useSessionStore.setState(initialSessionState, true)
    useTabStore.setState(initialTabState, true)
    useWorkspaceChatContextStore.setState(initialWorkspaceContextState, true)

    useTabStore.setState({
      activeTabId: sessionId,
      tabs: [{ sessionId, title: 'Project', type: 'session', status: 'idle' }],
    })
    useSessionStore.setState({
      sessions: [{
        id: sessionId,
        title: 'Project',
        createdAt: '2026-05-01T00:00:00.000Z',
        modifiedAt: '2026-05-01T00:00:00.000Z',
        messageCount: 1,
        projectPath: '/repo',
        workDir: '/repo',
        workDirExists: true,
      }],
      activeSessionId: sessionId,
    })
    useChatStore.setState({
      sessions: {
        [sessionId]: {
          messages: [{ id: 'existing', type: 'assistant_text', content: 'ready', timestamp: 1 }],
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
        },
      },
    })
    mocks.getGitInfo.mockResolvedValue({ branch: 'main', repoName: 'repo', workDir: '/repo', changedFiles: 0 })
    mocks.create.mockResolvedValue({ sessionId: 'created-session', workDir: '/repo' })
    mocks.delete.mockResolvedValue(undefined)
    mocks.list.mockResolvedValue({ sessions: [], total: 0 })
    mocks.getRepositoryContext.mockResolvedValue({
      state: 'ok',
      workDir: '/repo',
      repoRoot: '/repo',
      repoName: 'repo',
      currentBranch: 'main',
      defaultBranch: 'main',
      dirty: false,
      branches: [
        { name: 'main', current: true, local: true, remote: false, checkedOut: false },
        { name: 'feature/a', current: false, local: true, remote: false, checkedOut: false },
      ],
      worktrees: [],
    })
    mocks.getRecentProjects.mockResolvedValue({
      projects: [{
        projectPath: 'repo',
        realPath: '/repo',
        projectName: 'repo',
        isGit: true,
        repoName: 'repo',
        branch: 'main',
        modifiedAt: '2026-05-01T00:00:00.000Z',
        sessionCount: 1,
      }],
    })
  })

  it('keeps unsent composer drafts isolated when switching between session tabs', async () => {
    const historySessionId = 'history-session'
    useTabStore.setState({
      activeTabId: sessionId,
      tabs: [
        { sessionId, title: 'New session', type: 'session', status: 'idle' },
        { sessionId: historySessionId, title: 'History session', type: 'session', status: 'idle' },
      ],
    })
    useSessionStore.setState({
      sessions: [
        {
          id: sessionId,
          title: 'New session',
          createdAt: '2026-05-01T00:00:00.000Z',
          modifiedAt: '2026-05-01T00:00:00.000Z',
          messageCount: 0,
          projectPath: '/repo',
          workDir: '/repo',
          workDirExists: true,
        },
        {
          id: historySessionId,
          title: 'History session',
          createdAt: '2026-05-01T00:00:00.000Z',
          modifiedAt: '2026-05-01T00:00:00.000Z',
          messageCount: 1,
          projectPath: '/repo',
          workDir: '/repo',
          workDirExists: true,
        },
      ],
      activeSessionId: sessionId,
    })
    useChatStore.setState({
      sessions: {
        [sessionId]: {
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
        },
        [historySessionId]: {
          messages: [{ id: 'history-message', type: 'assistant_text', content: 'ready', timestamp: 1 }],
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
        },
      },
    })

    render(<ChatInput variant="hero" />)

    const input = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(input, {
      target: { value: 'new tab draft', selectionStart: 13 },
    })
    expect(input.value).toBe('new tab draft')

    act(() => {
      useTabStore.setState({ activeTabId: historySessionId })
    })

    await waitFor(() => {
      expect(input.value).toBe('')
    })

    fireEvent.change(input, {
      target: { value: 'history tab draft', selectionStart: 17 },
    })

    act(() => {
      useTabStore.setState({ activeTabId: sessionId })
    })

    await waitFor(() => {
      expect(input.value).toBe('new tab draft')
    })

    act(() => {
      useTabStore.setState({ activeTabId: historySessionId })
    })

    await waitFor(() => {
      expect(input.value).toBe('history tab draft')
    })
  })

  it('restores an unsent composer draft after the composer unmounts', async () => {
    const { unmount } = render(<ChatInput compact />)

    const input = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(input, {
      target: { value: 'keep this prompt while I inspect another tab', selectionStart: 43 },
    })
    expect(input.value).toBe('keep this prompt while I inspect another tab')

    unmount()
    render(<ChatInput compact />)

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('keep this prompt while I inspect another tab')
    })
  })

  it('turns a selected @ file into a chip without corrupting the typed path', async () => {
    mocks.search.mockResolvedValueOnce({
      currentPath: '/repo',
      parentPath: '/',
      query: 'conditions.py',
      entries: [
        { name: 'conditions.py', path: '/repo/backend/src/conditions.py', relativePath: 'backend/src/conditions.py', isDirectory: false },
      ],
    })

    render(<ChatInput compact />)

    const input = screen.getByRole('textbox') as HTMLTextAreaElement
    const mention = '@backend/src/conditions.py'
    fireEvent.change(input, {
      target: {
        value: `${mention} 记一下这个文件讲了什么东西。`,
        selectionStart: mention.length,
      },
    })

    fireEvent.click(await screen.findByText('backend/src/conditions.py'))

    await waitFor(() => {
      expect(input.value).toBe('记一下这个文件讲了什么东西。')
    })
    expect(screen.getByText('conditions.py')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mocks.wsSend).toHaveBeenCalledWith(sessionId, {
      type: 'user_message',
      content: '记一下这个文件讲了什么东西。',
      attachments: [{
        type: 'file',
        name: 'conditions.py',
        path: '/repo/backend/src/conditions.py',
        isDirectory: false,
        lineStart: undefined,
        lineEnd: undefined,
        note: undefined,
        quote: undefined,
      }],
    })
    const messages = useChatStore.getState().sessions[sessionId]?.messages ?? []
    expect(messages[messages.length - 1]).toMatchObject({
      type: 'user_text',
      content: '记一下这个文件讲了什么东西。',
      modelContent: '@"/repo/backend/src/conditions.py" 记一下这个文件讲了什么东西。',
      attachments: [{ name: 'conditions.py', path: '/repo/backend/src/conditions.py' }],
    })
  })

  it('turns a selected @ directory into a workspace chip and model path reference', async () => {
    mocks.search.mockResolvedValueOnce({
      currentPath: '/repo',
      parentPath: '/',
      query: 'backend',
      entries: [
        { name: 'backend', path: '/repo/backend', relativePath: 'backend', isDirectory: true },
      ],
    })

    render(<ChatInput compact />)

    const input = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(input, {
      target: {
        value: '@backend 讲一下这个目录。',
        selectionStart: '@backend'.length,
      },
    })

    fireEvent.click(await screen.findByRole('option', { name: /backend/i }))

    await waitFor(() => {
      expect(input.value).toBe('讲一下这个目录。')
    })
    expect(screen.getByText('backend/')).toBeInTheDocument()
    expect(screen.getByText('folder')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mocks.wsSend).toHaveBeenCalledWith(sessionId, {
      type: 'user_message',
      content: '讲一下这个目录。',
      attachments: [{
        type: 'file',
        name: 'backend/',
        path: '/repo/backend',
        isDirectory: true,
        lineStart: undefined,
        lineEnd: undefined,
        note: undefined,
        quote: undefined,
      }],
    })
    const messages = useChatStore.getState().sessions[sessionId]?.messages ?? []
    expect(messages[messages.length - 1]).toMatchObject({
      type: 'user_text',
      content: '讲一下这个目录。',
      modelContent: '@"/repo/backend" 讲一下这个目录。',
      attachments: [{ name: 'backend/', path: '/repo/backend' }],
    })
  })

  it('does not keep the working glow after the chat returns to idle', async () => {
    useTabStore.setState({
      activeTabId: sessionId,
      tabs: [{ sessionId, title: 'Project', type: 'session', status: 'running' }],
    })

    const { container } = render(<ChatInput compact />)

    await waitFor(() => {
      expect(container.querySelector('.chat-composer-shell')).not.toHaveClass('chat-composer-shell--active')
    })
  })

  it('shows the working glow while the active chat is busy', async () => {
    useChatStore.setState((state) => ({
      sessions: {
        ...state.sessions,
        [sessionId]: {
          ...state.sessions[sessionId]!,
          chatState: 'thinking',
        },
      },
    }))

    const { container } = render(<ChatInput compact />)

    await waitFor(() => {
      expect(container.querySelector('.chat-composer-shell')).toHaveClass('chat-composer-shell--active')
    })
  })

  it('uses a blended bottom surface for the default chat composer', async () => {
    const { container } = render(<ChatInput />)

    expect(screen.getByTestId('chat-input-shell')).toHaveClass('chat-input-shell--blended')
    expect(container.querySelector('.chat-composer-shell')).toHaveClass('chat-composer-shell--blended')
    await waitFor(() => expect(mocks.getGitInfo).toHaveBeenCalled())
  })

  it('keeps the project selector clickable after a chat has messages', async () => {
    render(<ChatInput />)

    fireEvent.click(screen.getByRole('button', { name: /repo/i }))

    expect(await screen.findByText('Choose a different folder')).toBeInTheDocument()
    expect(mocks.getRecentProjects).toHaveBeenCalled()
  })

  it('keeps the default desktop composer compact', async () => {
    const { container } = render(<ChatInput />)

    expect(screen.getByTestId('chat-input-shell')).toHaveClass('chat-input-shell--compact')
    expect(screen.getByTestId('chat-input-panel')).toHaveClass('chat-composer-shell--compact')
    expect(screen.getByRole('textbox')).toHaveClass('chat-composer-textarea--compact')
    expect(container.querySelector('.chat-composer-toolbar')).toHaveClass('chat-composer-toolbar--compact')
    await waitFor(() => expect(mocks.getGitInfo).toHaveBeenCalled())
  })

  it('uses the compact chrome-style composer for a new hero session', async () => {
    useSessionStore.setState({
      sessions: [{
        id: sessionId,
        title: 'Project',
        createdAt: '2026-05-01T00:00:00.000Z',
        modifiedAt: '2026-05-01T00:00:00.000Z',
        messageCount: 0,
        projectPath: '/repo',
        workDir: '/repo',
        workDirExists: true,
      }],
      activeSessionId: sessionId,
    })
    useChatStore.setState({
      sessions: {
        [sessionId]: {
          ...useChatStore.getState().sessions[sessionId]!,
          messages: [],
        },
      },
    })

    const { container } = render(<ChatInput variant="hero" />)

    expect(screen.getByTestId('chat-input-shell')).toHaveClass('chat-input-shell--hero-compact')
    expect(screen.getByTestId('chat-input-panel')).toHaveClass('chat-composer-shell--compact')
    expect(screen.getByRole('textbox')).toHaveAttribute('rows', '1')
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Ask Gaster Code to edit, debug or explain...')
    expect(screen.getByRole('textbox')).toHaveClass('chat-composer-textarea--compact')
    expect(screen.getByRole('textbox')).toHaveClass('pb-10')
    expect(container.querySelector('.chat-composer-toolbar')).toHaveClass('chat-composer-toolbar--compact')
    const projectContextRow = screen.getByTestId('chat-input-project-context-row')
    expect(projectContextRow).toHaveClass('chat-input-project-context-row--attached')
    expect(screen.getByTestId('chat-input-panel')).not.toContainElement(projectContextRow)
    expect(screen.getByTestId('repository-launch-controls')).toHaveClass('repository-launch-controls--chips')
    await waitFor(() => expect(mocks.getGitInfo).toHaveBeenCalled())
  })

  it('hides local composer glow controls in dev by default', async () => {
    render(<ChatInput compact />)

    expect(screen.queryByTestId('composer-glow-panel')).not.toBeInTheDocument()
    await waitFor(() => expect(mocks.getGitInfo).toHaveBeenCalled())
  })

  it('shows local composer glow controls when the local flag enables it', async () => {
    window.localStorage.setItem('gaster-code-composer-glow-panel', '1')

    render(<ChatInput compact />)

    expect(screen.getByTestId('composer-glow-panel')).toBeInTheDocument()
    await waitFor(() => expect(mocks.getGitInfo).toHaveBeenCalled())
  })

  it('updates composer glow variables from local controls', async () => {
    window.localStorage.setItem('gaster-code-composer-glow-panel', '1')
    useChatStore.setState((state) => ({
      sessions: {
        ...state.sessions,
        [sessionId]: {
          ...state.sessions[sessionId]!,
          chatState: 'thinking',
        },
      },
    }))

    const { container } = render(<ChatInput compact />)

    expect(screen.getByTestId('composer-glow-panel')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('边框强度'), { target: { value: '82' } })
    fireEvent.change(screen.getByLabelText('近光扩散'), { target: { value: '7' } })

    await waitFor(() => {
      expect(container.querySelector('.chat-composer-shell')).toHaveStyle({
        '--composer-glow-border-mix': '82%',
        '--composer-glow-near-spread': '7px',
      })
    })
  })

  it('can preview the composer glow locally while the chat is idle', async () => {
    window.localStorage.setItem('gaster-code-composer-glow-panel', '1')
    const { container } = render(<ChatInput compact />)

    expect(container.querySelector('.chat-composer-shell')).not.toHaveClass('chat-composer-shell--active')

    fireEvent.click(screen.getByLabelText('预览光效'))

    expect(container.querySelector('.chat-composer-shell')).toHaveClass('chat-composer-shell--active')
    await waitFor(() => expect(mocks.getGitInfo).toHaveBeenCalled())
  })

  it('uses the tuned composer glow values by default', async () => {
    window.localStorage.setItem('gaster-code-composer-glow-panel', '1')

    const { container } = render(<ChatInput compact />)

    await waitFor(() => {
      expect(container.querySelector('.chat-composer-shell')).toHaveStyle({
        '--composer-glow-border-mix': '86%',
        '--composer-glow-ring-mix': '50%',
        '--composer-glow-near-alpha': '47%',
        '--composer-glow-near-blur': '52px',
        '--composer-glow-near-spread': '13px',
        '--composer-glow-far-alpha': '13%',
        '--composer-glow-far-blur': '99px',
        '--composer-glow-far-spread': '8px',
      })
    })
  })
})
