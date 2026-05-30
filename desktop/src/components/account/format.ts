import type { GMasterBillingPlan, GMasterBillingTransaction, GMasterSubscriptionItem, GMasterWallet } from '../../api/gmasterAuth'

export function formatTokenAmount(value: number | null | undefined, unlimited = false) {
  if (unlimited) return 'Unlimited'
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return `${Math.max(0, value).toLocaleString()} tokens`
}

export function formatDate(seconds: number | null | undefined) {
  if (!seconds) return '-'
  return new Date(seconds * 1000).toLocaleDateString()
}

export function formatSubscriptionUsage(item: GMasterSubscriptionItem) {
  if (item.unlimited) return 'Unlimited'
  return `${Math.max(0, item.amountRemaining).toLocaleString()} / ${Math.max(0, item.amountTotal).toLocaleString()} tokens`
}

export function formatWallet(wallet: GMasterWallet | null | undefined) {
  if (!wallet) return '-'
  return `${Math.max(0, wallet.balance).toLocaleString()} ${wallet.currency}`.trim()
}

export function formatPlanPrice(plan: GMasterBillingPlan) {
  return `${Math.max(0, plan.price).toLocaleString()} ${plan.currency}`.trim()
}

export function formatTransactionAmount(transaction: GMasterBillingTransaction) {
  const prefix = transaction.kind === 'usage' ? '-' : '+'
  return `${prefix}${Math.max(0, transaction.amount).toLocaleString()} ${transaction.currency}`.trim()
}
