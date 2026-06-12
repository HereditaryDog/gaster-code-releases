import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MessageList, buildRenderModel } from './MessageList'
import { relativizeWorkspacePath } from './CurrentTurnChangeCard'
import { sessionsApi } from '../../api/sessions'
import { useChatStore } from '../../stores/chatStore'
import { useWorkspaceChatContextStore } from '../../stores/workspaceChatContextStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { SETTINGS_TAB_ID, useTabStore } from '../../stores/tabStore'
import { useUIStore } from '../../stores/uiStore'
import type { UIMessage } from '../../types/chat'
import type { PerSessionState } from '../../stores/chatStore'

const ACTIVE_TAB = 'active-tab'

async function waitForProgrammaticScrollReset() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  })
}

function makeSessionState(overrides: Partial<PerSessionState> = {}): PerSessionState {
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

function makeAssistantTranscript(count: number, prefix = 'assistant transcript line'): UIMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `assistant-${index}`,
    type: 'assistant_text',
    content: index % 25 === 0
      ? [
          `${prefix} ${index}`,
          '',
          '```ts',
          'const value = "this intentionally makes the row much taller"',
          '```',
        ].join('\n')
      : `${prefix} ${index}`,
    timestamp: index,
  }))
}

function stubProgressiveTranscriptIdleCallbacks() {
  const callbacks: Array<() => void> = []
  const win = window as typeof window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
    cancelIdleCallback?: (handle: number) => void
  }
  const originalRequestIdleCallback = win.requestIdleCallback
  const originalCancelIdleCallback = win.cancelIdleCallback

  Object.defineProperty(win, 'requestIdleCallback', {
    configurable: true,
    value: (callback: () => void) => {
      callbacks.push(callback)
      return callbacks.length
    },
  })
  Object.defineProperty(win, 'cancelIdleCallback', {
    configurable: true,
    value: vi.fn(),
  })

  return {
    callbacks,
    restore: () => {
      Object.defineProperty(win, 'requestIdleCallback', {
        configurable: true,
        value: originalRequestIdleCallback,
      })
      Object.defineProperty(win, 'cancelIdleCallback', {
        configurable: true,
        value: originalCancelIdleCallback,
      })
    },
  }
}

function findTextNodeContaining(container: Element, text: string) {
  const walker = document.createTreeWalker(container, 4)
  let current = walker.nextNode()
  while (current) {
    if (current.textContent?.includes(text)) return current
    current = walker.nextNode()
  }
  throw new Error(`Unable to find text node containing ${text}`)
}

async function selectMessageText(element: Element, text: string) {
  const textNode = findTextNodeContaining(element, text)
  const startOffset = textNode.textContent?.indexOf(text) ?? -1
  const range = document.createRange()
  range.setStart(textNode, startOffset)
  range.setEnd(textNode, startOffset + text.length)
  Object.assign(range, {
    getBoundingClientRect: () => ({
      left: 160,
      top: 80,
      right: 280,
      bottom: 98,
      width: 120,
      height: 18,
      x: 160,
      y: 80,
      toJSON: () => ({}),
    }),
  })

  const selectableRoot = element.closest('[data-message-shell]')?.parentElement?.parentElement
  Object.assign(selectableRoot ?? element, {
    getBoundingClientRect: () => ({
      left: 120,
      top: 48,
      right: 620,
      bottom: 240,
      width: 500,
      height: 192,
      x: 120,
      y: 48,
      toJSON: () => ({}),
    }),
  })

  window.getSelection()?.removeAllRanges()
  window.getSelection()?.addRange(range)

  await act(async () => {
    fireEvent.mouseUp(element, { clientX: 260, clientY: 104 })
    await Promise.resolve()
  })
}

