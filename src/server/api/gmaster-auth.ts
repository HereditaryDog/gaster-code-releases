/**
 * G-Master Auth REST API
 *
 * POST   /api/gmaster-auth/start          — create desktop auth session
 * GET    /api/gmaster-auth/callback       — exchange auth code for local tokens
 * GET    /api/gmaster-auth                — current auth status, without tokens
 * GET    /api/gmaster-auth/status         — current auth status, without tokens
 * GET    /api/gmaster-auth/me             — current G-Master account info
 * GET    /api/gmaster-auth/billing/plans  — list G-Master billing plans
 * POST   /api/gmaster-auth/billing/checkout — create a checkout session
 * GET    /api/gmaster-auth/billing/checkout/:id — fetch checkout session status
 * GET    /api/gmaster-auth/billing/transactions — list billing transactions
 * POST   /api/gmaster-auth/subscription/cancel — cancel current subscription
 * POST   /api/gmaster-auth/subscription/resume — resume current subscription
 * POST   /api/gmaster-auth/provider-token — fetch provider config for proxy use
 * POST   /api/gmaster-auth/sync-provider  — upsert managed G-Master provider
 * DELETE /api/gmaster-auth                — logout, revoking remote session and deleting local tokens
 */

import { z } from 'zod'
import { gmasterAuthService } from '../services/gmasterAuthService.js'
import { ProviderService } from '../services/providerService.js'
import { conversationService } from '../services/conversationService.js'
import { diagnosticsService } from '../services/diagnosticsService.js'
import {
  didManagedGMasterProviderChange,
  findManagedGMasterProvider,
  syncManagedGMasterProviderFromAuth,
  type ManagedGMasterProviderSyncResult,
} from '../services/gmasterProviderSync.js'
import { ApiError, errorResponse } from '../middleware/errorHandler.js'

const providerService = new ProviderService()
const GMASTER_MANAGED_PROVIDER_ID = 'managed-gmaster-api'

const StartRequestSchema = z.object({
  serverPort: z.number().int().positive(),
  clientVersion: z.string().trim().min(1),
  intent: z.enum(['login', 'register']).default('login'),
})

const CreateCheckoutRequestSchema = z.object({
  kind: z.enum(['topup', 'subscription']),
  planId: z.string().trim().min(1),
  returnTo: z.enum(['account']).default('account'),
})

function html(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function handleGMasterAuthApi(
  req: Request,
  url: URL,
  segments: string[],
): Promise<Response> {
  try {
    const action = segments[2] // segments: ['api', 'gmaster-auth', <action?>]
    if (action === 'billing' || action === 'subscription') {
      return await handleGMasterAuthNestedApi(req, segments)
    }

    if (segments.length > 3) {
      return Response.json({ error: 'Not Found' }, { status: 404 })
    }

    if (action === 'start' && req.method === 'POST') {
      let body: unknown
      try {
        body = await req.json()
      } catch {
        throw ApiError.badRequest('Invalid JSON body')
      }

      const parsed = StartRequestSchema.safeParse(body)
      if (!parsed.success) {
        throw ApiError.badRequest(
          'serverPort (positive integer), clientVersion, and optional intent required',
        )
      }

      const session = await gmasterAuthService.startSession({
        serverPort: parsed.data.serverPort,
        clientVersion: parsed.data.clientVersion,
        intent: parsed.data.intent,
      })
      return Response.json({
        authorizeUrl: session.authorizeUrl,
        state: session.state,
      })
    }

    if (action === 'callback' && req.method === 'GET') {
      return handleGMasterAuthCallback(url)
    }

    if ((action === undefined || action === 'status') && req.method === 'GET') {
      const status = await gmasterAuthService.getStatus()
      if (!status.loggedIn) {
        await providerService.deactivateManagedGMasterProvider()
      } else {
        await syncManagedGMasterProviderIfNeeded()
      }
      return Response.json(status)
    }

    if (action === 'me' && req.method === 'GET') {
      return Response.json(await gmasterAuthService.fetchMe())
    }

    if (action === 'provider-token' && req.method === 'POST') {
      return Response.json({
        provider: await gmasterAuthService.fetchProviderToken(),
      })
    }

    if (action === 'sync-provider' && req.method === 'POST') {
      const before = await providerService.listProviders().catch(() => null)
      const beforeProvider = before ? findManagedGMasterProvider(before.providers) : null
      const providerConfig = await gmasterAuthService.fetchProviderToken()
      const provider = await providerService.upsertManagedGMasterProvider(providerConfig)
      await stopManagedGMasterCliSessionsIfProviderChanged({
        loggedIn: true,
        provider,
        changed: didManagedGMasterProviderChange(beforeProvider, provider),
      }, 'sync-provider')
      return Response.json({ provider })
    }

    if (action === undefined && req.method === 'DELETE') {
      await gmasterAuthService.revokeSession({ revokeProviderToken: true }).catch(() => {})
      await gmasterAuthService.deleteTokens()
      await providerService.deactivateManagedGMasterProvider()
      return Response.json({ ok: true })
    }

    return Response.json({ error: 'Not Found' }, { status: 404 })
  } catch (error) {
    return errorResponse(error)
  }
}

async function handleGMasterAuthNestedApi(
  req: Request,
  segments: string[],
): Promise<Response> {
  const resource = segments[2]
  const action = segments[3]
  const subaction = segments[4]

  if (
    resource === 'billing' &&
    action === 'plans' &&
    segments.length === 4 &&
    req.method === 'GET'
  ) {
    return Response.json(await gmasterAuthService.fetchBillingPlans())
  }

  if (
    resource === 'billing' &&
    action === 'checkout' &&
    segments.length === 4 &&
    req.method === 'POST'
  ) {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      throw ApiError.badRequest('Invalid JSON body')
    }

    const parsed = CreateCheckoutRequestSchema.safeParse(body)
    if (!parsed.success) {
      throw ApiError.badRequest('kind, planId, and optional returnTo required')
    }

    return Response.json(await gmasterAuthService.createCheckout(parsed.data))
  }

  if (
    resource === 'billing' &&
    action === 'checkout' &&
    typeof subaction === 'string' &&
    segments.length === 5 &&
    req.method === 'GET'
  ) {
    return Response.json(
      await gmasterAuthService.fetchCheckoutStatus(decodeURIComponent(subaction)),
    )
  }

  if (
    resource === 'billing' &&
    action === 'transactions' &&
    segments.length === 4 &&
    req.method === 'GET'
  ) {
    return Response.json(await gmasterAuthService.fetchBillingTransactions())
  }

  if (
    resource === 'subscription' &&
    action === 'cancel' &&
    segments.length === 4 &&
    req.method === 'POST'
  ) {
    return Response.json(await gmasterAuthService.cancelSubscription())
  }

  if (
    resource === 'subscription' &&
    action === 'resume' &&
    segments.length === 4 &&
    req.method === 'POST'
  ) {
    return Response.json(await gmasterAuthService.resumeSubscription())
  }

  return Response.json({ error: 'Not Found' }, { status: 404 })
}

