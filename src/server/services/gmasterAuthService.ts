import * as crypto from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  getClaudeConfigDir,
  getGasterConfigPath,
  resolveExistingGasterConfigPath,
} from '../../utils/gasterConfig.js'
import { ApiError } from '../middleware/errorHandler.js'

export type GMasterUser = {
  id: number
  username: string
  displayName: string
  email?: string | null
  group: string | null
}

export type StoredGMasterAuthTokens = {
  accessToken: string
  refreshToken: string | null
  expiresAt: number | null
  user: GMasterUser
}

export type GMasterAuthStatus =
  | { loggedIn: false }
  | {
      loggedIn: true
      expiresAt: number | null
      user: GMasterUser
    }

export type GMasterAuthIntent = 'login' | 'register'

export type GMasterBillingKind = 'topup' | 'subscription'

export type GMasterProviderConfig = {
  name: string
  baseUrl: string
  apiFormat: GMasterProviderApiFormat
  apiKey: string
  models: {
    main: string
    haiku: string
    sonnet: string
    opus: string
  }
  availableModels?: string[]
}

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

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>

type PendingGMasterAuthSession = {
  state: string
  codeVerifier: string
  redirectUri: string
  clientVersion: string
  intent?: GMasterAuthIntent
  createdAt: number
}

type ApiEnvelope<T> = {
  success?: boolean
  code?: string
  message?: string
  data?: T
}

export type GMasterProviderApiFormat =
  | 'anthropic'
  | 'openai_chat'
  | 'openai_responses'

const SESSION_TTL_MS = 30 * 60 * 1000
const REQUEST_TIMEOUT_MS = 15_000
const TOKEN_REFRESH_SKEW_SECONDS = 60
const DEFAULT_BASE_URL = 'https://gmapi.fun'

const GMASTER_ERROR_STATUS: Record<string, number> = {
  GMASTER_AUTH_EXPIRED: 401,
  GMASTER_BILLING_CHECKOUT_FAILED: 400,
  GMASTER_BILLING_PAYMENT_PENDING: 409,
  GMASTER_BILLING_PLAN_UNAVAILABLE: 400,
  GMASTER_BILLING_PROVIDER_UNAVAILABLE: 503,
}

function base64Url(bytes: Buffer): string {
  return bytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function randomPkceValue(): string {
  return base64Url(crypto.randomBytes(32))
}

function createCodeChallenge(verifier: string): string {
  return base64Url(crypto.createHash('sha256').update(verifier).digest())
}

function normalizeUser(raw: any): GMasterUser {
  return {
    id: Number(raw?.id),
    username: String(raw?.username ?? ''),
    displayName: String(raw?.display_name ?? raw?.displayName ?? raw?.username ?? ''),
    email: raw?.email ?? null,
    group: raw?.group ?? null,
  }
}

function normalizeProvider(raw: any): GMasterProviderConfig {
  const apiFormat = String(raw?.api_format ?? raw?.apiFormat ?? '')
  if (!isValidProviderApiFormat(apiFormat)) {
    throw new Error('Invalid G-Master provider api_format')
  }

  const apiKey = String(raw?.api_key ?? raw?.apiKey ?? '').trim()
  if (!apiKey) {
    throw new Error('Invalid G-Master provider api_key')
  }

  const rawModels = raw?.models ?? {}
  const main = String(rawModels.main ?? '').trim()
  if (!main) {
    throw new Error('Invalid G-Master provider main model')
  }

  return {
    name: String(raw?.name ?? ''),
    baseUrl: String(raw?.base_url ?? raw?.baseUrl ?? ''),
    apiFormat,
    apiKey,
    models: {
      main,
      haiku: String(rawModels.haiku ?? main).trim(),
      sonnet: String(rawModels.sonnet ?? main).trim(),
      opus: String(rawModels.opus ?? main).trim(),
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isLikelyChatModel(modelId: string): boolean {
  return !/(^|[-_])(image|embedding|audio|tts|whisper|rerank)([-_]|$)/i.test(modelId)
}

function extractModelCatalogItems(payload: unknown): unknown[] {
  if (isRecord(payload)) {
    if (Array.isArray(payload.data)) return payload.data
    if (isRecord(payload.data) && Array.isArray(payload.data.data)) return payload.data.data
    if (Array.isArray(payload.models)) return payload.models
    if (isRecord(payload.data) && Array.isArray(payload.data.models)) return payload.data.models
  }
  return []
}

function normalizeModelCatalog(payload: unknown): string[] {
  const ids = extractModelCatalogItems(payload)
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (isRecord(item) && typeof item.id === 'string') return item.id.trim()
      return ''
    })
    .filter((modelId) => modelId && isLikelyChatModel(modelId))

  return Array.from(new Set(ids))
}

function buildProviderModelsUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '')
  if (!normalized) throw new Error('G-Master provider base URL is missing')
  const parsed = new URL(normalized)
  const path = parsed.pathname.replace(/\/+$/, '')
  if (path.endsWith('/v1')) return `${normalized}/models`
  return `${normalized}/v1/models`
}

