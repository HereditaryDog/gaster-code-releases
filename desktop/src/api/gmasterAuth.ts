import { api, getBaseUrl } from './client'
import type { SavedProvider } from '../types/provider'

export type GMasterUser = {
  id: number
  username: string
  displayName: string
  email?: string | null
  group?: string | null
}

export type GMasterAuthStatus =
  | { loggedIn: false }
  | {
      loggedIn: true
      expiresAt: number | null
      user: GMasterUser
      subscription?: unknown
      quota?: unknown
      canUseBuiltinProvider?: boolean
      billingUrl?: string
      accountUrl?: string
    }

export type GMasterAuthIntent = 'login' | 'register'

export type GMasterAccountInfo = {
  user: GMasterUser
  subscription: GMasterSubscriptionSnapshot | null
  quota: {
    remaining: number | null
    used: number | null
    unlimited: boolean
  } | null
  canUseBuiltinProvider: boolean
  billingUrl: string | null
  accountUrl: string | null
}

export type GMasterSubscriptionSnapshot = {
  active: boolean
  items: GMasterSubscriptionItem[]
}

export type GMasterSubscriptionItem = {
  id: number
  planId: number
  status: string
  startTime: number
  endTime: number
  amountTotal: number
  amountUsed: number
  amountRemaining: number
  unlimited: boolean
  upgradeGroup: string
}

function currentServerPort(): number {
  const port = new URL(getBaseUrl()).port
  const parsed = Number.parseInt(port, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Cannot determine server port from baseUrl: ${getBaseUrl()}`)
  }
  return parsed
}

export const gmasterAuthApi = {
  start(intent: GMasterAuthIntent = 'login') {
    return api.post<{ authorizeUrl: string; state: string }>('/api/gmaster-auth/start', {
      serverPort: currentServerPort(),
      clientVersion: import.meta.env?.VITE_APP_VERSION || '0.1.3',
      intent,
    })
  },
  status() {
    return api.get<GMasterAuthStatus>('/api/gmaster-auth/status')
  },
  me() {
    return api.get<GMasterAccountInfo>('/api/gmaster-auth/me')
  },
  syncProvider() {
    return api.post<{ provider: SavedProvider }>('/api/gmaster-auth/sync-provider')
  },
  logout() {
    return api.delete<{ ok: true }>('/api/gmaster-auth')
  },
}
