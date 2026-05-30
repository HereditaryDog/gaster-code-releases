import type { GMasterBillingPlan, GMasterSubscriptionItem, GMasterSubscriptionSnapshot } from '../../api/gmasterAuth'
import { Button } from '../shared/Button'
import { formatDate, formatSubscriptionUsage } from './format'

type SubscriptionPanelProps = {
  subscription: GMasterSubscriptionSnapshot | null
  subscriptionPlans: GMasterBillingPlan[]
  isLoading: boolean
  actionLoading: 'cancel' | 'resume' | null
  labels: {
    title: string
    activeDescription: string
    inactiveDescription: string
    active: string
    inactive: string
    noSubscription: string
    subscribe: string
    changePlan: string
    cancel: string
    resume: string
    cancelAtPeriodEnd: string
    plansLoading: string
    noPlans: string
  }
  onManage: () => void
  onCancel: () => void
  onResume: () => void
}

export function SubscriptionPanel({
  subscription,
  subscriptionPlans,
  isLoading,
  actionLoading,
  labels,
  onManage,
  onCancel,
  onResume,
}: SubscriptionPanelProps) {
  const hasActiveSubscription = Boolean(subscription?.active)
  const firstItem = subscription?.items[0] ?? null

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-container)] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{labels.title}</h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
            {hasActiveSubscription ? labels.activeDescription : labels.inactiveDescription}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
            hasActiveSubscription
              ? 'bg-[var(--color-success)]/12 text-[var(--color-success)]'
              : 'bg-[var(--color-surface-container-high)] text-[var(--color-text-tertiary)]'
          }`}
          >
            {hasActiveSubscription ? labels.active : labels.inactive}
          </span>
          <Button size="sm" onClick={onManage} disabled={isLoading || subscriptionPlans.length === 0}>
            {hasActiveSubscription ? labels.changePlan : labels.subscribe}
          </Button>
          {firstItem?.cancelAtPeriodEnd && firstItem.resumable && (
            <Button variant="secondary" size="sm" onClick={onResume} loading={actionLoading === 'resume'}>
              {labels.resume}
            </Button>
          )}
          {hasActiveSubscription && !firstItem?.cancelAtPeriodEnd && (
            <Button variant="ghost" size="sm" onClick={onCancel} loading={actionLoading === 'cancel'}>
              {labels.cancel}
            </Button>
          )}
        </div>
      </div>

      {subscription?.items.length ? (
        <div className="mt-4 space-y-2">
          {subscription.items.map((item) => (
            <SubscriptionRow key={item.id} item={item} labels={labels} />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] px-4 py-5 text-center text-sm text-[var(--color-text-tertiary)]">
          {labels.noSubscription}
        </p>
      )}

      {isLoading && (
        <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">{labels.plansLoading}</p>
      )}
      {!isLoading && subscriptionPlans.length === 0 && (
        <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">{labels.noPlans}</p>
      )}
    </section>
  )
}

function SubscriptionRow({
  item,
  labels,
}: {
  item: GMasterSubscriptionItem
  labels: { cancelAtPeriodEnd: string }
}) {
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
      {item.cancelAtPeriodEnd && (
        <p className="mt-2 text-xs text-[var(--color-warning)]">{labels.cancelAtPeriodEnd}</p>
      )}
    </div>
  )
}
