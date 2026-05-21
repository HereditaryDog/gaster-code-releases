/**
 * Integration tests for /api/gaster-oauth/* endpoints.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { handleGasterOAuthApi, handleGasterOAuthCallback } from '../api/gaster-oauth.js'
import { gasterOAuthService } from '../services/gasterOAuthService.js'

let tmpDir: string
let originalConfigDir: string | undefined

async function setup() {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gaster-oauth-api-test-'))
  originalConfigDir = process.env.CLAUDE_CONFIG_DIR
  process.env.CLAUDE_CONFIG_DIR = tmpDir
}

async function teardown() {
  if (originalConfigDir === undefined) {
    delete process.env.CLAUDE_CONFIG_DIR
  } else {
    process.env.CLAUDE_CONFIG_DIR = originalConfigDir
  }
  await fs.rm(tmpDir, { recursive: true, force: true })
}

function buildReq(
  method: string,
  pathname: string,
  body?: unknown,
): { req: Request; url: URL; segments: string[] } {
  const url = new URL(`http://localhost:3456${pathname}`)
  const req = new Request(url.toString(), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const segments = url.pathname.split('/').filter(Boolean)
  return { req, url, segments }
}

describe('POST /api/gaster-oauth/start', () => {
  beforeEach(setup)
  afterEach(teardown)

  test('returns authorize URL with PKCE challenge', async () => {
    const { req, url, segments } = buildReq('POST', '/api/gaster-oauth/start', {
      serverPort: 54321,
    })
    const res = await handleGasterOAuthApi(req, url, segments)
    expect(res.status).toBe(200)
    const data = (await res.json()) as { authorizeUrl: string; state: string }
    expect(data.authorizeUrl).toContain('code_challenge_method=S256')
    expect(data.authorizeUrl).toContain(
      encodeURIComponent('http://localhost:54321/callback'),
    )
    expect(data.state).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  test('400 if serverPort missing', async () => {
    const { req, url, segments } = buildReq('POST', '/api/gaster-oauth/start', {})
    const res = await handleGasterOAuthApi(req, url, segments)
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string; message?: string }
    expect(body.error).toBe('BAD_REQUEST')
  })
})

describe('GET /api/gaster-oauth/status', () => {
  beforeEach(setup)
  afterEach(teardown)

  test('returns loggedIn=false when no token file', async () => {
    const { req, url, segments } = buildReq('GET', '/api/gaster-oauth/status')
    const res = await handleGasterOAuthApi(req, url, segments)
    expect(res.status).toBe(200)
    const data = (await res.json()) as { loggedIn: boolean }
    expect(data.loggedIn).toBe(false)
  })

  test('returns loggedIn=true + metadata when token saved', async () => {
    await gasterOAuthService.saveTokens({
      accessToken: 'sk-ant-oat01-xxx',
      refreshToken: 'sk-ant-ort01-xxx',
      expiresAt: Date.now() + 3600_000,
      scopes: ['user:inference'],
      subscriptionType: 'max',
    })

    const { req, url, segments } = buildReq('GET', '/api/gaster-oauth/status')
    const res = await handleGasterOAuthApi(req, url, segments)
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      loggedIn: boolean
      subscriptionType: string | null
      scopes: string[]
    }
    expect(data.loggedIn).toBe(true)
    expect(data.subscriptionType).toBe('max')
    expect(data.scopes).toEqual(['user:inference'])
    expect(JSON.stringify(data)).not.toContain('sk-ant-oat01')
    expect(JSON.stringify(data)).not.toContain('sk-ant-ort01')
  })

  test('returns loggedIn=false when stored token is expired and refresh fails', async () => {
    await gasterOAuthService.saveTokens({
      accessToken: 'expired-token',
      refreshToken: 'revoked-refresh-token',
      expiresAt: Date.now() - 1_000,
      scopes: ['user:inference'],
      subscriptionType: 'max',
    })
    gasterOAuthService.setRefreshFn(async () => {
      throw new Error('refresh revoked')
    })

    const { req, url, segments } = buildReq('GET', '/api/gaster-oauth/status')
    const res = await handleGasterOAuthApi(req, url, segments)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ loggedIn: false })
  })
})

describe('GET /callback', () => {
  beforeEach(setup)
  afterEach(teardown)

  test('success page is branded as Gaster Code', async () => {
    const originalCompleteSession = gasterOAuthService.completeSession
    ;(gasterOAuthService as any).completeSession = async () => undefined

    try {
      const res = await handleGasterOAuthCallback(
        new URL('http://localhost:3456/callback?code=abc&state=state-123'),
      )
      const body = await res.text()

      expect(body).toContain('return to Gaster Code')
    } finally {
      ;(gasterOAuthService as any).completeSession = originalCompleteSession
    }
  })
})

describe('DELETE /api/gaster-oauth', () => {
  beforeEach(setup)
  afterEach(teardown)

  test('clears token file', async () => {
    await gasterOAuthService.saveTokens({
      accessToken: 'a',
      refreshToken: null,
      expiresAt: null,
      scopes: [],
      subscriptionType: null,
    })

    const { req, url, segments } = buildReq('DELETE', '/api/gaster-oauth')
    const res = await handleGasterOAuthApi(req, url, segments)
    expect(res.status).toBe(200)
    expect(await gasterOAuthService.loadTokens()).toBeNull()
  })
})