export async function handleGMasterAuthCallback(url: URL): Promise<Response> {
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    return html(renderCallbackPage(false, `G-Master returned: ${error}`))
  }
  if (!code || !state) {
    return html(renderCallbackPage(false, 'Missing code or state parameter'))
  }

  try {
    await gmasterAuthService.completeSession(code, state)
    await syncManagedGMasterProviderIfNeeded('auth-callback').catch((syncError) => {
      console.warn('[GMasterAuth] Provider sync after callback failed:', syncError)
    })
    return html(renderCallbackPage(true, null))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return html(renderCallbackPage(false, message))
  }
}

async function syncManagedGMasterProviderIfNeeded(
  reason = 'status-sync',
): Promise<void> {
  const result = await syncManagedGMasterProviderFromAuth(providerService, {
    force: reason === 'auth-callback',
  })
  await stopManagedGMasterCliSessionsIfProviderChanged(result, reason)
}

async function stopManagedGMasterCliSessionsIfProviderChanged(
  result: ManagedGMasterProviderSyncResult,
  reason: string,
): Promise<void> {
  if (!result.changed) return
  const restartedSessionIds = await conversationService.restartSessionsUsingProvider(
    GMASTER_MANAGED_PROVIDER_ID,
  )
  if (restartedSessionIds.length === 0) return

  void diagnosticsService.recordEvent({
    type: 'gmaster_provider_runtime_restarted',
    severity: 'info',
    summary: `Restarted ${restartedSessionIds.length} G-Master CLI session(s) after ${reason}`,
    details: {
      reason,
      providerId: GMASTER_MANAGED_PROVIDER_ID,
      restartedSessionIds,
      loggedIn: result.loggedIn,
    },
  })
}

function renderCallbackPage(success: boolean, errorMsg: string | null): string {
  if (success) {
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Login Success</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fafafa;color:#333}.card{text-align:center;padding:40px;background:white;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.06)}h1{color:#16a34a;margin:0 0 12px}p{color:#666}</style>
</head><body><div class="card"><h1>Login Successful</h1><p>You can close this window and return to Gaster Code.</p></div>
<script>setTimeout(() => window.close(), 1500)</script>
</body></html>`
  }

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Login Failed</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fafafa;color:#333}.card{text-align:center;padding:40px;background:white;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.06)}h1{color:#dc2626;margin:0 0 12px}pre{color:#666;white-space:pre-wrap;word-break:break-word;text-align:left;background:#f5f5f5;padding:12px;border-radius:6px}</style>
</head><body><div class="card"><h1>Login Failed</h1><pre>${escapeHtml(errorMsg ?? 'Unknown error')}</pre></div>
</body></html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
