import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/gmasterAuth', () => ({
  gmasterAuthApi: {
    status: vi.fn(),
    start: vi.fn(),
    logout: vi.fn(),
    syncProvider: vi.fn(),
  },
}))

import { gmasterAuthApi } from '../api/gmasterAuth'
import { useGMasterAuthStore } from './gmasterAuthStore'

describe('gmasterAuthStore', () => {
  beforeEach(() => {
    useGMasterAuthStore.getState().stopPolling()
    vi.clearAllMocks()
    useGMasterAuthStore.setState({
      status: null,
      isLoading: false,
      isPolling: false,
      error: null,
    })
  })

  afterEach(() => {
    useGMasterAuthStore.getState().stopPolling()
    vi.useRealTimers()
  })

  it('fetchStatus stores logged-out status', async () => {
    vi.mocked(gmasterAuthApi.status).mockResolvedValueOnce({ loggedIn: false })
    await useGMasterAuthStore.getState().fetchStatus()
    expect(useGMasterAuthStore.getState().status).toEqual({ loggedIn: false })
  })

  it('login returns authorizeUrl and clears loading', async () => {
    vi.mocked(gmasterAuthApi.start).mockResolvedValueOnce({ authorizeUrl: 'https://gmapi.example.test/login', state: 'state-1' })
    const result = await useGMasterAuthStore.getState().login()
    expect(result.authorizeUrl).toBe('https://gmapi.example.test/login')
    expect(useGMasterAuthStore.getState().isLoading).toBe(false)
  })

  it('logout clears status', async () => {
    vi.mocked(gmasterAuthApi.logout).mockResolvedValueOnce({ ok: true })
    await useGMasterAuthStore.getState().logout()
    expect(useGMasterAuthStore.getState().status).toEqual({ loggedIn: false })
  })

  it('syncProvider delegates to API', async () => {
    vi.mocked(gmasterAuthApi.syncProvider).mockResolvedValueOnce({ provider: { id: 'managed-gmaster-api' } as any })
    await useGMasterAuthStore.getState().syncProvider()
    expect(gmasterAuthApi.syncProvider).toHaveBeenCalled()
  })

  it('startPolling uses 2000ms timer and fetches status', async () => {
    vi.useFakeTimers()
    vi.mocked(gmasterAuthApi.status).mockResolvedValue({ loggedIn: false })

    useGMasterAuthStore.getState().startPolling()

    expect(useGMasterAuthStore.getState().isPolling).toBe(true)
    expect(vi.getTimerCount()).toBe(1)
    expect(gmasterAuthApi.status).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1_999)
    expect(gmasterAuthApi.status).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(gmasterAuthApi.status).toHaveBeenCalledTimes(1)
  })

  it('syncs provider and stops polling when status is logged in', async () => {
    vi.useFakeTimers()
    vi.mocked(gmasterAuthApi.status).mockResolvedValue({
      loggedIn: true,
      expiresAt: null,
      user: {
        id: 1,
        username: 'gmaster',
        displayName: 'G Master',
      },
    })
    vi.mocked(gmasterAuthApi.syncProvider).mockResolvedValue({ provider: { id: 'managed-gmaster-api' } as any })

    useGMasterAuthStore.getState().startPolling()
    await vi.advanceTimersByTimeAsync(2_000)

    expect(gmasterAuthApi.status).toHaveBeenCalledTimes(1)
    expect(gmasterAuthApi.syncProvider).toHaveBeenCalledTimes(1)
    expect(useGMasterAuthStore.getState().isPolling).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not sync stale logged-in status when polling status fails', async () => {
    vi.useFakeTimers()
    vi.mocked(gmasterAuthApi.status).mockRejectedValue(new Error('status failed'))
    useGMasterAuthStore.setState({
      status: {
        loggedIn: true,
        expiresAt: null,
        user: {
          id: 1,
          username: 'stale',
          displayName: 'Stale User',
        },
      },
    })

    useGMasterAuthStore.getState().startPolling()
    await vi.advanceTimersByTimeAsync(2_000)

    expect(gmasterAuthApi.syncProvider).not.toHaveBeenCalled()
    expect(useGMasterAuthStore.getState().isPolling).toBe(true)
    expect(useGMasterAuthStore.getState().error).toBe('status failed')
    expect(vi.getTimerCount()).toBe(1)
  })

  it('logout stops active polling and resets status', async () => {
    vi.useFakeTimers()
    vi.mocked(gmasterAuthApi.status).mockResolvedValue({ loggedIn: false })
    vi.mocked(gmasterAuthApi.logout).mockResolvedValueOnce({ ok: true })

    useGMasterAuthStore.getState().startPolling()
    expect(useGMasterAuthStore.getState().isPolling).toBe(true)
    expect(vi.getTimerCount()).toBe(1)

    await useGMasterAuthStore.getState().logout()

    expect(useGMasterAuthStore.getState().status).toEqual({ loggedIn: false })
    expect(useGMasterAuthStore.getState().isLoading).toBe(false)
    expect(useGMasterAuthStore.getState().isPolling).toBe(false)
    expect(vi.getTimerCount()).toBe(0)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(gmasterAuthApi.status).not.toHaveBeenCalled()
  })
})