function isValidProviderApiFormat(
  apiFormat: string,
): apiFormat is GMasterProviderApiFormat {
  return (
    apiFormat === 'anthropic' ||
    apiFormat === 'openai_chat' ||
    apiFormat === 'openai_responses'
  )
}

function isPendingSession(value: unknown): value is PendingGMasterAuthSession {
  const session = value as PendingGMasterAuthSession
  return (
    typeof session?.state === 'string' &&
    typeof session.codeVerifier === 'string' &&
    typeof session.redirectUri === 'string' &&
    typeof session.clientVersion === 'string' &&
    (
      session.intent === undefined ||
      session.intent === 'login' ||
      session.intent === 'register'
    ) &&
    typeof session.createdAt === 'number'
  )
}

function validateAuthorizeUrl(authorizeUrl: string, expectedBaseUrl: string): void {
  let parsedAuthorizeUrl: URL
  try {
    parsedAuthorizeUrl = new URL(authorizeUrl)
  } catch {
    throw new Error('Invalid G-Master authorize URL')
  }

  const expectedOrigin = new URL(expectedBaseUrl).origin
  if (
    !['http:', 'https:'].includes(parsedAuthorizeUrl.protocol) ||
    parsedAuthorizeUrl.origin !== expectedOrigin
  ) {
    throw new Error('Invalid G-Master authorize URL')
  }
}

function normalizeAccountInfo(raw: any): GMasterAccountInfo {
  const subscription = raw?.subscription
  const quota = raw?.quota
  const entitlements = raw?.entitlements
  return {
    user: normalizeUser(raw?.user),
    subscription: subscription ? normalizeSubscriptionSnapshot(subscription) : null,
    quota: quota
      ? {
          remaining: quota.remaining ?? null,
          used: quota.used ?? null,
          unlimited: Boolean(quota.unlimited),
        }
      : null,
    wallet: normalizeWallet(raw?.wallet),
    entitlements: entitlements ? normalizeEntitlements(entitlements) : null,
    canUseBuiltinProvider: Boolean(
      raw?.can_use_builtin_provider ?? raw?.canUseBuiltinProvider,
    ),
    billingUrl: raw?.billing_url ?? raw?.billingUrl ?? null,
    accountUrl: raw?.account_url ?? raw?.accountUrl ?? null,
  }
}

function normalizeWallet(raw: any): GMasterWallet | null {
  if (!isRecord(raw)) return null
  return {
    balance: Number(raw.balance ?? 0),
    currency: String(raw.currency ?? ''),
    lowBalance: Boolean(raw.low_balance ?? raw.lowBalance),
  }
}

