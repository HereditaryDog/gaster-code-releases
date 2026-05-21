import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { resolveRuntimeOverride, shouldSuppressPrewarmStartupWarning } from '../ws/handler.js'
import { gmasterAuthService } from '../services/gmasterAuthService.js'
import { ProviderService } from '../services/providerService.js'
import { ConversationStartupError } from '../services/conversationService.js'

let tmpDir: string
let originalConfigDir: string | undefined
let originalBaseUrl: string | undefined

async function setup() {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-gmaster-runtime-test-'))
  originalConfigDir = process.env.CLAUDE_CONFIG_DIR
  originalBaseUrl = process.env.GMASTER_API_BASE_URL
  process.env.CLAUDE_CONFIG_DIR = tmpDir
  process.env.GMASTER_API_BASE_URL = 'https://gmapi.example.test'
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
            models: {
              main: 'Kimi-K2.6',
              haiku: 'GLM-5.1',
              sonnet: 'MiniMax-M2.7',
              opus: 'gpt-5.5',
            },
          },
        },
      })
    }
    if (String(url).endsWith('/v1/models')) {
      return Response.json({
        object: 'list',
        data: [{ id: 'Kimi-K2.6', object: 'model' }],
      })
    }
    return Response.json({ success: false, message: `unexpected ${String(url)}` }, { status: 500 })
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

describe('G-Master runtime selection', () => {
  beforeEach(setup)
  afterEach(teardown)

  test('resolves official runtime model selections to the managed G-Master provider when signed in', async () => {
    await gmasterAuthService.saveTokens({
      accessToken: 'desktop-access',
      refreshToken: 'desktop-refresh',
      expiresAt: Date.now() + 3600_000,
      user: { id: 7, username: 'alice', displayName: 'Alice' },
    })

    const selection = await resolveRuntimeOverride({
      providerId: null,
      modelId: 'Kimi-K2.6',
    })

    expect(selection).toEqual({
      providerId: 'managed-gmaster-api',
      modelId: 'Kimi-K2.6',
    })

    const listed = await new ProviderService().listProviders()
    expect(listed.activeId).toBe('managed-gmaster-api')
    expect(listed.providers[0]?.apiKey).toBe('sk-gmaster-desktop')
  })
})

describe('WebSocket prewarm diagnostics', () => {
  test('suppresses warning diagnostics for stale sessions with missing work directories', () => {
    expect(
      shouldSuppressPrewarmStartupWarning(
        new ConversationStartupError(
          'Working directory does not exist or is not a directory: /tmp/missing-project',
          'WORKDIR_INVALID',
        ),
      ),
    ).toBe(true)

    expect(
      shouldSuppressPrewarmStartupWarning(new Error('provider rejected request')),
    ).toBe(false)
  })
})
