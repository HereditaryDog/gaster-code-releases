import type { GMasterBillingPlan } from '../../api/gmasterAuth'
import { Button } from '../shared/Button'
import { Modal } from '../shared/Modal'
import { formatPlanPrice, formatTokenAmount } from './format'

type PlanDialogProps = {
  open: boolean
  title: string
  description: string
  emptyText: string
  plans: GMasterBillingPlan[]
  actionLabel: string
  recommendedLabel: string
  loadingPlanId: string | null
  onClose: () => void
  onSelectPlan: (plan: GMasterBillingPlan) => void
}

export function PlanDialog({
  open,
  title,
  description,
  emptyText,
  plans,
  actionLabel,
  recommendedLabel,
  loadingPlanId,
  onClose,
  onSelectPlan,
}: PlanDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={640}>
      <p className="text-sm text-[var(--color-text-tertiary)]">{description}</p>

      {plans.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] px-4 py-5 text-center text-sm text-[var(--color-text-tertiary)]">
          {emptyText}
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{plan.name || plan.id}</h3>
                    {plan.recommended && (
                      <span className="rounded bg-[var(--color-brand)]/14 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-brand)]">
                        {recommendedLabel}
                      </span>
                    )}
                  </div>
                  {plan.description && (
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{plan.description}</p>
                  )}
                  <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
                    {formatTokenAmount(plan.quotaAmount, plan.unlimited)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{formatPlanPrice(plan)}</span>
                  <Button size="sm" onClick={() => onSelectPlan(plan)} loading={loadingPlanId === plan.id}>
                    {actionLabel}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
