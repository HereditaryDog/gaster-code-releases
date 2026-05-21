import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import '@testing-library/jest-dom'

import { StreamingIndicator } from './StreamingIndicator'
import { useChatStore } from '../../stores/chatStore'
import { useTabStore } from '../../stores/tabStore'

describe('StreamingIndicator', () => {
  beforeEach(() => {
    useTabStore.setState({
      activeTabId: 'session-1',
      tabs: [{ sessionId: 'session-1', title: 'Session', type: 'session', status: 'running' }],
    })
    useChatStore.setState({
      sessions: {
        'session-1': {
          messages: [],
          chatState: 'tool_executing',
          connectionState: 'connected',
          streamingText: '',
          streamingToolInput: '',
          activeToolUseId: null,
          activeToolName: null,
          activeThinkingId: null,
          pendingPermission: null,
          pendingComputerUsePermission: null,
          tokenUsage: { input_tokens: 0, output_tokens: 0 },
          elapsedSeconds: 4,
          statusVerb: 'Boogieing',
          slashCommands: [],
          agentTaskNotifications: {},
          elapsedTimer: null,
          composerPrefill: null,
        },
      },
    } as Partial<ReturnType<typeof useChatStore.getState>>)
  })

  it('renders the original breathing G glyph instead of the sparkle icon', () => {
    const { container } = render(<StreamingIndicator />)

    expect(screen.getByText('Boogieing...')).toBeInTheDocument()
    expect(container.textContent).not.toContain('✦')
    expect(container.querySelector('.chat-streaming-indicator__glyph')).not.toBeNull()
    expect(container.querySelector('.sidebar-session-status-marker')).toBeNull()
  })
})
