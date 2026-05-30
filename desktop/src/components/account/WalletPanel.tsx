import type { GMasterBillingPlan, GMasterWallet } from '../../api/gmasterAuth'
import { Button } from '../shared/Button'
import { formatWallet } from './format'

type WalletPanelProps = {
  wallet: GMasterWallet | null
  topUpPlans: GMasterBillingPlan[]
  isLoading: boolean
  labels: {
    title: string
    description: string
    balance: string
    lowBalance: string
    topUp: string
    plansLoading: string
    noPlans: string
  }
  onTopUp: () => void
}

export function WalletPanel({ wallet, topUpPlans, isLoading, labels, onTopUp }: WalletPanelProps) {
  const topUpDisabled = isLoading || topUpPlans.length === 0

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-container)] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{labels.title}</h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">{labels.description}</p>
        </div>
        <Button size="sm" onClick={onTopUp} disabled={topUpDisabled}>
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">add_card</span>
          {labels.topUp}
        </Button>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
        <p className="text-xs text-[var(--color-text-tertiary)]">{labels.balance}</p>
        <p className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">{formatWallet(wallet)}</p>
      </div>

      {wallet?.lowBalance && (
        <p className="mt-3 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-2 text-xs text-[var(--color-warning)]">
          {labels.lowBalance}
        </p>
      )}

      {isLoading && (
        <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">{labels.plansLoading}</p>
      )}
      {!isLoading && topUpPlans.length === 0 && (
        <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">{labels.noPlans}</p>
      )}
    </section>
  )
}
