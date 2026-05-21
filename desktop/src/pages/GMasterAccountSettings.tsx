import { useCallback, useEffect, useState } from 'react'
import { gmasterAuthApi, type GMasterAccountInfo, type GMasterAuthIntent, type GMasterSubscriptionItem } from '../api/gmasterAuth'
import { Button } from '../components/shared/Button'
import { useTranslation } from '../i18n'
import { useGMasterAuthStore } from '../stores/gmasterAuthStore'

type AccountLoadState = 'loading' | 'ready' | 'signedOut' | 'error'

type TauriWindow = Window & {
  __TAURI__?: unknown
  __TAURI_INTERNALS__?: unknown
}

function isTauriRuntime() {
  const currentWindow = window as TauriWindow
  return Boolean(currentWindow.__TAURI__ || currentWindow.__TAURI_INTERNALS__)
}

function reserveBrowserWindow(): Window | null {
  if (typeof window === 'undefined' || isTauriRuntime()) return null
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
  try {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(url)
    closeReservedWindow(reservedWindow)
    return
  } catch {
    if (navigateReservedWindow(reservedWindow, url)) return
    const popup = window.open(url, '_blank')
    if (popup) {
      popup.opener = null
      return
    }
    window.location.assign(url)
  }
}

function formatAmount(value: number | null | undefined, unlimited = false) {
  if (unlimited) return 'Unlimited'
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return `${Math.max(0, value).toLocaleString()} tokens`
}

function formatDate(seconds: number) {
  if (!seconds) return '-'
  return new Date(seconds * 1000).toLocaleDateString()
}

function formatSubscriptionUsage(item: GMasterSubscriptionItem) {
  if (item.unlimited) return 'Unlimited'
  return `${Math.max(0, item.amountRemaining).toLocaleString()} / ${Math.max(0, item.amountTotal).toLocaleString()} tokens`
}

export function GMasterAccountSettings() {
  const t = useTranslation()
  const login = useGMasterAuthStore((s) => s.login)
  const startPolling = useGMasterAuthStore((s) => s.startPolling)
  const logout = useGMasterAuthStore((s) => s.logout)
  const [account, setAccount] = useState<GMasterAccountInfo | null>(null)
  const [loadState, setLoadState] = useState<AccountLoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<'login' | 'register' | 'logout' | null>(null)

  const loadAccount = useCallback(async () => {
    setLoadState('loading')
    setError(null)
    try {
      const status = await gmasterAuthApi.status()
      if (!status.loggedIn) {
        setAccount(null)
        setLoadState('signedOut')
        return
      }

      const nextAccount = await gmasterAuthApi.me()
      setAccount(nextAccount)
      setLoadState('ready')
    } catch (err) {
      setAccount(null)
      setLoadState('error')
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    void loadAccount()
  }, [loadAccount])

  const handleAuth = async (intent: GMasterAuthIntent) => {
    const reservedWindow = reserveBrowserWindow()
    setActionLoading(intent)
    setError(null)
    try {
      const { authorizeUrl } = await login(intent)
      await openExternalUrl(authorizeUrl, reservedWindow)
      startPolling()
    } catch (err) {
      closeReservedWindow(reservedWindow)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setActionLoading(null)
    }
  }

  const handleLogout = async () => {
    setActionLoading('logout')
    setError(null)
    try {
      await logout()
      setAccount(null)
      setLoadState('signedOut')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{t('settings.account.title')}</h2>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-0.5">{t('settings.account.description')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={loadAccount} disabled={loadState === 'loading'}>
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">refresh</span>
          {t('settings.account.refresh')}
        </Button>
      </div>

      {loadState === 'loading' && (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-5 h-5 border-2 border-[var(--color-brand)] border-t-transparent rounded-full" />
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
            <Button onClick={() => handleAuth('login')} loading={actionLoading === 'login'}>
              <span className="material-symbols-outlined text-[17px]" aria-hidden="true">login</span>
              {t('welcome.gmasterAction')}
            </Button>
            <Button variant="secondary" onClick={() => handleAuth('register')} loading={actionLoading === 'register'}>
              <span className="material-symbols-outlined text-[17px]" aria-hidden="true">person_add</span>
              {t('welcome.gmasterRegisterAction')}
            </Button>
          </div>
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
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-container)] p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-[#2a2118] text-2xl font-semibold text-[#fff8ec]">
                  G
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-xl font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">{account.user.displayName || account.user.username}</h3>
                  <p className="mt-0.5 text-sm text-[var(--color-text-tertiary)]">@{account.user.username}</p>
                  {account.user.email && (
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{account.user.email}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => account.accountUrl && void openExternalUrl(account.accountUrl)}
                  disabled={!account.accountUrl}
                >
                  {t('settings.account.manageAccount')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => account.billingUrl && void openExternalUrl(account.billingUrl)}
                  disabled={!account.billingUrl}
                >
                  {t('settings.account.manageSubscription')}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleLogout} loading={actionLoading === 'logout'}>
                  {t('settings.account.signOut')}
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label={t('settings.account.userGroup')} value={account.user.group || '-'} />
              <MetricCard label={t('settings.account.remainingQuota')} value={formatAmount(account.quota?.remaining, account.quota?.unlimited)} />
              <MetricCard label={t('settings.account.usedQuota')} value={formatAmount(account.quota?.used)} />
              <MetricCard
                label={t('settings.account.builtinProvider')}
                value={account.canUseBuiltinProvider ? t('settings.account.available') : t('settings.account.unavailable')}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-container)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t('settings.account.subscriptionTitle')}</h3>
                <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                  {account.subscription?.active ? t('settings.account.subscriptionActive') : t('settings.account.subscriptionInactive')}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                account.subscription?.active
                  ? 'bg-[var(--color-success)]/12 text-[var(--color-success)]'
                  : 'bg-[var(--color-surface-container-high)] text-[var(--color-text-tertiary)]'
              }`}
              >
                {account.subscription?.active ? t('settings.account.active') : t('settings.account.inactive')}
              </span>
            </div>

            {account.subscription?.items.length ? (
              <div className="mt-4 space-y-2">
                {account.subscription.items.map((item) => (
                  <SubscriptionRow key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] px-4 py-5 text-center text-sm text-[var(--color-text-tertiary)]">
                {t('settings.account.noSubscription')}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <p className="text-xs text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  )
}

function SubscriptionRow({ item }: { item: GMasterSubscriptionItem }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">Plan #{item.planId}</span>
          <span className="rounded bg-[var(--color-surface-container-high)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-tertiary)]">
            {item.status}
          </span>
          {item.upgradeGroup && (
            <span className="rounded bg-[var(--color-brand)]/14 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-brand)]">
              {item.upgradeGroup}
            </span>
          )}
        </div>
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">{formatSubscriptionUsage(item)}</span>
      </div>
      <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
        {formatDate(item.startTime)} - {formatDate(item.endTime)}
      </p>
    </div>
  )
}
