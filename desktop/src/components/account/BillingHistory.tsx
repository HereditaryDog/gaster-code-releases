import type { GMasterBillingTransaction } from '../../api/gmasterAuth'
import { formatDate, formatTransactionAmount } from './format'

type BillingHistoryProps = {
  transactions: GMasterBillingTransaction[]
  isLoading: boolean
  labels: {
    title: string
    description: string
    loading: string
    empty: string
  }
}

export function BillingHistory({ transactions, isLoading, labels }: BillingHistoryProps) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-container)] p-5">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{labels.title}</h3>
        <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">{labels.description}</p>
      </div>

      {isLoading && (
        <p className="mt-4 text-sm text-[var(--color-text-tertiary)]">{labels.loading}</p>
      )}

      {!isLoading && transactions.length === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] px-4 py-5 text-center text-sm text-[var(--color-text-tertiary)]">
          {labels.empty}
        </p>
      )}

      {!isLoading && transactions.length > 0 && (
        <div className="mt-4 divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{transaction.description || transaction.kind}</span>
                  <span className="rounded bg-[var(--color-surface-container-high)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-tertiary)]">
                    {transaction.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{formatDate(transaction.createdAt)}</p>
              </div>
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">{formatTransactionAmount(transaction)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
