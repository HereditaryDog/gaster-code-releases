/**
 * GasterOpenAIOAuthService — 桌面端自管 OpenAI OAuth token
 *
 * 为什么存在: macOS Keychain ACL 在 .app 被打上 quarantine 属性后
 * 对无 UI sidecar 静默拒绝,导致 CLI 读不到 OAuth token → 403。
 * 这个 service 把 token 存到 Gaster Code 自己的目录,并通过 env 注入给 CLI。
 *
 * 复用 src/services/openaiAuth/client.ts 里的 PKCE + token exchange 逻辑,
 * 不复制粘贴 —— 保证跟 CLI 走同一套协议实现。
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
} from '../../services/oauth/crypto.js'
import {
  buildOpenAIAuthorizeUrl,
  exchangeOpenAICodeForTokens,
  refreshOpenAITokens,
  isOpenAITokenExpired,
  normalizeOpenAITokens,
  OPENAI_CODEX_OAUTH_PORT,
  OPENAI_CODEX_REDIRECT_PATH,
} from '../../services/openaiAuth/client.js'
import type {
  OpenAIOAuthTokens,
  OpenAIOAuthTokenResponse,
} from '../../services/openaiAuth/types.js'
import {
  getClaudeConfigDir,
  getGasterConfigPath,
  resolveExistingGasterConfigPath,
} from '../../utils/gasterConfig.js'

export type StoredOpenAIOAuthTokens = {
  accessToken: string
  refreshToken: string | null
  expiresAt: number | null
  email: string | null
  accountId: string | null
}

export type OpenAIOAuthSession = {
  state: string
  codeVerifier: string
  authorizeUrl: string
  serverPort: number
  createdAt: number
}

type OpenAIRefreshFn = (
  refreshToken: string,
) => Promise<OpenAIOAuthTokenResponse>

const SESSION_TTL_MS = 5 * 60 * 1000

export class GasterOpenAIOAuthService {
  private sessions = new Map<string, OpenAIOAuthSession>()
  private refreshFn: OpenAIRefreshFn = refreshOpenAITokens

  setRefreshFn(fn: OpenAIRefreshFn): void {
    this.refreshFn = fn
  }

  private getOAuthFilePath(): string {
    return getGasterConfigPath(getClaudeConfigDir(), 'openai-oauth.json')
  }

  private getReadableOAuthFilePath(): string {
    return resolveExistingGasterConfigPath(getClaudeConfigDir(), 'openai-oauth.json')
  }

  async loadTokens(): Promise<StoredOpenAIOAuthTokens | null> {
    try {
      const raw = await fs.readFile(this.getReadableOAuthFilePath(), 'utf-8')
      return JSON.parse(raw) as StoredOpenAIOAuthTokens
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }

  async saveTokens(tokens: StoredOpenAIOAuthTokens): Promise<void> {
    const filePath = this.getOAuthFilePath()
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    const tmp = `${filePath}.tmp.${process.pid}.${globalThis.crypto.randomUUID()}`
    await fs.writeFile(tmp, JSON.stringify(tokens, null, 2), { mode: 0o600 })
    await fs.rename(tmp, filePath)
  }

  async deleteTokens(): Promise<void> {
    const paths = [
      this.getOAuthFilePath(),
      resolveExistingGasterConfigPath(getClaudeConfigDir(), 'openai-oauth.json'),
    ]
    for (const filePath of [...new Set(paths)]) {
      try {
        await fs.unlink(filePath)
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
      }
    }
  }

  startSession({ serverPort }: { serverPort: number }): OpenAIOAuthSession {
    this.pruneExpiredSessions()

    const codeVerifier = generateCodeVerifier()
    const state = generateState()

    const redirectUri = `http://localhost:${serverPort}${OPENAI_CODEX_REDIRECT_PATH}`
    const authorizeUrl = buildOpenAIAuthorizeUrl({
      redirectUri,
      codeVerifier,
      state,
    })

    const session: OpenAIOAuthSession = {
      state,
      codeVerifier,
      authorizeUrl,
      serverPort,
      createdAt: Date.now(),
    }
    this.sessions.set(state, session)
    return session
  }

  getSession(state: string): OpenAIOAuthSession | null {
    const s = this.sessions.get(state)
    if (!s) return null
    if (Date.now() - s.createdAt > SESSION_TTL_MS) {
      this.sessions.delete(state)
      return null
    }
    return s
  }

  consumeSession(state: string): OpenAIOAuthSession | null {
    const s = this.getSession(state)
    if (s) this.sessions.delete(state)
    return s
  }

  private pruneExpiredSessions(): void {
    const now = Date.now()
    for (const [state, s] of this.sessions.entries()) {
      if (now - s.createdAt > SESSION_TTL_MS) this.sessions.delete(state)
    }
  }

  async completeSession(
    authorizationCode: string,
    state: string,
  ): Promise<StoredOpenAIOAuthTokens> {
    const session = this.consumeSession(state)
    if (!session) {
      throw new Error('OpenAI OAuth session not found or expired')
    }

    const redirectUri = `http://localhost:${session.serverPort}${OPENAI_CODEX_REDIRECT_PATH}`
    const response = await exchangeOpenAICodeForTokens({
      code: authorizationCode,
      redirectUri,
      codeVerifier: session.codeVerifier,
    })

    const normalized = normalizeOpenAITokens(response)
    const tokens: StoredOpenAIOAuthTokens = {
      accessToken: normalized.accessToken,
      refreshToken: normalized.refreshToken,
      expiresAt: normalized.expiresAt,
      email: normalized.email ?? null,
      accountId: normalized.accountId ?? null,
    }
    await this.saveTokens(tokens)
    return tokens
  }

  async ensureFreshTokens(): Promise<StoredOpenAIOAuthTokens | null> {
    const tokens = await this.loadTokens()
    if (!tokens) return null

    if (tokens.expiresAt === null) return tokens

    if (!isOpenAITokenExpired(tokens.expiresAt)) return tokens

    if (!tokens.refreshToken) return null

    try {
      const refreshed = await this.refreshFn(tokens.refreshToken)
      const normalized = normalizeOpenAITokens(refreshed)
      const updated: StoredOpenAIOAuthTokens = {
        accessToken: normalized.accessToken,
        refreshToken: normalized.refreshToken ?? tokens.refreshToken,
        expiresAt: normalized.expiresAt,
        email: normalized.email ?? tokens.email,
        accountId: normalized.accountId ?? tokens.accountId,
      }
      await this.saveTokens(updated)
      return updated
    } catch (err) {
      console.error(
        '[GasterOpenAIOAuthService] token refresh failed:',
        err instanceof Error ? err.message : err,
      )
      return null
    }
  }

  async ensureFreshAccessToken(): Promise<string | null> {
    const tokens = await this.ensureFreshTokens()
    return tokens?.accessToken ?? null
  }
}

export const gasterOpenAIOAuthService = new GasterOpenAIOAuthService()
