import { create } from 'zustand'
import { ApiError } from '../api/client'
import { settingsApi } from '../api/settings'
import { modelsApi } from '../api/models'
import { h5AccessApi } from '../api/h5Access'
import {
  isThemeMode,
  type AppMode,
  type AppModeConfig,
  type DesktopTerminalSettings,
  type DesktopTerminalStartupShell,
  type H5AccessDiagnostics,
  type H5AccessSettings,
  type NetworkSettings,
  type PermissionMode,
  type EffortLevel,
  type ModelInfo,
  type ThemeMode,
  type UpdateProxyMode,
  type UpdateProxySettings,
  type WebSearchSettings,
} from '../types/settings'
import type { Locale } from '../i18n'
import { readMigratedStorage, writeMigratedStorage } from '../lib/storageMigration'
import { isTauriRuntime } from '../lib/desktopRuntime'
import {
  APP_ZOOM_CONTROL_STEP,
  DEFAULT_APP_ZOOM,
  MAX_APP_ZOOM,
  MIN_APP_ZOOM,
  applyAppZoomLevel,
  normalizeAppZoomLevel,
  readStoredAppZoomLevel,
} from '../lib/appZoom'
import { useUIStore } from './uiStore'

const LOCALE_STORAGE_KEY = 'gaster-code-locale'
const LEGACY_LOCALE_STORAGE_KEYS = ['gaster-code-legacy-locale']
export const UI_ZOOM_MIN = MIN_APP_ZOOM
export const UI_ZOOM_MAX = MAX_APP_ZOOM
export const UI_ZOOM_STEP = APP_ZOOM_CONTROL_STEP
export const UI_ZOOM_DEFAULT = DEFAULT_APP_ZOOM
let desktopNotificationsSaveQueue: Promise<void> = Promise.resolve()

function getStoredLocale(): Locale {
  try {
    const stored = readMigratedStorage(LOCALE_STORAGE_KEY, LEGACY_LOCALE_STORAGE_KEYS)
    if (stored === 'en' || stored === 'zh') return stored
  } catch { /* localStorage unavailable */ }
  return 'zh'
}

type SettingsStore = {
  permissionMode: PermissionMode
  currentModel: ModelInfo | null
  effortLevel: EffortLevel
  thinkingEnabled: boolean
  availableModels: ModelInfo[]
  activeProviderName: string | null
  locale: Locale
  theme: ThemeMode
  skipWebFetchPreflight: boolean
  desktopNotificationsEnabled: boolean
  desktopTerminal: DesktopTerminalSettings
  webSearch: WebSearchSettings
  updateProxy: UpdateProxySettings
  network: NetworkSettings
  h5Access: H5AccessSettings
  h5AccessDiagnostics: H5AccessDiagnostics | null
  h5AccessError: string | null
  responseLanguage: string
  uiZoom: number
  isLoading: boolean
  error: string | null
  appMode: AppModeConfig
  appModeRequiresRestart: boolean

  fetchAll: () => Promise<void>
  fetchH5Access: () => Promise<void>
  fetchAppMode: () => Promise<void>
  setPermissionMode: (mode: PermissionMode) => Promise<void>
  setModel: (modelId: string) => Promise<void>
  setEffort: (level: EffortLevel) => Promise<void>
  setThinkingEnabled: (enabled: boolean) => Promise<void>
  setLocale: (locale: Locale) => void
  setTheme: (theme: ThemeMode) => Promise<void>
  setSkipWebFetchPreflight: (enabled: boolean) => Promise<void>
  setDesktopNotificationsEnabled: (enabled: boolean) => Promise<void>
  setDesktopTerminal: (settings: DesktopTerminalSettings) => Promise<void>
  setWebSearch: (settings: WebSearchSettings) => Promise<void>
  setUpdateProxy: (settings: UpdateProxySettings) => Promise<void>
  setNetwork: (settings: NetworkSettings) => Promise<void>
  setAppMode: (mode: AppMode, portableDir?: string | null) => Promise<void>
  enableH5Access: () => Promise<string>
  disableH5Access: () => Promise<void>
  regenerateH5AccessToken: () => Promise<string>
  updateH5AccessSettings: (input: {
    allowedOrigins?: string[]
    publicBaseUrl?: string | null
  }) => Promise<void>
  setResponseLanguage: (language: string) => Promise<void>
  setUiZoom: (zoom: number) => void
}

