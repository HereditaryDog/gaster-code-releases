import type { GMasterAccountInfo } from '../../api/gmasterAuth'
import { Button } from '../shared/Button'
import { AccountMetrics } from './AccountMetrics'

type AccountHeaderProps = {
  account: GMasterAccountInfo
  labels: {
    manageAccount: string
    signOut: string
    userGroup: string
    remainingQuota: string
    usedQuota: string
    builtinProvider: string
    available: string
    unavailable: string
  }
  onManageAccount: () => void
  onSignOut: () => void
  signOutLoading?: boolean
}

export function AccountHeader({
  account,
  labels,
  onManageAccount,
  onSignOut,
  signOutLoading = false,
}: AccountHeaderProps) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-container)] p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-[#2a2118] text-2xl font-semibold text-[#fff8ec]">
            G
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-xl font-semibold text-[var(--color-text-primary)]">
              {account.user.displayName || account.user.username}
            </h3>
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
            onClick={onManageAccount}
            disabled={!account.accountUrl}
          >
            {labels.manageAccount}
          </Button>
          <Button variant="ghost" size="sm" onClick={onSignOut} loading={signOutLoading}>
            {labels.signOut}
          </Button>
        </div>
      </div>

      <AccountMetrics account={account} labels={labels} />
    </section>
  )
}