function normalizeEntitlements(raw: any): GMasterEntitlements {
  return {
    canUseBuiltinProvider: Boolean(
      raw?.can_use_builtin_provider ?? raw?.canUseBuiltinProvider,
    ),
    enabledModels: Array.isArray(raw?.enabled_models)
      ? raw.enabled_models.map(String)
      : Array.isArray(raw?.enabledModels)
        ? raw.enabledModels.map(String)
        : [],
    enabledFeatures: Array.isArray(raw?.enabled_features)
      ? raw.enabled_features.map(String)
      : Array.isArray(raw?.enabledFeatures)
        ? raw.enabledFeatures.map(String)
        : [],
    expiresAt: raw?.expires_at ?? raw?.expiresAt ?? null,
  }
}

function normalizeSubscriptionSnapshot(raw: any): GMasterSubscriptionSnapshot {
  const items = Array.isArray(raw?.items) ? raw.items : []
  return {
    active: Boolean(raw?.active),
    items: items.map(normalizeSubscriptionItem),
  }
}

function normalizeSubscriptionItem(raw: any): GMasterSubscriptionItem {
  return {
    id: Number(raw?.id ?? 0),
    planId: Number(raw?.plan_id ?? raw?.planId ?? 0),
    status: String(raw?.status ?? ''),
    startTime: Number(raw?.start_time ?? raw?.startTime ?? 0),
    endTime: Number(raw?.end_time ?? raw?.endTime ?? 0),
    amountTotal: Number(raw?.amount_total ?? raw?.amountTotal ?? 0),
    amountUsed: Number(raw?.amount_used ?? raw?.amountUsed ?? 0),
    amountRemaining: Number(raw?.amount_remaining ?? raw?.amountRemaining ?? 0),
    unlimited: Boolean(raw?.unlimited),
    upgradeGroup: String(raw?.upgrade_group ?? raw?.upgradeGroup ?? ''),
    ...(
      raw?.cancel_at_period_end !== undefined || raw?.cancelAtPeriodEnd !== undefined
        ? { cancelAtPeriodEnd: Boolean(raw?.cancel_at_period_end ?? raw?.cancelAtPeriodEnd) }
        : {}
    ),
    ...(raw?.resumable !== undefined ? { resumable: Boolean(raw.resumable) } : {}),
  }
}

function normalizeBillingKind(value: unknown): GMasterBillingKind {
  return value === 'subscription' ? 'subscription' : 'topup'
}

function normalizeBillingInterval(value: unknown): GMasterBillingPlan['interval'] {
  if (value === 'month' || value === 'year' || value === 'one_time') return value
  return 'one_time'
}

function normalizeBillingPlan(raw: any): GMasterBillingPlan {
  return {
    id: String(raw?.id ?? raw?.plan_id ?? raw?.planId ?? ''),
    kind: normalizeBillingKind(raw?.kind),
    name: String(raw?.name ?? ''),
    description: String(raw?.description ?? ''),
    price: Number(raw?.price ?? 0),
    currency: String(raw?.currency ?? ''),
    interval: normalizeBillingInterval(raw?.interval),
    quotaAmount: raw?.quota_amount ?? raw?.quotaAmount ?? null,
    unlimited: Boolean(raw?.unlimited),
    recommended: Boolean(raw?.recommended),
  }
}

function normalizeCheckoutStatus(value: unknown): GMasterCheckoutStatus {
  if (
    value === 'paid' ||
    value === 'failed' ||
    value === 'expired' ||
    value === 'cancelled'
  ) {
    return value
  }
  return 'pending'
}

function normalizeCheckoutSession(raw: any): GMasterCheckoutSession {
  return {
    id: String(raw?.id ?? ''),
    url: String(raw?.url ?? raw?.checkout_url ?? raw?.checkoutUrl ?? ''),
    status: normalizeCheckoutStatus(raw?.status),
    kind: normalizeBillingKind(raw?.kind),
    expiresAt: raw?.expires_at ?? raw?.expiresAt ?? null,
  }
}

function statusForGMasterError(code: string | undefined, fallbackStatus: number): number {
  if (code && GMASTER_ERROR_STATUS[code]) return GMASTER_ERROR_STATUS[code]
  return fallbackStatus
}

