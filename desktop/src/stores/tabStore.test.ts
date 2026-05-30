import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listSessions } = vi.hoisted(() => ({
  listSessions: vi.fn(),
}))

vi.mock('../api/sessions', () => ({
  sessionsApi: {
    list: listSessions,
  },
}))

describe('tabStore', () => {
  beforeEach(() => {
    vi.resetModules()
    window.localStorage.clear()
    listSessions.mockReset()
  })

  it('writes open tabs to the Gaster Code storage key', async () => {
    const { useTabStore } = await import('./tabStore')

    useTabStore.getState().openTab('session-1', 'Session 1')

    expect(window.localStorage.getItem('gaster-code-open-tabs')).toContain('Session 1')
    expect(window.localStorage.getItem('cc-haha-open-tabs')).toBeNull()
  })

  it('migrates legacy open tabs while restoring', async () => {
    window.localStorage.setItem(
      'cc-haha-open-tabs',
      JSON.stringify({
        openTabs: [{ sessionId: 'session-1', title: 'Saved title', type: 'session' }],
        activeTabId: 'session-1',
      }),
    )
    listSessions.mockResolvedValue({
      sessions: [{ id: 'session-1', title: 'Server title' }],
    })

    const { useTabStore } = await import('./tabStore')

    await useTabStore.getState().restoreTabs()

    expect(useTabStore.getState().tabs).toEqual([
      { sessionId: 'session-1', title: 'Server title', type: 'session', status: 'idle' },
    ])
    expect(window.localStorage.getItem('gaster-code-open-tabs')).toContain('Saved title')
    expect(window.localStorage.getItem('cc-haha-open-tabs')).toBeNull()
  })

  it('refreshes an existing tab title when opening the same session again', async () => {
    const { useTabStore } = await import('./tabStore')

    useTabStore.getState().openTab('session-1', '```json {"title":')
    useTabStore.getState().openTab('session-1', '使用bash写一个shell，随便写点什么东西')

    expect(useTabStore.getState().tabs).toHaveLength(1)
    expect(useTabStore.getState().tabs[0]).toMatchObject({
      sessionId: 'session-1',
      title: '使用bash写一个shell，随便写点什么东西',
      type: 'session',
    })
    expect(useTabStore.getState().activeTabId).toBe('session-1')
  })
})
