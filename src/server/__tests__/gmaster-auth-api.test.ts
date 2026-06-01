import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { handleGMasterAuthApi, handleGMasterAuthCallback } from '../api/gmaster-auth.js'
import { gmasterAuthService } from '../services/gmasterAuthService.js'
import { ProviderService } from '../services/providerService.js'
import { conversationService } from '../services/conversationService.js'

let tmpDir: string
let originalConfigDir: string | undefined
let originalBaseUrl: string | undefined
let authStartBodies: unknown[]
let billingRequestBodies: unknown[]

async function setup() {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gmaster-auth-api-test-'))
  originalConfigDir = process.env.CLAUDE_CONFIG_DIR
  originalBaseUrl = process.env.GMASTER_API_BASE_URL
  process.env.CLAUDE_CONFIG_DIR = tmpDir
  process.env.GMASTER_API_BASE_URL = 'https://gmapi.example.test'
  authStartBodies = []
  billingRequestBodies = []
  gmasterAuthService.setFetchFn(async (url, init) => {
    if (String(url).endsWith('/api/gaster-code/auth/start')) {
      authStartBodies.push(JSON.parse(String(init?.body)))
      return Response.json({ success: true, data: { authorize_url: 'https://gmapi.example.test/gaster-code/desktop-login?state=abc' } })
    }
    if (String(url).endsWith('/api/gaster-code/auth/token')) {
      return Response.json({
        success: true,
        data: {
          access_token: 'desktop-access',
          refresh_token: 'desktop-refresh',
          expires_at: Date.now() + 3600_000,
          user: { id: 7, username: 'alice', display_name: 'Alice' },
        },
      })
    }
    if (String(url).endsWith('/api/gaster-code/provider-token')) {
      return Response.json({
        success: true,
        data: {
          provider: {
            name: 'G-Master API',
            base_url: 'https://gmapi.example.test',
            api_format: 'anthropic',
            api_key: 'sk-gmaster-desktop',
            models: { main: 'gpt-5.4', haiku: 'gpt-5.4-mini', sonnet: 'gpt-5.4', opus: 'gpt-5.4' },
          },
        },
      })
    }
    if (String(url).endsWith('/v1/models')) {
      return Response.json({ object: 'list', data: [{ id: 'gpt-5.4', object: 'model' }] })
    }
    if (String(url).endsWith('/api/gaster-code/billing/plans')) {
      return Response.json({
        success: true,
        data: {
          plans: [{
            id: 'subscription_2',
            kind: 'subscription',
            name: 'Monthly',
            description: 'Monthly subscription',
            price: 1200,
            currency: 'USD',
            interval: 'month',
            quota_amount: 10000000,
            unlimited: false,
            recommended: true,
          }],
        },
      })
    }
    if (String(url).endsWith('/api/gaster-code/billing/checkout')) {
      billingRequestBodies.push(JSON.parse(String(init?.body)))
      return Response.json({
        success: true,
        data: {
          id: 'cs_123',
          status: 'pending',
          url: 'https://pay.example.test/cs_123',
          kind: 'subscription',
          expires_at: 1770000300,
        },
      })
    }
    if (String(url).endsWith('/api/gaster-code/billing/checkout/cs_%2F123')) {
      return Response.json({
        success: true,
        data: { id: 'cs_/123', status: 'paid', url: '', kind: 'subscription', expires_at: null },
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
    return Response.json({ success: false, message: `unexpected ${String(url)} ${init?.method}` }, { status: 500 })
  })
}

async function teardown() {
  if (originalConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
  else process.env.CLAUDE_CONFIG_DIR = originalConfigDir
  if (originalBaseUrl === undefined) delete process.env.GMASTER_API_BASE_URL
  else process.env.GMASTER_API_BASE_URL = originalBaseUrl
  gmasterAuthService.setFetchFn(fetch)
  await fs.rm(tmpDir, { recursive: true, force: true })
}

function buildReq(method: string, pathname: string, body?: unknown) {
  const url = new URL(`http://127.0.0.1:3456${pathname}`)
  const req = new Request(url.toString(), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return { req, url, segments: url.pathname.split('/').filter(Boolean) }
}

describe('gmaster auth local API', () => {
  beforeEach(setup)
  afterEach(teardown)

  test('POST /api/gmaster-auth/start returns authorizeUrl', async () => {
    const { req, url, segments } = buildReq('POST', '/api/gmaster-auth/start', { serverPort: 3456, clientVersion: '1.0.8' })
    const res = await handleGMasterAuthApi(req, url, segments)
    expect(res.status).toBe(200)
    const body = await res.json() as { authorizeUrl: string; state: string }
    expect(body.authorizeUrl).toContain('/gaster-code/desktop-login')
    expect(body.state).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(authStartBodies[0]).toMatchObject({ intent: 'login' })
  })

  test('POST /api/gmaster-auth/start forwards register intent', async () => {
    const { req, url, segments } = buildReq('POST', '/api/gmaster-auth/start', { serverPort: 3456, clientVersion: '1.0.8', intent: 'register' })
    const res = await handleGMasterAuthApi(req, url, segments)
    expect(res.status).toBe(200)
    expect(authStartBodies[0]).toMatchObject({ intent: 'register' })
  })

  test('GET /api/gmaster-auth/status hides tokens', async () => {
    const { req, url, segments } = buildReq('GET', '/api/gmaster-auth/status')
    const res = await handleGMasterAuthApi(req, url, segments)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ loggedIn: false })
  })

  test('GET /api/gmaster-auth/status deactivates stale managed provider when signed out', async () => {
    const providerService = new ProviderService()
    await providerService.upsertManagedGMasterProvider({
      name: 'G-Master API',
      baseUrl: 'https://gmapi.example.test',
      apiFormat: 'anthropic',
      apiKey: 'sk-gmaster-desktop',
      models: { main: 'gpt-5.4', haiku: 'gpt-5.4-mini', sonnet: 'gpt-5.4', opus: 'gpt-5.4' },
    })

    const { req, url, segments } = buildReq('GET', '/api/gmaster-auth/status')
    const res = await handleGMasterAuthApi(req, url, segments)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ loggedIn: false })
    const listed = await providerService.listProviders()
    expect(listed.activeId).toBeNull()
    expect(listed.providers[0]?.apiKey).toBe('')
  })

  test('GET /api/gmaster-auth/status repairs stale managed provider when signed in', async () => {
    const providerService = new ProviderService()
    await providerService.upsertManagedGMasterProvider({
      name: 'G-Master API',
      baseUrl: 'https://gmapi.example.test',
      apiFormat: 'anthropic',
      apiKey: 'stale-token',
      models: { main: 'gpt-5.4', haiku: 'gpt-5.4-mini', sonnet: 'gpt-5.4', opus: 'gpt-5.4' },
    })
    await providerService.deactivateManagedGMasterProvider()
    await gmasterAuthService.saveTokens({
      accessToken: 'desktop-access',
      refreshToken: null,
      expiresAt: null,
      user: { id: 7, username: 'alice', displayName: 'Alice' },
    })
    gmasterAuthService.setFetchFn(async (url) => {
      if (String(url).endsWith('/api/gaster-code/provider-token')) {
        return Response.json({
          success: true,
          data: {
            provider: {
              name: 'G-Master API',
              base_url: 'https://gmapi.example.test',
              api_format: 'anthropic',
              api_key: 'sk-gmaster-desktop',
              models: { main: 'gpt-5.4', haiku: 'gpt-5.4-mini', sonnet: 'gpt-5.4', opus: 'gpt-5.4' },
            },
          },
        })
      }
      if (String(url).endsWith('/v1/models')) {
        return Response.json({ object: 'list', data: [{ id: 'gpt-5.4', object: 'model' }] })
      }
      return Response.json({ success: false, message: 'unexpected URL' }, { status: 500 })
    })

    const { req, url, segments } = buildReq('GET', '/api/gmaster-auth/status')
    const res = await handleGMasterAuthApi(req, url, segments)

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ loggedIn: true })
    const listed = await providerService.listProviders()
    expect(listed.activeId).toBe('managed-gmaster-api')
    expect(listed.providers[0]?.apiKey).toBe('sk-gmaster-desktop')
    const settings = await providerService.getManagedSettings()
    expect((settings.env as Record<string, string>).ANTHROPIC_API_KEY).toBe('sk-gmaster-desktop')
  })

  test('callback exchanges code and returns success HTML', async () => {
    const start = buildReq('POST', '/api/gmaster-auth/start', { serverPort: 3456, clientVersion: '1.0.8' })
    const startRes = await handleGMasterAuthApi(start.req, start.url, start.segments)
    const { state } = await startRes.json() as { state: string }
    const callbackUrl = new URL(`http://127.0.0.1:3456/api/gmaster-auth/callback?code=abc&state=${state}`)
    const res = await handleGMasterAuthCallback(callbackUrl)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('Login Successful')
    expect((await gmasterAuthService.loadTokens())?.accessToken).toBe('desktop-access')
  })

  test('callback refreshes managed provider token and restarts G-Master sessions after re-login', async () => {
    const restartSpy = spyOn(conversationService, 'restartSessionsUsingProvider')
      .mockResolvedValue(['active-gmaster-session'])
    const providerService = new ProviderService()
    await providerService.upsertManagedGMasterProvider({
      name: 'G-Master API',
      baseUrl: 'https://gmapi.example.test',
      apiFormat: 'anthropic',
      apiKey: 'stale-provider-token',
      models: { main: 'gpt-5.4', haiku: 'gpt-5.4-mini', sonnet: 'gpt-5.4', opus: 'gpt-5.4' },
    })

    const start = buildReq('POST', '/api/gmaster-auth/start', { serverPort: 3456, clientVersion: '1.0.8' })
    const startRes = await handleGMasterAuthApi(start.req, start.url, start.segments)
    const { state } = await startRes.json() as { state: string }
    const callbackUrl = new URL(`http://127.0.0.1:3456/api/gmaster-auth/callback?code=abc&state=${state}`)

    const res = await handleGMasterAuthCallback(callbackUrl)

    expect(res.status).toBe(200)
    const listed = await providerService.listProviders()
    expect(listed.providers[0]?.apiKey).toBe('sk-gmaster-desktop')
    expect(restartSpy).toHaveBeenCalledWith('managed-gmaster-api')
    restartSpy.mockRestore()
  })

  test('callback failure HTML escapes provider error', async () => {
    const callbackUrl = new URL('http://127.0.0.1:3456/api/gmaster-auth/callback?error=%3Cscript%3Ealert(1)%3C%2Fscript%3E')
    const res = await handleGMasterAuthCallback(callbackUrl)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
  })

  test('DELETE /api/gmaster-auth clears local token file', async () => {
    const providerService = new ProviderService()
    await providerService.upsertManagedGMasterProvider({
      name: 'G-Master API',
      baseUrl: 'https://gmapi.example.test',
      apiFormat: 'anthropic',
      apiKey: 'sk-gmaster-desktop',
      models: { main: 'gpt-5.4', haiku: 'gpt-5.4-mini', sonnet: 'gpt-5.4', opus: 'gpt-5.4' },
    })
    await gmasterAuthService.saveTokens({
      accessToken: 'desktop-access',
      refreshToken: null,
      expiresAt: null,
      user: { id: 7, username: 'alice', displayName: 'Alice' },
    })
    const { req, url, segments } = buildReq('DELETE', '/api/gmaster-auth')
    const res = await handleGMasterAuthApi(req, url, segments)
    expect(res.status).toBe(200)
    expect(await gmasterAuthService.loadTokens()).toBeNull()

    const listed = await providerService.listProviders()
    expect(listed.activeId).toBeNull()
    expect(listed.providers[0]?.apiKey).toBe('')
  })

  test('extra path segments return 404 for exact routes', async () => {
    const cases = [
      buildReq('POST', '/api/gmaster-auth/start/extra', { serverPort: 3456, clientVersion: '1.0.8' }),
      buildReq('GET', '/api/gmaster-auth/status/extra'),
      buildReq('GET', '/api/gmaster-auth/me/extra'),
      buildReq('GET', '/api/gmaster-auth/callback/extra'),
    ]

    for (const { req, url, segments } of cases) {
      const res = await handleGMasterAuthApi(req, url, segments)
      expect(res.status).toBe(404)
    }
  })

  test('billing nested routes proxy authenticated G-Master API calls', async () => {
    await gmasterAuthService.saveTokens({
      accessToken: 'desktop-access',
      refreshToken: null,
      expiresAt: null,
      user: { id: 7, username: 'alice', displayName: 'Alice' },
    })

    const plans = buildReq('GET', '/api/gmaster-auth/billing/plans')
    const plansRes = await handleGMasterAuthApi(plans.req, plans.url, plans.segments)
    expect(plansRes.status).toBe(200)
    expect(await plansRes.json()).toEqual({
      plans: [{
        id: 'subscription_2',
        kind: 'subscription',
        name: 'Monthly',
        description: 'Monthly subscription',
        price: 1200,
        currency: 'USD',
        interval: 'month',
        quotaAmount: 10000000,
        unlimited: false,
        recommended: true,
      }],
    })

    const checkout = buildReq('POST', '/api/gmaster-auth/billing/checkout', {
      kind: 'subscription',
      planId: 'subscription_2',
    })
    const checkoutRes = await handleGMasterAuthApi(checkout.req, checkout.url, checkout.segments)
    expect(checkoutRes.status).toBe(200)
    expect(await checkoutRes.json()).toMatchObject({
      id: 'cs_123',
      status: 'pending',
      url: 'https://pay.example.test/cs_123',
      kind: 'subscription',
      expiresAt: 1770000300,
    })
    expect(billingRequestBodies[0]).toEqual({
      kind: 'subscription',
      plan_id: 'subscription_2',
      return_to: 'account',
    })

    const checkoutStatus = buildReq('GET', '/api/gmaster-auth/billing/checkout/cs_%2F123')
    const checkoutStatusRes = await handleGMasterAuthApi(checkoutStatus.req, checkoutStatus.url, checkoutStatus.segments)
    expect(checkoutStatusRes.status).toBe(200)
    expect(await checkoutStatusRes.json()).toMatchObject({ id: 'cs_/123', status: 'paid' })

    const transactions = buildReq('GET', '/api/gmaster-auth/billing/transactions')
    const transactionsRes = await handleGMasterAuthApi(transactions.req, transactions.url, transactions.segments)
    expect(transactionsRes.status).toBe(200)
    expect(await transactionsRes.json()).toEqual({
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

    const cancel = buildReq('POST', '/api/gmaster-auth/subscription/cancel')
    const cancelRes = await handleGMasterAuthApi(cancel.req, cancel.url, cancel.segments)
    expect(cancelRes.status).toBe(200)
    expect(await cancelRes.json()).toEqual({ ok: true })

    const resume = buildReq('POST', '/api/gmaster-auth/subscription/resume')
    const resumeRes = await handleGMasterAuthApi(resume.req, resume.url, resume.segments)
    expect(resumeRes.status).toBe(200)
    expect(await resumeRes.json()).toEqual({ ok: true })
  })

  test('billing checkout validates request body and unknown nested routes stay 404', async () => {
    await gmasterAuthService.saveTokens({
      accessToken: 'desktop-access',
      refreshToken: null,
      expiresAt: null,
      user: { id: 7, username: 'alice', displayName: 'Alice' },
    })

    const invalid = buildReq('POST', '/api/gmaster-auth/billing/checkout', {
      kind: 'topup',
      planId: '',
      returnTo: 'dashboard',
    })
    const invalidRes = await handleGMasterAuthApi(invalid.req, invalid.url, invalid.segments)
    expect(invalidRes.status).toBe(400)

    const unknown = buildReq('GET', '/api/gmaster-auth/billing/checkout/cs_123/extra')
    const unknownRes = await handleGMasterAuthApi(unknown.req, unknown.url, unknown.segments)
    expect(unknownRes.status).toBe(404)
  })

  test('billing routes preserve stable G-Master API error codes', async () => {
    await gmasterAuthService.saveTokens({
      accessToken: 'desktop-access',
      refreshToken: null,
      expiresAt: null,
      user: { id: 7, username: 'alice', displayName: 'Alice' },
    })
    gmasterAuthService.setFetchFn(async (url) => {
      if (String(url).endsWith('/api/gaster-code/billing/plans')) {
        return Response.json({
          success: false,
          code: 'GMASTER_BILLING_PLAN_UNAVAILABLE',
          message: 'subscription plan is unavailable',
        })
      }
      return Response.json({ success: false, message: `unexpected ${String(url)}` }, { status: 500 })
    })

    const plans = buildReq('GET', '/api/gmaster-auth/billing/plans')
    const res = await handleGMasterAuthApi(plans.req, plans.url, plans.segments)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'GMASTER_BILLING_PLAN_UNAVAILABLE',
      message: 'subscription plan is unavailable',
    })
  })

  test('POST /api/gmaster-auth/sync-provider upserts managed provider', async () => {
    const restartSpy = spyOn(conversationService, 'restartSessionsUsingProvider')
      .mockResolvedValue(['active-gmaster-session'])
    await gmasterAuthService.saveTokens({
      accessToken: 'desktop-access',
      refreshToken: null,
      expiresAt: null,
      user: { id: 7, username: 'alice', displayName: 'Alice' },
    })
    gmasterAuthService.setFetchFn(async (url) => {
      if (String(url).endsWith('/api/gaster-code/provider-token')) {
        return Response.json({
          success: true,
          data: {
            provider: {
              name: 'G-Master API',
              base_url: 'https://gmapi.example.test',
              api_format: 'anthropic',
              api_key: 'sk-gmaster-desktop',
              models: { main: 'gpt-5.4', haiku: 'gpt-5.4-mini', sonnet: 'gpt-5.4', opus: 'gpt-5.4' },
            },
          },
        })
      }
      if (String(url).endsWith('/v1/models')) {
        return Response.json({ object: 'list', data: [{ id: 'gpt-5.4', object: 'model' }] })
      }
      return Response.json({ success: false, message: 'unexpected URL' }, { status: 500 })
    })
    const { req, url, segments } = buildReq('POST', '/api/gmaster-auth/sync-provider')
    const res = await handleGMasterAuthApi(req, url, segments)
    expect(res.status).toBe(200)
    const body = await res.json() as { provider: { id: string; managed?: { type: string } } }
    expect(body.provider.id).toBe('managed-gmaster-api')
    expect(body.provider.managed?.type).toBe('gmaster')
    expect(restartSpy).toHaveBeenCalledWith('managed-gmaster-api')
    restartSpy.mockRestore()
  })
})