function normalizeTransactionKind(value: unknown): GMasterBillingTransaction['kind'] {
  if (
    value === 'subscription' ||
    value === 'usage' ||
    value === 'refund' ||
    value === 'adjustment'
  ) {
    return value
  }
  return 'topup'
}

function normalizeTransactionStatus(value: unknown): GMasterBillingTransaction['status'] {
  if (
    value === 'paid' ||
    value === 'failed' ||
    value === 'refunded' ||
    value === 'cancelled'
  ) {
    return value
  }
  return 'pending'
}

function normalizeBillingTransaction(raw: any): GMasterBillingTransaction {
  return {
    id: String(raw?.id ?? ''),
    kind: normalizeTransactionKind(raw?.kind),
    status: normalizeTransactionStatus(raw?.status),
    amount: Number(raw?.amount ?? 0),
    currency: String(raw?.currency ?? ''),
    createdAt: Number(raw?.created_at ?? raw?.createdAt ?? 0),
    description: String(raw?.description ?? ''),
  }
}

function normalizeTokenResponse(raw: any): StoredGMasterAuthTokens {
  return {
    accessToken: String(raw?.access_token ?? ''),
    refreshToken: raw?.refresh_token ?? null,
    expiresAt: raw?.expires_at ?? null,
    user: normalizeUser(raw?.user),
  }
}

function isTokenExpiring(expiresAt: number | null): boolean {
  if (!expiresAt) return false
  if (expiresAt > 1_000_000_000_000) {
    return expiresAt <= Date.now() + TOKEN_REFRESH_SKEW_SECONDS * 1000
  }
  return expiresAt <= Math.floor(Date.now() / 1000) + TOKEN_REFRESH_SKEW_SECONDS
}

export class GMasterAuthService {
  private sessions = new Map<string, PendingGMasterAuthSession>()
  private fetchFn: FetchFn = fetch
  private refreshInFlight = new Map<string, Promise<StoredGMasterAuthTokens>>()

  setFetchFn(fn: FetchFn): void {
    this.fetchFn = fn
  }

  private getBaseUrl(): string {
    return (process.env.GMASTER_API_BASE_URL || DEFAULT_BASE_URL).replace(
      /\/+$/,
      '',
    )
  }

  private getTokenFilePath(): string {
    return getGasterConfigPath(getClaudeConfigDir(), 'gmaster-auth.json')
  }

  private getReadableTokenFilePath(): string {
    return resolveExistingGasterConfigPath(getClaudeConfigDir(), 'gmaster-auth.json')
  }

  private getPendingSessionsFilePath(): string {
    return getGasterConfigPath(getClaudeConfigDir(), 'gmaster-auth-sessions.json')
  }

  private getReadablePendingSessionsFilePath(): string {
    return resolveExistingGasterConfigPath(getClaudeConfigDir(), 'gmaster-auth-sessions.json')
  }

