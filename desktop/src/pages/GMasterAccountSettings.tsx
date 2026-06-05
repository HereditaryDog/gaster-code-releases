import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  gmasterAuthApi,
  type GMasterAccountInfo,
  type GMasterAuthIntent,
  type GMasterBillingKind,
  type GMasterBillingPlan,
  type GMasterBillingTransaction,
  type GMasterCheckoutSession,
} from '../api/gmasterAuth'
import { ApiError } from '../api/client'
import { AccountHeader } from '../components/account/AccountHeader'
import { BillingHistory } from '../components/account/BillingHistory'
import { PlanDialog } from '../components/account/PlanDialog'
import { SubscriptionPanel } from '../components/account/SubscriptionPanel'
import { WalletPanel } from '../components/account/WalletPanel'
import { Button } from '../components/shared/Button'
import { useTranslation } from '../i18n'
import { getDesktopHost } from '../lib/desktopHost'
import { useGMasterAuthStore } from '../stores/gmasterAuthStore'

type AccountLoadState = 'loading' | 'ready' | 'signedOut' | 'error'
type AuthAction = 'login' | 'register' | 'logout' | null
type SubscriptionAction = 'cancel' | 'resume' | null

function reserveBrowserWindow(): Window | null {
  if (typeof window === 'undefined' || getDesktopHost().isDesktop) return null
  const popup = window.open('about:blank', '_blank')
  if (popup) popup.opener = null
  return popup
}

function closeReservedWindow(popup: Window | null) {
  if (!popup || popup.closed) return
  try {
    popup.close()
  } catch {
    // Ignore cleanup failures for browser-owned windows.
  }
}

function navigateReservedWindow(popup: Window | null, url: string) {
  if (!popup || popup.closed) return false
  try {
    popup.location.href = url
    return true
  } catch {
    return false
  }
}

async function openExternalUrl(url: string, reservedWindow: Window | null = null) {
  const host = getDesktopHost()
  if (host.isDesktop) {
    try {
      await host.shell.open(url)
      closeReservedWindow(reservedWindow)
      return
    } catch {
      // Fall through to browser-style fallbacks if the desktop shell bridge fails.
    }
  }

  if (navigateReservedWindow(reservedWindow, url)) return
  const popup = window.open(url, '_blank')
  if (popup) {
    popup.opener = null
    return
  }
  window.location.assign(url)
}

function isTerminalCheckoutStatus(status: GMasterCheckoutSession['status']) {
  return status === 'paid' || status === 'failed' || status === 'expired' || status === 'cancelled'
}

function getApiErrorCode(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null
  const body = error.body
  if (!body || typeof body !== 'object' || !('error' in body)) return null
  const code = (body as { error?: unknown }).error
  return typeof code === 'string' ? code : null
}

function getAccountErrorMessage(error: unknown, t: ReturnType<typeof useTranslation>) {
  const code = getApiErrorCode(error)
  if (code === 'GMASTER_AUTH_EXPIRED') return t('error.GMASTER_AUTH_EXPIRED')
  if (code === 'GMASTER_BILLING_CHECKOUT_FAILED') return t('settings.account.checkoutFailed')
  if (code === 'GMASTER_BILLING_PAYMENT_PENDING') return t('settings.account.billingPaymentPending')
  if (code === 'GMASTER_BILLING_PLAN_UNAVAILABLE') return t('settings.account.billingPlanUnavailable')
  if (code === 'GMASTER_BILLING_PROVIDER_UNAVAILABLE') return t('settings.account.billingProviderUnavailable')
  return error instanceof Error ? error.message : String(error)
}

