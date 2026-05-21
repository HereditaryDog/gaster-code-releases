import { ProviderService } from './providerService.js'
import { gmasterAuthService } from './gmasterAuthService.js'
import type { SavedProvider } from '../types/provider.js'

export type ManagedGMasterProviderSyncResult = {
  loggedIn: boolean
  provider: SavedProvider | null
  changed: boolean
}

type ManagedGMasterProviderSyncOptions = {
  force?: boolean
}

const GMASTER_MANAGED_PROVIDER_ID = 'managed-gmaster-api'

export async function syncManagedGMasterProviderFromAuth(
  providerService = new ProviderService(),
  options: ManagedGMasterProviderSyncOptions = {},
): Promise<ManagedGMasterProviderSyncResult> {
  const before = await providerService.listProviders().catch(() => null)
  const beforeProvider = before ? findManagedGMasterProvider(before.providers) : null
  const status = await gmasterAuthService.getStatus()
  if (!status.loggedIn) {
    await providerService.deactivateManagedGMasterProvider()
    return {
      loggedIn: false,
      provider: null,
      changed: Boolean(
        beforeProvider?.apiKey ||
        before?.activeId === beforeProvider?.id ||
        before?.activeId === GMASTER_MANAGED_PROVIDER_ID
      ),
    }
  }

  if (!options.force && !(await providerService.needsManagedGMasterProviderSync())) {
    return { loggedIn: true, provider: beforeProvider, changed: false }
  }
  try {
    const providerConfig = await gmasterAuthService.fetchProviderToken()
    const provider = await providerService.upsertManagedGMasterProvider(providerConfig)
    return {
      loggedIn: true,
      provider,
      changed: didManagedGMasterProviderChange(beforeProvider, provider),
    }
  } catch (err) {
    console.warn('[GMasterAuth] Managed provider sync failed:', err)
    return { loggedIn: true, provider: beforeProvider, changed: false }
  }
}

export function didManagedGMasterProviderChange(
  before: SavedProvider | null | undefined,
  after: SavedProvider,
): boolean {
  if (!before) return true
  return (
    before.id !== after.id ||
    before.apiKey !== after.apiKey ||
    before.baseUrl !== after.baseUrl ||
    before.apiFormat !== after.apiFormat ||
    before.models.main !== after.models.main ||
    before.models.haiku !== after.models.haiku ||
    before.models.sonnet !== after.models.sonnet ||
    before.models.opus !== after.models.opus
  )
}

export function findManagedGMasterProvider(
  providers: SavedProvider[],
): SavedProvider | null {
  return providers.find((provider) =>
    provider.id === GMASTER_MANAGED_PROVIDER_ID ||
    provider.managed?.type === 'gmaster' ||
    provider.presetId === 'gmaster'
  ) ?? null
}
