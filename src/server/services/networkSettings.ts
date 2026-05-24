import { SettingsService } from './settingsService.js'

export type NetworkProxyMode = 'system' | 'manual'

export type NetworkSettings = {
  aiRequestTimeoutMs: number
  proxy: {
    mode: NetworkProxyMode
    url: string
  }
}

const DEFAULT_NETWORK_SETTINGS: NetworkSettings = {
  aiRequestTimeoutMs: 120_000,
  proxy: {
    mode: 'system',
    url: '',
  },
}

const MIN_AI_REQUEST_TIMEOUT_MS = 5_000
const MAX_AI_REQUEST_TIMEOUT_MS = 600_000

type NetworkSettingsInput = Partial<Omit<NetworkSettings, 'proxy'>> & {
  proxy?: Partial<NetworkSettings['proxy']>
}

function normalizeNetworkSettings(settings: NetworkSettingsInput | undefined): NetworkSettings {
  const timeout = typeof settings?.aiRequestTimeoutMs === 'number' && Number.isFinite(settings.aiRequestTimeoutMs)
    ? Math.min(Math.max(Math.round(settings.aiRequestTimeoutMs), MIN_AI_REQUEST_TIMEOUT_MS), MAX_AI_REQUEST_TIMEOUT_MS)
    : DEFAULT_NETWORK_SETTINGS.aiRequestTimeoutMs
  const proxyMode = settings?.proxy?.mode === 'manual' ? 'manual' : 'system'

  return {
    aiRequestTimeoutMs: timeout,
    proxy: {
      mode: proxyMode,
      url: typeof settings?.proxy?.url === 'string' ? settings.proxy.url.trim() : '',
    },
  }
}

function isValidHttpProxyUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export async function loadNetworkSettings(): Promise<NetworkSettings> {
  const userSettings = await new SettingsService().getUserSettings()
  return normalizeNetworkSettings(userSettings.network as NetworkSettingsInput | undefined)
}

export function getManualNetworkProxyUrl(settings: NetworkSettings): string | undefined {
  if (settings.proxy.mode !== 'manual') return undefined
  const url = settings.proxy.url.trim()
  return url && isValidHttpProxyUrl(url) ? url : undefined
}

export function buildNetworkEnvironment(settings: NetworkSettings): Record<string, string> {
  const proxyUrl = getManualNetworkProxyUrl(settings)
  if (!proxyUrl) return {}

  return {
    HTTP_PROXY: proxyUrl,
    HTTPS_PROXY: proxyUrl,
    http_proxy: proxyUrl,
    https_proxy: proxyUrl,
  }
}
