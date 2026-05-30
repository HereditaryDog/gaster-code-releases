import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { GMasterAuthService, type StoredGMasterAuthTokens } from '../services/gmasterAuthService.js'

let tmpDir: string
let originalConfigDir: string | undefined
let originalBaseUrl: string | undefined
let service: GMasterAuthService
let fetchCalls: Array<{ url: string; init?: RequestInit }> = []
let authStartAuthorizeUrl: string
let providerPayload: {
  name: string
  base_url: string
  api_format: string
  api_key: string
  models: Record<string, string>
}

async function setup() {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gmaster-auth-test-'))
  originalConfigDir = process.env.CLAUDE_CONFIG_DIR
  originalBaseUrl = process.env.GMASTER_API_BASE_URL
  process.env.CLAUDE_CONFIG_DIR = tmpDir
  process.env.GMASTER_API_BASE_URL = 'https://gmapi.example.test'
  fetchCalls = []
  authStartAuthorizeUrl = 'https://gmapi.example.test/gaster-code/desktop-login?request_id=gcr_abc'
  providerPayload = {
    name: 'G-Master API',
    base_url: 'https://gmapi.example.test',
    api_format: 'anthropic',
    api_key: 'sk-gmaster-desktop',
    models: { main: 'gpt-5.4', haiku: 'gpt-5.4-mini', sonnet: 'gpt-5.4', opus: 'gpt-5.4' },
  }
  service = new GMasterAuthService()
  service.setFetchFn(async (url, init) => {
    fetchCalls.push({ url: String(url), init })
    if (String(url).endsWith('/api/gaster-code/auth/start')) {
      return Response.json({ success: true, data: { authorize_url: authStartAuthorizeUrl } })
    }
    if (String(url).endsWith('/api/gaster-code/auth/token')) {
      return Response.json({
        success: true,
        data: {
          access_token: 'desktop-access',
          refresh_token: 'desktop-refresh',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: 7, username: 'alice', display_name: 'Alice', email: 'alice@example.test', group: 'default' },
        },
      })
    }
    if (String(url).endsWith('/api/gaster-code/auth/refresh')) {
      return Response.json({
        success: true,
        data: {
          access_token: 'desktop-access-refreshed',
          refresh_token: 'desktop-refresh-refreshed',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: 7, username: 'alice', display_name: 'Alice', email: 'alice@example.test', group: 'default' },
        },
      })
    }
    if (String(url).endsWith('/api/gaster-code/me')) {
      return Response.json({
        success: true,
        data: {
          user: { id: 7, username: 'alice', display_name: 'Alice', email: 'alice@example.test', group: 'default' },
          subscription: {
            active: true,
            items: [{
              id: 10,
              plan_id: 2,
              status: 'active',
              start_time: 1770000000,
              end_time: 1772592000,
              amount_total: 1000000,
              amount_used: 120000,
              amount_remaining: 880000,
              unlimited: false,
              upgrade_group: 'weekly',
              cancel_at_period_end: true,
              resumable: true,
            }],
          },
          quota: { remaining: 123, used: 10, unlimited: false },
          wallet: { balance: 2500, currency: 'credits', low_balance: false },
          entitlements: {
            can_use_builtin_provider: true,
            enabled_models: ['gpt-5.4'],
            enabled_features: ['chat'],
            expires_at: 1772592000,
          },
          can_use_builtin_provider: true,
          billing_url: 'https://gmapi.example.test/user/billing',
          account_url: 'https://gmapi.example.test/user',
        },
      })
    }
    if (String(url).endsWith('/api/gaster-code/provider-token')) {
      return Response.json({
        success: true,
        data: {
          provider: providerPayload,
        },
      })
    }
    if (String(url).endsWith('/v1/models')) {
      return Response.json({
        object: 'list',
        data: [
          { id: 'claude-sonnet-4-6', object: 'model' },
          { id: 'claude-opus-4-7', object: 'model' },
          { id: 'gpt-image-2', object: 'model' },
        ],
      })
    }
    if (String(url).endsWith('/api/gaster-code/auth/revoke')) {
      return Response.json({ success: true, data: null })
    }
    return Response.json({ success: false, message: 'unhandled test URL' }, { status: 500 })
  })
}

