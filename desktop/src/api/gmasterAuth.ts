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

export type GMasterBillingKind = 'topup' | 'subscription'

export type GMasterEntitlements = {
  canUseBuiltinProvider: boolean
  enabledModels: string[]
  enabledFeatures: string[]
  expiresAt: number | null
}

export type GMasterWallet = {
  balance: number
  currency: string
  lowBalance: boolean
}

export type GMasterAccountOverview = {
  user: GMasterUser
  subscription: GMasterSubscriptionSnapshot | null
  quota: {
    remaining: number | null
    used: number | null
    unlimited: boolean
  } | null
  wallet: GMasterWallet | null
  entitlements: GMasterEntitlements | null
  canUseBuiltinProvider: boolean
  billingUrl: string | null
  accountUrl: string | null
}

export type GMasterAccountInfo = GMasterAccountOverview

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
  cancelAtPeriodEnd?: boolean
  resumable?: boolean
}

export type GMasterBillingPlan = {
  id: string
  kind: GMasterBillingKind
  name: string
  description: string
  price: number
  currency: string
  interval: 'month' | 'year' | 'one_time'
  quotaAmount: number | null
  unlimited: boolean
  recommended: boolean
}

export type GMasterCheckoutStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled'

export type GMasterCheckoutSession = {
  id: string
  url: string
  status: GMasterCheckoutStatus
  kind: GMasterBillingKind
  expiresAt: number | null
}

export type GMasterBillingTransaction = {
  id: string
  kind: 'topup' | 'subscription' | 'usage' | 'refund' | 'adjustment'
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled'
  amount: number
  currency: string
  createdAt: number
  description: string
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
    return api.get<GMasterAccountOverview>('/api/gmaster-auth/me')
  },
  plans() {
    return api.get<{ plans: GMasterBillingPlan[] }>('/api/gmaster-auth/billing/plans')
  },
  createCheckout(input: {
    kind: GMasterBillingKind
    planId: string
    returnTo?: 'account'
  }) {
    return api.post<GMasterCheckoutSession>(
      '/api/gmaster-auth/billing/checkout',
      input,
    )
  },
  checkoutStatus(id: string) {
    return api.get<GMasterCheckoutSession>(
      `/api/gmaster-auth/billing/checkout/${encodeURIComponent(id)}`,
    )
  },
  transactions() {
    return api.get<{ transactions: GMasterBillingTransaction[] }>('/api/gmaster-auth/billing/transactions')
  },
  cancelSubscription() {
    return api.post<{ ok: true }>('/api/gmaster-auth/subscription/cancel')
  },
  resumeSubscription() {
    return api.post<{ ok: true }>('/api/gmaster-auth/subscription/resume')
  },
  syncProvider() {
    return api.post<{ provider: SavedProvider }>('/api/gmaster-auth/sync-provider')
  },
  logout() {
    return api.delete<{ ok: true }>('/api/gmaster-auth')
  },
}