type NetworkSettingsInput = Partial<Omit<NetworkSettings, 'proxy'>> & {
  proxy?: Partial<NetworkSettings['proxy']>
}

const DEFAULT_H5_ACCESS_SETTINGS: H5AccessSettings = {
  enabled: false,
  tokenPreview: null,
  allowedOrigins: [],
  publicBaseUrl: null,
}

const DEFAULT_DESKTOP_TERMINAL_SETTINGS: DesktopTerminalSettings = {
  startupShell: 'system',
  customShellPath: '',
}

const DEFAULT_UPDATE_PROXY_SETTINGS: UpdateProxySettings = {
  mode: 'system',
  url: '',
}

const DEFAULT_NETWORK_SETTINGS: NetworkSettings = {
  aiRequestTimeoutMs: 120_000,
  proxy: {
    mode: 'system',
    url: '',
  },
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  permissionMode: 'default',
  currentModel: null,
  effortLevel: 'medium',
  thinkingEnabled: true,
  availableModels: [],
  activeProviderName: null,
  locale: getStoredLocale(),
  theme: useUIStore.getState().theme,
  skipWebFetchPreflight: true,
  desktopNotificationsEnabled: false,
  desktopTerminal: DEFAULT_DESKTOP_TERMINAL_SETTINGS,
  webSearch: { mode: 'auto', tavilyApiKey: '', braveApiKey: '' },
  updateProxy: DEFAULT_UPDATE_PROXY_SETTINGS,
  network: DEFAULT_NETWORK_SETTINGS,
  h5Access: DEFAULT_H5_ACCESS_SETTINGS,
  h5AccessDiagnostics: null,
  h5AccessError: null,
  responseLanguage: '',
  uiZoom: readStoredAppZoomLevel(),
  isLoading: false,
  error: null,
  appMode: {
    mode: 'default',
    portableDir: null,
    defaultPortableDir: null,
    activeConfigDir: null,
    configDirSource: 'system',
  },
  appModeRequiresRestart: false,

  setUiZoom: (zoom: number) => {
    const level = normalizeAppZoomLevel(zoom)
    set({ uiZoom: level })
    void applyAppZoomLevel(level)
  },

  fetchAll: async () => {
    set({ isLoading: true, error: null })
    try {
      const previousH5Access = get().h5Access
      const [{ mode }, modelsRes, { model }, { level }, userSettings, h5AccessResult] = await Promise.all([
        settingsApi.getPermissionMode(),
        modelsApi.list(),
        modelsApi.getCurrent(),
        modelsApi.getEffort(),
        settingsApi.getUser(),
        loadH5AccessSettings(previousH5Access),
      ])
      const theme = isThemeMode(userSettings.theme) ? userSettings.theme : 'white'
      useUIStore.getState().setTheme(theme)
      set({
        permissionMode: mode,
        availableModels: modelsRes.models,
        activeProviderName: modelsRes.provider?.name ?? null,
        currentModel: model,
        effortLevel: level,
        thinkingEnabled: userSettings.alwaysThinkingEnabled !== false,
        theme,
        skipWebFetchPreflight: userSettings.skipWebFetchPreflight !== false,
        desktopNotificationsEnabled: userSettings.desktopNotificationsEnabled === true,
        desktopTerminal: normalizeDesktopTerminalSettings(userSettings.desktopTerminal),
        webSearch: normalizeWebSearchSettings(userSettings.webSearch),
        updateProxy: normalizeUpdateProxySettings(userSettings.updateProxy),
        network: normalizeNetworkSettings(userSettings.network),
        h5Access: h5AccessResult.settings,
        h5AccessDiagnostics: h5AccessResult.diagnostics,
        h5AccessError: h5AccessResult.error,
        responseLanguage: typeof userSettings.language === 'string' ? userSettings.language : '',
        isLoading: false,
        error: null,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load desktop settings'
      set({ isLoading: false, error: message })
      throw error
    }
  },

  fetchH5Access: async () => {
    const result = await loadH5AccessSettings(get().h5Access)
    set({
      h5Access: result.settings,
      h5AccessDiagnostics: result.diagnostics,
      h5AccessError: result.error,
    })
  },

  fetchAppMode: async () => {
    if (!isTauriRuntime()) return
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const result = await invoke<AppModeConfig>('get_app_mode')
      set({ appMode: result })
    } catch {
      // Non-Tauri runtimes and older native builds simply do not expose this.
    }
  },

  setPermissionMode: async (mode) => {
    const prev = get().permissionMode
    set({ permissionMode: mode })
    try {
      await settingsApi.setPermissionMode(mode)
    } catch {
      set({ permissionMode: prev })
    }
  },

  setModel: async (modelId) => {
    await modelsApi.setCurrent(modelId)
    const { model } = await modelsApi.getCurrent()
    set({ currentModel: model })
  },

  setEffort: async (level) => {
    const prev = get().effortLevel
    set({ effortLevel: level })
    try {
      await modelsApi.setEffort(level)
    } catch {
      set({ effortLevel: prev })
    }
  },

  setThinkingEnabled: async (enabled) => {
    const prev = get().thinkingEnabled
    set({ thinkingEnabled: enabled })
    try {
      await settingsApi.updateUser({ alwaysThinkingEnabled: enabled })
    } catch {
      set({ thinkingEnabled: prev })
    }
  },

  setLocale: (locale) => {
    set({ locale })
    writeMigratedStorage(LOCALE_STORAGE_KEY, locale, LEGACY_LOCALE_STORAGE_KEYS)
  },

  setTheme: async (theme) => {
    const prev = get().theme
    set({ theme })
    useUIStore.getState().setTheme(theme)
    try {
      await settingsApi.updateUser({ theme })
    } catch {
      set({ theme: prev })
      useUIStore.getState().setTheme(prev)
    }
  },

  setSkipWebFetchPreflight: async (enabled) => {
    const prev = get().skipWebFetchPreflight
    set({ skipWebFetchPreflight: enabled })
    try {
      await settingsApi.updateUser({ skipWebFetchPreflight: enabled })
    } catch {
      set({ skipWebFetchPreflight: prev })
    }
  },

  setDesktopNotificationsEnabled: async (enabled) => {
    const prev = get().desktopNotificationsEnabled
    set({ desktopNotificationsEnabled: enabled })
    const save = desktopNotificationsSaveQueue
      .catch(() => undefined)
      .then(async () => {
        if (get().desktopNotificationsEnabled !== enabled) return
        await settingsApi.updateUser({ desktopNotificationsEnabled: enabled })
      })

    desktopNotificationsSaveQueue = save

    try {
      await save
    } catch {
      if (get().desktopNotificationsEnabled === enabled) {
        set({ desktopNotificationsEnabled: prev })
      }
    }
  },

  setDesktopTerminal: async (settings) => {
    const prev = get().desktopTerminal
    const next = normalizeDesktopTerminalSettings(settings)
    set({ desktopTerminal: next })
    try {
      await settingsApi.updateUser({ desktopTerminal: next })
    } catch (error) {
      set({ desktopTerminal: prev })
      throw error
    }
  },

  setWebSearch: async (webSearch) => {
    const prev = get().webSearch
    const next = normalizeWebSearchSettings(webSearch)
    set({ webSearch: next })
    try {
      await settingsApi.updateUser({ webSearch: next })
    } catch {
      set({ webSearch: prev })
    }
  },

  setUpdateProxy: async (settings) => {
    const prev = get().updateProxy
    const next = normalizeUpdateProxySettings(settings)
    set({ updateProxy: next })
    try {
      await settingsApi.updateUser({ updateProxy: next })
    } catch (error) {
      set({ updateProxy: prev })
      throw error
    }
  },

  setNetwork: async (settings) => {
    const prev = get().network
    const next = normalizeNetworkSettings(settings)
    set({ network: next })
    try {
      await settingsApi.updateUser({ network: next })
    } catch (error) {
      set({ network: prev })
      throw error
    }
  },

  setAppMode: async (mode, portableDir) => {
    if (!isTauriRuntime()) return
    const prev = get().appMode
    const next: AppModeConfig = {
      ...prev,
      mode,
      portableDir: mode === 'portable'
        ? portableDir ?? prev.defaultPortableDir ?? prev.portableDir
        : null,
      activeConfigDir: mode === 'portable'
        ? portableDir ?? prev.defaultPortableDir ?? prev.portableDir
        : null,
      configDirSource: mode === 'portable' ? 'portable' : 'system',
    }
    set({ appMode: next, appModeRequiresRestart: true })
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('set_app_mode', {
        mode,
        portableDir: next.portableDir || null,
      })
    } catch (error) {
      set({ appMode: prev, appModeRequiresRestart: false })
      throw error
    }
  },

  enableH5Access: async () => {
    set({ h5AccessError: null })
    try {
      const { settings, token } = await h5AccessApi.enable()
      set({
        h5Access: normalizeH5AccessSettings(settings),
        h5AccessError: null,
      })
      await refreshH5DiagnosticsSilent(set)
      return token
    } catch (error) {
      set({ h5AccessError: getErrorMessage(error, '启用 H5 访问失败。') })
      throw error
    }
  },

  disableH5Access: async () => {
    set({ h5AccessError: null })
    try {
      const { settings } = await h5AccessApi.disable()
      set({
        h5Access: normalizeH5AccessSettings(settings),
        h5AccessError: null,
      })
      await refreshH5DiagnosticsSilent(set)
    } catch (error) {
      set({ h5AccessError: getErrorMessage(error, '关闭 H5 访问失败。') })
      throw error
    }
  },

  regenerateH5AccessToken: async () => {
    set({ h5AccessError: null })
    try {
      const { settings, token } = await h5AccessApi.regenerate()
      set({
        h5Access: normalizeH5AccessSettings(settings),
        h5AccessError: null,
      })
      await refreshH5DiagnosticsSilent(set)
      return token
    } catch (error) {
      set({ h5AccessError: getErrorMessage(error, '重新生成 H5 令牌失败。') })
      throw error
    }
  },

  updateH5AccessSettings: async (input) => {
    set({ h5AccessError: null })
    try {
      const { settings } = await h5AccessApi.update(input)
      set({
        h5Access: normalizeH5AccessSettings(settings),
        h5AccessError: null,
      })
      await refreshH5DiagnosticsSilent(set)
    } catch (error) {
      set({ h5AccessError: getErrorMessage(error, '更新 H5 访问设置失败。') })
      throw error
    }
  },

  setResponseLanguage: async (language) => {
    const prev = get().responseLanguage
    set({ responseLanguage: language })
    try {
      await settingsApi.updateUser({ language: language || undefined })
    } catch {
      set({ responseLanguage: prev })
    }
  },
}))

