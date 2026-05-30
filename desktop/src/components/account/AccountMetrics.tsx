import type { GMasterAccountInfo } from '../../api/gmasterAuth'
import { formatTokenAmount } from './format'

type AccountMetricsProps = {
  account: GMasterAccountInfo
  labels: {
    userGroup: string
    remainingQuota: string
    usedQuota: string
    builtinProvider: string
    available: string
    unavailable: string
  }
}

export function AccountMetrics({ account, labels }: AccountMetricsProps) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label={labels.userGroup} value={account.user.group || '-'} />
      <MetricCard label={labels.remainingQuota} value={formatTokenAmount(account.quota?.remaining, account.quota?.unlimited)} />
      <MetricCard label={labels.usedQuota} value={formatTokenAmount(account.quota?.used)} />
      <MetricCard
        label={labels.builtinProvider}
        value={account.canUseBuiltinProvider ? labels.available : labels.unavailable}
      />
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