  async loadTokens(): Promise<StoredGMasterAuthTokens | null> {
    try {
      const raw = await fs.readFile(this.getReadableTokenFilePath(), 'utf-8')
      return JSON.parse(raw) as StoredGMasterAuthTokens
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }

  async saveTokens(tokens: StoredGMasterAuthTokens): Promise<void> {
    const filePath = this.getTokenFilePath()
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    const tmp = `${filePath}.tmp.${process.pid}.${crypto.randomUUID()}`
    await fs.writeFile(tmp, JSON.stringify(tokens, null, 2), { mode: 0o600 })
    await fs.chmod(tmp, 0o600)
    await fs.rename(tmp, filePath)
    await fs.chmod(filePath, 0o600)
  }

  async deleteTokens(): Promise<void> {
    const paths = [
      this.getTokenFilePath(),
      resolveExistingGasterConfigPath(getClaudeConfigDir(), 'gmaster-auth.json'),
    ]
    for (const filePath of [...new Set(paths)]) {
      try {
        await fs.unlink(filePath)
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
      }
    }
  }

  async startSession({
    serverPort,
    clientVersion,
    intent = 'login',
  }: {
    serverPort: number
    clientVersion: string
    intent?: GMasterAuthIntent
  }): Promise<{ state: string; authorizeUrl: string }> {
    await this.loadPendingSessions()
    this.pruneExpiredSessions()

    const state = randomPkceValue()
    const codeVerifier = randomPkceValue()
    const codeChallenge = createCodeChallenge(codeVerifier)
    const redirectUri = `http://127.0.0.1:${serverPort}/api/gmaster-auth/callback`

    const baseUrl = this.getBaseUrl()
    const response = await this.fetchJson<{ authorize_url: string }>(
      '/api/gaster-code/auth/start',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state,
          redirect_uri: redirectUri,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          client_name: 'Gaster Code',
          client_version: clientVersion,
          intent,
        }),
      },
    )
    validateAuthorizeUrl(response.authorize_url, baseUrl)

    this.sessions.set(state, {
      state,
      codeVerifier,
      redirectUri,
      clientVersion,
      intent,
      createdAt: Date.now(),
    })
    await this.savePendingSessions()

    return { state, authorizeUrl: response.authorize_url }
  }

  async completeSession(
    code: string,
    state: string,
  ): Promise<StoredGMasterAuthTokens> {
    const session = await this.consumeSession(state)
    if (!session) {
      throw new Error('G-Master auth session not found or expired')
    }

    const response = await this.fetchJson<any>('/api/gaster-code/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        redirect_uri: session.redirectUri,
        code_verifier: session.codeVerifier,
      }),
    })

    const tokens = normalizeTokenResponse(response)
    await this.saveTokens(tokens)
    return tokens
  }

  async getStatus(): Promise<GMasterAuthStatus> {
    const tokens = await this.loadTokens()
    if (!tokens) return { loggedIn: false }
    if (isTokenExpiring(tokens.expiresAt)) {
      try {
        const refreshed = await this.refreshTokens(tokens.refreshToken)
        return {
          loggedIn: true,
          expiresAt: refreshed.expiresAt,
          user: refreshed.user,
        }
      } catch {
        const latest = await this.loadUsableTokensAfterRefreshFailure()
        if (latest) {
          return {
            loggedIn: true,
            expiresAt: latest.expiresAt,
            user: latest.user,
          }
        }
        await this.deleteTokens()
        return { loggedIn: false }
      }
    }
    return {
      loggedIn: true,
      expiresAt: tokens.expiresAt,
      user: tokens.user,
    }
  }

  async fetchMe(): Promise<GMasterAccountInfo> {
    const tokens = await this.requireTokens()
    const data = await this.fetchJson<any>('/api/gaster-code/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    })
    return normalizeAccountInfo(data)
  }

  async fetchBillingPlans(): Promise<{ plans: GMasterBillingPlan[] }> {
    const tokens = await this.requireTokens()
    const data = await this.fetchJson<any>('/api/gaster-code/billing/plans', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    })
    const plans = Array.isArray(data?.plans)
      ? data.plans
      : Array.isArray(data)
        ? data
        : []
    return { plans: plans.map(normalizeBillingPlan) }
  }

  async createCheckout({
    kind,
    planId,
    returnTo = 'account',
  }: {
    kind: GMasterBillingKind
    planId: string
    returnTo?: 'account'
  }): Promise<GMasterCheckoutSession> {
    const tokens = await this.requireTokens()
    const data = await this.fetchJson<any>('/api/gaster-code/billing/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.accessToken}`,
      },
      body: JSON.stringify({
        kind,
        plan_id: planId,
        return_to: returnTo,
      }),
    })
    return normalizeCheckoutSession(data)
  }

  async fetchCheckoutStatus(id: string): Promise<GMasterCheckoutSession> {
    const tokens = await this.requireTokens()
    const encodedId = encodeURIComponent(id)
    const data = await this.fetchJson<any>(
      `/api/gaster-code/billing/checkout/${encodedId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      },
    )
    return normalizeCheckoutSession(data)
  }

  async fetchBillingTransactions(): Promise<{ transactions: GMasterBillingTransaction[] }> {
    const tokens = await this.requireTokens()
    const data = await this.fetchJson<any>('/api/gaster-code/billing/transactions', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    })
    const transactions = Array.isArray(data?.transactions)
      ? data.transactions
      : Array.isArray(data)
        ? data
        : []
    return { transactions: transactions.map(normalizeBillingTransaction) }
  }

  async cancelSubscription(): Promise<{ ok: true }> {
    const tokens = await this.requireTokens()
    await this.fetchJson<any>('/api/gaster-code/subscription/cancel', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    })
    return { ok: true }
  }

  async resumeSubscription(): Promise<{ ok: true }> {
    const tokens = await this.requireTokens()
    await this.fetchJson<any>('/api/gaster-code/subscription/resume', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    })
    return { ok: true }
  }

  async fetchProviderToken(): Promise<GMasterProviderConfig> {
    const tokens = await this.requireTokens()
    const data = await this.fetchJson<{ provider: any }>(
      '/api/gaster-code/provider-token',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      },
    )
    const provider = normalizeProvider(data.provider)
    const availableModels = await this.fetchProviderModelCatalog(provider).catch((err) => {
      console.warn('[GMasterAuth] Failed to refresh G-Master model catalog:', err)
      return []
    })
    return availableModels.length > 0 ? { ...provider, availableModels } : provider
  }

  async refreshTokens(refreshToken: string | null): Promise<StoredGMasterAuthTokens> {
    const token = String(refreshToken ?? '').trim()
    if (!token) throw new Error('G-Master refresh token not found')
    const pending = this.refreshInFlight.get(token)
    if (pending) return pending

    const refreshPromise = this.refreshTokensOnce(token)
    this.refreshInFlight.set(token, refreshPromise)
    refreshPromise.finally(() => {
      if (this.refreshInFlight.get(token) === refreshPromise) {
        this.refreshInFlight.delete(token)
      }
    }).catch(() => undefined)
    return refreshPromise
  }

  private async refreshTokensOnce(token: string): Promise<StoredGMasterAuthTokens> {
    let response: any
    try {
      response = await this.fetchJson<any>('/api/gaster-code/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: token }),
      })
    } catch (err) {
      const latest = await this.loadUsableTokensAfterRefreshFailure()
      if (latest) return latest
      throw err
    }
    const tokens = normalizeTokenResponse(response)
    await this.saveTokens(tokens)
    return tokens
  }

  async revokeSession({
    revokeProviderToken = true,
  }: {
    revokeProviderToken?: boolean
  } = {}): Promise<void> {
    const tokens = await this.loadTokens()
    if (!tokens?.accessToken) return
    await this.fetchJson<null>('/api/gaster-code/auth/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.accessToken}`,
      },
      body: JSON.stringify({
        revoke_provider_token: revokeProviderToken,
      }),
    })
  }

  private async requireTokens(): Promise<StoredGMasterAuthTokens> {
    const tokens = await this.loadTokens()
    if (!tokens) throw new Error('G-Master auth tokens not found')
    if (!isTokenExpiring(tokens.expiresAt)) return tokens
    return this.refreshTokens(tokens.refreshToken)
  }

  private async loadUsableTokensAfterRefreshFailure(): Promise<StoredGMasterAuthTokens | null> {
    const latest = await this.loadTokens().catch(() => null)
    if (!latest) return null
    if (isTokenExpiring(latest.expiresAt)) return null
    if (!latest.accessToken.trim()) return null
    return latest
  }

  private async fetchProviderModelCatalog(provider: GMasterProviderConfig): Promise<string[]> {
    const url = buildProviderModelsUrl(provider.baseUrl)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    let response: Response
    try {
      response = await this.fetchFn(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
        },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    const text = await response.text()
    let payload: unknown = null
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        if (!response.ok) {
          throw new Error(`G-Master model catalog request failed (${response.status}): ${text}`)
        }
        throw new Error('G-Master model catalog returned invalid JSON')
      }
    }

    if (!response.ok) {
      const message = isRecord(payload) && typeof payload.message === 'string'
        ? payload.message
        : text || response.statusText
      throw new Error(`G-Master model catalog request failed (${response.status}): ${message}`)
    }

    return normalizeModelCatalog(payload)
  }

  private async consumeSession(state: string): Promise<PendingGMasterAuthSession | null> {
    await this.loadPendingSessions()
    const session = this.sessions.get(state)
    if (!session) return null
    this.sessions.delete(state)
    await this.savePendingSessions()
    if (Date.now() - session.createdAt > SESSION_TTL_MS) return null
    return session
  }

  private pruneExpiredSessions(): void {
    const now = Date.now()
    for (const [state, session] of this.sessions.entries()) {
      if (now - session.createdAt > SESSION_TTL_MS) this.sessions.delete(state)
    }
  }

  private async loadPendingSessions(): Promise<void> {
    const filePath = this.getReadablePendingSessionsFilePath()
    let raw: string
    try {
      raw = await fs.readFile(filePath, 'utf-8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return
      throw err
    }

    let pending: unknown
    try {
      pending = JSON.parse(raw)
    } catch {
      await fs.unlink(filePath).catch(() => {})
      return
    }

    const sessions = Array.isArray(pending)
      ? pending
      : Array.isArray((pending as { sessions?: unknown[] })?.sessions)
        ? (pending as { sessions: unknown[] }).sessions
        : []

    const now = Date.now()
    for (const session of sessions) {
      if (!isPendingSession(session)) continue
      if (now - session.createdAt > SESSION_TTL_MS) continue
      this.sessions.set(session.state, session)
    }
  }

  private async savePendingSessions(): Promise<void> {
    this.pruneExpiredSessions()
    const filePath = this.getPendingSessionsFilePath()
    const sessions = [...this.sessions.values()]
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    const tmp = `${filePath}.tmp.${process.pid}.${crypto.randomUUID()}`
    await fs.writeFile(tmp, JSON.stringify({ sessions }, null, 2), { mode: 0o600 })
    await fs.chmod(tmp, 0o600)
    await fs.rename(tmp, filePath)
    await fs.chmod(filePath, 0o600)
  }

  private async fetchJson<T>(
    endpoint: string,
    init: RequestInit = {},
  ): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`
    const controller = new AbortController()
    if (init.signal) {
      if (init.signal.aborted) controller.abort()
      else init.signal.addEventListener('abort', () => controller.abort(), {
        once: true,
      })
    }
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    let response: Response
    try {
      response = await this.fetchFn(url, {
        ...init,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }
    const text = await response.text()
    let payload: ApiEnvelope<T> | null = null
    if (text) {
      try {
        payload = JSON.parse(text) as ApiEnvelope<T>
      } catch {
        if (!response.ok) {
          throw new Error(`G-Master API request failed (${response.status}): ${text}`)
        }
        throw new Error('G-Master API returned invalid JSON')
      }
    }

    if (!response.ok) {
      const message = payload?.message || text || response.statusText
      if (payload?.code) {
        throw new ApiError(
          statusForGMasterError(payload.code, response.status),
          message,
          payload.code,
        )
      }
      throw new Error(`G-Master API request failed (${response.status}): ${message}`)
    }
    if (payload?.success === false) {
      const message = payload.message || 'G-Master API request failed'
      if (payload.code) {
        throw new ApiError(
          statusForGMasterError(payload.code, 400),
          message,
          payload.code,
        )
      }
      throw new Error(message)
    }
    if (!payload || payload.data === undefined) {
      throw new Error('G-Master API response missing data')
    }
    return payload.data
  }
}

export const gmasterAuthService = new GMasterAuthService()