async function teardown() {
  if (originalConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
  else process.env.CLAUDE_CONFIG_DIR = originalConfigDir
  if (originalBaseUrl === undefined) delete process.env.GMASTER_API_BASE_URL
  else process.env.GMASTER_API_BASE_URL = originalBaseUrl
  await fs.rm(tmpDir, { recursive: true, force: true })
}

describe('GMasterAuthService', () => {
  beforeEach(setup)
  afterEach(teardown)

  test('startSession posts PKCE challenge and stores pending state', async () => {
    const session = await service.startSession({ serverPort: 54321, clientVersion: '0.1.3' })
    expect(session.authorizeUrl).toContain('/gaster-code/desktop-login')
    expect(session.state).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const body = JSON.parse(String(fetchCalls[0]?.init?.body))
    expect(body.state).toBe(session.state)
    expect(body.code_challenge).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(body.code_challenge_method).toBe('S256')
    expect(body.redirect_uri).toBe('http://127.0.0.1:54321/api/gmaster-auth/callback')
    expect(body.client_name).toBe('Gaster Code')
    expect(body.client_version).toBe('0.1.3')
    expect(body.intent).toBe('login')
    const tokens = await service.completeSession('one-time-code', session.state)
    expect(tokens.accessToken).toBe('desktop-access')
    expect(tokens.user.email).toBe('alice@example.test')
  })

  test('fetchProviderToken includes chat model catalog from G-Master API', async () => {
    await service.saveTokens({
      accessToken: 'desktop-access',
      refreshToken: null,
      expiresAt: null,
      user: { id: 7, username: 'alice', displayName: 'Alice', group: 'default' },
    })

    const provider = await service.fetchProviderToken()

    expect(provider.availableModels).toEqual(['claude-sonnet-4-6', 'claude-opus-4-7'])
  })

  test('startSession forwards register intent to G-Master auth start', async () => {
    await service.startSession({ serverPort: 54321, clientVersion: '0.1.3', intent: 'register' })

    const body = JSON.parse(String(fetchCalls[0]?.init?.body))
    expect(body.intent).toBe('register')
  })

  test('startSession rejects javascript authorize URL', async () => {
    authStartAuthorizeUrl = 'javascript:alert(1)'
    await expect(service.startSession({ serverPort: 54321, clientVersion: '0.1.3' })).rejects.toThrow('Invalid G-Master authorize URL')
  })

  test('startSession rejects wrong-origin authorize URL', async () => {
    authStartAuthorizeUrl = 'https://evil.example.test/gaster-code/desktop-login?state=abc'
    await expect(service.startSession({ serverPort: 54321, clientVersion: '0.1.3' })).rejects.toThrow('Invalid G-Master authorize URL')
  })

  test('completeSession exchanges code and writes token file with 0600 permissions', async () => {
    const session = await service.startSession({ serverPort: 54321, clientVersion: '0.1.3' })
    const tokens = await service.completeSession('one-time-code', session.state)
    expect(tokens.accessToken).toBe('desktop-access')
    const tokenCall = fetchCalls.find((call) => call.url.endsWith('/api/gaster-code/auth/token'))
    const tokenBody = JSON.parse(String(tokenCall?.init?.body))
    expect(tokenBody).toEqual({
      code: 'one-time-code',
      redirect_uri: 'http://127.0.0.1:54321/api/gmaster-auth/callback',
      code_verifier: expect.any(String),
    })
    const tokenPath = path.join(tmpDir, 'gaster-code', 'gmaster-auth.json')
    expect((await fs.stat(tokenPath)).mode & 0o777).toBe(0o600)
    expect((await service.loadTokens())?.user.username).toBe('alice')
  })

  test('completeSession resumes pending auth state after server restart', async () => {
    const session = await service.startSession({ serverPort: 54321, clientVersion: '0.1.3' })
    const restartedService = new GMasterAuthService()
    restartedService.setFetchFn(async (url, init) => {
      fetchCalls.push({ url: String(url), init })
      if (String(url).endsWith('/api/gaster-code/auth/token')) {
        return Response.json({
          success: true,
          data: {
            access_token: 'desktop-access-after-restart',
            refresh_token: 'desktop-refresh-after-restart',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: 7, username: 'alice', display_name: 'Alice', email: 'alice@example.test', group: 'default' },
          },
        })
      }
      return Response.json({ success: false, message: 'unhandled test URL' }, { status: 500 })
    })

    const tokens = await restartedService.completeSession('one-time-code', session.state)

    expect(tokens.accessToken).toBe('desktop-access-after-restart')
    const tokenCall = fetchCalls.find((call) => call.url.endsWith('/api/gaster-code/auth/token'))
    const tokenBody = JSON.parse(String(tokenCall?.init?.body))
    expect(tokenBody.redirect_uri).toBe('http://127.0.0.1:54321/api/gmaster-auth/callback')
    expect(tokenBody.code_verifier).toEqual(expect.any(String))
  })

  test('completeSession keeps pending auth state long enough for browser login', async () => {
    const originalNow = Date.now
    let currentNow = 1_770_000_000_000
    Date.now = () => currentNow
    try {
      const session = await service.startSession({ serverPort: 54321, clientVersion: '0.1.3' })
      currentNow += 10 * 60 * 1000

      const tokens = await service.completeSession('one-time-code', session.state)

      expect(tokens.accessToken).toBe('desktop-access')
    } finally {
      Date.now = originalNow
    }
  })

  test('completeSession rejects mismatched state', async () => {
    await service.startSession({ serverPort: 54321, clientVersion: '0.1.3' })
    await expect(service.completeSession('one-time-code', 'wrong-state')).rejects.toThrow('G-Master auth session not found or expired')
  })

  test('status returns loggedIn false when token file is absent', async () => {
    expect(await service.getStatus()).toEqual({ loggedIn: false })
  })

  test('fetchMe uses bearer token without exposing secrets in status', async () => {
    await service.saveTokens({
      accessToken: 'desktop-access',
      refreshToken: 'desktop-refresh',
      expiresAt: Date.now() + 3600_000,
      user: { id: 7, username: 'alice', displayName: 'Alice', group: 'default' },
    })
    const status = await service.getStatus()
    expect(status.loggedIn).toBe(true)
    expect(JSON.stringify(status)).not.toContain('desktop-access')
    const me = await service.fetchMe()
    expect(me.user.username).toBe('alice')
    expect(me.user.email).toBe('alice@example.test')
    expect(me.subscription).toEqual({
      active: true,
      items: [{
        id: 10,
        planId: 2,
        status: 'active',
        startTime: 1770000000,
        endTime: 1772592000,
        amountTotal: 1000000,
        amountUsed: 120000,
        amountRemaining: 880000,
        unlimited: false,
        upgradeGroup: 'weekly',
        cancelAtPeriodEnd: true,
        resumable: true,
      }],
    })
    expect(me.wallet).toEqual({ balance: 2500, currency: 'credits', lowBalance: false })
    expect(me.entitlements).toEqual({
      canUseBuiltinProvider: true,
      enabledModels: ['gpt-5.4'],
      enabledFeatures: ['chat'],
      expiresAt: 1772592000,
    })
    const meCall = fetchCalls.find((call) => call.url.endsWith('/api/gaster-code/me'))
    expect(meCall?.init?.headers).toEqual({
      Authorization: 'Bearer desktop-access',
    })
  })

  test('billing helpers proxy authenticated requests and normalize responses', async () => {
    await service.saveTokens({
      accessToken: 'desktop-access',
      refreshToken: 'desktop-refresh',
      expiresAt: Date.now() + 3600_000,
      user: { id: 7, username: 'alice', displayName: 'Alice', group: 'default' },
    })
    service.setFetchFn(async (url, init) => {
      fetchCalls.push({ url: String(url), init })
      if (String(url).endsWith('/api/gaster-code/billing/plans')) {
        return Response.json({
          success: true,
          data: {
            plans: [{
              id: 'topup_10',
              kind: 'topup',
              name: '10M credits',
              description: 'Top up 10M credits',
              price: 1200,
              currency: 'USD',
              interval: 'one_time',
              quota_amount: 10000000,
              unlimited: false,
              recommended: true,
            }],
          },
        })
      }
      if (String(url).endsWith('/api/gaster-code/billing/checkout')) {
        return Response.json({
          success: true,
          data: {
            id: 'cs_123',
            status: 'pending',
            url: 'https://pay.example.test/cs_123',
            kind: 'topup',
            expires_at: 1770000300,
          },
        })
      }
      if (String(url).endsWith('/api/gaster-code/billing/checkout/cs_%2F123')) {
        return Response.json({
          success: true,
          data: { id: 'cs_/123', status: 'paid', url: '', kind: 'topup', expires_at: null },
        })
      }
      if (String(url).endsWith('/api/gaster-code/billing/transactions')) {
        return Response.json({
          success: true,
          data: {
            transactions: [{
              id: 'txn_1',
              kind: 'topup',
              status: 'paid',
              amount: 1200,
              currency: 'USD',
              created_at: 1770000000,
              description: 'Top up',
            }],
          },
        })
      }
      if (String(url).endsWith('/api/gaster-code/subscription/cancel')) {
        return Response.json({
          success: true,
          data: { ok: true },
        })
      }
      if (String(url).endsWith('/api/gaster-code/subscription/resume')) {
        return Response.json({
          success: true,
          data: { ok: true },
        })
      }
      return Response.json({ success: false, message: 'unhandled test URL' }, { status: 500 })
    })

    expect(await service.fetchBillingPlans()).toEqual({
      plans: [{
        id: 'topup_10',
        kind: 'topup',
        name: '10M credits',
        description: 'Top up 10M credits',
        price: 1200,
        currency: 'USD',
        interval: 'one_time',
        quotaAmount: 10000000,
        unlimited: false,
        recommended: true,
      }],
    })
    expect(await service.createCheckout({
      kind: 'topup',
      planId: 'topup_10',
      returnTo: 'account',
    })).toMatchObject({
      id: 'cs_123',
      status: 'pending',
      url: 'https://pay.example.test/cs_123',
      kind: 'topup',
      expiresAt: 1770000300,
    })
    expect(await service.fetchCheckoutStatus('cs_/123')).toMatchObject({
      id: 'cs_/123',
      status: 'paid',
      kind: 'topup',
    })
    expect(await service.fetchBillingTransactions()).toEqual({
      transactions: [{
        id: 'txn_1',
        kind: 'topup',
        status: 'paid',
        amount: 1200,
        currency: 'USD',
        createdAt: 1770000000,
        description: 'Top up',
      }],
    })
    expect(await service.cancelSubscription()).toEqual({ ok: true })
    expect(await service.resumeSubscription()).toEqual({ ok: true })

    const checkoutCall = fetchCalls.find((call) => call.url.endsWith('/api/gaster-code/billing/checkout'))
    expect(checkoutCall?.init?.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer desktop-access',
    })
    expect(JSON.parse(String(checkoutCall?.init?.body))).toEqual({
      kind: 'topup',
      plan_id: 'topup_10',
      return_to: 'account',
    })
  })

  test('fetchProviderToken returns normalized provider config', async () => {
    await service.saveTokens({
      accessToken: 'desktop-access',
      refreshToken: 'desktop-refresh',
      expiresAt: Date.now() + 3600_000,
      user: { id: 7, username: 'alice', displayName: 'Alice', group: 'default' },
    })
    const provider = await service.fetchProviderToken()
    expect(provider.name).toBe('G-Master API')
    expect(provider.apiFormat).toBe('anthropic')
    expect(provider.apiKey).toBe('sk-gmaster-desktop')
    expect(provider.models).toEqual({
      main: 'gpt-5.4',
      haiku: 'gpt-5.4-mini',
      sonnet: 'gpt-5.4',
      opus: 'gpt-5.4',
    })
  })

  test('fetchProviderToken rejects invalid api format', async () => {
    providerPayload.api_format = 'invalid'
    await service.saveTokens({
      accessToken: 'desktop-access',
      refreshToken: 'desktop-refresh',
      expiresAt: Date.now() + 3600_000,
      user: { id: 7, username: 'alice', displayName: 'Alice', group: 'default' },
    })
    await expect(service.fetchProviderToken()).rejects.toThrow('Invalid G-Master provider api_format')
  })

  test('fetchProviderToken rejects missing main model', async () => {
    providerPayload.models = { haiku: 'gpt-5.4-mini' }
    await service.saveTokens({
      accessToken: 'desktop-access',
      refreshToken: 'desktop-refresh',
      expiresAt: Date.now() + 3600_000,
      user: { id: 7, username: 'alice', displayName: 'Alice', group: 'default' },
    })
    await expect(service.fetchProviderToken()).rejects.toThrow('Invalid G-Master provider main model')
  })

  test('expired status refreshes tokens before reporting logged in', async () => {
    await service.saveTokens({
      accessToken: 'desktop-access-old',
      refreshToken: 'desktop-refresh-old',
      expiresAt: Math.floor(Date.now() / 1000) - 30,
      user: { id: 7, username: 'alice', displayName: 'Alice', email: 'alice@example.test', group: 'default' },
    })
    const status = await service.getStatus()
    expect(status).toMatchObject({
      loggedIn: true,
      user: { username: 'alice', email: 'alice@example.test' },
    })
    expect((await service.loadTokens())?.accessToken).toBe('desktop-access-refreshed')
    const refreshCall = fetchCalls.find((call) => call.url.endsWith('/api/gaster-code/auth/refresh'))
    expect(JSON.parse(String(refreshCall?.init?.body))).toEqual({
      refresh_token: 'desktop-refresh-old',
    })
  })

  test('shares one refresh request across concurrent status, account, and provider calls', async () => {
    let refreshCalls = 0
    let releaseRefresh: (() => void) | null = null
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve
    })
    service.setFetchFn(async (url, init) => {
      fetchCalls.push({ url: String(url), init })
      if (String(url).endsWith('/api/gaster-code/auth/refresh')) {
        refreshCalls += 1
        await refreshGate
        return Response.json({
          success: true,
          data: {
            access_token: 'desktop-access-singleflight',
            refresh_token: 'desktop-refresh-singleflight',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: 7, username: 'alice', display_name: 'Alice', email: 'alice@example.test', group: 'default' },
          },
        })
      }
      if (String(url).endsWith('/api/gaster-code/me')) {
        return Response.json({
          success: true,
          data: {
            user: { id: 7, username: 'alice', display_name: 'Alice', email: 'alice@example.test', group: 'default' },
            subscription: null,
            quota: null,
            can_use_builtin_provider: true,
            billing_url: null,
            account_url: null,
          },
        })
      }
      if (String(url).endsWith('/api/gaster-code/provider-token')) {
        return Response.json({ success: true, data: { provider: providerPayload } })
      }
      if (String(url).endsWith('/v1/models')) {
        return Response.json({
          object: 'list',
          data: [
            { id: 'claude-sonnet-4-6', object: 'model' },
          ],
        })
      }
      return Response.json({ success: false, message: 'unhandled test URL' }, { status: 500 })
    })
    await service.saveTokens({
      accessToken: 'desktop-access-old',
      refreshToken: 'desktop-refresh-old',
      expiresAt: Math.floor(Date.now() / 1000) - 30,
      user: { id: 7, username: 'alice', displayName: 'Alice', group: 'default' },
    })

    const pending = Promise.all([
      service.getStatus(),
      service.fetchMe(),
      service.fetchProviderToken(),
    ])
    await new Promise((resolve) => setTimeout(resolve, 0))
    releaseRefresh?.()
    const [status] = await pending

    expect(status).toMatchObject({ loggedIn: true, user: { username: 'alice' } })
    expect(refreshCalls).toBe(1)
    expect((await service.loadTokens())?.accessToken).toBe('desktop-access-singleflight')
  })

  test('keeps a newer token file when stale refresh fails after another writer updated it', async () => {
    service.setFetchFn(async (url, init) => {
      fetchCalls.push({ url: String(url), init })
      if (String(url).endsWith('/api/gaster-code/auth/refresh')) {
        await service.saveTokens({
          accessToken: 'desktop-access-written-by-other-request',
          refreshToken: 'desktop-refresh-written-by-other-request',
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
          user: { id: 7, username: 'alice', displayName: 'Alice', email: 'alice@example.test', group: 'default' },
        })
        return Response.json({ success: false, message: 'refresh token already rotated' }, { status: 401 })
      }
      return Response.json({ success: false, message: 'unhandled test URL' }, { status: 500 })
    })
    await service.saveTokens({
      accessToken: 'desktop-access-old',
      refreshToken: 'desktop-refresh-old',
      expiresAt: Math.floor(Date.now() / 1000) - 30,
      user: { id: 7, username: 'alice', displayName: 'Alice', group: 'default' },
    })

    const status = await service.getStatus()

    expect(status).toMatchObject({ loggedIn: true, user: { username: 'alice' } })
    expect((await service.loadTokens())?.accessToken).toBe('desktop-access-written-by-other-request')
  })

  test('revokeSession calls backend revoke with provider token revocation', async () => {
    await service.saveTokens({
      accessToken: 'desktop-access',
      refreshToken: 'desktop-refresh',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 7, username: 'alice', displayName: 'Alice', email: 'alice@example.test', group: 'default' },
    })
    await service.revokeSession({ revokeProviderToken: true })
    const revokeCall = fetchCalls.find((call) => call.url.endsWith('/api/gaster-code/auth/revoke'))
    expect(revokeCall?.init?.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer desktop-access',
    })
    expect(JSON.parse(String(revokeCall?.init?.body))).toEqual({
      revoke_provider_token: true,
    })
  })
})