function normalizeWebSearchSettings(settings: WebSearchSettings | undefined): WebSearchSettings {
  return {
    mode: settings?.mode ?? 'auto',
    tavilyApiKey: settings?.tavilyApiKey ?? '',
    braveApiKey: settings?.braveApiKey ?? '',
  }
}

function isUpdateProxyMode(value: unknown): value is UpdateProxyMode {
  return value === 'system' || value === 'manual'
}

function normalizeUpdateProxySettings(
  settings: Partial<UpdateProxySettings> | undefined,
): UpdateProxySettings {
  const mode = isUpdateProxyMode(settings?.mode)
    ? settings.mode
    : DEFAULT_UPDATE_PROXY_SETTINGS.mode
  return {
    mode,
    url: typeof settings?.url === 'string' ? settings.url.trim() : '',
  }
}

function normalizeNetworkSettings(
  settings: NetworkSettingsInput | undefined,
): NetworkSettings {
  const timeout = typeof settings?.aiRequestTimeoutMs === 'number' && Number.isFinite(settings.aiRequestTimeoutMs)
    ? Math.min(Math.max(Math.round(settings.aiRequestTimeoutMs), 5_000), 600_000)
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

function normalizeDesktopTerminalSettings(
  settings: Partial<DesktopTerminalSettings> | undefined,
): DesktopTerminalSettings {
  const startupShell = isDesktopTerminalStartupShell(settings?.startupShell)
    ? settings.startupShell
    : DEFAULT_DESKTOP_TERMINAL_SETTINGS.startupShell

  return {
    startupShell,
    customShellPath: typeof settings?.customShellPath === 'string'
      ? settings.customShellPath
      : DEFAULT_DESKTOP_TERMINAL_SETTINGS.customShellPath,
  }
}

function normalizeH5AccessSettings(settings: H5AccessSettings | undefined): H5AccessSettings {
  return {
    enabled: settings?.enabled === true,
    tokenPreview: settings?.tokenPreview ?? null,
    allowedOrigins: Array.isArray(settings?.allowedOrigins) ? settings.allowedOrigins : [],
    publicBaseUrl: settings?.publicBaseUrl ?? null,
  }
}

function normalizeH5AccessDiagnostics(
  diagnostics: H5AccessDiagnostics | undefined,
): H5AccessDiagnostics | null {
  if (!diagnostics) return null
  return {
    storedHostStaleness: diagnostics.storedHostStaleness,
    storedPublicBaseUrl: diagnostics.storedPublicBaseUrl ?? null,
    effectivePublicBaseUrl: diagnostics.effectivePublicBaseUrl ?? null,
    suggestedHost: diagnostics.suggestedHost ?? null,
    localInterfaceHosts: Array.isArray(diagnostics.localInterfaceHosts)
      ? diagnostics.localInterfaceHosts
      : [],
  }
}

async function loadH5AccessSettings(previousH5Access: H5AccessSettings): Promise<{
  settings: H5AccessSettings
  diagnostics: H5AccessDiagnostics | null
  error: string | null
}> {
  try {
    const { settings, diagnostics } = await h5AccessApi.get()
    return {
      settings: normalizeH5AccessSettings(settings),
      diagnostics: normalizeH5AccessDiagnostics(diagnostics),
      error: null,
    }
  } catch (error) {
    if (isLegacyH5EndpointError(error)) {
      return {
        settings: DEFAULT_H5_ACCESS_SETTINGS,
        diagnostics: null,
        error: null,
      }
    }

    return {
      settings: previousH5Access,
      diagnostics: null,
      error: getErrorMessage(error, '加载 H5 访问设置失败。'),
    }
  }
}

async function refreshH5DiagnosticsSilent(
  set: (state: Partial<SettingsStore>) => void,
): Promise<void> {
  try {
    const { diagnostics } = await h5AccessApi.get()
    set({ h5AccessDiagnostics: normalizeH5AccessDiagnostics(diagnostics) })
  } catch {
    // Diagnostics are advisory; keep the main H5 action result visible.
  }
}

function isLegacyH5EndpointError(error: unknown) {
  const status = error instanceof ApiError
    ? error.status
    : typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
      ? error.status
      : null
  return status === 404 || status === 405
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback
}

function isDesktopTerminalStartupShell(value: unknown): value is DesktopTerminalStartupShell {
  return value === 'system'
    || value === 'pwsh'
    || value === 'powershell'
    || value === 'cmd'
    || value === 'custom'
}
