import { create } from 'zustand'
import { gmasterAuthApi, type GMasterAuthIntent, type GMasterAuthStatus } from '../api/gmasterAuth'

const POLL_INTERVAL_MS = 2_000

type GMasterAuthState = {
  status: GMasterAuthStatus | null
  isPolling: boolean
  isLoading: boolean
  error: string | null
  fetchStatus: () => Promise<GMasterAuthStatus | null>
  login: (intent?: GMasterAuthIntent) => Promise<{ authorizeUrl: string }>
  logout: () => Promise<void>
  syncProvider: () => Promise<void>
  startPolling: () => void
  stopPolling: () => void
}

export const useGMasterAuthStore = create<GMasterAuthState>((set, get) => {
  let pollTimer: ReturnType<typeof setTimeout> | null = null

  return {
    status: null,
    isPolling: false,
    isLoading: false,
    error: null,

    fetchStatus: async () => {
      try {
        const status = await gmasterAuthApi.status()
        set({ status, error: null })
        return status
      } catch (err) {
        set({ error: err instanceof Error ? err.message : String(err) })
        return null
      }
    },

    login: async (intent = 'login') => {
      set({ status: null, isLoading: true, error: null })
      try {
        const res = await gmasterAuthApi.start(intent)
        set({ isLoading: false })
        return { authorizeUrl: res.authorizeUrl }
      } catch (err) {
        set({ isLoading: false, error: err instanceof Error ? err.message : String(err) })
        throw err
      }
    },

    logout: async () => {
      get().stopPolling()
      set({ isLoading: true, error: null })
      try {
        await gmasterAuthApi.logout()
        set({ status: { loggedIn: false }, isLoading: false })
      } catch (err) {
        set({ isLoading: false, error: err instanceof Error ? err.message : String(err) })
        throw err
      }
    },

    syncProvider: async () => {
      await gmasterAuthApi.syncProvider()
    },

    startPolling: () => {
      if (pollTimer) return
      set({ status: null, isPolling: true })
      const scheduleNext = () => {
        pollTimer = setTimeout(async () => {
          const status = await get().fetchStatus()
          if (!get().isPolling) return
          if (status?.loggedIn) {
            await get().syncProvider().catch((err) => {
              set({ error: err instanceof Error ? err.message : String(err) })
            })
            if (!get().isPolling) return
            get().stopPolling()
            return
          }
          if (get().isPolling) scheduleNext()
        }, POLL_INTERVAL_MS)
      }
      scheduleNext()
    },

    stopPolling: () => {
      if (pollTimer) {
        clearTimeout(pollTimer)
        pollTimer = null
      }
      set({ isPolling: false })
    },
  }
})