export function GMasterAccountSettings() {
  const t = useTranslation()
  const login = useGMasterAuthStore((s) => s.login)
  const startPolling = useGMasterAuthStore((s) => s.startPolling)
  const logout = useGMasterAuthStore((s) => s.logout)
  const syncProvider = useGMasterAuthStore((s) => s.syncProvider)
  const authStatus = useGMasterAuthStore((s) => s.status)
  const isPolling = useGMasterAuthStore((s) => s.isPolling)
  const authError = useGMasterAuthStore((s) => s.error)

  const [account, setAccount] = useState<GMasterAccountInfo | null>(null)
  const [plans, setPlans] = useState<GMasterBillingPlan[]>([])
  const [transactions, setTransactions] = useState<GMasterBillingTransaction[]>([])
  const [loadState, setLoadState] = useState<AccountLoadState>('loading')
  const [billingLoading, setBillingLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [checkoutErrorCode, setCheckoutErrorCode] = useState<string | null>(null)
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null)
  const [authAction, setAuthAction] = useState<AuthAction>(null)
  const [subscriptionAction, setSubscriptionAction] = useState<SubscriptionAction>(null)
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null)
  const [pendingCheckout, setPendingCheckout] = useState<GMasterCheckoutSession | null>(null)
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [subscriptionOpen, setSubscriptionOpen] = useState(false)

  const topUpPlans = useMemo(
    () => plans.filter((plan) => plan.kind === 'topup'),
    [plans],
  )
  const subscriptionPlans = useMemo(
    () => plans.filter((plan) => plan.kind === 'subscription'),
    [plans],
  )

  const loadAccount = useCallback(async () => {
    setLoadState('loading')
    setBillingLoading(true)
    setError(null)
    setCheckoutError(null)
    setCheckoutErrorCode(null)
    try {
      const status = await gmasterAuthApi.status()
      if (!status.loggedIn) {
        setAccount(null)
        setPlans([])
        setTransactions([])
        setLoadState('signedOut')
        return
      }

      const [nextAccount, planResult, transactionResult] = await Promise.all([
        gmasterAuthApi.me(),
        gmasterAuthApi.plans(),
        gmasterAuthApi.transactions(),
      ])
      setAccount(nextAccount)
      setPlans(planResult.plans)
      setTransactions(transactionResult.transactions)
      setLoadState('ready')
    } catch (err) {
      setAccount(null)
      setLoadState('error')
      setError(getAccountErrorMessage(err, t))
    } finally {
      setBillingLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadAccount()
  }, [loadAccount])

  useEffect(() => {
    if (authStatus?.loggedIn) void loadAccount()
  }, [authStatus, loadAccount])

  useEffect(() => {
    if (!pendingCheckout || pendingCheckout.status !== 'pending') return
    let cancelled = false
    const timer = setInterval(() => {
      void (async () => {
        try {
          const next = await gmasterAuthApi.checkoutStatus(pendingCheckout.id)
          if (cancelled) return
          if (!isTerminalCheckoutStatus(next.status)) {
            setPendingCheckout(next)
            return
          }

          setPendingCheckout(null)
          if (next.status === 'paid') {
            setCheckoutErrorCode(null)
            setCheckoutNotice(t('settings.account.checkoutPaid'))
            setTopUpOpen(false)
            setSubscriptionOpen(false)
            await syncProvider().catch(() => undefined)
            await loadAccount()
            return
          }
          const failureKey = next.status === 'failed'
            ? 'settings.account.checkoutFailed'
            : next.status === 'expired'
              ? 'settings.account.checkoutExpired'
              : 'settings.account.checkoutCancelled'
          setCheckoutError(t(failureKey))
          setCheckoutErrorCode(null)
        } catch (err) {
          if (!cancelled) {
            setCheckoutError(getAccountErrorMessage(err, t))
            setCheckoutErrorCode(getApiErrorCode(err))
          }
        }
      })()
    }, 2_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [loadAccount, pendingCheckout, syncProvider, t])

  const handleAuth = async (intent: GMasterAuthIntent) => {
    const reservedWindow = reserveBrowserWindow()
    setAuthAction(intent)
    setError(null)
    try {
      const { authorizeUrl } = await login(intent)
      await openExternalUrl(authorizeUrl, reservedWindow)
      startPolling()
    } catch (err) {
      closeReservedWindow(reservedWindow)
      setError(getAccountErrorMessage(err, t))
    } finally {
      setAuthAction(null)
    }
  }

  const handleLogout = async () => {
    setAuthAction('logout')
    setError(null)
    try {
      await logout()
      setAccount(null)
      setPlans([])
      setTransactions([])
      setLoadState('signedOut')
    } catch (err) {
      setError(getAccountErrorMessage(err, t))
    } finally {
      setAuthAction(null)
    }
  }

  const handleCheckout = async (kind: GMasterBillingKind, plan: GMasterBillingPlan) => {
    setCheckoutError(null)
    setCheckoutErrorCode(null)
    setCheckoutNotice(null)
    setCheckoutPlanId(plan.id)
    try {
      const session = await gmasterAuthApi.createCheckout({
        kind,
        planId: plan.id,
        returnTo: 'account',
      })
      setPendingCheckout(session)
      if (session.url) await openExternalUrl(session.url)
      if (session.status === 'paid') {
        await syncProvider().catch(() => undefined)
        await loadAccount()
      }
    } catch (err) {
      setCheckoutError(getAccountErrorMessage(err, t))
      setCheckoutErrorCode(getApiErrorCode(err))
    } finally {
      setCheckoutPlanId(null)
    }
  }

  const handleCancelSubscription = async () => {
    setSubscriptionAction('cancel')
    setCheckoutError(null)
    setCheckoutErrorCode(null)
    try {
      await gmasterAuthApi.cancelSubscription()
      await loadAccount()
    } catch (err) {
      setCheckoutError(getAccountErrorMessage(err, t))
      setCheckoutErrorCode(getApiErrorCode(err))
    } finally {
      setSubscriptionAction(null)
    }
  }

  const handleResumeSubscription = async () => {
    setSubscriptionAction('resume')
    setCheckoutError(null)
    setCheckoutErrorCode(null)
    try {
      await gmasterAuthApi.resumeSubscription()
      await loadAccount()
    } catch (err) {
      setCheckoutError(getAccountErrorMessage(err, t))
      setCheckoutErrorCode(getApiErrorCode(err))
    } finally {
      setSubscriptionAction(null)
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{t('settings.account.title')}</h2>
          <p className="mt-0.5 text-sm text-[var(--color-text-tertiary)]">{t('settings.account.description')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={loadAccount} disabled={loadState === 'loading'}>
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">refresh</span>
          {t('settings.account.refresh')}
        </Button>
      </div>

      {loadState === 'loading' && (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-brand)] border-t-transparent" />
        </div>
      )}

      {loadState === 'signedOut' && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-container)] p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-surface-container-high)]">
            <span className="material-symbols-outlined text-[26px] text-[var(--color-text-secondary)]">account_circle</span>
          </div>
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{t('settings.account.notSignedIn')}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--color-text-tertiary)]">{t('settings.account.notSignedInDescription')}</p>
          <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Button onClick={() => handleAuth('login')} loading={authAction === 'login'}>
              <span className="material-symbols-outlined text-[17px]" aria-hidden="true">login</span>
              {t('welcome.gmasterAction')}
            </Button>
            <Button variant="secondary" onClick={() => handleAuth('register')} loading={authAction === 'register'}>
              <span className="material-symbols-outlined text-[17px]" aria-hidden="true">person_add</span>
              {t('welcome.gmasterRegisterAction')}
            </Button>
          </div>
          {isPolling && (
            <p className="mt-4 text-sm text-[var(--color-text-tertiary)]">{t('settings.account.waitingForAuth')}</p>
          )}
          {authError && (
            <p className="mt-3 text-xs text-[var(--color-error)]">{authError}</p>
          )}
        </div>
      )}

      {loadState === 'error' && (
        <div className="rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 p-4">
          <p className="text-sm font-medium text-[var(--color-error)]">{t('settings.account.loadFailed')}</p>
          {error && <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{error}</p>}
        </div>
      )}

      {loadState === 'ready' && account && (
        <div className="space-y-4">
          {(checkoutError || checkoutNotice || pendingCheckout) && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${
              checkoutError
                ? 'border-[var(--color-error)]/30 bg-[var(--color-error)]/10 text-[var(--color-error)]'
                : 'border-[var(--color-success)]/30 bg-[var(--color-success)]/10 text-[var(--color-success)]'
            }`}
            >
              <div>{checkoutError || checkoutNotice || t('settings.account.checkoutPending')}</div>
              {checkoutError && (
                <div className="mt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (checkoutErrorCode === 'GMASTER_AUTH_EXPIRED') {
                        void handleAuth('login')
                        return
                      }
                      void loadAccount()
                    }}
                  >
                    {checkoutErrorCode === 'GMASTER_AUTH_EXPIRED'
                      ? t('settings.account.signInAgain')
                      : t('settings.account.refreshPlans')}
                  </Button>
                </div>
              )}
            </div>
          )}

          <AccountHeader
            account={account}
            labels={{
              manageAccount: t('settings.account.manageAccount'),
              signOut: t('settings.account.signOut'),
              userGroup: t('settings.account.userGroup'),
              remainingQuota: t('settings.account.remainingQuota'),
              usedQuota: t('settings.account.usedQuota'),
              builtinProvider: t('settings.account.builtinProvider'),
              available: t('settings.account.available'),
              unavailable: t('settings.account.unavailable'),
            }}
            onManageAccount={() => account.accountUrl && void openExternalUrl(account.accountUrl)}
            onSignOut={handleLogout}
            signOutLoading={authAction === 'logout'}
          />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <WalletPanel
              wallet={account.wallet}
              topUpPlans={topUpPlans}
              isLoading={billingLoading}
              labels={{
                title: t('settings.account.walletTitle'),
                description: t('settings.account.walletDescription'),
                balance: t('settings.account.walletBalance'),
                lowBalance: t('settings.account.walletLowBalance'),
                topUp: t('settings.account.topUp'),
                plansLoading: t('settings.account.plansLoading'),
                noPlans: t('settings.account.noTopUpPlans'),
              }}
              onTopUp={() => setTopUpOpen(true)}
            />

            <SubscriptionPanel
              subscription={account.subscription}
              subscriptionPlans={subscriptionPlans}
              isLoading={billingLoading}
              actionLoading={subscriptionAction}
              labels={{
                title: t('settings.account.subscriptionTitle'),
                activeDescription: t('settings.account.subscriptionActive'),
                inactiveDescription: t('settings.account.subscriptionInactive'),
                active: t('settings.account.active'),
                inactive: t('settings.account.inactive'),
                noSubscription: t('settings.account.noSubscription'),
                subscribe: t('settings.account.subscribe'),
                changePlan: t('settings.account.changePlan'),
                cancel: t('settings.account.cancelSubscription'),
                resume: t('settings.account.resumeSubscription'),
                cancelAtPeriodEnd: t('settings.account.cancelAtPeriodEnd'),
                plansLoading: t('settings.account.plansLoading'),
                noPlans: t('settings.account.noSubscriptionPlans'),
              }}
              onManage={() => setSubscriptionOpen(true)}
              onCancel={handleCancelSubscription}
              onResume={handleResumeSubscription}
            />
          </div>

          <BillingHistory
            transactions={transactions}
            isLoading={billingLoading}
            labels={{
              title: t('settings.account.billingHistoryTitle'),
              description: t('settings.account.billingHistoryDescription'),
              loading: t('settings.account.billingHistoryLoading'),
              empty: t('settings.account.billingHistoryEmpty'),
            }}
          />
        </div>
      )}

      <PlanDialog
        open={topUpOpen}
        title={t('settings.account.topUpDialogTitle')}
        description={t('settings.account.topUpDialogDescription')}
        emptyText={t('settings.account.noTopUpPlans')}
        plans={topUpPlans}
        actionLabel={t('settings.account.topUp')}
        recommendedLabel={t('settings.account.recommendedPlan')}
        loadingPlanId={checkoutPlanId}
        onClose={() => setTopUpOpen(false)}
        onSelectPlan={(plan) => void handleCheckout('topup', plan)}
      />

      <PlanDialog
        open={subscriptionOpen}
        title={t('settings.account.subscriptionDialogTitle')}
        description={t('settings.account.subscriptionDialogDescription')}
        emptyText={t('settings.account.noSubscriptionPlans')}
        plans={subscriptionPlans}
        actionLabel={account?.subscription?.active ? t('settings.account.changePlan') : t('settings.account.subscribe')}
        recommendedLabel={t('settings.account.recommendedPlan')}
        loadingPlanId={checkoutPlanId}
        onClose={() => setSubscriptionOpen(false)}
        onSelectPlan={(plan) => void handleCheckout('subscription', plan)}
      />
    </div>
  )
}
