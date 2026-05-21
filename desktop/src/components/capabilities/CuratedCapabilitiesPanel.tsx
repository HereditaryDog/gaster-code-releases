import { useEffect } from 'react'
import { useTranslation } from '../../i18n'
import { useCapabilityStore } from '../../stores/capabilityStore'
import { useUIStore } from '../../stores/uiStore'
import type { CuratedCapabilityKind } from '../../types/capability'

type Props = {
  kind: CuratedCapabilityKind
  onChanged?: () => void | Promise<void>
}

function itemKey(kind: CuratedCapabilityKind, id: string): string {
  return `${kind}:${id}`
}

export function CuratedCapabilitiesPanel({ kind, onChanged }: Props) {
  const t = useTranslation()
  const addToast = useUIStore((s) => s.addToast)
  const items = useCapabilityStore((s) => kind === 'skills' ? s.skills : s.agents)
  const isLoading = useCapabilityStore((s) => s.isLoading)
  const error = useCapabilityStore((s) => s.error)
  const isToggling = useCapabilityStore((s) => s.isToggling)
  const fetchCuratedCapabilities = useCapabilityStore((s) => s.fetchCuratedCapabilities)
  const setCuratedCapabilityEnabled = useCapabilityStore(
    (s) => s.setCuratedCapabilityEnabled,
  )

  useEffect(() => {
    void fetchCuratedCapabilities()
  }, [fetchCuratedCapabilities])

  const enabledCount = items.filter(item => item.enabled).length
  const title = kind === 'skills'
    ? t('settings.capabilities.curated.skillsTitle')
    : t('settings.capabilities.curated.agentsTitle')

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await setCuratedCapabilityEnabled(kind, id, enabled)
      await onChanged?.()
      addToast({
        type: 'success',
        message: enabled
          ? t('settings.capabilities.curated.enabledToast')
          : t('settings.capabilities.curated.disabledToast'),
      })
    } catch (toggleError) {
      addToast({
        type: 'error',
        message: toggleError instanceof Error
          ? toggleError.message
          : t('settings.capabilities.curated.toggleFailed'),
      })
    }
  }

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[var(--color-brand)]">
              auto_awesome
            </span>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {title}
            </h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-tertiary)]">
            {t('settings.capabilities.curated.description')}
          </p>
        </div>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          {t('settings.capabilities.curated.enabledCount', {
            enabled: String(enabledCount),
            total: String(items.length),
          })}
        </span>
      </div>

      {isLoading && items.length === 0 ? (
        <div className="flex justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-brand)] border-t-transparent" />
        </div>
      ) : error ? (
        <div className="px-5 py-4 text-sm text-[var(--color-error)]">{error}</div>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {items.map(item => {
            const key = itemKey(kind, item.id)
            const busy = Boolean(isToggling[key])
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {item.displayName}
                    </span>
                    <span className="rounded-full bg-[var(--color-surface-container-high)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-tertiary)]">
                      {item.category}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                    {item.description}
                  </p>
                </div>
                <label className="inline-flex flex-shrink-0 items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                  <span>
                    {item.enabled
                      ? t('settings.capabilities.curated.enabled')
                      : t('settings.capabilities.curated.disabled')}
                  </span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--color-brand)]"
                    checked={item.enabled}
                    disabled={busy}
                    onChange={(event) =>
                      void handleToggle(item.id, event.currentTarget.checked)
                    }
                    aria-label={t('settings.capabilities.curated.toggleLabel', {
                      name: item.displayName,
                    })}
                  />
                </label>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
