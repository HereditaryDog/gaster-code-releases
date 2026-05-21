import { generateCodeChallenge } from '../oauth/crypto.js'
import type {
  OpenAIJwtClaims,
  OpenAIOAuthTokenResponse,
  OpenAIOAuthTokens,
} from './types.js'

export const OPENAI_AUTH_ISSUER = 'https://auth.openai.com'
export const OPENAI_CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
export const OPENAI_CODEX_API_ENDPOINT =
  'https://chatgpt.com/backend-api/codex/responses'
export const OPENAI_CODEX_OAUTH_PORT = 1455
export const OPENAI_CODEX_REDIRECT_PATH = '/auth/callback'

const DEFAULT_TOKEN_LIFETIME_MS = 3600 * 1000

export function buildOpenAIAuthorizeUrl(input: {
  redirectUri: string
  codeVerifier: string
  state: string
}): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: OPENAI_CODEX_CLIENT_ID,
    redirect_uri: input.redirectUri,
    scope: 'openid profile email offline_access',
    code_challenge: generateCodeChallenge(input.codeVerifier),
    code_challenge_method: 'S256',
    id_token_add_organizations: 'true',
    codex_cli_simplified_flow: 'true',
    state: input.state,
    originator: 'opencode',
  })

  return `${OPENAI_AUTH_ISSUER}/oauth/authorize?${params.toString()}`
}

export async function exchangeOpenAICodeForTokens(input: {
  code: string
  redirectUri: string
  codeVerifier: string
}): Promise<OpenAIOAuthTokenResponse> {
  const response = await fetch(`${OPENAI_AUTH_ISSUER}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: OPENAI_CODEX_CLIENT_ID,
      code_verifier: input.codeVerifier,
    }).toString(),
  })

  if (!response.ok) {
    throw new Error(`OpenAI token exchange failed: ${response.status}`)
  }

  return (await response.json()) as OpenAIOAuthTokenResponse
}

export async function refreshOpenAITokens(
  refreshToken: string,
): Promise<OpenAIOAuthTokenResponse> {
  const response = await fetch(`${OPENAI_AUTH_ISSUER}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: OPENAI_CODEX_CLIENT_ID,
    }).toString(),
  })

  if (!response.ok) {
    throw new Error(`OpenAI token refresh failed: ${response.status}`)
  }

  return (await response.json()) as OpenAIOAuthTokenResponse
}

export function parseOpenAIJwtClaims(
  token?: string,
): OpenAIJwtClaims | undefined {
  if (!token) return undefined
  const parts = token.split('.')
  if (parts.length !== 3) return undefined

  try {
    return JSON.parse(Buffer.from(parts[1]!, 'base64url').toString())
  } catch {
    return undefined
  }
}

export function extractOpenAIAccountId(
  claims?: OpenAIJwtClaims,
): string | undefined {
  if (!claims) return undefined

  return (
    claims.chatgpt_account_id ||
    claims['https://api.openai.com/auth']?.chatgpt_account_id ||
    claims.organizations?.[0]?.id
  )
}

export function normalizeOpenAITokens(
  response: OpenAIOAuthTokenResponse,
): OpenAIOAuthTokens {
  const claims =
    parseOpenAIJwtClaims(response.id_token) ??
    parseOpenAIJwtClaims(response.access_token)

  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
    idToken: response.id_token,
    accountId: extractOpenAIAccountId(claims),
    email: claims?.email,
  }
}

export function isOpenAITokenExpired(expiresAt: number): boolean {
  return expiresAt - Date.now() <= 5 * 60 * 1000
}

export function withRefreshedAccessToken(
  existing: OpenAIOAuthTokens,
  refreshed: OpenAIOAuthTokenResponse,
): OpenAIOAuthTokens {
  const next = normalizeOpenAITokens(refreshed)

  return {
    ...next,
    accountId: next.accountId ?? existing.accountId,
    email: next.email ?? existing.email,
    idToken: next.idToken ?? existing.idToken,
  }
}