describe('MessageList nested tool calls', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useSettingsStore.setState({ locale: 'en' })
    useTabStore.setState({ activeTabId: ACTIVE_TAB, tabs: [{ sessionId: ACTIVE_TAB, title: 'Test', type: 'session' as const, status: 'idle' }] })
    useUIStore.setState({ pendingSettingsTab: null })
    useChatStore.setState({ sessions: { [ACTIVE_TAB]: makeSessionState() } })
    useWorkspaceChatContextStore.setState(useWorkspaceChatContextStore.getInitialState(), true)
    vi.spyOn(sessionsApi, 'getTurnCheckpoints').mockImplementation(
      () => new Promise(() => {}),
    )
    vi.spyOn(sessionsApi, 'getWorkspaceStatus').mockResolvedValue({
      state: 'ok',
      workDir: '/tmp/example-project',
      repoName: 'example-project',
      branch: null,
      isGitRepo: false,
      changedFiles: [],
    })
  })

  it('renders the tail of long transcripts first, then progressively fills older messages', async () => {
    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: makeAssistantTranscript(220),
        }),
      },
    })

    const { container } = render(<MessageList />)

    expect(screen.getByText('assistant transcript line 219')).toBeTruthy()
    expect(screen.queryByText('assistant transcript line 0')).toBeNull()
    const initialRenderedMessages = container.querySelectorAll('[data-message-shell="assistant"]').length
    expect(initialRenderedMessages).toBeLessThan(220)
    expect(container.querySelector('[data-progressive-transcript-spacer]')).toBeTruthy()

    await waitFor(() => {
      expect(container.querySelectorAll('[data-message-shell="assistant"]').length).toBeGreaterThan(initialRenderedMessages)
    })
  })

  it('starts progressive rendering when an active transcript grows past the long-transcript threshold', async () => {
    const idle = stubProgressiveTranscriptIdleCallbacks()
    try {
      useChatStore.setState({
        sessions: {
          [ACTIVE_TAB]: makeSessionState({
            messages: makeAssistantTranscript(90),
          }),
        },
      })

      const { container } = render(<MessageList />)

      expect(screen.getByText('assistant transcript line 0')).toBeTruthy()
      expect(container.querySelector('[data-progressive-transcript-spacer]')).toBeNull()

      act(() => {
        useChatStore.setState((state) => ({
          sessions: {
            ...state.sessions,
            [ACTIVE_TAB]: {
              ...state.sessions[ACTIVE_TAB]!,
              messages: makeAssistantTranscript(130),
            },
          },
        }))
      })

      expect(screen.getByText('assistant transcript line 129')).toBeTruthy()
      expect(screen.queryByText('assistant transcript line 0')).toBeNull()
      expect(container.querySelector('[data-progressive-transcript-spacer]')).toBeTruthy()
      expect(container.querySelectorAll('[data-message-shell="assistant"]').length).toBeLessThan(130)
      expect(idle.callbacks.length).toBeGreaterThan(0)
    } finally {
      idle.restore()
    }
  })

  it('keeps the bottom anchored when progressive transcript batches hydrate older messages', async () => {
    const idle = stubProgressiveTranscriptIdleCallbacks()
    try {
      useChatStore.setState({
        sessions: {
          [ACTIVE_TAB]: makeSessionState({
            messages: makeAssistantTranscript(180),
          }),
        },
      })

      const { container } = render(<MessageList />)
      const scroller = container.querySelector('.overflow-y-auto') as HTMLDivElement
      let scrollHeight = 1000
      let scrollTop = 600
      Object.defineProperty(scroller, 'scrollHeight', {
        configurable: true,
        get: () => scrollHeight,
      })
      Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 400 })
      Object.defineProperty(scroller, 'scrollTop', {
        configurable: true,
        get: () => scrollTop,
        set: (value) => {
          scrollTop = value
        },
      })

      await waitForProgrammaticScrollReset()
      fireEvent.scroll(scroller)
      const initialRenderedMessages = container.querySelectorAll('[data-message-shell="assistant"]').length
      await waitFor(() => {
        expect(idle.callbacks.length).toBeGreaterThan(0)
      })

      scrollHeight = 1250
      await act(async () => {
        idle.callbacks.shift()?.()
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(container.querySelectorAll('[data-message-shell="assistant"]').length).toBeGreaterThan(initialRenderedMessages)
        expect(scrollTop).toBe(850)
      })
    } finally {
      idle.restore()
    }
  })

  it('adds selected user message text to the chat context', async () => {
    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [{
            id: 'user-1',
            type: 'user_text',
            content: 'Please inspect the workspace selection behavior.',
            timestamp: 1,
          }],
        }),
      },
    })

    render(<MessageList />)

    const userText = screen.getByText('Please inspect the workspace selection behavior.')
    await selectMessageText(userText, 'workspace selection behavior')
    const floatingAddButton = screen.getByRole('button', { name: 'Add to chat' })

    expect(floatingAddButton.style.left).toBe('141px')
    expect(floatingAddButton.style.top).toBe('26px')

    fireEvent.click(floatingAddButton)

    expect(useWorkspaceChatContextStore.getState().referencesBySession[ACTIVE_TAB]).toMatchObject([
      {
        kind: 'chat-selection',
        path: 'chat://user/user-1',
        name: 'User message',
        messageId: 'user-1',
        sourceRole: 'user',
        quote: 'workspace selection behavior',
      },
    ])
    expect(window.getSelection()?.toString()).toBe('')
  })

  it('dismisses the selected-message action when clicking outside the popover', async () => {
    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [{
            id: 'assistant-1',
            type: 'assistant_text',
            content: 'Clicking outside should clear the selected reply action.',
            timestamp: 1,
          }],
        }),
      },
    })

    render(<MessageList />)

    const assistantText = screen.getByText(/Clicking outside should clear/)
    await selectMessageText(assistantText, 'selected reply')
    expect(screen.getByRole('button', { name: 'Add to chat' })).toBeTruthy()

    await act(async () => {
      fireEvent.pointerDown(document.body)
      await Promise.resolve()
    })

    expect(screen.queryByRole('button', { name: 'Add to chat' })).toBeNull()
    expect(window.getSelection()?.toString()).toBe('')
  })

  it('dismisses the selected-message action when the transcript scrolls', async () => {
    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [{
            id: 'assistant-scroll',
            type: 'assistant_text',
            content: 'Scrolling should clear the selected reply action.',
            timestamp: 1,
          }],
        }),
      },
    })

    render(<MessageList />)

    const assistantText = screen.getByText(/Scrolling should clear/)
    await selectMessageText(assistantText, 'selected reply')
    expect(screen.getByRole('button', { name: 'Add to chat' })).toBeTruthy()

    await act(async () => {
      fireEvent.scroll(document)
      await Promise.resolve()
    })

    expect(screen.queryByRole('button', { name: 'Add to chat' })).toBeNull()
    expect(window.getSelection()?.toString()).toBe('')
  })

  it('renders sub-agent tool calls inline beneath the parent agent tool call', () => {
    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [
            {
              id: 'tool-agent',
              type: 'tool_use',
              toolName: 'Agent',
              toolUseId: 'agent-1',
              input: { description: 'Inspect src/components' },
              timestamp: 1,
            },
            {
              id: 'tool-read',
              type: 'tool_use',
              toolName: 'Read',
              toolUseId: 'read-1',
              input: { file_path: '/tmp/example.ts' },
              timestamp: 2,
              parentToolUseId: 'agent-1',
            },
            {
              id: 'result-read',
              type: 'tool_result',
              toolUseId: 'read-1',
              content: 'const answer = 42',
              isError: false,
              timestamp: 3,
              parentToolUseId: 'agent-1',
            },
          ],
        }),
      },
    })

    const { container } = render(<MessageList />)

    expect(screen.getAllByText('Running').length).toBeGreaterThan(0)
    expect(screen.getByText(/Read .*example\.ts.*done/i)).toBeTruthy()
    expect(container.textContent).toContain('Agent')
  })

  it('keeps mixed tool groups active while a nested child tool call is unresolved', () => {
    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          chatState: 'idle',
          messages: [
            {
              id: 'tool-task-update',
              type: 'tool_use',
              toolName: 'TaskUpdate',
              toolUseId: 'task-update-1',
              input: { tasks: [{ id: '4', status: 'in_progress', content: 'Run page integration' }] },
              timestamp: 1,
            },
            {
              id: 'tool-bash',
              type: 'tool_use',
              toolName: 'Bash',
              toolUseId: 'bash-1',
              input: { command: 'bun run dev' },
              timestamp: 2,
            },
            {
              id: 'result-task-update',
              type: 'tool_result',
              toolUseId: 'task-update-1',
              content: 'updated',
              isError: false,
              timestamp: 3,
            },
            {
              id: 'result-bash',
              type: 'tool_result',
              toolUseId: 'bash-1',
              content: 'started',
              isError: false,
              timestamp: 4,
            },
            {
              id: 'tool-local-bash',
              type: 'tool_use',
              toolName: 'local_bash',
              toolUseId: 'local-bash-1',
              input: { description: 'Run page integration checks' },
              timestamp: 5,
              parentToolUseId: 'task-update-1',
            },
          ],
        }),
      },
    })

    render(<MessageList />)

    const groupSummary = screen.getByText('TaskUpdate (1), ran a command')
    const groupButton = groupSummary.closest('button')
    expect(groupButton?.textContent).not.toContain('check_circle')
    expect(screen.getByText('local_bash')).toBeTruthy()
  })

  it('does not render blank assistant bubbles for whitespace-only text', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-empty',
        type: 'assistant_text',
        content: '\n\n  ',
        timestamp: 1,
      },
      {
        id: 'tool-bash',
        type: 'tool_use',
        toolName: 'Bash',
        toolUseId: 'bash-1',
        input: { command: 'pwd' },
        timestamp: 2,
      },
    ]

    const { renderItems } = buildRenderModel(messages)
    expect(renderItems).toHaveLength(1)
    expect(renderItems[0]).toMatchObject({ kind: 'tool_group' })

    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages,
          streamingText: '\n  ',
        }),
      },
    })

    const { container } = render(<MessageList />)
    expect(container.querySelectorAll('[data-message-shell="assistant"]')).toHaveLength(0)
  })

  it('adds a soft bottom fade on the full chat scroll area', () => {
    const { container } = render(<MessageList />)

    const scroller = container.querySelector('.overflow-y-auto')
    expect(scroller?.className).toContain('chat-scroll-area--composer-fade')
  })

  it('keeps root tool runs split when nested child tool calls appear between them', () => {
    const messages: UIMessage[] = [
      {
        id: 'tool-agent',
        type: 'tool_use',
        toolName: 'Agent',
        toolUseId: 'agent-1',
        input: { description: 'Inspect src/components' },
        timestamp: 1,
      },
      {
        id: 'tool-read',
        type: 'tool_use',
        toolName: 'Read',
        toolUseId: 'read-1',
        input: { file_path: '/tmp/example.ts' },
        timestamp: 2,
        parentToolUseId: 'agent-1',
      },
      {
        id: 'result-read',
        type: 'tool_result',
        toolUseId: 'read-1',
        content: 'const answer = 42',
        isError: false,
        timestamp: 3,
        parentToolUseId: 'agent-1',
      },
      {
        id: 'tool-write',
        type: 'tool_use',
        toolName: 'Write',
        toolUseId: 'write-1',
        input: { file_path: '/tmp/out.ts', content: 'export const value = 1' },
        timestamp: 4,
      },
    ]

    const { renderItems } = buildRenderModel(messages)
    const toolGroups = renderItems.filter((item) => item.kind === 'tool_group')

    expect(toolGroups).toHaveLength(2)
    expect(toolGroups.map((item) => item.toolCalls[0]?.toolUseId)).toEqual(['agent-1', 'write-1'])
  })

  it('keeps task-management tools from downgrading dispatched agents into a mixed tool tree', () => {
    const messages: UIMessage[] = [
      {
        id: 'tool-task-create',
        type: 'tool_use',
        toolName: 'TaskCreate',
        toolUseId: 'task-create-1',
        input: { subject: 'Review recent changes' },
        timestamp: 1,
      },
      {
        id: 'tool-task-update',
        type: 'tool_use',
        toolName: 'TaskUpdate',
        toolUseId: 'task-update-1',
        input: { id: '1', status: 'in_progress' },
        timestamp: 2,
      },
      {
        id: 'tool-agent-a',
        type: 'tool_use',
        toolName: 'Agent',
        toolUseId: 'agent-a',
        input: { description: 'Review desktop impact' },
        timestamp: 3,
      },
      {
        id: 'tool-agent-b',
        type: 'tool_use',
        toolName: 'Agent',
        toolUseId: 'agent-b',
        input: { description: 'Review runtime impact' },
        timestamp: 4,
      },
      {
        id: 'tool-agent-child-bash',
        type: 'tool_use',
        toolName: 'Bash',
        toolUseId: 'agent-a-bash',
        input: { command: 'git status --short' },
        timestamp: 5,
        parentToolUseId: 'agent-a',
      },
    ]

    const { renderItems, childToolCallsByParent } = buildRenderModel(messages)
    const toolGroups = renderItems.filter((item) => item.kind === 'tool_group')

    expect(toolGroups).toHaveLength(2)
    expect(toolGroups[0]?.toolCalls.map((toolCall) => toolCall.toolName)).toEqual([
      'TaskCreate',
      'TaskUpdate',
    ])
    expect(toolGroups[1]?.toolCalls.map((toolCall) => toolCall.toolName)).toEqual([
      'Agent',
      'Agent',
    ])
    expect(childToolCallsByParent.get('agent-a')?.map((toolCall) => toolCall.toolUseId)).toEqual([
      'agent-a-bash',
    ])
  })

  it('keeps later nested tool calls under their parent after an interleaved user message', () => {
    const messages: UIMessage[] = [
      {
        id: 'tool-agent',
        type: 'tool_use',
        toolName: 'Agent',
        toolUseId: 'agent-1',
        input: { description: 'Inspect src/components' },
        timestamp: 1,
      },
      {
        id: 'tool-read',
        type: 'tool_use',
        toolName: 'Read',
        toolUseId: 'read-1',
        input: { file_path: '/tmp/example.ts' },
        timestamp: 2,
        parentToolUseId: 'agent-1',
      },
      {
        id: 'user-follow-up',
        type: 'user_text',
        content: '顺便把刚才的问题也处理掉',
        timestamp: 3,
      },
      {
        id: 'tool-write',
        type: 'tool_use',
        toolName: 'Write',
        toolUseId: 'write-1',
        input: { file_path: '/tmp/out.ts', content: 'export const value = 1' },
        timestamp: 4,
        parentToolUseId: 'agent-1',
      },
    ]

    const { renderItems, childToolCallsByParent } = buildRenderModel(messages)
    const renderedKinds = renderItems.map((item) =>
      item.kind === 'tool_group'
        ? `tool:${item.toolCalls[0]?.toolUseId}`
        : `message:${item.message.id}`,
    )

    expect(renderedKinds).toEqual([
      'tool:agent-1',
      'message:user-follow-up',
    ])
    expect(
      (childToolCallsByParent.get('agent-1') ?? []).map((toolCall) => toolCall.toolUseId),
    ).toEqual(['read-1', 'write-1'])
  })

  it('does not render parented orphan tool results as root session messages', () => {
    const messages: UIMessage[] = [
      {
        id: 'tool-agent',
        type: 'tool_use',
        toolName: 'Agent',
        toolUseId: 'agent-1',
        input: { description: 'Inspect src/components' },
        timestamp: 1,
      },
      {
        id: 'result-child',
        type: 'tool_result',
        toolUseId: 'grep-1',
        content: 'Found 22 files',
        isError: false,
        timestamp: 2,
        parentToolUseId: 'agent-1',
      },
    ]

    const { renderItems } = buildRenderModel(messages)

    expect(renderItems).toHaveLength(1)
    expect(renderItems[0]).toMatchObject({ kind: 'tool_group' })
  })

  it('shows failed agent status and compact unavailable summary for Explore launch errors', () => {
    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [
            {
              id: 'tool-agent',
              type: 'tool_use',
              toolName: 'Agent',
              toolUseId: 'agent-1',
              input: { description: '探索整体架构', subagent_type: 'Explore' },
              timestamp: 1,
            },
            {
              id: 'result-agent',
              type: 'tool_result',
              toolUseId: 'agent-1',
              content: `Agent type 'Explore' not found. Available agents: general-purpose`,
              isError: true,
              timestamp: 2,
            },
          ],
        }),
      },
    })

    render(<MessageList sessionId={ACTIVE_TAB} />)

    expect(screen.getByText('Failed')).toBeTruthy()
    expect(screen.getByText('Explore agent unavailable in this session')).toBeTruthy()
  })

  it('shows completed agent output when no nested tool activity is available', () => {
    const longResult = '探索完成。让我将结果整合写入计划文件。第二段补充内容用于验证 dialog 展示的是完整结果而不是截断摘要。'

    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [
            {
              id: 'tool-agent',
              type: 'tool_use',
              toolName: 'Agent',
              toolUseId: 'agent-1',
              input: { description: '探索整体架构' },
              timestamp: 1,
            },
            {
              id: 'result-agent',
              type: 'tool_result',
              toolUseId: 'agent-1',
              content: {
                status: 'completed',
                content: [
                  { type: 'text', text: longResult },
                  {
                    type: 'text',
                    text: "agentId: a0c0c732f61442dc1 (use SendMessage with to: 'a0c0c732f61442dc1' to continue this agent)\n<usage>total_tokens: 17195\ntool_uses: 2\nduration_ms: 41368</usage>",
                  },
                ],
              },
              isError: false,
              timestamp: 2,
            },
          ],
        }),
      },
    })

    render(<MessageList sessionId={ACTIVE_TAB} />)

    expect(screen.getByText('Done')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'View result' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'View result' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/第二段补充内容用于验证 dialog 展示的是完整结果而不是截断摘要。/)).toBeTruthy()
    expect(within(dialog).queryByText(/agentId:/)).toBeNull()
    expect(within(dialog).queryByText(/total_tokens/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeTruthy()
  })

  it('keeps async launched agents in running state until a terminal notification arrives', () => {
    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [
            {
              id: 'tool-agent',
              type: 'tool_use',
              toolName: 'Agent',
              toolUseId: 'agent-1',
              input: { description: '修复临时文件泄漏' },
              timestamp: 1,
            },
            {
              id: 'result-agent',
              type: 'tool_result',
              toolUseId: 'agent-1',
              content:
                "Async agent launched successfully.\nagentId: a29934b04b20ed564 (internal ID - do not mention to user. Use SendMessage with to: 'a29934b04b20ed564' to continue this agent.)\nThe agent is working in the background. You will be notified automatically when it completes.",
              isError: false,
              timestamp: 2,
            },
          ],
        }),
      },
    })

    render(<MessageList />)

    expect(screen.getAllByText('Running').length).toBeGreaterThan(0)
    expect(screen.queryByText('Done')).toBeNull()
    expect(screen.queryByRole('button', { name: 'View result' })).toBeNull()
  })

  it('shows completed background agent result from the terminal task notification', () => {
    const resultText = '后台 agent 已经完成：定位到 parentToolUseId 丢失并补齐了 live 事件链。'

    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [
            {
              id: 'tool-agent',
              type: 'tool_use',
              toolName: 'Agent',
              toolUseId: 'agent-1',
              input: { description: '排查 subagent UI' },
              timestamp: 1,
            },
            {
              id: 'result-agent',
              type: 'tool_result',
              toolUseId: 'agent-1',
              content:
                "Async agent launched successfully.\nagentId: a29934b04b20ed564 (internal ID - do not mention to user. Use SendMessage with to: 'a29934b04b20ed564' to continue this agent.)\nThe agent is working in the background. You will be notified automatically when it completes.",
              isError: false,
              timestamp: 2,
            },
          ],
          agentTaskNotifications: {
            'agent-1': {
              taskId: 'agent-task-1',
              toolUseId: 'agent-1',
              status: 'completed',
              summary: 'Agent "排查 subagent UI" completed',
              result: resultText,
            },
          },
        }),
      },
    })

    render(<MessageList />)

    expect(screen.getByText('Done')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'View result' }))

    expect(within(screen.getByRole('dialog')).getByText(resultText)).toBeTruthy()
  })

  it('prefers the terminal task report over structured agent tool result JSON', () => {
    const markdownReport = '## 审查安全风险\n\n- 最终报告应该按 Markdown 展示。'

    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [
            {
              id: 'tool-agent',
              type: 'tool_use',
              toolName: 'Agent',
              toolUseId: 'agent-1',
              input: { description: '查看安全报告' },
              timestamp: 1,
            },
            {
              id: 'result-agent',
              type: 'tool_result',
              toolUseId: 'agent-1',
              content: {
                results: [
                  {
                    file: 'git:v0.2.6..v0.2.7',
                    line: 0,
                    snippet: 'raw structured JSON should not be shown',
                    context: '结构化检索结果不是给用户看的最终报告。',
                  },
                ],
              },
              isError: false,
              timestamp: 2,
            },
          ],
          agentTaskNotifications: {
            'agent-1': {
              taskId: 'agent-task-1',
              toolUseId: 'agent-1',
              status: 'completed',
              summary: 'Agent "审查安全风险" completed',
              result: markdownReport,
            },
          },
        }),
      },
    })

    render(<MessageList />)

    expect(screen.getByText(/最终报告应该按 Markdown 展示。/)).toBeTruthy()
    expect(screen.queryByText(/raw structured JSON should not be shown/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'View result' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: '查看安全报告' })).toBeTruthy()
    expect(within(dialog).getByText('最终报告应该按 Markdown 展示。')).toBeTruthy()
    expect(within(dialog).queryByText(/raw structured JSON should not be shown/)).toBeNull()
  })

  it('formats structured agent fallback results as readable markdown', () => {
    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [
            {
              id: 'tool-agent',
              type: 'tool_use',
              toolName: 'Agent',
              toolUseId: 'agent-1',
              input: { description: '审查安全风险' },
              timestamp: 1,
            },
            {
              id: 'result-agent',
              type: 'tool_result',
              toolUseId: 'agent-1',
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    results: [
                      {
                        file: 'git:v0.2.6..v0.2.7',
                        line: 0,
                        snippet: 'v0.2.7 tag = a4c92ec7',
                        context: '版本范围判断：release-notes/v0.2.7.md 明确相比 v0.2.6。',
                      },
                      {
                        risk: 'medium',
                        items: [
                          {
                            file: '/tmp/example/src/lib.rs',
                            line: 220,
                            context: '中风险：服务默认监听 0.0.0.0。',
                          },
                        ],
                      },
                    ],
                  }),
                },
              ],
              isError: false,
              timestamp: 2,
            },
          ],
        }),
      },
    })

    render(<MessageList />)

    expect(screen.getByText(/git:v0\.2\.6\.\.v0\.2\.7:0/)).toBeTruthy()
    expect(screen.queryByText(/\{"results"/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'View result' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('git:v0.2.6..v0.2.7:0')).toBeTruthy()
    expect(within(dialog).getByText('/tmp/example/src/lib.rs:220')).toBeTruthy()
    expect(within(dialog).getByText(/服务默认监听 0\.0\.0\.0/)).toBeTruthy()
    expect(within(dialog).queryByText(/\{"results"/)).toBeNull()
  })

  it('renders copy controls for user messages and scopes assistant copy to a single reply', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    })

    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [
            {
              id: 'user-1',
              type: 'user_text',
              content: '请帮我探索整体架构',
              timestamp: 1,
            },
            {
              id: 'assistant-1',
              type: 'assistant_text',
              content: '先看 CLI 和服务端入口。',
              timestamp: 2,
            },
            {
              id: 'assistant-2',
              type: 'assistant_text',
              content: '再看 desktop 前后端边界。',
              timestamp: 3,
            },
          ],
        }),
      },
    })

    render(<MessageList />)

    expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: 'Copy reply' })[1]!)

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('再看 desktop 前后端边界。')
    })
    expect(writeText).not.toHaveBeenCalledWith(
      '先看 CLI 和服务端入口。\n再看 desktop 前后端边界。'
    )
  })

  it('does not force-scroll to the bottom while the user is reading history', async () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })

    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          chatState: 'streaming',
          messages: [
            {
              id: 'user-1',
              type: 'user_text',
              content: '历史消息',
              timestamp: 1,
            },
          ],
          streamingText: 'streaming',
        }),
      },
    })

    const { container } = render(<MessageList />)
    const scroller = container.querySelector('.overflow-y-auto') as HTMLDivElement
    let scrollTop = 120
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1000 })
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 400 })
    Object.defineProperty(scroller, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value) => {
        scrollTop = value
      },
    })

    scrollIntoView.mockClear()
    await waitForProgrammaticScrollReset()
    fireEvent.scroll(scroller)

    act(() => {
      useChatStore.setState((state) => ({
        sessions: {
          ...state.sessions,
          [ACTIVE_TAB]: {
            ...state.sessions[ACTIVE_TAB]!,
            streamingText: 'streaming new token',
          },
        },
      }))
    })

    await waitFor(() => {
      expect(screen.getByText('streaming new token')).toBeTruthy()
    })
    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(scrollTop).toBe(120)
  })

  it('keeps auto-scrolling when new output arrives while already near the bottom', async () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })

    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          chatState: 'streaming',
          messages: [
            {
              id: 'user-1',
              type: 'user_text',
              content: '最新消息',
              timestamp: 1,
            },
          ],
          streamingText: 'streaming',
        }),
      },
    })

    const { container } = render(<MessageList />)
    const scroller = container.querySelector('.overflow-y-auto') as HTMLDivElement
    let scrollTop = 552
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1000 })
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 400 })
    Object.defineProperty(scroller, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value) => {
        scrollTop = value
      },
    })

    scrollIntoView.mockClear()
    await waitForProgrammaticScrollReset()
    fireEvent.scroll(scroller)

    act(() => {
      useChatStore.setState((state) => ({
        sessions: {
          ...state.sessions,
          [ACTIVE_TAB]: {
            ...state.sessions[ACTIVE_TAB]!,
            streamingText: 'streaming next token',
          },
        },
      }))
    })

    await waitFor(() => {
      expect(screen.getByText('streaming next token')).toBeTruthy()
    })
    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(scrollTop).toBe(600)
  })

  it('restores a session scroll position when switching back to a tab', async () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })

    useTabStore.setState({
      activeTabId: 'session-a',
      tabs: [
        { sessionId: 'session-a', title: 'A', type: 'session' as const, status: 'idle' },
        { sessionId: 'session-b', title: 'B', type: 'session' as const, status: 'idle' },
      ],
    })
    useChatStore.setState({
      sessions: {
        'session-a': makeSessionState({
          messages: [
            { id: 'a-user', type: 'user_text', content: 'A prompt', timestamp: 1 },
            { id: 'a-assistant', type: 'assistant_text', content: 'A response', timestamp: 2 },
          ],
        }),
        'session-b': makeSessionState({
          messages: [
            { id: 'b-user', type: 'user_text', content: 'B prompt', timestamp: 1 },
            { id: 'b-assistant', type: 'assistant_text', content: 'B response', timestamp: 2 },
          ],
        }),
      },
    })

    const { container } = render(<MessageList />)
    const scroller = container.querySelector('.overflow-y-auto') as HTMLDivElement
    let scrollTop = 180
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1200 })
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 400 })
    Object.defineProperty(scroller, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value) => {
        scrollTop = value
      },
    })

    await waitForProgrammaticScrollReset()
    fireEvent.scroll(scroller)
    expect(screen.getByRole('button', { name: 'Latest' })).toBeTruthy()

    act(() => {
      useTabStore.setState({ activeTabId: 'session-b' })
    })
    await waitFor(() => {
      expect(screen.getByText('B response')).toBeTruthy()
    })

    scrollTop = 760
    await waitForProgrammaticScrollReset()
    fireEvent.scroll(scroller)

    act(() => {
      useTabStore.setState({ activeTabId: 'session-a' })
    })
    await waitFor(() => {
      expect(screen.getByText('A response')).toBeTruthy()
    })

    expect(scrollTop).toBe(180)
    expect(screen.getByRole('button', { name: 'Latest' })).toBeTruthy()
  })

  it('scrolls new sessions to the latest message instead of inheriting another tab position', async () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })

    useTabStore.setState({
      activeTabId: 'session-a',
      tabs: [
        { sessionId: 'session-a', title: 'A', type: 'session' as const, status: 'idle' },
        { sessionId: 'session-fresh', title: 'Fresh', type: 'session' as const, status: 'idle' },
      ],
    })
    useChatStore.setState({
      sessions: {
        'session-a': makeSessionState({
          messages: [
            { id: 'a-user', type: 'user_text', content: 'A prompt', timestamp: 1 },
            { id: 'a-assistant', type: 'assistant_text', content: 'A response', timestamp: 2 },
          ],
        }),
        'session-fresh': makeSessionState({
          messages: [
            { id: 'fresh-user', type: 'user_text', content: 'Fresh prompt', timestamp: 1 },
            { id: 'fresh-assistant', type: 'assistant_text', content: 'Fresh latest response', timestamp: 2 },
          ],
        }),
      },
    })

    const { container } = render(<MessageList />)
    const scroller = container.querySelector('.overflow-y-auto') as HTMLDivElement
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1200 })
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 400 })
    Object.defineProperty(scroller, 'scrollTop', {
      configurable: true,
      value: 150,
      writable: true,
    })

    await waitForProgrammaticScrollReset()
    fireEvent.scroll(scroller)
    scrollIntoView.mockClear()

    act(() => {
      useTabStore.setState({ activeTabId: 'session-fresh' })
    })

    await waitFor(() => {
      expect(screen.getByText('Fresh latest response')).toBeTruthy()
      expect(scroller.scrollTop).toBe(800)
    })
  })

  it('shows a latest button when reading history and resumes following after clicking it', async () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })

    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          chatState: 'streaming',
          messages: [
            {
              id: 'user-1',
              type: 'user_text',
              content: '历史消息',
              timestamp: 1,
            },
          ],
          streamingText: 'streaming',
        }),
      },
    })

    const { container } = render(<MessageList />)
    const scroller = container.querySelector('.overflow-y-auto') as HTMLDivElement
    let scrollTop = 120
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1000 })
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 400 })
    Object.defineProperty(scroller, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value) => {
        scrollTop = value
      },
    })

    scrollIntoView.mockClear()
    await waitForProgrammaticScrollReset()
    fireEvent.scroll(scroller)
    fireEvent.click(screen.getByRole('button', { name: 'Latest' }))

    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(scrollTop).toBe(600)
    expect(screen.queryByRole('button', { name: 'Latest' })).toBeNull()

    scrollIntoView.mockClear()
    act(() => {
      useChatStore.setState((state) => ({
        sessions: {
          ...state.sessions,
          [ACTIVE_TAB]: {
            ...state.sessions[ACTIVE_TAB]!,
            streamingText: 'streaming after jump',
          },
        },
      }))
    })

    await waitFor(() => {
      expect(screen.getByText('streaming after jump')).toBeTruthy()
    })
    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(scrollTop).toBe(600)
  })

  it('keeps user actions anchored to the right bubble and assistant actions to the left bubble', () => {
    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [
            {
              id: 'user-1',
              type: 'user_text',
              content: '请把这条 prompt 放在右侧',
              timestamp: 1,
            },
            {
              id: 'assistant-1',
              type: 'assistant_text',
              content: '这条回复应该停在左侧。',
              timestamp: 2,
            },
          ],
        }),
      },
    })

    render(<MessageList />)

    const userShell = screen.getByText('请把这条 prompt 放在右侧').closest('[data-message-shell="user"]')
    const assistantShell = screen.getByText('这条回复应该停在左侧。').closest('[data-message-shell="assistant"]')
    const userActions = screen.getByRole('button', { name: 'Copy prompt' }).closest('[data-message-actions]')
    const assistantActions = screen.getByRole('button', { name: 'Copy reply' }).closest('[data-message-actions]')

    expect(userShell).toBeTruthy()
    expect(userShell?.className).toContain('items-end')
    expect(assistantShell).toBeTruthy()
    expect(assistantShell?.className).toContain('items-start')
    expect(assistantShell?.className).not.toContain('ml-10')
    expect(userActions?.getAttribute('data-align')).toBe('end')
    expect(assistantActions?.getAttribute('data-align')).toBe('start')
  })

  it('uses the document column for markdown-heavy assistant replies', () => {
    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [
            {
              id: 'assistant-doc',
              type: 'assistant_text',
              content: [
                '## 交付结果',
                '',
                '已完成以下内容：',
                '',
                '- 添加任务',
                '- 删除任务',
                '',
                '```bash',
                'npm run build',
                '```',
              ].join('\n'),
              timestamp: 1,
            },
          ],
        }),
      },
    })

    render(<MessageList />)

    const assistantShell = screen.getByText('交付结果').closest('[data-message-shell="assistant"]')
    expect(assistantShell?.getAttribute('data-layout')).toBe('document')
    expect(assistantShell?.className).toContain('w-full')
    expect(assistantShell?.className).not.toContain('ml-10')
  })

  it('does not expose the old message-level rewind action', async () => {
    vi.spyOn(sessionsApi, 'getTurnCheckpoints').mockResolvedValue({
      checkpoints: [
        {
          target: {
            targetUserMessageId: 'user-1',
            userMessageIndex: 0,
            userMessageCount: 1,
          },
          code: {
            available: true,
            filesChanged: ['src/App.tsx'],
            insertions: 4,
            deletions: 1,
          },
        },
      ],
    })

    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [
            {
              id: 'user-1',
              type: 'user_text',
              content: '做一个页面',
              timestamp: 1,
            },
            {
              id: 'assistant-1',
              type: 'assistant_text',
              content: 'done',
              timestamp: 2,
            },
          ],
        }),
      },
    })

    render(<MessageList />)

    expect(await screen.findByRole('button', { name: 'Undo current turn changes' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Rewind to here' })).toBeNull()
  })

  it('keeps historical sessions readable when turn checkpoint payloads are missing', async () => {
    vi.spyOn(sessionsApi, 'getTurnCheckpoints').mockResolvedValue({} as never)

    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [
            {
              id: 'user-1',
              type: 'user_text',
              content: '继续优化 workflow.py',
              timestamp: 1,
            },
            {
              id: 'assistant-1',
              type: 'assistant_text',
              content: '两个文件均已优化完成，功能保持不变。',
              timestamp: 2,
            },
          ],
        }),
      },
    })

    render(<MessageList />)

    expect(await screen.findByText('两个文件均已优化完成，功能保持不变。')).toBeTruthy()
    await waitFor(() => {
      expect(sessionsApi.getTurnCheckpoints).toHaveBeenCalled()
    })
    expect(screen.queryByText(/Cannot read properties/)).toBeNull()
    expect(screen.queryByLabelText('Turn changed files')).toBeNull()
  })

  it('reuses cached turn change cards when switching back to the same historical session', async () => {
    const getTurnCheckpoints = vi.spyOn(sessionsApi, 'getTurnCheckpoints').mockResolvedValue({
      checkpoints: [
        {
          target: {
            targetUserMessageId: 'user-1',
            userMessageIndex: 0,
            userMessageCount: 1,
          },
          code: {
            available: true,
            filesChanged: ['src/App.tsx'],
            insertions: 4,
            deletions: 1,
          },
        },
      ],
    })

    const makeHistoricalMessages = (suffix: string): UIMessage[] => [
      {
        id: `user-${suffix}`,
        type: 'user_text',
        content: `修改第 ${suffix} 个会话`,
        timestamp: 1,
      },
      {
        id: `assistant-${suffix}`,
        type: 'assistant_text',
        content: `第 ${suffix} 个会话已完成`,
        timestamp: 2,
      },
    ]

    useChatStore.setState({
      sessions: {
        'session-a': makeSessionState({ messages: makeHistoricalMessages('1') }),
        'session-b': makeSessionState({ messages: makeHistoricalMessages('2') }),
      },
    })
    useTabStore.setState({
      activeTabId: 'session-a',
      tabs: [
        { sessionId: 'session-a', title: 'A', type: 'session' as const, status: 'idle' },
        { sessionId: 'session-b', title: 'B', type: 'session' as const, status: 'idle' },
      ],
    })

    const { rerender } = render(<MessageList />)
    await waitFor(() => expect(getTurnCheckpoints).toHaveBeenCalledWith('session-a'))

    await act(async () => {
      useTabStore.setState({ activeTabId: 'session-b' })
      rerender(<MessageList />)
    })
    await waitFor(() => expect(getTurnCheckpoints).toHaveBeenCalledWith('session-b'))

    getTurnCheckpoints.mockClear()
    await act(async () => {
      useTabStore.setState({ activeTabId: 'session-a' })
      rerender(<MessageList />)
    })

    await waitFor(() => {
      expect(screen.getByText('第 1 个会话已完成')).toBeTruthy()
    })
    expect(getTurnCheckpoints).not.toHaveBeenCalled()
  })

  it('renders multiple historical turn change cards across three turns', async () => {
    vi.spyOn(sessionsApi, 'getTurnCheckpoints').mockResolvedValue({
      checkpoints: [
        {
          target: {
            targetUserMessageId: 'user-1',
            userMessageIndex: 0,
            userMessageCount: 3,
          },
          code: {
            available: true,
            filesChanged: ['src/first.ts'],
            insertions: 3,
            deletions: 1,
          },
        },
        {
          target: {
            targetUserMessageId: 'user-2',
            userMessageIndex: 1,
            userMessageCount: 3,
          },
          code: {
            available: true,
            filesChanged: ['src/second.ts'],
            insertions: 5,
            deletions: 2,
          },
        },
        {
          target: {
            targetUserMessageId: 'user-3',
            userMessageIndex: 2,
            userMessageCount: 3,
          },
          code: {
            available: true,
            filesChanged: [],
            insertions: 0,
            deletions: 0,
          },
        },
      ],
    })

    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [
            {
              id: 'user-1',
              type: 'user_text',
              content: '第一段',
              timestamp: 1,
            },
            {
              id: 'assistant-1',
              type: 'assistant_text',
              content: 'ok',
              timestamp: 2,
            },
            {
              id: 'user-2',
              type: 'user_text',
              content: '第二段',
              timestamp: 3,
            },
            {
              id: 'assistant-2',
              type: 'assistant_text',
              content: 'done',
              timestamp: 4,
            },
            {
              id: 'user-3',
              type: 'user_text',
              content: '第三段',
              timestamp: 5,
            },
            {
              id: 'assistant-3',
              type: 'assistant_text',
              content: 'done',
              timestamp: 6,
            },
          ],
        }),
      },
    })

    render(<MessageList />)

    const cards = await screen.findAllByLabelText('Turn changed files')
    expect(cards).toHaveLength(2)
    expect(screen.getByText('src/first.ts')).toBeTruthy()
    expect(screen.getByText('src/second.ts')).toBeTruthy()
    expect(screen.queryByText('src/third.ts')).toBeNull()
  })

  it('expands a historical turn diff through the turn checkpoint diff API', async () => {
    vi.spyOn(sessionsApi, 'getTurnCheckpoints').mockResolvedValue({
      checkpoints: [
        {
          target: {
            targetUserMessageId: 'user-1',
            userMessageIndex: 0,
            userMessageCount: 2,
          },
          code: {
            available: true,
            filesChanged: ['src/first.ts'],
            insertions: 1,
            deletions: 1,
          },
        },
        {
          target: {
            targetUserMessageId: 'user-2',
            userMessageIndex: 1,
            userMessageCount: 2,
          },
          code: {
            available: true,
            filesChanged: ['src/second.ts'],
            insertions: 2,
            deletions: 0,
          },
        },
      ],
    })
    vi.spyOn(sessionsApi, 'getWorkspaceDiff').mockResolvedValue({
      state: 'ok',
      path: 'src/first.ts',
      diff: 'diff --session a/src/first.ts b/src/first.ts\n-old\n+new',
    })
    vi.spyOn(sessionsApi, 'getTurnCheckpointDiff').mockResolvedValue({
      state: 'ok',
      path: 'src/first.ts',
      diff: 'diff --session a/src/first.ts b/src/first.ts\n-old\n+new',
    })

    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [
            {
              id: 'user-1',
              type: 'user_text',
              content: '第一轮',
              timestamp: 1,
            },
            {
              id: 'assistant-1',
              type: 'assistant_text',
              content: 'done',
              timestamp: 2,
            },
            {
              id: 'user-2',
              type: 'user_text',
              content: '第二轮',
              timestamp: 3,
            },
            {
              id: 'assistant-2',
              type: 'assistant_text',
              content: 'done',
              timestamp: 4,
            },
          ],
        }),
      },
    })

    render(<MessageList />)

    fireEvent.click(await screen.findByRole('button', { name: 'Show diff for src/first.ts' }))

    const diffSurface = await screen.findByTestId('workspace-code')
    expect(diffSurface.textContent).toContain('+new')
    expect(sessionsApi.getTurnCheckpointDiff).toHaveBeenCalledWith(
      ACTIVE_TAB,
      'user-1',
      'src/first.ts',
      0,
    )
    expect(sessionsApi.getWorkspaceDiff).not.toHaveBeenCalled()
  })

  it('keeps checkpoint paths bound to the original turn cwd when expanding historical diffs', async () => {
    vi.spyOn(sessionsApi, 'getWorkspaceStatus').mockResolvedValue({
      state: 'ok',
      workDir: '/tmp/current-project',
      repoName: 'current-project',
      branch: null,
      isGitRepo: false,
      changedFiles: [],
    })
    vi.spyOn(sessionsApi, 'getTurnCheckpoints').mockResolvedValue({
      checkpoints: [
        {
          target: {
            targetUserMessageId: 'user-1',
            userMessageIndex: 0,
            userMessageCount: 2,
          },
          workDir: '/tmp/old-project',
          code: {
            available: true,
            filesChanged: ['/tmp/old-project/src/first.ts'],
            insertions: 1,
            deletions: 1,
          },
        },
      ],
    })
    vi.spyOn(sessionsApi, 'getTurnCheckpointDiff').mockResolvedValue({
      state: 'ok',
      path: '/tmp/old-project/src/first.ts',
      diff: 'diff --git a/src/first.ts b/src/first.ts\n-old\n+new',
    })

    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [
            {
              id: 'user-1',
              type: 'user_text',
              content: '第一轮',
              timestamp: 1,
            },
            {
              id: 'assistant-1',
              type: 'assistant_text',
              content: 'done',
              timestamp: 2,
            },
          ],
        }),
      },
    })

    render(<MessageList />)

    fireEvent.click(await screen.findByRole('button', { name: 'Show diff for src/first.ts' }))

    await screen.findByTestId('workspace-code')
    expect(sessionsApi.getTurnCheckpointDiff).toHaveBeenCalledWith(
      ACTIVE_TAB,
      'user-1',
      '/tmp/old-project/src/first.ts',
      0,
    )
  })

  it('relativizes Windows checkpoint paths against the turn workdir', () => {
    expect(relativizeWorkspacePath(
      'C:\\Users\\Relakkes\\aacc\\src\\App.tsx',
      'c:/users/relakkes/aacc',
    )).toBe('src/App.tsx')
  })

  it('matches live turn change checkpoints by user message index when transcript ids differ from local UI ids', async () => {
    vi.spyOn(sessionsApi, 'getTurnCheckpoints').mockResolvedValue({
      checkpoints: [
        {
          target: {
            targetUserMessageId: 'transcript-user-1',
            userMessageIndex: 0,
            userMessageCount: 1,
          },
          code: {
            available: true,
            filesChanged: ['src/live.ts'],
            insertions: 7,
            deletions: 0,
          },
        },
      ],
    })
    vi.spyOn(sessionsApi, 'getTurnCheckpointDiff').mockResolvedValue({
      state: 'ok',
      path: 'src/live.ts',
      diff: 'diff --session a/src/live.ts b/src/live.ts\n+live',
    })

    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [
            {
              id: 'local-user-temp-id',
              type: 'user_text',
              content: '实时这一轮',
              timestamp: 1,
            },
            {
              id: 'assistant-1',
              type: 'assistant_text',
              content: 'done',
              timestamp: 2,
            },
          ],
        }),
      },
    })

    render(<MessageList />)

    expect(await screen.findByText('src/live.ts')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show diff for src/live.ts' }))
    await screen.findByTestId('workspace-code')
    expect(sessionsApi.getTurnCheckpointDiff).toHaveBeenCalledWith(
      ACTIVE_TAB,
      'transcript-user-1',
      'src/live.ts',
      0,
    )
  })

  it('keeps turn change cards anchored when the only response item is filtered from rendering', async () => {
    vi.spyOn(sessionsApi, 'getTurnCheckpoints').mockResolvedValue({
      checkpoints: [
        {
          target: {
            targetUserMessageId: 'user-1',
            userMessageIndex: 0,
            userMessageCount: 1,
          },
          code: {
            available: true,
            filesChanged: ['src/blank-response.ts'],
            insertions: 3,
            deletions: 0,
          },
        },
      ],
    })

    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [
            {
              id: 'user-1',
              type: 'user_text',
              content: '生成文件',
              timestamp: 1,
            },
            {
              id: 'assistant-empty',
              type: 'assistant_text',
              content: '\n  ',
              timestamp: 2,
            },
          ],
        }),
      },
    })

    render(<MessageList />)

    expect(await screen.findByText('src/blank-response.ts')).toBeTruthy()
  })

  it('keeps historical turn change cards visible while the next turn is running', async () => {
    vi.spyOn(sessionsApi, 'getTurnCheckpoints').mockResolvedValue({
      checkpoints: [
        {
          target: {
            targetUserMessageId: 'user-1',
            userMessageIndex: 0,
            userMessageCount: 1,
          },
          code: {
            available: true,
            filesChanged: ['src/first.ts'],
            insertions: 1,
            deletions: 0,
          },
        },
      ],
    })

    const messages: UIMessage[] = [
      {
        id: 'user-1',
        type: 'user_text',
        content: '第一轮',
        timestamp: 1,
      },
      {
        id: 'assistant-1',
        type: 'assistant_text',
        content: 'done',
        timestamp: 2,
      },
    ]

    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({ messages }),
      },
    })

    render(<MessageList />)

    expect(await screen.findByText('src/first.ts')).toBeTruthy()

    act(() => {
      useChatStore.setState({
        sessions: {
          [ACTIVE_TAB]: makeSessionState({
            messages,
            chatState: 'thinking',
          }),
        },
      })
    })

    await waitFor(() => {
      expect(screen.getByText('src/first.ts')).toBeTruthy()
    })
  })

  it('confirms before rewinding to an earlier turn from a historical change card', async () => {
    vi.spyOn(sessionsApi, 'getTurnCheckpoints').mockResolvedValue({
      checkpoints: [
        {
          target: {
            targetUserMessageId: 'user-1',
            userMessageIndex: 0,
            userMessageCount: 2,
          },
          code: {
            available: true,
            filesChanged: ['src/first.ts'],
            insertions: 1,
            deletions: 0,
          },
        },
        {
          target: {
            targetUserMessageId: 'user-2',
            userMessageIndex: 1,
            userMessageCount: 2,
          },
          code: {
            available: true,
            filesChanged: ['src/second.ts'],
            insertions: 1,
            deletions: 0,
          },
        },
      ],
    })
    vi.spyOn(sessionsApi, 'rewind')
      .mockResolvedValueOnce({
        target: {
          targetUserMessageId: 'user-1',
          userMessageIndex: 0,
          userMessageCount: 1,
        },
        conversation: {
          messagesRemoved: 2,
        },
        code: {
          available: true,
          filesChanged: ['src/App.tsx'],
          insertions: 1,
          deletions: 0,
        },
      })
      .mockResolvedValueOnce({
        target: {
          targetUserMessageId: 'user-1',
          userMessageIndex: 0,
          userMessageCount: 1,
        },
        conversation: {
          messagesRemoved: 2,
          removedMessageIds: ['user-1', 'assistant-1'],
        },
        code: {
          available: true,
          filesChanged: ['src/App.tsx'],
          insertions: 1,
          deletions: 0,
        },
      })
    const reloadHistory = vi.fn().mockResolvedValue(undefined)
    const queueComposerPrefill = vi.fn()

    useChatStore.setState({
      reloadHistory,
      queueComposerPrefill,
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [
            {
              id: 'user-1',
              type: 'user_text',
              content: '做一个页面',
              timestamp: 1,
            },
            {
              id: 'assistant-1',
              type: 'assistant_text',
              content: 'first done',
              timestamp: 2,
            },
            {
              id: 'user-2',
              type: 'user_text',
              content: '第二轮需求',
              timestamp: 3,
            },
            {
              id: 'assistant-2',
              type: 'assistant_text',
              content: 'second done',
              timestamp: 4,
            },
          ],
        }),
      },
    })

    render(<MessageList />)

    const historicalCard = (await screen.findByText('src/first.ts')).closest('section')
    expect(historicalCard).toBeTruthy()
    fireEvent.click(
      within(historicalCard as HTMLElement).getByRole('button', {
        name: 'Rewind to before this turn',
      }),
    )

    expect(sessionsApi.rewind).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('dialog', { name: 'Rewind to before this turn?' })
    expect(
      within(dialog).getByText(
        'This will rewind the conversation to before this turn and restore tracked files for that checkpoint.',
      ),
    ).toBeTruthy()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Rewind to before this turn' }))

    await waitFor(() => {
      expect(sessionsApi.rewind).toHaveBeenLastCalledWith(ACTIVE_TAB, {
        targetUserMessageId: 'user-1',
        userMessageIndex: 0,
        expectedContent: '做一个页面',
      })
    })
    expect(reloadHistory).toHaveBeenCalledWith(ACTIVE_TAB)
    expect(queueComposerPrefill).toHaveBeenCalledWith(ACTIVE_TAB, {
      text: '做一个页面',
      attachments: undefined,
    })
  })

  it('does not render cards for turns without file changes', async () => {
    vi.spyOn(sessionsApi, 'getTurnCheckpoints').mockResolvedValue({
      checkpoints: [
        {
          target: {
            targetUserMessageId: 'user-1',
            userMessageIndex: 0,
            userMessageCount: 2,
          },
          code: {
            available: true,
            filesChanged: ['src/first.ts'],
            insertions: 2,
            deletions: 1,
          },
        },
        {
          target: {
            targetUserMessageId: 'user-2',
            userMessageIndex: 1,
            userMessageCount: 2,
          },
          code: {
            available: true,
            filesChanged: [],
            insertions: 0,
            deletions: 0,
          },
        },
      ],
    })

    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [
            {
              id: 'user-1',
              type: 'user_text',
              content: '第一轮改文件',
              timestamp: 1,
            },
            {
              id: 'assistant-1',
              type: 'assistant_text',
              content: 'first done',
              timestamp: 2,
            },
            {
              id: 'user-2',
              type: 'user_text',
              content: '第二轮只解释',
              timestamp: 3,
            },
            {
              id: 'assistant-2',
              type: 'assistant_text',
              content: 'second done',
              timestamp: 4,
            },
          ],
        }),
      },
    })

    render(<MessageList />)

    const cards = await screen.findAllByLabelText('Turn changed files')
    expect(cards).toHaveLength(1)
    expect(screen.getByText('src/first.ts')).toBeTruthy()
    expect(screen.queryByText('src/second.ts')).toBeNull()
  })

  it('shows raw startup details under translated CLI startup errors', () => {
    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [
            {
              id: 'error-1',
              type: 'error',
              code: 'CLI_START_FAILED',
              message:
                'CLI exited during startup (code 1): Claude Code on Windows requires git-bash (https://git-scm.com/downloads/win).',
              timestamp: 1,
            },
          ],
        }),
      },
    })

    render(<MessageList />)

    expect(screen.getByText('Failed to start CLI process.')).toBeTruthy()
    expect(
      screen.getByText(
        'CLI exited during startup (code 1): Claude Code on Windows requires git-bash (https://git-scm.com/downloads/win).',
      ),
    ).toBeTruthy()
  })

  it('shows a Chinese G-Master login recovery action for expired managed auth', () => {
    useSettingsStore.setState({ locale: 'zh' })
    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [
            {
              id: 'error-auth',
              type: 'error',
              code: 'GMASTER_AUTH_EXPIRED',
              message: 'authentication_failed: Not logged in · Please run /login',
              timestamp: 1,
            },
          ],
        }),
      },
    })

    render(<MessageList sessionId={ACTIVE_TAB} />)

    expect(screen.getByText('G-Master API 登录已失效，请重新登录后再试。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '重新登录 G-Master API' }))
    expect(useUIStore.getState().pendingSettingsTab).toBe('account')
    expect(useTabStore.getState().activeTabId).toBe(SETTINGS_TAB_ID)
  })

  it('shows a Chinese new-session action for missing historical sessions', () => {
    useSettingsStore.setState({ locale: 'zh' })
    useChatStore.setState({
      sessions: {
        [ACTIVE_TAB]: makeSessionState({
          messages: [
            {
              id: 'error-session',
              type: 'error',
              code: 'CLI_SESSION_MISSING',
              message: 'No conversation found with session ID: de658bd4-a7c0-4aea-9acc-e2fb0064b752',
              timestamp: 1,
            },
          ],
        }),
      },
    })

    render(<MessageList />)

    expect(screen.getByText('这个历史会话已无法恢复，请新建会话继续。')).toBeTruthy()
    expect(screen.getByRole('button', { name: '新建会话' })).toBeTruthy()
  })
})
