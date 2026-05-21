import { beforeEach, describe, expect, it } from 'vitest'
import {
  formatWorkspaceReferencePrompt,
  useWorkspaceChatContextStore,
} from './workspaceChatContextStore'

const initialState = useWorkspaceChatContextStore.getInitialState()

describe('workspaceChatContextStore', () => {
  beforeEach(() => {
    useWorkspaceChatContextStore.setState(initialState, true)
  })

  it('deduplicates file references per session', () => {
    const store = useWorkspaceChatContextStore.getState()

    store.addReference('session-1', {
      kind: 'file',
      path: 'src/App.tsx',
      absolutePath: '/repo/src/App.tsx',
      name: 'App.tsx',
    })
    store.addReference('session-1', {
      kind: 'file',
      path: 'src/App.tsx',
      absolutePath: '/repo/src/App.tsx',
      name: 'App.tsx',
    })

    expect(useWorkspaceChatContextStore.getState().referencesBySession['session-1']).toHaveLength(1)
  })

  it('formats line comments into the request prompt', () => {
    const prompt = formatWorkspaceReferencePrompt([
      {
        id: 'ref-1',
        kind: 'code-comment',
        path: 'src/App.tsx',
        absolutePath: '/repo/src/App.tsx',
        name: 'App.tsx',
        lineStart: 12,
        lineEnd: 12,
        note: 'Use a clearer name',
        quote: 'const value = 1',
      },
    ])

    expect(prompt).toContain('Referenced workspace context:')
    expect(prompt).toContain('@"src/App.tsx:L12":')
    expect(prompt).toContain('Comment: Use a clearer name')
    expect(prompt).toContain('```tsx\nconst value = 1\n```')
    expect(prompt).not.toContain('Use the Read tool')
    expect(prompt).not.toContain('Path: /repo/src/App.tsx')
  })

  it('formats selected chat context separately from workspace context', () => {
    const prompt = formatWorkspaceReferencePrompt([
      {
        id: 'ref-chat',
        kind: 'chat-selection',
        path: 'chat://assistant/msg-1',
        name: 'Assistant message',
        quote: 'Use a bounded retry with jitter.',
        sourceRole: 'assistant',
        messageId: 'msg-1',
      },
    ])

    expect(prompt).toContain('Referenced chat context:')
    expect(prompt).toContain('Assistant message:')
    expect(prompt).toContain('```\nUse a bounded retry with jitter.\n```')
    expect(prompt).not.toContain('Referenced workspace context:')
  })

  it('deduplicates selected code by path, line range, and quote', () => {
    const store = useWorkspaceChatContextStore.getState()

    store.addReference('session-selection', {
      kind: 'code-selection',
      path: 'src/App.tsx',
      absolutePath: '/repo/src/App.tsx',
      name: 'App.tsx',
      lineStart: 10,
      lineEnd: 11,
      quote: 'const value = 1',
    })
    store.addReference('session-selection', {
      kind: 'code-selection',
      path: 'src/App.tsx',
      absolutePath: '/repo/src/App.tsx',
      name: 'App.tsx',
      lineStart: 10,
      lineEnd: 11,
      quote: 'const value = 1',
    })

    expect(useWorkspaceChatContextStore.getState().referencesBySession['session-selection']).toHaveLength(1)
  })

  it('does not add prompt text for plain file attachments', () => {
    const prompt = formatWorkspaceReferencePrompt([
      {
        id: 'ref-1',
        kind: 'file',
        path: 'src/App.tsx',
        absolutePath: '/repo/src/App.tsx',
        name: 'App.tsx',
      },
    ])

    expect(prompt).toBe('')
  })
})
