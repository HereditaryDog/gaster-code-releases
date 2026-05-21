// desktop/src/api/gasterOAuth.ts

import { api, getBaseUrl } from './client'

export type GasterOAuthStatus =
  | { loggedIn: false }
  | {
      loggedIn: true
      expiresAt: number | null
      scopes: string[]
      subscriptionType: 'pro' | 'max' | 'team' | 'enterprise' | null
    }

function currentServerPort(): number {
  const port = new URL(getBaseUrl()).port
  const parsed = Number.parseInt(port, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Cannot determine server port from baseUrl: ${getBaseUrl()}`)
  }
  return parsed
}

export const gasterOAuthApi = {
  start() {
    return api.post<{ authorizeUrl: string; state: string }>(
      '/api/gaster-oauth/start',
      { serverPort: currentServerPort() },
    )
  },

  status() {
    return api.get<GasterOAuthStatus>('/api/gaster-oauth')
  },

  logout() {
    return api.delete<{ ok: true }>('/api/gaster-oauth')
  },
}
