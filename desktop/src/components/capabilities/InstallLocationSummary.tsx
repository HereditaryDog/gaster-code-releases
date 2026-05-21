import { useTranslation } from '../../i18n'
import type { CapabilityInstallLocation } from '../../types/capability'

export function InstallLocationSummary({
  locations,
}: {
  locations: CapabilityInstallLocation[]
}) {
  const t = useTranslation()

  if (locations.length === 0) return null

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
      <span className="inline-flex items-center gap-1 font-medium text-[var(--color-text-secondary)]">
        <span className="material-symbols-outlined text-[15px]">folder_open</span>
        {t('settings.capabilities.installLocations')}
      </span>
      {locations.map((location) => (
        <span
          key={location.id}
          title={`${location.label}: ${location.description}`}
          className="max-w-full rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 font-mono text-[11px] text-[var(--color-text-secondary)]"
        >
          {location.path}
        </span>
      ))}
    </div>
  )
}
