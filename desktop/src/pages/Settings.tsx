import { useState, useEffect, useMemo, useRef, useId, type CSSProperties, type ReactNode } from 'react'
import QRCode from 'qrcode'
import { Copy, Eye, EyeOff, PowerOff, QrCode, RotateCw } from 'lucide-react'
import {
  UI_ZOOM_DEFAULT,
  UI_ZOOM_MAX,
  UI_ZOOM_MIN,
  UI_ZOOM_STEP,
  useSettingsStore,
} from '../stores/settingsStore'
import { useProviderStore } from '../stores/providerStore'
import { useTranslation } from '../i18n'
import { Modal } from '../components/shared/Modal'
import { ConfirmDialog } from '../components/shared/ConfirmDialog'
import { Input } from '../components/shared/Input'
import { Textarea } from '../components/shared/Textarea'
import { Button } from '../components/shared/Button'
import { Dropdown } from '../components/shared/Dropdown'
import type { AppMode, PermissionMode, EffortLevel, ThemeMode, UpdateProxyMode, WebSearchMode } from '../types/settings'
import type { Locale } from '../i18n'
import type { SavedProvider, UpdateProviderInput, ProviderTestResult, ModelMapping, ApiFormat, ProviderAuthStrategy } from '../types/provider'
import type { ProviderPreset } from '../types/providerPreset'
import { AdapterSettings } from './AdapterSettings'
import { useAgentStore } from '../stores/agentStore'
import { useSessionStore } from '../stores/sessionStore'
import type { AgentDefinition, AgentSource } from '../api/agents'
import { MarkdownRenderer } from '../components/markdown/MarkdownRenderer'
import { useSkillStore } from '../stores/skillStore'
import { SkillList } from '../components/skills/SkillList'
import { SkillDetail } from '../components/skills/SkillDetail'
import { CuratedCapabilitiesPanel } from '../components/capabilities/CuratedCapabilitiesPanel'
import { InstallLocationSummary } from '../components/capabilities/InstallLocationSummary'
import { usePluginStore } from '../stores/pluginStore'
import { PluginList } from '../components/plugins/PluginList'
import { PluginDetail } from '../components/plugins/PluginDetail'
import { ComputerUseSettings } from './ComputerUseSettings'
import { McpSettings } from './McpSettings'
import { TerminalSettings } from './TerminalSettings'
import { DiagnosticsSettings } from './DiagnosticsSettings'
import { ActivitySettings } from './ActivitySettings'
import { GMasterAccountSettings } from './GMasterAccountSettings'
import { MemorySettings } from './MemorySettings'
import { useUIStore, type SettingsTab } from '../stores/uiStore'
import { ClaudeOfficialLogin } from '../components/settings/ClaudeOfficialLogin'
import { useUpdateStore } from '../stores/updateStore'
import { formatBytes } from '../lib/formatBytes'
import { isTauriRuntime } from '../lib/desktopRuntime'
import { useGMasterAuthStore } from '../stores/gmasterAuthStore'
import { GMASTER_API_BASE_URL, GMASTER_DEFAULT_MODELS, GMASTER_MANAGED_PROVIDER_ID, getGMasterModelOptions, isGMasterOfficialProvider } from '../constants/gmasterProvider'
import { OFFICIAL_MODELS } from '../constants/modelCatalog'
import { GASTER_CODE_VERSION } from '../version'
import {
  getDesktopNotificationPermission,
  notifyDesktop,
  openDesktopNotificationSettings,
  requestDesktopNotificationPermission,
  type DesktopNotificationPermission,
} from '../lib/desktopNotifications'
import {
  API_KEY_JSON_PLACEHOLDER,
  maskSettingsJsonSecrets,
  restoreSettingsJsonSecrets,
  stripProviderSettingsJsonEnv,
} from '../lib/providerSettingsJson'
import { copyTextToClipboard } from '../components/chat/clipboard'

export function buildH5LaunchUrl(baseUrl: string | null, token: string | null): string | null {
  if (!baseUrl) return null

  try {
    const url = new URL(baseUrl)
    if (token) {
      url.searchParams.set('serverUrl', baseUrl)
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
      hashParams.set('h5Token', token)
      url.hash = hashParams.toString()
    }
    return url.toString().replace(/\/$/, '')
  } catch {
    return token
      ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}serverUrl=${encodeURIComponent(baseUrl)}#h5Token=${encodeURIComponent(token)}`
      : baseUrl
  }
}

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('providers')
  const pendingSettingsTab = useUIStore((s) => s.pendingSettingsTab)
  const t = useTranslation()

  useEffect(() => {
    if (!pendingSettingsTab) return
    setActiveTab(pendingSettingsTab)
    useUIStore.getState().setPendingSettingsTab(null)
  }, [pendingSettingsTab])

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-surface)]">
      <div className="flex-1 flex overflow-hidden">
        {/* Tab navigation */}
        <div className="w-[180px] border-r border-[var(--color-border)] py-3 flex-shrink-0 flex flex-col">
          <div className="flex-1">
            <TabButton icon="account_circle" label={t('settings.tab.account')} active={activeTab === 'account'} onClick={() => setActiveTab('account')} />
            <TabButton icon="dns" label={t('settings.tab.providers')} active={activeTab === 'providers'} onClick={() => setActiveTab('providers')} />
            <TabButton icon="shield" label={t('settings.tab.permissions')} active={activeTab === 'permissions'} onClick={() => setActiveTab('permissions')} />
            <TabButton icon="tune" label={t('settings.tab.general')} active={activeTab === 'general'} onClick={() => setActiveTab('general')} />
            <TabButton icon="qr_code_2" label={t('settings.tab.h5Access')} active={activeTab === 'h5Access'} onClick={() => setActiveTab('h5Access')} />
            <TabButton icon="chat" label={t('settings.tab.adapters')} active={activeTab === 'adapters'} onClick={() => setActiveTab('adapters')} />
            <TabButton icon="terminal" label={t('settings.tab.terminal')} active={activeTab === 'terminal'} onClick={() => setActiveTab('terminal')} />
            <TabButton icon="dns" label={t('settings.tab.mcp')} active={activeTab === 'mcp'} onClick={() => setActiveTab('mcp')} />
            <TabButton icon="smart_toy" label={t('settings.tab.agents')} active={activeTab === 'agents'} onClick={() => setActiveTab('agents')} />
            <TabButton icon="auto_awesome" label={t('settings.tab.skills')} active={activeTab === 'skills'} onClick={() => setActiveTab('skills')} />
            <TabButton icon="history_edu" label={t('settings.tab.memory')} active={activeTab === 'memory'} onClick={() => setActiveTab('memory')} />
            <TabButton icon="extension" label={t('settings.tab.plugins')} active={activeTab === 'plugins'} onClick={() => setActiveTab('plugins')} />
            <TabButton icon="mouse" label={t('settings.tab.computerUse')} active={activeTab === 'computerUse'} onClick={() => setActiveTab('computerUse')} />
            <TabButton icon="monitoring" label={t('settings.tab.activity')} active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} />
            <TabButton icon="monitor_heart" label={t('settings.tab.diagnostics')} active={activeTab === 'diagnostics'} onClick={() => setActiveTab('diagnostics')} />
          </div>
          <div className="border-t border-[var(--color-border)]/40 pt-1">
            <TabButton icon="info" label={t('settings.tab.about')} active={activeTab === 'about'} onClick={() => setActiveTab('about')} />
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {activeTab === 'account' && <GMasterAccountSettings />}
          {activeTab === 'providers' && <ProviderSettings />}
          {activeTab === 'permissions' && <PermissionSettings />}
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'h5Access' && <H5AccessSettings />}
          {activeTab === 'adapters' && <AdapterSettings />}
          {activeTab === 'terminal' && <TerminalSettings showPreferences />}
          {activeTab === 'mcp' && <McpSettings />}
          {activeTab === 'agents' && <AgentsSettings />}
          {activeTab === 'skills' && <SkillSettings />}
          {activeTab === 'memory' && <MemorySettings />}
          {activeTab === 'plugins' && <PluginSettings />}
          {activeTab === 'computerUse' && <ComputerUseSettings />}
          {activeTab === 'activity' && <ActivitySettings />}
          {activeTab === 'diagnostics' && <DiagnosticsSettings />}
          {activeTab === 'about' && <AboutSettings />}
        </div>
      </div>
    </div>
  )
}

function TabButton({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors ${
        active
          ? 'bg-[var(--color-surface-selected)] text-[var(--color-text-primary)] font-medium'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
      {label}
    </button>
  )
}

// ─── Provider Settings ──────────────────────────────────────

type ProviderTestState = { loading: boolean; result?: ProviderTestResult }

function ProviderSettings() {
  const {
    providers,
    activeId,
    hasLoadedProviders,
    presets,
    isLoading,
    isPresetsLoading,
    fetchProviders,
    fetchPresets,
    deleteProvider,
    activateProvider,
    activateOfficial,
    testProvider,
  } = useProviderStore()
  const fetchSettings = useSettingsStore((s) => s.fetchAll)
  const gmasterStatus = useGMasterAuthStore((s) => s.status)
  const t = useTranslation()
  const [editingProvider, setEditingProvider] = useState<SavedProvider | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [pendingDeleteProvider, setPendingDeleteProvider] = useState<SavedProvider | null>(null)
  const [isDeletingProvider, setIsDeletingProvider] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, ProviderTestState>>({})

  useEffect(() => {
    void fetchProviders()
    void fetchPresets()
  }, [fetchPresets, fetchProviders])

  const presetMap = useMemo(
    () => new Map(presets.map((preset) => [preset.id, preset])),
    [presets],
  )
  const officialGMasterProvider = useMemo(
    () => providers.find((provider) => isGMasterOfficialProvider(provider)),
    [providers],
  )
  const displayedGMasterProvider = officialGMasterProvider ?? GMASTER_SIGNED_OUT_PROVIDER
  const customProviders = useMemo(
    () => providers.filter((provider) => !isGMasterOfficialProvider(provider)),
    [providers],
  )
  const isGMasterSignedOut = !displayedGMasterProvider.apiKey.trim() || gmasterStatus?.loggedIn === false

  const handleDelete = async (provider: SavedProvider) => {
    if (activeId === provider.id) return
    setPendingDeleteProvider(provider)
  }

  const confirmDelete = async () => {
    if (!pendingDeleteProvider) return
    setIsDeletingProvider(true)
    try {
      await deleteProvider(pendingDeleteProvider.id)
      setPendingDeleteProvider(null)
    } catch (error) {
      console.error(error)
    } finally {
      setIsDeletingProvider(false)
    }
  }

  const handleTest = async (provider: SavedProvider) => {
    setTestResults((r) => ({ ...r, [provider.id]: { loading: true } }))
    try {
      const result = await testProvider(provider.id)
      setTestResults((r) => ({ ...r, [provider.id]: { loading: false, result } }))
    } catch {
      setTestResults((r) => ({ ...r, [provider.id]: { loading: false, result: { connectivity: { success: false, latencyMs: 0, error: t('settings.providers.requestFailed') } } } }))
    }
  }

  const handleActivate = async (id: string) => {
    await activateProvider(id)
    await fetchSettings()
  }

  const handleActivateOfficial = async () => {
    await activateOfficial()
    await fetchSettings()
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{t('settings.providers.title')}</h2>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-0.5">{t('settings.providers.description')}</p>
        </div>
        <Button size="sm" onClick={() => setShowCreateModal(true)} disabled={isPresetsLoading || presets.length === 0}>
          <span className="material-symbols-outlined text-[16px]">add</span>
          {t('settings.providers.addProvider')}
        </Button>
      </div>

      {/* Saved providers */}
      {isLoading && providers.length === 0 ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-5 h-5 border-2 border-[var(--color-brand)] border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <GMasterOfficialProviderPanel
            provider={displayedGMasterProvider}
            preset={presetMap.get(displayedGMasterProvider.presetId)}
            isActive={activeId === displayedGMasterProvider.id && !isGMasterSignedOut}
            isSignedOut={isGMasterSignedOut}
            test={testResults[displayedGMasterProvider.id]}
            onActivate={() => handleActivate(displayedGMasterProvider.id)}
            onTest={() => handleTest(displayedGMasterProvider)}
            onEdit={() => setEditingProvider(displayedGMasterProvider)}
          />

          <ClaudeNativeProviderPanel
            isActive={hasLoadedProviders && activeId === null}
            onActivate={handleActivateOfficial}
          />

          <div className="flex flex-col gap-2">
          {customProviders.map((provider) => {
            const isActive = activeId === provider.id
            const test = testResults[provider.id]
            const preset = presetMap.get(provider.presetId)
            return (
              <div
                key={provider.id}
                className={`relative flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all group ${
                  isActive
                    ? 'border-[var(--color-brand)] bg-[var(--color-surface-container)] shadow-[var(--shadow-focus-ring)]'
                    : 'border-[var(--color-border)] hover:border-[var(--color-border-focus)]'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isActive ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-tertiary)]'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{provider.name}</span>
                    {preset && preset.id !== 'custom' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[var(--color-surface-container-high)] text-[var(--color-text-tertiary)] leading-none">{preset.name}</span>
                    )}
                    {provider.apiFormat && provider.apiFormat !== 'anthropic' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[var(--color-surface-container-high)] text-[var(--color-warning)] leading-none">
                        {provider.apiFormat === 'openai_chat' ? 'OpenAI Chat' : 'OpenAI Responses'}
                      </span>
                    )}
                    {isActive && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded border border-[var(--color-brand)]/18 bg-[var(--color-brand)]/14 text-[var(--color-brand)] leading-none">{t('settings.providers.default')}</span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--color-text-tertiary)] truncate mt-0.5">
                    {provider.baseUrl} &middot; {provider.models.main}
                  </div>
                  <ProviderTestDetails test={test} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  {!isActive && (
                    <Button variant="ghost" size="sm" onClick={() => handleActivate(provider.id)}>{t('settings.providers.setDefault')}</Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleTest(provider)} loading={test?.loading}>{t('settings.providers.test')}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingProvider(provider)}>{t('settings.providers.edit')}</Button>
                  {!isActive && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(provider)} className="text-[var(--color-error)] hover:text-[var(--color-error)]">{t('common.delete')}</Button>
                  )}
                </div>
              </div>
            )
          })}
          </div>
        </div>
      )}

      {/* Create Modal — conditionally rendered so state resets on close */}
      {showCreateModal && (
        <ProviderFormModal open={true} onClose={() => setShowCreateModal(false)} mode="create" presets={presets} />
      )}

      {/* Edit Modal */}
      {editingProvider && (
        <ProviderFormModal key={editingProvider.id} open={true} onClose={() => setEditingProvider(null)} mode="edit" provider={editingProvider} presets={presets} />
      )}

      <ConfirmDialog
        open={pendingDeleteProvider !== null}
        onClose={() => {
          if (isDeletingProvider) return
          setPendingDeleteProvider(null)
        }}
        onConfirm={confirmDelete}
        title={t('common.delete')}
        body={pendingDeleteProvider ? t('settings.providers.confirmDelete', { name: pendingDeleteProvider.name }) : ''}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        confirmVariant="danger"
        loading={isDeletingProvider}
      />
    </div>
  )
}

function ProviderTestDetails({ test }: { test?: ProviderTestState }) {
  const t = useTranslation()

  if (!test || test.loading || !test.result) return null

  return (
    <div className="text-xs mt-1 flex flex-col gap-0.5">
      <span className={test.result.connectivity.success ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}>
        {test.result.connectivity.success
          ? t('settings.providers.connectivityOk', { latency: String(test.result.connectivity.latencyMs) })
          : t('settings.providers.connectivityFailed', { error: test.result.connectivity.error || '' })}
      </span>
      {test.result.proxy && (
        <span className={test.result.proxy.success ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}>
          {test.result.proxy.success
            ? t('settings.providers.proxyOk', { latency: String(test.result.proxy.latencyMs) })
            : t('settings.providers.proxyFailed', { error: test.result.proxy.error || '' })}
        </span>
      )}
    </div>
  )
}

const GMASTER_SIGNED_OUT_PROVIDER: SavedProvider = {
  id: GMASTER_MANAGED_PROVIDER_ID,
  presetId: 'gmaster',
  name: 'G-Master API',
  apiKey: '',
  authStrategy: 'api_key',
  baseUrl: GMASTER_API_BASE_URL,
  apiFormat: 'anthropic',
  models: GMASTER_DEFAULT_MODELS,
  notes: '',
  managed: { type: 'gmaster' },
}

function GMasterOfficialProviderPanel({
  provider,
  preset,
  isActive,
  isSignedOut,
  test,
  onActivate,
  onTest,
  onEdit,
}: {
  provider: SavedProvider
  preset?: ProviderPreset
  isActive: boolean
  isSignedOut: boolean
  test?: ProviderTestState
  onActivate: () => void
  onTest: () => void
  onEdit: () => void
}) {
  const t = useTranslation()
  const apiFormatLabel = provider.apiFormat === 'openai_chat'
    ? 'OpenAI Chat'
    : provider.apiFormat === 'openai_responses'
      ? 'OpenAI Responses'
      : preset?.name ?? t('settings.providers.apiFormatAnthropic')
  const mainModel = provider.models.main || GMASTER_DEFAULT_MODELS.main
  const haikuModel = provider.models.haiku || GMASTER_DEFAULT_MODELS.haiku
  const sonnetModel = provider.models.sonnet || GMASTER_DEFAULT_MODELS.sonnet

  return (
    <section
      data-testid="official-gmaster-provider-panel"
      className={`group relative overflow-hidden rounded-2xl border px-5 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)] ${
        !isSignedOut
          ? 'border-[var(--color-brand)] bg-[var(--color-surface-container)] shadow-[var(--shadow-focus-ring)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface-container-low)]'
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,var(--color-brand)_0,transparent_34%)] opacity-[0.14]" />
      <div className="relative flex items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-[var(--color-brand)]/25 bg-[var(--color-brand)]/12 text-[var(--color-brand)]">
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">verified</span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-brand)]">
                  {t('settings.providers.gmasterOfficialTitle')}
                </span>
                <span className="rounded-full border border-[var(--color-brand)]/25 bg-[var(--color-brand)]/14 px-2 py-0.5 text-[10px] font-bold leading-none text-[var(--color-brand)]">
                  {t('settings.providers.officialBadge')}
                </span>
                {isActive && (
                  <span className="rounded-full border border-[var(--color-success)]/25 bg-[var(--color-success)]/12 px-2 py-0.5 text-[10px] font-bold leading-none text-[var(--color-success)]">
                    {t('settings.providers.default')}
                  </span>
                )}
                {isSignedOut && (
                  <span className="rounded-full border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/12 px-2 py-0.5 text-[10px] font-bold leading-none text-[var(--color-warning)]">
                    {t('settings.account.notSignedIn')}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${!isSignedOut ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-tertiary)]'}`} />
                <h3 className="truncate text-base font-semibold text-[var(--color-text-primary)]">{provider.name}</h3>
              </div>
            </div>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {t('settings.providers.gmasterOfficialDesc')}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <ProviderMetric label={t('settings.providers.apiFormat')} value={apiFormatLabel} />
            <ProviderMetric label={t('settings.providers.mainModel')} value={mainModel} />
            <ProviderMetric label={t('settings.providers.baseUrl')} value={provider.baseUrl} />
            <ProviderMetric label={t('settings.providers.haikuModel')} value={haikuModel} />
            <ProviderMetric label={t('settings.providers.sonnetModel')} value={sonnetModel} />
            <ProviderMetric label={t('settings.providers.apiKey')} value={t('settings.providers.gmasterManagedCredential')} />
          </div>

          <ProviderTestDetails test={test} />
        </div>

        <div className="relative flex flex-shrink-0 items-center gap-1">
          {!isActive && !isSignedOut && (
            <Button variant="ghost" size="sm" onClick={onActivate}>{t('settings.providers.setDefault')}</Button>
          )}
          <Button variant="ghost" size="sm" onClick={onTest} loading={test?.loading} disabled={isSignedOut}>{t('settings.providers.test')}</Button>
          <Button variant="ghost" size="sm" onClick={onEdit} disabled={isSignedOut}>{t('settings.providers.edit')}</Button>
        </div>
      </div>
    </section>
  )
}

function ProviderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-high)]/55 px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">{label}</div>
      <div className="mt-1 truncate text-xs font-semibold text-[var(--color-text-primary)]" title={value}>{value}</div>
    </div>
  )
}

function ClaudeNativeProviderPanel({
  isActive,
  onActivate,
}: {
  isActive: boolean
  onActivate: () => void
}) {
  const t = useTranslation()
  const opusModel = OFFICIAL_MODELS.find((model) => model.id.includes('opus'))?.name ?? 'Opus 4.7'
  const sonnetModel = OFFICIAL_MODELS.find((model) => model.id.includes('sonnet'))?.name ?? 'Sonnet 4.6'
  const haikuModel = OFFICIAL_MODELS.find((model) => model.id.includes('haiku'))?.name ?? 'Haiku 4.5'

  return (
    <section
      data-testid="claude-native-provider-panel"
      className={`group relative overflow-hidden rounded-2xl border px-5 py-4 transition-all ${
        isActive
          ? 'border-[var(--color-brand)] bg-[var(--color-surface-container)] shadow-[var(--shadow-focus-ring)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface-container-low)] hover:border-[var(--color-border-focus)]'
      }`}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-[linear-gradient(120deg,var(--color-surface-container-high),transparent)] opacity-40" />
      <div className="relative flex items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-container-high)] text-[var(--color-text-secondary)]">
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">cloud</span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                  Claude Cloud
                </span>
                <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-container-high)] px-2 py-0.5 text-[10px] font-bold leading-none text-[var(--color-text-secondary)]">
                  {t('settings.providers.nativeBadge')}
                </span>
                {isActive && (
                  <span className="rounded-full border border-[var(--color-success)]/25 bg-[var(--color-success)]/12 px-2 py-0.5 text-[10px] font-bold leading-none text-[var(--color-success)]">
                    {t('settings.providers.default')}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${isActive ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-tertiary)]'}`} />
                <h3 className="truncate text-base font-semibold text-[var(--color-text-primary)]">{t('settings.providers.officialName')}</h3>
              </div>
            </div>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {t('settings.providers.officialDesc')}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <ProviderMetric label={t('settings.providers.apiFormat')} value={t('settings.providers.apiFormatAnthropic')} />
            <ProviderMetric label={t('settings.providers.opusModel')} value={opusModel} />
            <ProviderMetric label={t('settings.providers.sonnetModel')} value={sonnetModel} />
            <ProviderMetric label={t('settings.providers.haikuModel')} value={haikuModel} />
            <ProviderMetric label={t('settings.providers.apiKey')} value={t('settings.providers.noApiKeyRequired')} />
            <ProviderMetric label={t('settings.providers.baseUrl')} value="Claude Cloud" />
          </div>
        </div>

        <div className="relative flex flex-shrink-0 items-center gap-1">
          {!isActive && (
            <Button variant="ghost" size="sm" onClick={onActivate}>{t('settings.providers.setDefault')}</Button>
          )}
        </div>
      </div>

      {isActive && (
        <div className="relative mt-4 border-t border-[var(--color-border-separator)] pt-4">
          <ClaudeOfficialLogin />
        </div>
      )}
    </section>
  )
}

// ─── Provider Form Modal ──────────────────────────────────────

type ProviderFormProps = {
  open: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  provider?: SavedProvider
  presets: ProviderPreset[]
}

function requirePreset(preset: ProviderPreset | undefined): ProviderPreset {
  if (!preset) {
    throw new Error('Provider presets are not configured')
  }
  return preset
}

const AUTO_COMPACT_WINDOW_ENV_KEY = 'CLAUDE_CODE_AUTO_COMPACT_WINDOW'
const MODEL_CONTEXT_WINDOWS_ENV_KEY = 'CLAUDE_CODE_MODEL_CONTEXT_WINDOWS'
const MODEL_CONTEXT_WINDOW_MIN = 16000
const MODEL_CONTEXT_WINDOW_MAX = 10000000
const MODEL_SLOTS = ['main', 'haiku', 'sonnet', 'opus'] as const
const DEFAULT_PROVIDER_AUTH_STRATEGY: ProviderAuthStrategy = 'auth_token'
const AUTH_ENV_KEYS = new Set(['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'])
type ModelSlot = typeof MODEL_SLOTS[number]
type ModelContextInputs = Record<ModelSlot, string>

function formatContextWindow(value: number): string {
  return value.toLocaleString('en-US')
}

function getPresetAutoCompactWindow(preset: ProviderPreset): string {
  return preset.defaultEnv?.[AUTO_COMPACT_WINDOW_ENV_KEY] ?? ''
}

function getPresetAuthStrategy(preset: ProviderPreset): ProviderAuthStrategy {
  return preset.authStrategy ?? DEFAULT_PROVIDER_AUTH_STRATEGY
}

function omitAuthEnv(env: Record<string, string> | undefined): Record<string, string> {
  if (!env) return {}
  return Object.fromEntries(
    Object.entries(env).filter(([key]) => !AUTH_ENV_KEYS.has(key.toUpperCase())),
  )
}

function getProviderAuthValue(apiKey: string, preset: ProviderPreset): string {
  return apiKey || preset.defaultEnv?.ANTHROPIC_AUTH_TOKEN || preset.defaultEnv?.ANTHROPIC_API_KEY || (preset.needsApiKey ? '(your API key)' : '')
}

function buildSettingsJsonAuthEnv(
  apiFormat: ApiFormat,
  authStrategy: ProviderAuthStrategy,
  apiKey: string,
  preset: ProviderPreset,
): Record<string, string> {
  if (apiFormat !== 'anthropic') {
    return { ANTHROPIC_API_KEY: 'proxy-managed' }
  }

  const value = getProviderAuthValue(apiKey, preset)
  switch (authStrategy) {
    case 'api_key':
      return value ? { ANTHROPIC_API_KEY: value } : {}
    case 'auth_token':
      return value ? { ANTHROPIC_AUTH_TOKEN: value } : {}
    case 'auth_token_empty_api_key':
      return {
        ANTHROPIC_API_KEY: '',
        ...(value ? { ANTHROPIC_AUTH_TOKEN: value } : {}),
      }
    case 'dual_same_token':
      return value ? { ANTHROPIC_API_KEY: value, ANTHROPIC_AUTH_TOKEN: value } : {}
    case 'dual_dummy':
      return { ANTHROPIC_API_KEY: 'dummy', ANTHROPIC_AUTH_TOKEN: 'dummy' }
  }
}

function inferAuthStrategyFromEnv(env: Record<string, string>): ProviderAuthStrategy | null {
  if (env.ANTHROPIC_API_KEY === 'dummy' && env.ANTHROPIC_AUTH_TOKEN === 'dummy') return 'dual_dummy'
  if (env.ANTHROPIC_API_KEY === '' && env.ANTHROPIC_AUTH_TOKEN) return 'auth_token_empty_api_key'
  if (env.ANTHROPIC_API_KEY && env.ANTHROPIC_AUTH_TOKEN && env.ANTHROPIC_API_KEY === env.ANTHROPIC_AUTH_TOKEN) return 'dual_same_token'
  if (env.ANTHROPIC_AUTH_TOKEN) return 'auth_token'
  if (env.ANTHROPIC_API_KEY) return 'api_key'
  return null
}

function parseAutoCompactWindowInput(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  if (!Number.isInteger(parsed)) return undefined
  if (parsed < MODEL_CONTEXT_WINDOW_MIN || parsed > MODEL_CONTEXT_WINDOW_MAX) return undefined
  return parsed
}

function getAutoCompactWindowErrorKey(value: string): 'number' | 'range' | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isInteger(parsed)) return 'number'
  if (parsed < MODEL_CONTEXT_WINDOW_MIN || parsed > MODEL_CONTEXT_WINDOW_MAX) return 'range'
  return null
}

function parseModelContextWindowsInput(value: string): number | undefined {
  return parseAutoCompactWindowInput(value)
}

function getModelContextWindowErrorKey(value: string): 'number' | 'range' | null {
  return getAutoCompactWindowErrorKey(value)
}

function getModelContextInputValue(
  model: string | undefined,
  preset: ProviderPreset,
  provider?: SavedProvider,
): string {
  const trimmedModel = model?.trim()
  if (!trimmedModel) return ''
  const value = provider?.modelContextWindows?.[trimmedModel] ?? preset.modelContextWindows?.[trimmedModel]
  return value !== undefined ? String(value) : ''
}

function getModelContextInputs(
  models: ModelMapping,
  preset: ProviderPreset,
  provider?: SavedProvider,
): ModelContextInputs {
  const inputs = {} as ModelContextInputs
  for (const slot of MODEL_SLOTS) {
    inputs[slot] = getModelContextInputValue(models[slot], preset, provider)
  }
  return inputs
}

function buildModelContextWindows(
  models: ModelMapping,
  inputs: ModelContextInputs,
): Record<string, number> {
  const windows: Record<string, number> = {}
  for (const slot of MODEL_SLOTS) {
    const model = models[slot]?.trim()
    const parsed = parseModelContextWindowsInput(inputs[slot])
    if (model && parsed !== undefined) {
      windows[model] = parsed
    }
  }
  return windows
}

function normalizeModelMapping(models: ModelMapping): ModelMapping {
  const main = models.main.trim()
  return {
    main,
    haiku: models.haiku.trim() || main,
    sonnet: models.sonnet.trim() || main,
    opus: models.opus.trim() || main,
  }
}

function updateSettingsJsonAutoCompactWindow(raw: string, value: string): string {
  try {
    const parsed = JSON.parse(raw || '{}') as { env?: Record<string, unknown> }
    const existingEnv = parsed.env && typeof parsed.env === 'object' && !Array.isArray(parsed.env)
      ? parsed.env
      : {}
    const env = { ...existingEnv }
    const trimmed = value.trim()
    if (trimmed) {
      env[AUTO_COMPACT_WINDOW_ENV_KEY] = trimmed
    } else {
      delete env[AUTO_COMPACT_WINDOW_ENV_KEY]
    }
    parsed.env = env
    return JSON.stringify(parsed, null, 2)
  } catch {
    return raw
  }
}

function updateSettingsJsonModelContextWindows(
  raw: string,
  modelContextWindows: Record<string, number>,
): string {
  try {
    const parsed = JSON.parse(raw || '{}') as { env?: Record<string, unknown> }
    const existingEnv = parsed.env && typeof parsed.env === 'object' && !Array.isArray(parsed.env)
      ? parsed.env
      : {}
    const env = { ...existingEnv }
    if (Object.keys(modelContextWindows).length > 0) {
      env[MODEL_CONTEXT_WINDOWS_ENV_KEY] = JSON.stringify(modelContextWindows)
    } else {
      delete env[MODEL_CONTEXT_WINDOWS_ENV_KEY]
    }
    parsed.env = env
    return JSON.stringify(parsed, null, 2)
  } catch {
    return raw
  }
}

function updateSettingsJsonModels(raw: string, models: ModelMapping): string {
  try {
    const parsed = JSON.parse(raw || '{}') as { env?: Record<string, unknown> }
    const existingEnv = parsed.env && typeof parsed.env === 'object' && !Array.isArray(parsed.env)
      ? parsed.env
      : {}
    parsed.env = {
      ...existingEnv,
      ANTHROPIC_MODEL: models.main,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: models.haiku,
      ANTHROPIC_DEFAULT_SONNET_MODEL: models.sonnet,
      ANTHROPIC_DEFAULT_OPUS_MODEL: models.opus,
    }
    return JSON.stringify(parsed, null, 2)
  } catch {
    return raw
  }
}

function updateSettingsJsonProviderConnection(
  raw: string,
  apiFormat: ApiFormat,
  authStrategy: ProviderAuthStrategy,
  apiKey: string,
  preset: ProviderPreset,
  baseUrl: string,
): string {
  try {
    const parsed = JSON.parse(raw || '{}') as { env?: Record<string, unknown> }
    const existingEnv = parsed.env && typeof parsed.env === 'object' && !Array.isArray(parsed.env)
      ? parsed.env
      : {}
    const env = { ...existingEnv }
    delete env.ANTHROPIC_API_KEY
    delete env.ANTHROPIC_AUTH_TOKEN
    env.ANTHROPIC_BASE_URL = apiFormat !== 'anthropic' ? 'http://127.0.0.1:3456/proxy' : baseUrl
    Object.assign(env, buildSettingsJsonAuthEnv(apiFormat, authStrategy, apiKey, preset))
    parsed.env = env
    return JSON.stringify(parsed, null, 2)
  } catch {
    return raw
  }
}

function buildFallbackPreset(provider?: SavedProvider): ProviderPreset {
  return {
    id: provider?.presetId ?? 'custom',
    name: provider?.name ?? 'Custom',
    baseUrl: provider?.baseUrl ?? '',
    apiFormat: provider?.apiFormat ?? 'anthropic',
    authStrategy: provider?.authStrategy,
    defaultModels: provider?.models ?? { main: '', haiku: '', sonnet: '', opus: '' },
    modelContextWindows: provider?.modelContextWindows,
    defaultEnv: provider?.autoCompactWindow !== undefined
      ? { [AUTO_COMPACT_WINDOW_ENV_KEY]: String(provider.autoCompactWindow) }
      : undefined,
    needsApiKey: true,
    websiteUrl: '',
  }
}

function openExternalUrl(url: string) {
  if (!isTauriRuntime()) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }

  void import('@tauri-apps/plugin-shell')
    .then((mod) => mod.open(url))
    .catch(() => window.open(url, '_blank', 'noopener,noreferrer'))
}

function ProviderFormModal({ open, onClose, mode, provider, presets }: ProviderFormProps) {
  const { createProvider, updateProvider, testConfig } = useProviderStore()
  const fetchSettings = useSettingsStore((s) => s.fetchAll)
  const t = useTranslation()

  const availablePresets = presets.filter((p) => p.id !== 'official')
  const regularPresets = availablePresets.filter((p) => !p.featured)
  const featuredPresets = availablePresets.filter((p) => p.featured)
  const presetDefaultEnvKeys = useMemo(
    () => presets.flatMap((preset) => Object.keys(preset.defaultEnv ?? {})),
    [presets],
  )
  const fallbackPreset = provider
    ? buildFallbackPreset(provider)
    : requirePreset(availablePresets[availablePresets.length - 1])
  const initialPreset = requirePreset(
    provider
      ? availablePresets.find((p) => p.id === provider.presetId) ?? fallbackPreset
      : availablePresets[0] ?? fallbackPreset,
  )

  const [selectedPreset, setSelectedPreset] = useState<ProviderPreset>(initialPreset)
  const [name, setName] = useState(provider?.name ?? initialPreset.name)
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? initialPreset.baseUrl)
  const [apiFormat, setApiFormat] = useState<ApiFormat>(provider?.apiFormat ?? initialPreset.apiFormat ?? 'anthropic')
  const [authStrategy, setAuthStrategy] = useState<ProviderAuthStrategy>(provider?.authStrategy ?? getPresetAuthStrategy(initialPreset))
  const [apiKey, setApiKey] = useState(provider?.apiKey ?? '')
  const [showApiKey, setShowApiKey] = useState(false)
  const [notes, setNotes] = useState(provider?.notes ?? '')
  const [models, setModels] = useState<ModelMapping>(provider?.models ?? { ...initialPreset.defaultModels })
  const [modelContextInputs, setModelContextInputs] = useState<ModelContextInputs>(
    getModelContextInputs(provider?.models ?? initialPreset.defaultModels, initialPreset, provider),
  )
  const [autoCompactWindow, setAutoCompactWindow] = useState(
    provider?.autoCompactWindow !== undefined
      ? String(provider.autoCompactWindow)
      : getPresetAutoCompactWindow(initialPreset),
  )
  const [showContextSettings, setShowContextSettings] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [settingsJson, setSettingsJson] = useState('')
  const [settingsJsonError, setSettingsJsonError] = useState<string | null>(null)
  const jsonPastedRef = useRef(false)
  const isOfficialGMaster = isGMasterOfficialProvider(provider) || selectedPreset.id === 'gmaster'
  const officialModelOptions = useMemo(
    () => getGMasterModelOptions(models, provider?.availableModels),
    [models, provider?.availableModels],
  )
  const resolvedOfficialModels: ModelMapping = {
    main: models.main.trim() || GMASTER_DEFAULT_MODELS.main,
    haiku: models.haiku.trim() || GMASTER_DEFAULT_MODELS.haiku,
    sonnet: models.sonnet.trim() || GMASTER_DEFAULT_MODELS.sonnet,
    opus: models.opus.trim() || GMASTER_DEFAULT_MODELS.opus,
  }
  const submittedModels = normalizeModelMapping(isOfficialGMaster ? resolvedOfficialModels : models)
  const submittedBaseUrl = isOfficialGMaster ? (baseUrl.trim() || GMASTER_API_BASE_URL) : baseUrl.trim()
  const apiFormatLabel = apiFormat === 'openai_chat'
    ? t('settings.providers.apiFormatOpenaiChat')
    : apiFormat === 'openai_responses'
      ? t('settings.providers.apiFormatOpenaiResponses')
      : t('settings.providers.apiFormatAnthropic')

  // Load current settings.json and merge provider env vars
  useEffect(() => {
    if (isOfficialGMaster) {
      setSettingsJson('')
      setSettingsJsonError(null)
      return
    }

    // Skip if JSON was just populated by user paste
    if (jsonPastedRef.current) {
      jsonPastedRef.current = false
      return
    }
    import('../api/providers').then(({ providersApi }) => {
      providersApi.getSettings().then((settings) => {
        const needsProxy = apiFormat !== 'anthropic'
        const autoCompactWindowEnv = autoCompactWindow.trim()
        const modelContextWindows = buildModelContextWindows(models, modelContextInputs)
        const normalizedModels = normalizeModelMapping(models)
        const existingEnv = (settings.env as Record<string, string>) || {}
        const cleanedEnv = stripProviderSettingsJsonEnv(existingEnv, presetDefaultEnvKeys)
        const merged = {
          ...settings,
          skipWebFetchPreflight: settings.skipWebFetchPreflight ?? true,
          env: {
            ...cleanedEnv,
            ...omitAuthEnv(selectedPreset.defaultEnv),
            ...(autoCompactWindowEnv ? { [AUTO_COMPACT_WINDOW_ENV_KEY]: autoCompactWindowEnv } : {}),
            ...(Object.keys(modelContextWindows).length > 0
              ? { [MODEL_CONTEXT_WINDOWS_ENV_KEY]: JSON.stringify(modelContextWindows) }
              : {}),
            ANTHROPIC_BASE_URL: needsProxy ? 'http://127.0.0.1:3456/proxy' : baseUrl,
            ...buildSettingsJsonAuthEnv(apiFormat, authStrategy, apiKey, selectedPreset),
            ANTHROPIC_MODEL: normalizedModels.main,
            ANTHROPIC_DEFAULT_HAIKU_MODEL: normalizedModels.haiku,
            ANTHROPIC_DEFAULT_SONNET_MODEL: normalizedModels.sonnet,
            ANTHROPIC_DEFAULT_OPUS_MODEL: normalizedModels.opus,
          },
        }
        setSettingsJson(JSON.stringify(merged, null, 2))
      }).catch(() => {
        setSettingsJson(JSON.stringify({}, null, 2))
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPreset.id, isOfficialGMaster])

  const handlePresetChange = (preset: ProviderPreset) => {
    setSelectedPreset(preset)
    setName(preset.name)
    setBaseUrl(preset.baseUrl)
    setApiFormat(preset.apiFormat ?? 'anthropic')
    setAuthStrategy(getPresetAuthStrategy(preset))
    setModels({ ...preset.defaultModels })
    setModelContextInputs(getModelContextInputs(preset.defaultModels, preset))
    setAutoCompactWindow(getPresetAutoCompactWindow(preset))
    setShowContextSettings(false)
    setTestResult(null)
  }

  const isCustom = selectedPreset.id === 'custom'
  const requiresApiKey = !isOfficialGMaster && selectedPreset.needsApiKey !== false
  const autoCompactWindowErrorKey = getAutoCompactWindowErrorKey(autoCompactWindow)
  const modelContextWindowErrorSlots = MODEL_SLOTS.filter((slot) => getModelContextWindowErrorKey(modelContextInputs[slot]))
  const canSubmit = name.trim() && submittedBaseUrl && (mode === 'edit' || isOfficialGMaster || !requiresApiKey || apiKey.trim()) && submittedModels.main.trim() && !settingsJsonError && !autoCompactWindowErrorKey && modelContextWindowErrorSlots.length === 0
  const apiKeyUrl = selectedPreset.apiKeyUrl?.trim()
  const promoText = selectedPreset.promoText?.trim()
  const displayedSettingsJson = showApiKey
    ? settingsJson
    : maskSettingsJsonSecrets(settingsJson)
  const apiFormatItems = [
    {
      value: 'anthropic' as const,
      label: t('settings.providers.apiFormatAnthropic'),
      icon: <span className="material-symbols-outlined text-[17px]">hub</span>,
    },
    {
      value: 'openai_chat' as const,
      label: t('settings.providers.apiFormatOpenaiChat'),
      icon: <span className="material-symbols-outlined text-[17px]">forum</span>,
    },
    {
      value: 'openai_responses' as const,
      label: t('settings.providers.apiFormatOpenaiResponses'),
      icon: <span className="material-symbols-outlined text-[17px]">route</span>,
    },
  ]
  const selectedApiFormatLabel = apiFormatItems.find((item) => item.value === apiFormat)?.label ?? t('settings.providers.apiFormatAnthropic')
  const authStrategyItems = [
    {
      value: 'auth_token' as const,
      label: t('settings.providers.authStrategyAuthToken'),
      description: t('settings.providers.authStrategyAuthTokenDesc'),
      icon: <span className="material-symbols-outlined text-[17px]">key</span>,
    },
    {
      value: 'auth_token_empty_api_key' as const,
      label: t('settings.providers.authStrategyAuthTokenEmptyApiKey'),
      description: t('settings.providers.authStrategyAuthTokenEmptyApiKeyDesc'),
      icon: <span className="material-symbols-outlined text-[17px]">key_off</span>,
    },
    {
      value: 'api_key' as const,
      label: t('settings.providers.authStrategyApiKey'),
      description: t('settings.providers.authStrategyApiKeyDesc'),
      icon: <span className="material-symbols-outlined text-[17px]">vpn_key</span>,
    },
    {
      value: 'dual_same_token' as const,
      label: t('settings.providers.authStrategyDualSameToken'),
      description: t('settings.providers.authStrategyDualSameTokenDesc'),
      icon: <span className="material-symbols-outlined text-[17px]">sync_alt</span>,
    },
    {
      value: 'dual_dummy' as const,
      label: t('settings.providers.authStrategyDualDummy'),
      description: t('settings.providers.authStrategyDualDummyDesc'),
      icon: <span className="material-symbols-outlined text-[17px]">construction</span>,
    },
  ] satisfies Array<{ value: ProviderAuthStrategy; label: string; description: string; icon: ReactNode }>
  const selectedAuthStrategyLabel = authStrategyItems.find((item) => item.value === authStrategy)?.label ?? t('settings.providers.authStrategyAuthToken')
  const configuredContextWindows = buildModelContextWindows(models, modelContextInputs)
  const configuredContextSummary = Object.entries(configuredContextWindows)
    .filter(([model], index, entries) => entries.findIndex(([candidate]) => candidate === model) === index)
    .map(([model, value]) => `${model}: ${formatContextWindow(value)}`)
  const parsedFallbackContextWindow = parseAutoCompactWindowInput(autoCompactWindow)
  const fallbackContextSummary = parsedFallbackContextWindow !== undefined
    ? t('settings.providers.contextFallbackSummary', {
      tokens: formatContextWindow(parsedFallbackContextWindow),
    })
    : t('settings.providers.contextFallbackAuto')
  const contextSummary = configuredContextSummary.length > 0
    ? [...configuredContextSummary, fallbackContextSummary].join(' · ')
    : t('settings.providers.contextSummaryAuto')
  const shouldShowContextFields = showContextSettings || modelContextWindowErrorSlots.length > 0 || !!autoCompactWindowErrorKey
  const handleAutoCompactWindowChange = (value: string) => {
    setAutoCompactWindow(value)
    setSettingsJson((current) => updateSettingsJsonAutoCompactWindow(current, value))
  }
  const handleBaseUrlChange = (value: string) => {
    setBaseUrl(value)
    setSettingsJson((current) => updateSettingsJsonProviderConnection(current, apiFormat, authStrategy, apiKey, selectedPreset, value))
  }
  const handleApiKeyChange = (value: string) => {
    setApiKey(value)
    setSettingsJson((current) => updateSettingsJsonProviderConnection(current, apiFormat, authStrategy, value, selectedPreset, baseUrl))
  }
  const handleApiFormatChange = (value: ApiFormat) => {
    setApiFormat(value)
    setSettingsJson((current) => updateSettingsJsonProviderConnection(current, value, authStrategy, apiKey, selectedPreset, baseUrl))
  }
  const handleAuthStrategyChange = (value: ProviderAuthStrategy) => {
    setAuthStrategy(value)
    setSettingsJson((current) => updateSettingsJsonProviderConnection(current, apiFormat, value, apiKey, selectedPreset, baseUrl))
  }
  const handleModelChange = (slot: ModelSlot, value: string) => {
    const nextModels = { ...models, [slot]: value }
    const nextInputs = {
      ...modelContextInputs,
      [slot]: getModelContextInputValue(value, selectedPreset, provider),
    }
    setModels(nextModels)
    setModelContextInputs(nextInputs)
    setSettingsJson((current) => updateSettingsJsonModelContextWindows(
      updateSettingsJsonModels(current, normalizeModelMapping(nextModels)),
      buildModelContextWindows(nextModels, nextInputs),
    ))
  }
  const handleModelContextWindowChange = (slot: ModelSlot, value: string) => {
    const nextInputs = { ...modelContextInputs, [slot]: value }
    setModelContextInputs(nextInputs)
    setSettingsJson((current) => updateSettingsJsonModelContextWindows(
      current,
      buildModelContextWindows(models, nextInputs),
    ))
  }
  const connectivityError = testResult?.connectivity.error || ''
  const gmasterUnavailableModel = isOfficialGMaster
    ? extractGMasterUnavailableModel(connectivityError) || testResult?.connectivity.modelUsed
    : undefined
  const displayedConnectivityError = gmasterUnavailableModel
    ? t('settings.providers.gmasterNoChannelHint', { model: gmasterUnavailableModel })
    : connectivityError
  const renderPresetButton = (preset: ProviderPreset) => (
    <button
      key={preset.id}
      onClick={() => handlePresetChange(preset)}
      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
        selectedPreset.id === preset.id
          ? 'border-[var(--color-brand)] bg-[var(--color-surface-container-high)] text-[var(--color-brand)] shadow-[var(--shadow-focus-ring)]'
          : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-hover)]'
      }`}
    >
      {preset.name}
    </button>
  )

  const handleSubmit = async () => {
    if (!canSubmit) return
    const parsedAutoCompactWindow = parseAutoCompactWindowInput(autoCompactWindow)
    const parsedModelContextWindows = buildModelContextWindows(models, modelContextInputs)
    setIsSubmitting(true)
    try {
      // Write the edited Gaster Code settings.json first so provider-specific model
      // settings never conflict with the user's global ~/.claude/settings.json.
      if (!isOfficialGMaster && settingsJson.trim()) {
        try {
          const parsed = restoreSettingsJsonSecrets(JSON.parse(settingsJson), settingsJson, apiKey)
          const { providersApi } = await import('../api/providers')
          await providersApi.updateSettings(parsed)
        } catch {
          // JSON validation already prevents this
        }
      }

      if (mode === 'create') {
        await createProvider({
          presetId: selectedPreset.id,
          name: name.trim(),
          apiKey: isOfficialGMaster ? '' : apiKey.trim(),
          authStrategy,
          baseUrl: submittedBaseUrl,
          apiFormat,
          models: submittedModels,
          ...(parsedAutoCompactWindow !== undefined && { autoCompactWindow: parsedAutoCompactWindow }),
          ...(Object.keys(parsedModelContextWindows).length > 0 && { modelContextWindows: parsedModelContextWindows }),
          notes: notes.trim() || undefined,
        })
      } else if (provider) {
        const input: UpdateProviderInput = {
          name: name.trim(),
          baseUrl: submittedBaseUrl,
          authStrategy,
          apiFormat,
          models: submittedModels,
          autoCompactWindow: parsedAutoCompactWindow ?? null,
          modelContextWindows: Object.keys(parsedModelContextWindows).length > 0
            ? parsedModelContextWindows
            : null,
          notes: notes.trim() || undefined,
        }
        if (!isOfficialGMaster && apiKey.trim()) input.apiKey = apiKey.trim()
        await updateProvider(provider.id, input)
      }
      await fetchSettings()
      onClose()
    } catch (err) {
      console.error('Failed to save provider:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTest = async () => {
    if (!submittedBaseUrl || !submittedModels.main.trim()) return
    setIsTesting(true)
    setTestResult(null)
    try {
      let result: ProviderTestResult
      if (mode === 'edit' && provider && !apiKey.trim()) {
        result = await useProviderStore.getState().testProvider(provider.id, {
          baseUrl: submittedBaseUrl,
          modelId: submittedModels.main.trim(),
          apiFormat,
          authStrategy,
        })
      } else {
        const testApiKey = apiKey.trim() || selectedPreset.defaultEnv?.ANTHROPIC_AUTH_TOKEN || (requiresApiKey ? '' : 'local')
        if (requiresApiKey && !testApiKey) return
        result = await testConfig({
          baseUrl: submittedBaseUrl,
          apiKey: testApiKey,
          modelId: submittedModels.main.trim(),
          authStrategy,
          apiFormat,
        })
      }
      setTestResult(result)
    } catch {
      setTestResult({ connectivity: { success: false, latencyMs: 0, error: t('settings.providers.requestFailed') } })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? t('settings.providers.addTitle') : t('settings.providers.editTitle')}
      width={720}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} loading={isSubmitting}>
            {mode === 'create' ? t('common.add') : t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {isOfficialGMaster && (
          <div className="rounded-xl border border-[var(--color-brand)]/25 bg-[var(--color-brand)]/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
              <span className="material-symbols-outlined text-[18px] text-[var(--color-brand)]">verified</span>
              {t('settings.providers.gmasterOfficialTitle')}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
              {t('settings.providers.gmasterOfficialDesc')}
            </p>
          </div>
        )}

        {/* Preset chips */}
        {mode === 'create' && (
          <div>
            <label className="text-sm font-medium text-[var(--color-text-primary)] mb-2 block">{t('settings.providers.preset')}</label>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {regularPresets.map(renderPresetButton)}
              </div>
              {featuredPresets.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)]/60 pt-2">
                  {featuredPresets.map(renderPresetButton)}
                </div>
              )}
            </div>
          </div>
        )}

        {isOfficialGMaster ? (
          <ReadOnlyField label={t('settings.providers.name')} value={name || 'G-Master API'} />
        ) : (
          <Input label={t('settings.providers.name')} required value={name} onChange={(e) => setName(e.target.value)} placeholder={t('settings.providers.namePlaceholder')} />
        )}

        {!isOfficialGMaster && (
          <Input label={t('settings.providers.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('settings.providers.notesPlaceholder')} />
        )}

        {isOfficialGMaster ? (
          <ReadOnlyField label={t('settings.providers.baseUrl')} value={submittedBaseUrl} />
        ) : (
          <Input label={t('settings.providers.baseUrl')} required value={baseUrl} onChange={(e) => handleBaseUrlChange(e.target.value)} placeholder={t('settings.providers.baseUrlPlaceholder')} />
        )}

        {/* API Format */}
        {isOfficialGMaster ? (
          <ReadOnlyField label={t('settings.providers.apiFormat')} value={apiFormatLabel} />
        ) : (isCustom || mode === 'edit') ? (
          <div>
            <label className="text-sm font-medium text-[var(--color-text-primary)] mb-1 block">{t('settings.providers.apiFormat')}</label>
            <Dropdown<ApiFormat>
              items={apiFormatItems}
              value={apiFormat}
              onChange={handleApiFormatChange}
              width="100%"
              className="block w-full"
              trigger={
                <button
                  type="button"
                  className="flex h-10 w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-left text-sm text-[var(--color-text-primary)] outline-none transition-colors hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-container-low)] focus-visible:border-[var(--color-border-focus)] focus-visible:shadow-[var(--shadow-focus-ring)]"
                >
                  <span className="min-w-0 flex-1 truncate">{selectedApiFormatLabel}</span>
                  <span className="material-symbols-outlined flex-shrink-0 text-[18px] text-[var(--color-text-secondary)]">expand_more</span>
                </button>
              }
            />
            {apiFormat !== 'anthropic' && (
              <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1">{t('settings.providers.proxyHint')}</p>
            )}
          </div>
        ) : apiFormat !== 'anthropic' ? (
          <div>
            <label className="text-sm font-medium text-[var(--color-text-primary)] mb-1 block">{t('settings.providers.apiFormat')}</label>
            <div className="text-xs text-[var(--color-text-tertiary)] px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-surface-container-low)] border border-[var(--color-border)]">
              {apiFormat === 'openai_chat' ? t('settings.providers.apiFormatOpenaiChat') : t('settings.providers.apiFormatOpenaiResponses')}
            </div>
          </div>
        ) : null}

        {isOfficialGMaster ? (
          <ReadOnlyField label={t('settings.providers.apiKey')} value={t('settings.providers.gmasterManagedCredential')} />
        ) : (
          <>
            {apiFormat === 'anthropic' && (
          <div>
            <label className="text-sm font-medium text-[var(--color-text-primary)] mb-1 block">{t('settings.providers.authStrategy')}</label>
            <Dropdown<ProviderAuthStrategy>
              items={authStrategyItems}
              value={authStrategy}
              onChange={handleAuthStrategyChange}
              width="100%"
              className="block w-full"
              trigger={
                <button
                  type="button"
                  className="flex min-h-10 w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-left text-sm text-[var(--color-text-primary)] outline-none transition-colors hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-container-low)] focus-visible:border-[var(--color-border-focus)] focus-visible:shadow-[var(--shadow-focus-ring)]"
                >
                  <span className="min-w-0 flex-1 truncate">{selectedAuthStrategyLabel}</span>
                  <span className="material-symbols-outlined flex-shrink-0 text-[18px] text-[var(--color-text-secondary)]">expand_more</span>
                </button>
              }
            />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="provider-api-key" className="text-sm font-medium text-[var(--color-text-primary)]">
            {mode === 'edit' ? t('settings.providers.apiKeyKeep') : t('settings.providers.apiKey')}
            {mode === 'create' && requiresApiKey && <span className="text-[var(--color-error)] ml-0.5">*</span>}
          </label>
          <div className="relative">
            <input
              id="provider-api-key"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder="sk-..."
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 pr-10 text-sm text-[var(--color-text-primary)] outline-none transition-colors duration-150 placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus)] focus:shadow-[var(--shadow-focus-ring)]"
            />
            <button
              type="button"
              onClick={() => setShowApiKey((visible) => !visible)}
              aria-label={showApiKey ? 'Hide API Key' : 'Show API Key'}
              className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] focus:outline-none focus:shadow-[var(--shadow-focus-ring)]"
            >
              <span className="material-symbols-outlined text-[16px]">
                {showApiKey ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </div>

            {(apiKeyUrl || promoText) && (
              <div className="-mt-2 flex flex-col gap-1.5">
                {apiKeyUrl && (
                  <button
                    type="button"
                    onClick={() => openExternalUrl(apiKeyUrl)}
                    className="group inline-flex h-6 w-fit cursor-pointer items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-1.5 text-[11px] font-medium leading-none text-[var(--color-brand)] transition-colors hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-hover)] focus:outline-none focus:shadow-[var(--shadow-focus-ring)]"
                  >
                    <span className="material-symbols-outlined text-[13px]">key</span>
                    {t('settings.providers.getApiKey')}
                    <span className="material-symbols-outlined text-[9px] opacity-60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5">arrow_outward</span>
                  </button>
                )}
                {promoText && (
                  <button
                    type="button"
                    onClick={() => apiKeyUrl && openExternalUrl(apiKeyUrl)}
                    disabled={!apiKeyUrl}
                    className="group flex w-full cursor-pointer items-start gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-brand)]/25 bg-[var(--color-brand)]/8 px-2.5 py-1.5 text-left text-[11px] leading-5 text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-brand)]/45 hover:bg-[var(--color-brand)]/12 focus:outline-none focus:shadow-[var(--shadow-focus-ring)] disabled:cursor-default disabled:hover:border-[var(--color-brand)]/25 disabled:hover:bg-[var(--color-brand)]/8"
                  >
                    <span className="material-symbols-outlined mt-0.5 text-[13px] text-[var(--color-brand)]">tips_and_updates</span>
                    <span>{promoText}</span>
                    {apiKeyUrl && (
                      <span className="material-symbols-outlined ml-auto mt-1 text-[10px] text-[var(--color-brand)] opacity-45 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5">arrow_outward</span>
                    )}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* Model Mapping */}
        <div>
          <label className="text-sm font-medium text-[var(--color-text-primary)] mb-2 block">{t('settings.providers.modelMapping')}</label>
          <div className="grid grid-cols-2 gap-2">
            {isOfficialGMaster ? (
              <>
                <ModelSelect label={t('settings.providers.mainModel')} required value={resolvedOfficialModels.main} options={officialModelOptions} onChange={(value) => handleModelChange('main', value)} />
                <ModelSelect label={t('settings.providers.haikuModel')} value={resolvedOfficialModels.haiku} options={officialModelOptions} onChange={(value) => handleModelChange('haiku', value)} />
                <ModelSelect label={t('settings.providers.sonnetModel')} value={resolvedOfficialModels.sonnet} options={officialModelOptions} onChange={(value) => handleModelChange('sonnet', value)} />
                <ModelSelect label={t('settings.providers.opusModel')} value={resolvedOfficialModels.opus} options={officialModelOptions} onChange={(value) => handleModelChange('opus', value)} />
              </>
            ) : (
              <>
                <Input label={t('settings.providers.mainModel')} required value={models.main} onChange={(e) => handleModelChange('main', e.target.value)} placeholder="Model ID" />
                <Input label={t('settings.providers.haikuModel')} value={models.haiku} onChange={(e) => handleModelChange('haiku', e.target.value)} placeholder={t('settings.providers.sameAsMain')} />
                <Input label={t('settings.providers.sonnetModel')} value={models.sonnet} onChange={(e) => handleModelChange('sonnet', e.target.value)} placeholder={t('settings.providers.sameAsMain')} />
                <Input label={t('settings.providers.opusModel')} value={models.opus} onChange={(e) => handleModelChange('opus', e.target.value)} placeholder={t('settings.providers.sameAsMain')} />
              </>
            )}
          </div>
          {isOfficialGMaster && (
            <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-tertiary)]">
              {t('settings.providers.gmasterTestMainHint', { model: submittedModels.main })}
            </p>
          )}
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-container-low)]">
          <button
            type="button"
            onClick={() => setShowContextSettings((visible) => !visible)}
            className="flex w-full items-start gap-3 px-3 py-3 text-left outline-none transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:shadow-[var(--shadow-focus-ring)]"
            aria-expanded={shouldShowContextFields}
          >
            <span className="material-symbols-outlined mt-0.5 text-[18px] text-[var(--color-brand)]">compress</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-[var(--color-text-primary)]">
                {t('settings.providers.contextSettingsTitle')}
              </span>
              <span className="mt-1 block truncate text-xs text-[var(--color-text-secondary)]">
                {contextSummary}
              </span>
              <span className="mt-1 block text-[11px] leading-5 text-[var(--color-text-tertiary)]">
                {t('settings.providers.contextSettingsDesc')}
              </span>
            </span>
            <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-brand)]">
              {shouldShowContextFields
                ? t('settings.providers.contextSettingsHide')
                : t('settings.providers.contextSettingsEdit')}
              <span className="material-symbols-outlined text-[16px]">
                {shouldShowContextFields ? 'expand_less' : 'expand_more'}
              </span>
            </span>
          </button>

          {shouldShowContextFields && (
            <div className="border-t border-[var(--color-border)] px-3 pb-3 pt-3">
              <div>
                <label className="text-sm font-medium text-[var(--color-text-primary)] mb-2 block">{t('settings.providers.modelContextWindows')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {MODEL_SLOTS.map((slot) => {
                    const errorKey = getModelContextWindowErrorKey(modelContextInputs[slot])
                    const labelKey = slot === 'main'
                      ? 'settings.providers.mainContextWindow'
                      : slot === 'haiku'
                        ? 'settings.providers.haikuContextWindow'
                        : slot === 'sonnet'
                          ? 'settings.providers.sonnetContextWindow'
                          : 'settings.providers.opusContextWindow'
                    return (
                      <div key={slot}>
                        <Input
                          label={t(labelKey)}
                          value={modelContextInputs[slot]}
                          onChange={(e) => handleModelContextWindowChange(slot, e.target.value)}
                          placeholder={t('settings.providers.contextWindowPlaceholder')}
                        />
                        {errorKey && (
                          <p className="text-[11px] text-[var(--color-error)] mt-1">
                            {errorKey === 'number'
                              ? t('settings.providers.modelContextWindowNumberError')
                              : t('settings.providers.modelContextWindowRangeError')}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
                <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
                  {t('settings.providers.modelContextWindowsDesc')}
                </p>
              </div>

              <div className="mt-3">
                <Input
                  label={t('settings.providers.autoCompactWindow')}
                  value={autoCompactWindow}
                  onChange={(e) => handleAutoCompactWindowChange(e.target.value)}
                  placeholder={t('settings.providers.autoCompactWindowPlaceholder')}
                />
                {autoCompactWindowErrorKey ? (
                  <p className="text-[11px] text-[var(--color-error)] mt-1">
                    {autoCompactWindowErrorKey === 'number'
                      ? t('settings.providers.autoCompactWindowNumberError')
                      : t('settings.providers.autoCompactWindowRangeError')}
                  </p>
                ) : (
                  <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1">
                    {t('settings.providers.autoCompactWindowDesc')}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Test connection */}
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={handleTest} loading={isTesting} disabled={!submittedBaseUrl || !submittedModels.main.trim()}>
            {t('settings.providers.testConnection')}
          </Button>
          {testResult && (
            <div className="flex flex-col gap-0.5">
              <span className={`text-xs ${testResult.connectivity.success ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                {testResult.connectivity.success
                  ? t('settings.providers.connectivityOk', { latency: String(testResult.connectivity.latencyMs) })
                  : t('settings.providers.connectivityFailed', { error: displayedConnectivityError })}
              </span>
              {testResult.proxy && (
                <span className={`text-xs ${testResult.proxy.success ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                  {testResult.proxy.success
                    ? t('settings.providers.proxyOk', { latency: String(testResult.proxy.latencyMs) })
                    : t('settings.providers.proxyFailed', { error: testResult.proxy.error || '' })}
                </span>
              )}
            </div>
          )}
        </div>

        {!isOfficialGMaster && (
        <div>
          <label className="text-sm font-medium text-[var(--color-text-primary)] mb-2 block">{t('settings.providers.settingsJson')}</label>
          <textarea
            value={displayedSettingsJson}
            onChange={(e) => {
              const raw = e.target.value
              try {
                const parsed = restoreSettingsJsonSecrets(JSON.parse(raw), settingsJson, apiKey)
                setSettingsJson(JSON.stringify(parsed, null, 2))
                setSettingsJsonError(null)
                // Auto-fill form fields from parsed JSON env
                const env = parsed.env as Record<string, string> | undefined
                if (env) {
                  if (env.ANTHROPIC_BASE_URL) {
                    setBaseUrl(env.ANTHROPIC_BASE_URL)
                    // Auto-switch to matching preset or Custom
                    if (mode === 'create') {
                      const matchedPreset = availablePresets.find((p) => p.id !== 'custom' && p.baseUrl === env.ANTHROPIC_BASE_URL)
                      const targetPreset = requirePreset(
                        matchedPreset ?? availablePresets.find((p) => p.id === 'custom'),
                      )
                      if (targetPreset.id !== selectedPreset.id) {
                        jsonPastedRef.current = true
                        setSelectedPreset(targetPreset)
                      }
                    }
                  }
                  const nextApiKey = env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_API_KEY
                  if (nextApiKey && nextApiKey !== '(your API key)' && nextApiKey !== API_KEY_JSON_PLACEHOLDER) {
                    setApiKey(nextApiKey)
                  }
                  const nextAuthStrategy = inferAuthStrategyFromEnv(env)
                  if (nextAuthStrategy) {
                    setAuthStrategy(nextAuthStrategy)
                  }
                  if (env[AUTO_COMPACT_WINDOW_ENV_KEY] !== undefined) {
                    setAutoCompactWindow(String(env[AUTO_COMPACT_WINDOW_ENV_KEY]))
                  } else {
                    setAutoCompactWindow('')
                  }
                  let parsedContextWindows: Record<string, number> = {}
                  if (typeof env[MODEL_CONTEXT_WINDOWS_ENV_KEY] === 'string') {
                    try {
                      const parsedContext = JSON.parse(env[MODEL_CONTEXT_WINDOWS_ENV_KEY]) as Record<string, unknown>
                      parsedContextWindows = Object.fromEntries(
                        Object.entries(parsedContext)
                          .filter(([, value]) => typeof value === 'number' && Number.isInteger(value)),
                      ) as Record<string, number>
                    } catch {
                      parsedContextWindows = {}
                    }
                  }
                  const newModels: Partial<ModelMapping> = {}
                  if (env.ANTHROPIC_MODEL) newModels.main = env.ANTHROPIC_MODEL
                  if (env.ANTHROPIC_DEFAULT_HAIKU_MODEL) newModels.haiku = env.ANTHROPIC_DEFAULT_HAIKU_MODEL
                  if (env.ANTHROPIC_DEFAULT_SONNET_MODEL) newModels.sonnet = env.ANTHROPIC_DEFAULT_SONNET_MODEL
                  if (env.ANTHROPIC_DEFAULT_OPUS_MODEL) newModels.opus = env.ANTHROPIC_DEFAULT_OPUS_MODEL
                  if (Object.keys(newModels).length > 0) {
                    setModels((prev) => {
                      const nextModels = { ...prev, ...newModels }
                      setModelContextInputs(getModelContextInputs(nextModels, {
                        ...selectedPreset,
                        modelContextWindows: parsedContextWindows,
                      }))
                      return nextModels
                    })
                  } else if (Object.keys(parsedContextWindows).length > 0) {
                    setModelContextInputs(getModelContextInputs(models, {
                      ...selectedPreset,
                      modelContextWindows: parsedContextWindows,
                    }))
                  }
                }
              } catch (err) {
                setSettingsJson(raw)
                setSettingsJsonError(err instanceof Error ? err.message : 'Invalid JSON')
              }
            }}
            rows={16}
            spellCheck={false}
            className={`w-full text-xs px-3 py-3 rounded-[var(--radius-md)] bg-[var(--color-surface-container-low)] border font-mono leading-relaxed resize-y text-[var(--color-text-secondary)] outline-none ${
              settingsJsonError
                ? 'border-[var(--color-error)] focus:border-[var(--color-error)]'
                : 'border-[var(--color-border)] focus:border-[var(--color-border-focus)]'
            }`}
          />
          {settingsJsonError && (
            <p className="text-[11px] text-[var(--color-error)] mt-1">{t('settings.providers.jsonError', { error: settingsJsonError })}</p>
          )}
          <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1">{t('settings.providers.settingsJsonDesc')}</p>
        </div>
        )}
      </div>
    </Modal>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-sm font-medium text-[var(--color-text-primary)] mb-1 block">{label}</label>
      <div className="text-sm text-[var(--color-text-secondary)] px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-surface-container-low)] border border-[var(--color-border)]">
        {value}
      </div>
    </div>
  )
}

function extractGMasterUnavailableModel(error: string): string | undefined {
  const match = error.match(/No available channel for model\s+(.+?)\s+under group/i)
  return match?.[1]?.trim()
}

function ModelSelect({
  label,
  required,
  value,
  options,
  onChange,
}: {
  label: string
  required?: boolean
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-[var(--color-text-primary)]">
        {label}
        {required && <span className="text-[var(--color-error)] ml-0.5">*</span>}
      </label>
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 px-3 rounded-[var(--radius-md)] border text-sm bg-[var(--color-surface)] text-[var(--color-text-primary)] border-[var(--color-border)] outline-none transition-colors duration-150 focus:border-[var(--color-border-focus)] focus:shadow-[var(--shadow-focus-ring)]"
      >
        {options.map((model) => (
          <option key={model} value={model}>{model}</option>
        ))}
      </select>
    </div>
  )
}


// ─── Permission Settings ──────────────────────────────────────

function PermissionSettings() {
  const { permissionMode, setPermissionMode } = useSettingsStore()
  const t = useTranslation()

  const MODES: Array<{ mode: PermissionMode; icon: string; label: string; desc: string }> = [
    { mode: 'default', icon: 'verified_user', label: t('settings.permissions.default'), desc: t('settings.permissions.defaultDesc') },
    { mode: 'acceptEdits', icon: 'edit_note', label: t('settings.permissions.acceptEdits'), desc: t('settings.permissions.acceptEditsDesc') },
    { mode: 'plan', icon: 'architecture', label: t('settings.permissions.plan'), desc: t('settings.permissions.planDesc') },
    { mode: 'bypassPermissions', icon: 'bolt', label: t('settings.permissions.bypass'), desc: t('settings.permissions.bypassDesc') },
  ]

  return (
    <div className="max-w-xl">
      <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">{t('settings.permissions.title')}</h2>
      <p className="text-sm text-[var(--color-text-tertiary)] mb-4">{t('settings.permissions.description')}</p>

      <div className="flex flex-col gap-2">
        {MODES.map(({ mode, icon, label, desc }) => {
          const isSelected = permissionMode === mode
          return (
            <button
              key={mode}
              onClick={() => setPermissionMode(mode)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                isSelected
                  ? 'border-[var(--color-brand)] bg-[var(--color-surface-container)] shadow-[var(--shadow-focus-ring)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              <span className="material-symbols-outlined text-[20px] text-[var(--color-text-secondary)]">{icon}</span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-[var(--color-text-primary)]">{label}</div>
                <div className="text-xs text-[var(--color-text-tertiary)]">{desc}</div>
              </div>
              {isSelected && (
                <span className="material-symbols-outlined text-[18px] text-[var(--color-brand)]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── General Settings ──────────────────────────────────────

function GeneralSettings() {
  const {
    effortLevel,
    setEffort,
    thinkingEnabled,
    setThinkingEnabled,
    locale,
    setLocale,
    theme,
    setTheme,
    skipWebFetchPreflight,
    setSkipWebFetchPreflight,
    desktopNotificationsEnabled,
    setDesktopNotificationsEnabled,
    webSearch,
    setWebSearch,
    responseLanguage,
    setResponseLanguage,
    uiZoom,
    setUiZoom,
    appMode,
    appModeRequiresRestart,
    fetchAppMode,
    setAppMode: setAppModeAction,
  } = useSettingsStore()
  const t = useTranslation()
  const [webSearchDraft, setWebSearchDraft] = useState(webSearch)
  const [notificationPermission, setNotificationPermission] = useState<DesktopNotificationPermission>('default')
  const [notificationActionRunning, setNotificationActionRunning] = useState(false)
  const [zoomDraft, setZoomDraft] = useState(uiZoom)
  const [zoomDragging, setZoomDragging] = useState(false)
  const [modeSwitchConfirmOpen, setModeSwitchConfirmOpen] = useState(false)
  const [pendingMode, setPendingMode] = useState<AppMode | null>(null)
  const [pendingPortableDir, setPendingPortableDir] = useState<string | null>(null)
  const [portableDirDraft, setPortableDirDraft] = useState('')
  const [modeActionRunning, setModeActionRunning] = useState(false)
  const [modeError, setModeError] = useState<string | null>(null)
  const webSearchDirty = JSON.stringify(webSearchDraft) !== JSON.stringify(webSearch)
  const activeConfigDir = appMode.activeConfigDir ?? (appMode.mode === 'portable' ? appMode.portableDir : null)
  const configDirSource = appMode.configDirSource ?? (appMode.mode === 'portable' ? 'portable' : 'system')
  const isEnvironmentConfigDir = configDirSource === 'environment'

  useEffect(() => {
    setWebSearchDraft(webSearch)
  }, [webSearch])

  useEffect(() => {
    if (!zoomDragging) {
      setZoomDraft(uiZoom)
    }
  }, [uiZoom, zoomDragging])

  useEffect(() => {
    let cancelled = false
    getDesktopNotificationPermission().then((permission) => {
      if (!cancelled) setNotificationPermission(permission)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isTauriRuntime()) return
    void fetchAppMode()
  }, [fetchAppMode])

  useEffect(() => {
    setPortableDirDraft(appMode.portableDir ?? appMode.defaultPortableDir ?? '')
  }, [appMode.defaultPortableDir, appMode.portableDir])

  const EFFORT_LABELS: Record<EffortLevel, string> = {
    low: t('settings.general.effort.low'),
    medium: t('settings.general.effort.medium'),
    high: t('settings.general.effort.high'),
    max: t('settings.general.effort.max'),
  }

  const LANGUAGES: Array<{ value: Locale; label: string }> = [
    { value: 'en', label: 'English' },
    { value: 'zh', label: '中文' },
  ]

  const RESPONSE_LANGUAGES: Array<{ value: string; label: string }> = [
    { value: '', label: t('settings.general.responseLangDefault') },
    { value: 'english', label: 'English' },
    { value: 'chinese', label: '中文 (Chinese)' },
    { value: 'japanese', label: '日本語 (Japanese)' },
    { value: 'korean', label: '한국어 (Korean)' },
    { value: 'spanish', label: 'Español (Spanish)' },
    { value: 'french', label: 'Français (French)' },
    { value: 'german', label: 'Deutsch (German)' },
    { value: 'portuguese', label: 'Português (Portuguese)' },
    { value: 'italian', label: 'Italiano (Italian)' },
    { value: 'russian', label: 'Русский (Russian)' },
    { value: 'dutch', label: 'Nederlands (Dutch)' },
    { value: 'polish', label: 'Polski (Polish)' },
    { value: 'turkish', label: 'Türkçe (Turkish)' },
    { value: 'hindi', label: 'हिन्दी (Hindi)' },
    { value: 'indonesian', label: 'Bahasa Indonesia' },
    { value: 'ukrainian', label: 'Українська (Ukrainian)' },
    { value: 'greek', label: 'Ελληνικά (Greek)' },
    { value: 'czech', label: 'Čeština (Czech)' },
    { value: 'danish', label: 'Dansk (Danish)' },
    { value: 'swedish', label: 'Svenska (Swedish)' },
    { value: 'norwegian', label: 'Norsk (Norwegian)' },
  ]
  const selectedResponseLanguageLabel =
    RESPONSE_LANGUAGES.find(({ value }) => value === responseLanguage)?.label ?? RESPONSE_LANGUAGES[0]!.label

  const THEMES: Array<{ value: ThemeMode; label: string }> = [
    { value: 'light', label: t('settings.general.appearance.light') },
    { value: 'dark', label: t('settings.general.appearance.dark') },
    { value: 'white', label: t('settings.general.appearance.white') },
  ]

  const WEB_SEARCH_MODES: Array<{ value: WebSearchMode; label: string }> = [
    { value: 'auto', label: t('settings.general.webSearch.mode.auto') },
    { value: 'tavily', label: t('settings.general.webSearch.mode.tavily') },
    { value: 'brave', label: t('settings.general.webSearch.mode.brave') },
    { value: 'anthropic', label: t('settings.general.webSearch.mode.anthropic') },
    { value: 'disabled', label: t('settings.general.webSearch.mode.disabled') },
  ]

  const notificationStatusLabel: Record<DesktopNotificationPermission, string> = {
    granted: t('settings.general.notificationsStatusGranted'),
    denied: t('settings.general.notificationsStatusDenied'),
    default: t('settings.general.notificationsStatusDefault'),
    unsupported: t('settings.general.notificationsStatusUnsupported'),
  }

  const handleDesktopNotificationsToggle = async (enabled: boolean) => {
    await setDesktopNotificationsEnabled(enabled)
    if (!enabled) return

    setNotificationActionRunning(true)
    try {
      const permission = await requestDesktopNotificationPermission()
      setNotificationPermission(permission)
      if (permission === 'granted') {
        void notifyDesktop({
          title: t('settings.general.notificationsTestTitle'),
          body: t('settings.general.notificationsTestBody'),
        })
      }
      if (permission === 'denied') {
        await openDesktopNotificationSettings()
      }
    } finally {
      setNotificationActionRunning(false)
    }
  }

  const handleNotificationPermissionAction = async () => {
    setNotificationActionRunning(true)
    try {
      if (notificationPermission === 'denied') {
        await openDesktopNotificationSettings()
      } else {
        const permission = await requestDesktopNotificationPermission()
        setNotificationPermission(permission)
        if (permission === 'granted') {
          void notifyDesktop({
            title: t('settings.general.notificationsTestTitle'),
            body: t('settings.general.notificationsTestBody'),
          })
        }
        if (permission === 'denied') {
          await openDesktopNotificationSettings()
        }
      }
    } finally {
      setNotificationActionRunning(false)
    }
  }

  const commitZoom = (zoom: number) => {
    setZoomDraft(zoom)
    setUiZoom(zoom)
  }

  const openPortableDirPicker = async () => {
    setModeError(null)
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('settings.general.storageChooseDirTitle'),
      })
      if (typeof selected === 'string') {
        setPortableDirDraft(selected)
      }
    } catch {
      setModeError(t('settings.general.storagePickerError'))
    }
  }

  const openModeSwitchConfirm = (mode: AppMode) => {
    if (isEnvironmentConfigDir) {
      setModeError(t('settings.general.storageEnvironmentSwitchBlocked'))
      return
    }

    const portableDir = portableDirDraft.trim()
    if (mode === 'portable' && !portableDir) {
      setModeError(t('settings.general.storageNoDirError'))
      return
    }

    setModeError(null)
    setPendingMode(mode)
    setPendingPortableDir(mode === 'portable' ? portableDir : null)
    setModeSwitchConfirmOpen(true)
  }

  const closeModeSwitchConfirm = () => {
    if (modeActionRunning) return
    setModeSwitchConfirmOpen(false)
    setPendingMode(null)
    setPendingPortableDir(null)
  }

  const confirmModeSwitch = async () => {
    if (!pendingMode) return

    setModeActionRunning(true)
    setModeError(null)
    try {
      await setAppModeAction(pendingMode, pendingPortableDir)
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('prepare_for_app_mode_restart')
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    } catch (error) {
      setModeError(
        error instanceof Error
          ? error.message
          : t('settings.general.storageRestartError'),
      )
      setModeSwitchConfirmOpen(false)
      setPendingMode(null)
      setPendingPortableDir(null)
      setModeActionRunning(false)
    }
  }

  const zoomPercent = Math.round(zoomDraft * 100)
  const zoomRangeProgress = `${((zoomDraft - UI_ZOOM_MIN) / (UI_ZOOM_MAX - UI_ZOOM_MIN)) * 100}%`

  return (
    <div className="max-w-xl">
      {/* Appearance selector */}
      <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">{t('settings.general.appearanceTitle')}</h2>
      <p className="text-sm text-[var(--color-text-tertiary)] mb-3">{t('settings.general.appearanceDescription')}</p>
      <div className="flex gap-2 mb-8">
        {THEMES.map(({ value, label }) => (
          <button
            key={value}
            aria-pressed={theme === value}
            onClick={() => void setTheme(value)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
              theme === value
                ? 'bg-[image:var(--gradient-btn-primary)] text-[var(--color-btn-primary-fg)] border-transparent shadow-[var(--shadow-button-primary)]'
                : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Language selector */}
      <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">{t('settings.general.languageTitle')}</h2>
      <p className="text-sm text-[var(--color-text-tertiary)] mb-3">{t('settings.general.languageDescription')}</p>
      <div className="flex gap-2 mb-8">
        {LANGUAGES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setLocale(value)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
              locale === value
                ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Response Language */}
      <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">{t('settings.general.responseLangTitle')}</h2>
      <p className="text-sm text-[var(--color-text-tertiary)] mb-3">{t('settings.general.responseLangDescription')}</p>
      <Dropdown<string>
        items={RESPONSE_LANGUAGES}
        value={responseLanguage}
        onChange={(value) => void setResponseLanguage(value)}
        width="100%"
        maxHeight={320}
        className="mb-8 block w-full"
        trigger={
          <button
            type="button"
            aria-label={t('settings.general.responseLangTitle')}
            className="flex h-10 w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-left text-sm text-[var(--color-text-primary)] outline-none transition-colors hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-container-low)] focus-visible:border-[var(--color-border-focus)] focus-visible:shadow-[var(--shadow-focus-ring)]"
          >
            <span className="min-w-0 flex-1 truncate">{selectedResponseLanguageLabel}</span>
            <span className="material-symbols-outlined flex-shrink-0 text-[18px] text-[var(--color-text-secondary)]">expand_more</span>
          </button>
        }
      />

      {/* Effort Level */}
      <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">{t('settings.general.effortTitle')}</h2>
      <p className="text-sm text-[var(--color-text-tertiary)] mb-3">{t('settings.general.effortDescription')}</p>
      <div className="flex gap-2">
        {(['low', 'medium', 'high', 'max'] as EffortLevel[]).map((level) => (
          <button
            key={level}
            onClick={() => setEffort(level)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
              effortLevel === level
                ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
            }`}
          >
            {EFFORT_LABELS[level]}
          </button>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">{t('settings.general.thinkingTitle')}</h2>
        <p className="text-sm text-[var(--color-text-tertiary)] mb-3">{t('settings.general.thinkingDescription')}</p>
        <label className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-4 py-3 cursor-pointer hover:border-[var(--color-border-focus)] transition-colors">
          <input
            type="checkbox"
            aria-label={t('settings.general.thinkingEnabled')}
            checked={thinkingEnabled}
            onChange={(e) => void setThinkingEnabled(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
          />
          <div className="min-w-0">
            <div className="text-sm font-medium text-[var(--color-text-primary)]">
              {t('settings.general.thinkingEnabled')}
            </div>
            <div className="text-xs text-[var(--color-text-tertiary)] mt-1 leading-5">
              {t('settings.general.thinkingHint')}
            </div>
          </div>
        </label>
      </div>

      <div className="mt-8">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">{t('settings.general.notificationsTitle')}</h2>
        <p className="text-sm text-[var(--color-text-tertiary)] mb-3">{t('settings.general.notificationsDescription')}</p>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-4 py-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              aria-label={t('settings.general.notificationsEnabled')}
              checked={desktopNotificationsEnabled}
              onChange={(e) => void handleDesktopNotificationsToggle(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-[var(--color-text-primary)]">
                {t('settings.general.notificationsEnabled')}
              </div>
              <div className="text-xs text-[var(--color-text-tertiary)] mt-1 leading-5">
                {desktopNotificationsEnabled
                  ? t('settings.general.notificationsHintOn')
                  : t('settings.general.notificationsHintOff')}
              </div>
            </div>
          </label>
          {desktopNotificationsEnabled && (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--color-border)]/60 pt-3">
              <div className="min-w-0 text-xs text-[var(--color-text-tertiary)]">
                {t('settings.general.notificationsStatus')}: {notificationStatusLabel[notificationPermission]}
              </div>
              {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="px-3 whitespace-nowrap"
                  disabled={notificationActionRunning}
                  onClick={() => void handleNotificationPermissionAction()}
                >
                  {notificationPermission === 'denied'
                    ? t('settings.general.notificationsOpenSettings')
                    : t('settings.general.notificationsAuthorize')}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">{t('settings.general.uiZoomTitle')}</h2>
            <p className="text-sm text-[var(--color-text-tertiary)]">{t('settings.general.uiZoomDescription')}</p>
          </div>
          <div className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
            {zoomPercent}%
          </div>
        </div>
        <div
          className={`settings-zoom-control rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-4 pb-4 ${zoomDragging ? 'is-dragging' : ''}`}
          style={{
            '--settings-zoom-range-progress': zoomRangeProgress,
          } as CSSProperties}
        >
          <div className="settings-zoom-range-wrap">
            <div className="settings-zoom-preview">{zoomPercent}%</div>
            <input
              type="range"
              min={UI_ZOOM_MIN}
              max={UI_ZOOM_MAX}
              step={UI_ZOOM_STEP}
              value={zoomDraft}
              aria-label={t('settings.general.uiZoomTitle')}
              className="settings-zoom-range w-full"
              onPointerDown={() => setZoomDragging(true)}
              onPointerUp={() => {
                setZoomDragging(false)
                commitZoom(zoomDraft)
              }}
              onPointerCancel={() => {
                setZoomDragging(false)
                commitZoom(zoomDraft)
              }}
              onBlur={() => {
                if (zoomDragging) {
                  setZoomDragging(false)
                  commitZoom(zoomDraft)
                }
              }}
              onChange={(event) => {
                const next = Number(event.target.value)
                setZoomDraft(next)
                if (!zoomDragging) {
                  commitZoom(next)
                }
              }}
            />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
              <span>{t('settings.general.uiZoomShortcuts')}</span>
              <kbd className="settings-zoom-kbd">{t('settings.general.uiZoomShortcutMac')}</kbd>
              <kbd className="settings-zoom-kbd">{t('settings.general.uiZoomShortcutOther')}</kbd>
              <span>{t('settings.general.uiZoomShortcutReset')}</span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="px-3 whitespace-nowrap"
              aria-label={t('settings.general.uiZoomReset')}
              onClick={() => commitZoom(UI_ZOOM_DEFAULT)}
            >
              {t('settings.general.uiZoomResetButton')}
            </Button>
          </div>
        </div>
      </div>

      {isTauriRuntime() && (
        <div className="mt-8 border-t border-[var(--color-border)] pt-8">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">{t('settings.general.storageTitle')}</h2>
          <p className="text-sm text-[var(--color-text-tertiary)] mb-3">{t('settings.general.storageDescription')}</p>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-4 py-4">
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  if (isEnvironmentConfigDir) {
                    setModeError(t('settings.general.storageEnvironmentSwitchBlocked'))
                    return
                  }
                  if (appMode.mode !== 'default') {
                    openModeSwitchConfirm('default')
                  }
                }}
                className={`flex items-start gap-3 rounded-lg border px-3 py-3 text-left transition-all ${
                  appMode.mode === 'default' && !isEnvironmentConfigDir
                    ? 'border-[var(--color-brand)] bg-[var(--color-surface)] shadow-[var(--shadow-focus-ring)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-focus)]'
                }`}
              >
                <span className="material-symbols-outlined mt-0.5 text-[20px] text-[var(--color-text-secondary)]">settings_applications</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--color-text-primary)]">{t('settings.general.storageSystemTitle')}</span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--color-text-tertiary)]">{t('settings.general.storageSystemDescription')}</span>
                </span>
              </button>

              <div
                className={`rounded-lg border px-3 py-3 transition-all ${
                  appMode.mode === 'portable' && !isEnvironmentConfigDir
                    ? 'border-[var(--color-brand)] bg-[var(--color-surface)] shadow-[var(--shadow-focus-ring)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)]'
                }`}
              >
                <div className="mb-3 flex items-start gap-3">
                  <span className="material-symbols-outlined mt-0.5 text-[20px] text-[var(--color-text-secondary)]">drive_file_move</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[var(--color-text-primary)]">{t('settings.general.storagePortableTitle')}</div>
                    <div className="mt-1 text-xs leading-5 text-[var(--color-text-tertiary)]">{t('settings.general.storagePortableDescription')}</div>
                  </div>
                </div>

                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Input
                      id="portable-data-dir"
                      label={t('settings.general.storagePortableDirLabel')}
                      value={portableDirDraft}
                      placeholder={t('settings.general.storagePortableDirPlaceholder')}
                      onChange={(event) => {
                        setPortableDirDraft(event.target.value)
                        setModeError(null)
                      }}
                      className="w-full font-mono text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10 flex-shrink-0 px-3 whitespace-nowrap"
                    onClick={() => void openPortableDirPicker()}
                  >
                    {t('settings.general.storageChooseDir')}
                  </Button>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-[var(--color-brand)] hover:underline"
                    onClick={() => {
                      setPortableDirDraft(appMode.defaultPortableDir ?? '')
                      setModeError(null)
                    }}
                  >
                    {t('settings.general.storageUseDefaultPortableDir')}
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={modeActionRunning || (appMode.mode === 'portable' && portableDirDraft.trim() === (appMode.portableDir ?? ''))}
                    onClick={() => openModeSwitchConfirm('portable')}
                  >
                    {t('settings.general.storageApplyPortable')}
                  </Button>
                </div>
              </div>
            </div>

            {activeConfigDir && (
              <div className="mt-3 rounded-lg border border-[var(--color-border)]/70 bg-[var(--color-surface)] px-3 py-2">
                <div className="text-[11px] font-medium uppercase text-[var(--color-text-tertiary)]">{t('settings.general.storageActiveDir')}</div>
                <div className="mt-1 break-all font-mono text-xs text-[var(--color-text-secondary)]">{activeConfigDir}</div>
              </div>
            )}

            {isEnvironmentConfigDir && (
              <div className="mt-3 rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning)]/10 px-3 py-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                {t('settings.general.storageEnvironmentHint')}
              </div>
            )}

            {appModeRequiresRestart && (
              <div className="mt-3 rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning)]/10 px-3 py-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                {t('settings.general.storageRestartHint')}
              </div>
            )}

            <div className="mt-3 text-xs leading-5 text-[var(--color-text-tertiary)]">
              {t('settings.general.storageMoveHint')}
            </div>

            {modeError && (
              <div className="mt-3 text-xs text-[var(--color-error)]">
                {modeError}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">{t('settings.general.webFetchPreflightTitle')}</h2>
        <p className="text-sm text-[var(--color-text-tertiary)] mb-3">{t('settings.general.webFetchPreflightDescription')}</p>
        <label className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-4 py-3 cursor-pointer hover:border-[var(--color-border-focus)] transition-colors">
          <input
            type="checkbox"
            aria-label={t('settings.general.webFetchPreflightEnabled')}
            checked={skipWebFetchPreflight}
            onChange={(e) => void setSkipWebFetchPreflight(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
          />
          <div className="min-w-0">
            <div className="text-sm font-medium text-[var(--color-text-primary)]">
              {t('settings.general.webFetchPreflightEnabled')}
            </div>
            <div className="text-xs text-[var(--color-text-tertiary)] mt-1 leading-5">
              {t('settings.general.webFetchPreflightHint')}
            </div>
          </div>
        </label>
      </div>

      <div className="mt-8">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">{t('settings.general.webSearchTitle')}</h2>
        <p className="text-sm text-[var(--color-text-tertiary)] mb-3">{t('settings.general.webSearchDescription')}</p>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-4 py-4">
          <div className="grid grid-cols-5 gap-1.5 mb-4">
            {WEB_SEARCH_MODES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setWebSearchDraft({ ...webSearchDraft, mode: value })}
                className={`h-9 px-2 text-xs font-semibold rounded-lg border transition-all truncate ${
                  (webSearchDraft.mode ?? 'auto') === value
                    ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                }`}
                title={label}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3">
            <Input
              id="web-search-tavily-key"
              type="password"
              label={t('settings.general.webSearchTavilyKey')}
              value={webSearchDraft.tavilyApiKey ?? ''}
              placeholder="tvly-..."
              autoComplete="off"
              onChange={(event) =>
                setWebSearchDraft({
                  ...webSearchDraft,
                  tavilyApiKey: event.target.value,
                })
              }
            />
            <div className="-mt-1 flex items-center justify-between gap-3 text-xs text-[var(--color-text-tertiary)]">
              <span>{t('settings.general.webSearchTavilyFreeHint')}</span>
              <a
                href="https://app.tavily.com/home"
                target="_blank"
                rel="noreferrer"
                aria-label={t('settings.general.webSearchTavilyApiKeyLink')}
                className="font-medium text-[var(--color-brand)] hover:underline whitespace-nowrap"
              >
                {t('settings.general.webSearchGetApiKey')}
              </a>
            </div>
            <Input
              id="web-search-brave-key"
              type="password"
              label={t('settings.general.webSearchBraveKey')}
              value={webSearchDraft.braveApiKey ?? ''}
              placeholder={t('settings.general.webSearchBravePlaceholder')}
              autoComplete="off"
              onChange={(event) =>
                setWebSearchDraft({
                  ...webSearchDraft,
                  braveApiKey: event.target.value,
                })
              }
            />
            <div className="-mt-1 flex items-center justify-between gap-3 text-xs text-[var(--color-text-tertiary)]">
              <span>{t('settings.general.webSearchBraveFreeHint')}</span>
              <a
                href="https://api-dashboard.search.brave.com/app/keys"
                target="_blank"
                rel="noreferrer"
                aria-label={t('settings.general.webSearchBraveApiKeyLink')}
                className="font-medium text-[var(--color-brand)] hover:underline whitespace-nowrap"
              >
                {t('settings.general.webSearchGetApiKey')}
              </a>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-xs text-[var(--color-text-tertiary)] leading-5">
              {t('settings.general.webSearchHint')}
            </p>
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                className="min-w-[72px] px-4 whitespace-nowrap"
                disabled={!webSearchDirty}
                onClick={() => void setWebSearch(webSearchDraft)}
              >
                {t('settings.general.webSearchSave')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={modeSwitchConfirmOpen}
        onClose={closeModeSwitchConfirm}
        onConfirm={() => void confirmModeSwitch()}
        title={t('settings.general.modeSwitchTitle')}
        body={(
          <div className="space-y-3 text-sm leading-6 text-[var(--color-text-secondary)]">
            <p>
              {pendingMode === 'portable'
                ? t('settings.general.storageSwitchPortableBody')
                : t('settings.general.storageSwitchDefaultBody')}
            </p>
            {pendingMode === 'portable' && pendingPortableDir && (
              <div className="rounded-lg bg-[var(--color-surface-container-low)] px-3 py-2 font-mono text-xs break-all text-[var(--color-text-secondary)]">
                {pendingPortableDir}
              </div>
            )}
            <p>{t('settings.general.storageSwitchRestartBody')}</p>
          </div>
        )}
        confirmLabel={t('settings.general.modeSwitchConfirm')}
        cancelLabel={t('common.cancel')}
        confirmVariant="primary"
        loading={modeActionRunning}
      />
    </div>
  )
}

// ─── H5 Access Settings ──────────────────────────────────────

function H5AccessSettings() {
  const {
    h5Access,
    h5AccessError,
    enableH5Access,
    disableH5Access,
    regenerateH5AccessToken,
    updateH5AccessSettings,
  } = useSettingsStore()
  const t = useTranslation()
  const [h5PublicBaseUrlDraft, setH5PublicBaseUrlDraft] = useState(h5Access.publicBaseUrl ?? '')
  const [h5AllowedOriginsDraft, setH5AllowedOriginsDraft] = useState(serializeAllowedOrigins(h5Access.allowedOrigins))
  const [h5GeneratedToken, setH5GeneratedToken] = useState<string | null>(null)
  const [h5TokenVisible, setH5TokenVisible] = useState(false)
  const [h5EnableConfirmOpen, setH5EnableConfirmOpen] = useState(false)
  const [h5QrDataUrl, setH5QrDataUrl] = useState<string | null>(null)
  const [h5ActionRunning, setH5ActionRunning] = useState(false)
  const h5AccessUrl = h5Access.publicBaseUrl
  const h5LaunchUrl = useMemo(
    () => buildH5LaunchUrl(h5AccessUrl, h5GeneratedToken),
    [h5AccessUrl, h5GeneratedToken],
  )
  const h5AllowedOrigins = useMemo(
    () => parseAllowedOriginsDraft(h5AllowedOriginsDraft),
    [h5AllowedOriginsDraft],
  )
  const h5AccessDirty =
    h5PublicBaseUrlDraft.trim() !== (h5Access.publicBaseUrl ?? '') ||
    !arraysEqual(h5AllowedOrigins, h5Access.allowedOrigins)

  useEffect(() => {
    setH5PublicBaseUrlDraft(h5Access.publicBaseUrl ?? '')
    setH5AllowedOriginsDraft(serializeAllowedOrigins(h5Access.allowedOrigins))
  }, [h5Access])

  useEffect(() => {
    let cancelled = false
    if (!h5Access.enabled || !h5LaunchUrl || !h5GeneratedToken) {
      setH5QrDataUrl(null)
      return () => {
        cancelled = true
      }
    }

    QRCode.toDataURL(h5LaunchUrl, { margin: 1, width: 192 })
      .then((dataUrl) => {
        if (!cancelled) setH5QrDataUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setH5QrDataUrl(null)
      })

    return () => {
      cancelled = true
    }
  }, [h5Access.enabled, h5LaunchUrl, h5GeneratedToken])

  const runH5Action = async (action: () => Promise<void>) => {
    setH5ActionRunning(true)
    try {
      await action()
    } catch {
      // The store owns H5-specific error state.
    } finally {
      setH5ActionRunning(false)
    }
  }

  const handleH5SettingsSave = async () => {
    await runH5Action(async () => {
      await updateH5AccessSettings({
        publicBaseUrl: h5PublicBaseUrlDraft.trim() || null,
        allowedOrigins: h5AllowedOrigins,
      })
    })
  }

  const handleH5UrlCopy = async () => {
    if (!h5AccessUrl) return
    await copyTextToClipboard(h5AccessUrl)
  }

  const handleH5LaunchUrlCopy = async () => {
    if (!h5LaunchUrl) return
    await copyTextToClipboard(h5LaunchUrl)
  }

  const handleH5EnableConfirm = async () => {
    await runH5Action(async () => {
      const token = await enableH5Access()
      setH5GeneratedToken(token)
      setH5TokenVisible(false)
      setH5EnableConfirmOpen(false)
    })
  }

  const handleH5Disable = async () => {
    await runH5Action(async () => {
      await disableH5Access()
      setH5GeneratedToken(null)
      setH5TokenVisible(false)
    })
  }

  const handleH5Regenerate = async () => {
    await runH5Action(async () => {
      const token = await regenerateH5AccessToken()
      setH5GeneratedToken(token)
      setH5TokenVisible(false)
    })
  }

  return (
    <div className="max-w-3xl">
      <section aria-labelledby="h5-access-title" role="region">
        <div className="mb-5 flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-container-low)] text-[var(--color-brand)]">
            <QrCode className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2
              id="h5-access-title"
              className="text-base font-semibold text-[var(--color-text-primary)] mb-1"
            >
              {t('settings.general.h5AccessTitle')}
            </h2>
            <p className="text-sm text-[var(--color-text-tertiary)]">
              {t('settings.general.h5AccessDescription')}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <label className="flex min-w-0 items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)]"
                checked={h5Access.enabled}
                disabled={h5ActionRunning}
                aria-label={t('settings.general.h5AccessEnabled')}
                onChange={(event) => {
                  if (event.target.checked) {
                    setH5EnableConfirmOpen(true)
                  } else {
                    void handleH5Disable()
                  }
                }}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[var(--color-text-primary)]">
                  {t('settings.general.h5AccessEnabled')}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--color-text-tertiary)]">
                  {t('settings.general.h5AccessEnabledHint')}
                </span>
              </span>
            </label>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                h5Access.enabled
                  ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-tertiary)] border border-[var(--color-border)]'
              }`}
            >
              {h5Access.enabled ? t('settings.general.h5AccessStatusEnabled') : t('settings.general.h5AccessDisabledValue')}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <Input
              id="h5-access-public-url"
              label={t('settings.general.h5AccessPublicUrl')}
              value={h5PublicBaseUrlDraft}
              placeholder={t('settings.general.h5AccessPublicUrlPlaceholder')}
              onChange={(event) => setH5PublicBaseUrlDraft(event.target.value)}
            />
            <Textarea
              id="h5-access-allowed-origins"
              label={t('settings.general.h5AccessAllowedOrigins')}
              value={h5AllowedOriginsDraft}
              placeholder={t('settings.general.h5AccessAllowedOriginsPlaceholder')}
              onChange={(event) => setH5AllowedOriginsDraft(event.target.value)}
              className="min-h-[88px]"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[var(--color-text-tertiary)]">
                {t('settings.general.h5AccessOriginsHint')}
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void handleH5SettingsSave()}
                disabled={!h5AccessDirty || h5ActionRunning}
                aria-label={t('settings.general.h5AccessSave')}
              >
                {t('settings.general.h5AccessSave')}
              </Button>
            </div>
          </div>

          {h5AccessUrl && (
            <div className="mt-4 border-t border-[var(--color-border)]/60 pt-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
                    {t('settings.general.h5AccessUrl')}
                  </div>
                  <div className="mt-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] break-all">
                    {h5AccessUrl}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0"
                  icon={<Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                  aria-label={t('settings.general.h5AccessCopyUrl')}
                  onClick={() => void handleH5UrlCopy()}
                >
                  {t('settings.general.h5AccessCopy')}
                </Button>
              </div>
            </div>
          )}

          {h5Access.enabled && h5AccessUrl && (
            <div className="mt-4 border-t border-[var(--color-border)]/60 pt-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex h-48 w-48 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white p-3">
                  {h5QrDataUrl ? (
                    <img
                      src={h5QrDataUrl}
                      alt={t('settings.general.h5AccessQrAlt')}
                      className="h-full w-full"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3 px-4 text-center">
                      <QrCode className="h-12 w-12 text-neutral-400" aria-hidden="true" />
                      <p className="text-xs leading-5 text-neutral-500">
                        {t('settings.general.h5AccessQrEmptyHint')}
                      </p>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium uppercase text-[var(--color-text-tertiary)]">
                    {t('settings.general.h5AccessQrTitle')}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[var(--color-text-tertiary)]">
                    {h5GeneratedToken
                      ? t('settings.general.h5AccessQrHint')
                      : t('settings.general.h5AccessQrRefreshHint')}
                  </p>
                  {h5LaunchUrl && (
                    <div className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] break-all">
                      {h5LaunchUrl}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                      disabled={!h5LaunchUrl || !h5GeneratedToken}
                      onClick={() => void handleH5LaunchUrlCopy()}
                    >
                      {t('settings.general.h5AccessCopyLaunchUrl')}
                    </Button>
                    <Button
                      size="sm"
                      variant={h5GeneratedToken ? 'secondary' : 'primary'}
                      icon={<RotateCw className="h-3.5 w-3.5" aria-hidden="true" />}
                      loading={h5ActionRunning}
                      onClick={() => void handleH5Regenerate()}
                    >
                      {h5GeneratedToken ? t('settings.general.h5AccessRegenerate') : t('settings.general.h5AccessGenerateToken')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {h5Access.enabled && (
            <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium uppercase text-[var(--color-text-tertiary)]">
                    {t('settings.general.h5AccessTokenPreview')}
                  </div>
                  <div className="mt-1 break-all text-sm text-[var(--color-text-primary)]">
                    {h5TokenVisible && h5GeneratedToken
                      ? h5GeneratedToken
                      : h5Access.tokenPreview || t('settings.general.h5AccessTokenNotAvailable')}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={h5TokenVisible ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                    disabled={!h5GeneratedToken}
                    onClick={() => setH5TokenVisible((visible) => !visible)}
                  >
                    {h5TokenVisible ? t('settings.general.h5AccessHideToken') : t('settings.general.h5AccessShowToken')}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    icon={<PowerOff className="h-3.5 w-3.5" aria-hidden="true" />}
                    loading={h5ActionRunning}
                    onClick={() => void handleH5Disable()}
                  >
                    {t('settings.general.h5AccessDisable')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <p className="mt-4 text-xs text-[var(--color-text-tertiary)] leading-5">
            {t('settings.general.h5AccessSafetyNote')}
          </p>
          {h5AccessError && (
            <p className="mt-2 text-xs text-[var(--color-error)]">
              {h5AccessError}
            </p>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={h5EnableConfirmOpen}
        onClose={() => {
          if (!h5ActionRunning) setH5EnableConfirmOpen(false)
        }}
        onConfirm={handleH5EnableConfirm}
        title={t('settings.general.h5AccessConfirmTitle')}
        body={t('settings.general.h5AccessConfirmBody')}
        confirmLabel={t('settings.general.h5AccessConfirmEnable')}
        cancelLabel={t('common.cancel')}
        confirmVariant="danger"
        loading={h5ActionRunning}
      />
    </div>
  )
}

function serializeAllowedOrigins(origins: string[]) {
  return origins.join(', ')
}

function parseAllowedOriginsDraft(value: string) {
  return value
    .split(/[\n,]/)
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

// ─── Agents Settings ──────────────────────────────────────

const AGENT_COLORS: Record<string, string> = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7',
  pink: '#ec4899',
  cyan: '#06b6d4',
}

const AGENT_SOURCE_ORDER: AgentSource[] = [
  'userSettings',
  'projectSettings',
  'localSettings',
  'policySettings',
  'plugin',
  'flagSettings',
  'built-in',
]

function AgentsSettings() {
  const {
    activeAgents,
    allAgents,
    installLocations,
    isLoading,
    error,
    selectedAgent,
    selectedAgentReturnTab,
    fetchAgents,
    selectAgent,
  } = useAgentStore()
  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const t = useTranslation()

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const currentWorkDir = activeSession?.workDir || undefined

  useEffect(() => {
    void fetchAgents(currentWorkDir)
  }, [fetchAgents, currentWorkDir])

  const groupedAgents = useMemo(() => {
    const groups: Partial<Record<AgentSource, AgentDefinition[]>> = {}
    for (const agent of allAgents) {
      ;(groups[agent.source] ??= []).push(agent)
    }
    return groups
  }, [allAgents])

  const sourceCount = AGENT_SOURCE_ORDER.filter((source) => (groupedAgents[source] ?? []).length > 0).length

  const handleAgentBack = () => {
    const returnTab = selectedAgentReturnTab
    selectAgent(null)
    if (returnTab === 'plugins') {
      useUIStore.getState().setPendingSettingsTab('plugins')
    }
  }

  if (selectedAgent) {
    return (
      <div className="w-full min-w-0">
        <AgentDetailView agent={selectedAgent} onBack={handleAgentBack} />
      </div>
    )
  }

  return (
    <div className="w-full min-w-0">
      {allAgents.length === 0 && (
        <CuratedCapabilitiesPanel
          kind="agents"
          onChanged={() => fetchAgents(currentWorkDir)}
        />
      )}
      {isLoading && allAgents.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-5 h-5 border-2 border-[var(--color-brand)] border-t-transparent rounded-full" />
        </div>
      ) : error ? (
        <div className="text-center py-12 px-4">
          <span className="material-symbols-outlined text-[40px] text-[var(--color-error)] mb-3 block">error_outline</span>
          <p className="text-sm text-[var(--color-error)] mb-2">{error}</p>
          <button
            onClick={() => void fetchAgents(currentWorkDir)}
            className="text-xs text-[var(--color-text-accent)] hover:underline"
          >
            {t('common.retry')}
          </button>
        </div>
      ) : allAgents.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-container-low)]">
          <span className="material-symbols-outlined text-[40px] text-[var(--color-text-tertiary)] mb-3 block">smart_toy</span>
          <p className="text-sm text-[var(--color-text-secondary)] mb-1">{t('settings.agents.empty')}</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">{t('settings.agents.emptyHint')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 min-w-0">
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] overflow-hidden">
            <div className="grid gap-4 px-5 py-5 min-w-0 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] xl:items-end">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-tertiary)] mb-2">
                  {t('settings.agents.browserEyebrow')}
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="material-symbols-outlined text-[22px] text-[var(--color-brand)]">
                    smart_toy
                  </span>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {t('settings.agents.browserTitle')}
                  </h3>
                </div>
                <p className="text-sm leading-6 text-[var(--color-text-secondary)] max-w-3xl">
                  {t('settings.agents.description')}
                </p>
                <InstallLocationSummary locations={installLocations} />
              </div>

              <div className="grid grid-cols-2 gap-3 min-w-0 sm:grid-cols-3">
                <SummaryCard
                  label={t('settings.agents.summary.totalAgents')}
                  value={String(allAgents.length)}
                  icon="smart_toy"
                />
                <SummaryCard
                  label={t('settings.agents.summary.activeAgents')}
                  value={String(activeAgents.length)}
                  icon="bolt"
                />
                <SummaryCard
                  label={t('settings.agents.summary.sources')}
                  value={String(sourceCount)}
                  icon="layers"
                  className="col-span-2 sm:col-span-1"
                />
              </div>
            </div>
          </section>

          <CuratedCapabilitiesPanel
            kind="agents"
            onChanged={() => fetchAgents(currentWorkDir)}
          />

          <div className={`grid gap-4 ${sourceCount >= 2 ? 'xl:grid-cols-2' : ''}`}>
            {AGENT_SOURCE_ORDER.map((source) => {
              const group = groupedAgents[source]
              if (!group?.length) return null

              const sourceLabel = t(`settings.agents.source.${source}`)
              return (
                <section
                  key={source}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden min-w-0"
                >
                  <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-container-low)]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${getAgentSourceAccentClass(source)}`}>
                          <span className="material-symbols-outlined text-[16px]">
                            {getAgentSourceIcon(source)}
                          </span>
                        </span>
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {sourceLabel}
                        </h4>
                        <span className="text-xs text-[var(--color-text-tertiary)]">
                          {group.length}
                        </span>
                      </div>
                      <p className="text-xs leading-5 text-[var(--color-text-tertiary)]">
                        {t('settings.agents.groupHint', {
                          source: sourceLabel,
                          count: String(group.length),
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col p-2">
                    {group.map((agent) => (
                      <button
                        key={`${agent.source}-${agent.agentType}`}
                        onClick={() => selectAgent(agent, 'agents')}
                        className="group rounded-xl border border-transparent px-3 py-3 text-left transition-all hover:border-[var(--color-border-focus)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center"
                            style={{ color: getAgentDotColor(agent.color) }}
                          >
                            <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-[var(--color-text-primary)] break-all">
                                {agent.agentType}
                              </span>
                              {agent.modelDisplay && (
                                <MetaPill>{agent.modelDisplay}</MetaPill>
                              )}
                              <MetaPill>{sourceLabel}</MetaPill>
                              <MetaPill>
                                {agent.isActive
                                  ? t('settings.agents.status.active')
                                  : t('settings.agents.status.available')}
                              </MetaPill>
                              {agent.overriddenBy && (
                                <MetaPill>
                                  {t('settings.agents.overriddenBy', {
                                    source: t(`settings.agents.source.${agent.overriddenBy}`),
                                  })}
                                </MetaPill>
                              )}
                            </div>
                            <div className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)] break-words [&_.prose]:text-xs [&_.prose]:leading-5 [&_.prose]:text-[var(--color-text-secondary)]">
                              <MarkdownRenderer
                                content={agent.description || t('settings.agents.noDescription')}
                              />
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--color-text-tertiary)]">
                              <span>
                                {agent.tools?.length
                                  ? t('settings.agents.toolCount', { count: String(agent.tools.length) })
                                  : t('settings.agents.noTools')}
                              </span>
                              {agent.baseDir && (
                                <span className="break-all">{agent.baseDir}</span>
                              )}
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-[18px] text-[var(--color-text-tertiary)] opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100">
                            chevron_right
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function AgentDetailView({ agent, onBack }: { agent: AgentDefinition; onBack: () => void }) {
  const t = useTranslation()
  const sourceLabel = t(`settings.agents.source.${agent.source}`)

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 min-w-0">
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          {t('settings.agents.backToList')}
        </button>
      </div>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] overflow-hidden">
        <div className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)] lg:items-start">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-tertiary)] mb-2">
              {t('settings.agents.entryEyebrow')}
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className="h-3 w-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: getAgentDotColor(agent.color) }}
              />
              <h3 className="text-[22px] font-semibold leading-tight text-[var(--color-text-primary)] break-all">
                {agent.agentType}
              </h3>
              <MetaPill>{sourceLabel}</MetaPill>
              {agent.modelDisplay && <MetaPill>{agent.modelDisplay}</MetaPill>}
              <MetaPill>
                {agent.isActive
                  ? t('settings.agents.status.active')
                  : t('settings.agents.status.available')}
              </MetaPill>
              {agent.overriddenBy && (
                <MetaPill>
                  {t('settings.agents.overriddenByShort', {
                    source: t(`settings.agents.source.${agent.overriddenBy}`),
                  })}
                </MetaPill>
              )}
            </div>
            <div className="max-w-4xl text-sm leading-6 text-[var(--color-text-secondary)]">
              <MarkdownRenderer
                content={agent.description || t('settings.agents.noDescription')}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--color-text-tertiary)]">
              <span>
                {agent.tools?.length
                  ? t('settings.agents.toolCount', { count: String(agent.tools.length) })
                  : t('settings.agents.noTools')}
              </span>
              {agent.baseDir && <span className="break-all">{agent.baseDir}</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            <DetailStat
              label={t('settings.agents.summary.source')}
              value={sourceLabel}
              icon="layers"
            />
            <DetailStat
              label={t('settings.agents.summary.model')}
              value={agent.modelDisplay || '—'}
              icon="psychology"
            />
            <DetailStat
              label={t('settings.agents.summary.tools')}
              value={String(agent.tools?.length ?? 0)}
              icon="build"
            />
            <DetailStat
              label={t('settings.agents.summary.status')}
              value={agent.isActive ? t('settings.agents.status.active') : t('settings.agents.status.available')}
              icon="bolt"
            />
          </div>
        </div>
      </section>

      {agent.tools && agent.tools.length > 0 && (
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[18px] text-[var(--color-text-tertiary)]">
              build
            </span>
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t('settings.agents.tools')}
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {agent.tools.map((tool) => (
              <MetaPill key={tool}>{tool}</MetaPill>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-1 min-h-0 min-w-0 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-[var(--color-text-secondary)] break-all">
                  {agent.baseDir || sourceLabel}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                {t('settings.agents.promptHint')}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[var(--color-surface)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] border border-[var(--color-border)]">
                {t('settings.agents.systemPrompt')}
              </span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--color-surface-container-lowest)]">
            {agent.systemPrompt ? (
              <div className="px-6 py-5 lg:px-8">
                <MarkdownRenderer
                  content={agent.systemPrompt}
                  variant="document"
                  className="mx-auto max-w-[72ch]"
                />
              </div>
            ) : (
              <div className="px-6 py-10 text-center">
                <span className="material-symbols-outlined text-[32px] text-[var(--color-text-tertiary)] mb-2 block">
                  article
                </span>
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  {t('settings.agents.noSystemPrompt')}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function getAgentDotColor(color?: string) {
  return color && AGENT_COLORS[color] ? AGENT_COLORS[color] : 'var(--color-text-tertiary)'
}

function getAgentSourceIcon(source: AgentSource) {
  switch (source) {
    case 'userSettings':
      return 'person'
    case 'projectSettings':
      return 'folder'
    case 'localSettings':
      return 'folder_lock'
    case 'policySettings':
      return 'shield'
    case 'plugin':
      return 'extension'
    case 'flagSettings':
      return 'terminal'
    case 'built-in':
      return 'inventory_2'
  }
}

function getAgentSourceAccentClass(source: AgentSource) {
  switch (source) {
    case 'userSettings':
      return 'bg-[var(--color-primary-fixed)] text-[var(--color-brand)]'
    case 'projectSettings':
      return 'bg-[var(--color-success-container)] text-[var(--color-success)]'
    case 'localSettings':
      return 'bg-[var(--color-info-container)] text-[var(--color-info)]'
    case 'policySettings':
      return 'bg-[var(--color-warning-container)] text-[var(--color-warning)]'
    case 'plugin':
      return 'bg-[var(--color-warning-container)] text-[var(--color-warning)]'
    case 'flagSettings':
      return 'bg-[var(--color-error)]/10 text-[var(--color-error)]'
    case 'built-in':
      return 'bg-[var(--color-surface-container-high)] text-[var(--color-text-tertiary)]'
  }
}

function MetaPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
      {children}
    </span>
  )
}

function SummaryCard({
  label,
  value,
  icon,
  className = '',
}: {
  label: string
  value: string
  icon: string
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 min-w-0 ${className}`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] min-w-0">
        <span className="material-symbols-outlined text-[14px] flex-shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 text-lg font-semibold text-[var(--color-text-primary)] truncate">
        {value}
      </div>
    </div>
  )
}

function DetailStat({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: string
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
        <span className="material-symbols-outlined text-[14px]">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-2 text-base font-semibold text-[var(--color-text-primary)] break-all">
        {value}
      </div>
    </div>
  )
}
// ─── Skill Settings ──────────────────────────────────────

function SkillSettings() {
  const selectedSkill = useSkillStore((s) => s.selectedSkill)
  const t = useTranslation()

  if (selectedSkill) {
    return (
      <div className="w-full min-w-0">
        <SkillDetail />
      </div>
    )
  }

  return (
    <div className="w-full min-w-0">
      <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
        {t('settings.skills.title')}
      </h2>
      <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
        {t('settings.skills.description')}
      </p>
      <SkillList />
    </div>
  )
}

function PluginSettings() {
  const selectedPlugin = usePluginStore((s) => s.selectedPlugin)
  const t = useTranslation()

  if (selectedPlugin) {
    return (
      <div className="w-full min-w-0">
        <PluginDetail />
      </div>
    )
  }

  return (
    <div className="w-full min-w-0">
      <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
        {t('settings.plugins.title')}
      </h2>
      <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
        {t('settings.plugins.description')}
      </p>
      <PluginList />
    </div>
  )
}

// ─── About Settings ──────────────────────────────────────

const APP_NAME = 'Gaster Code'
const APP_LOGO_PATH = '/app-icon.svg'
const GITHUB_REPO = 'https://github.com/HereditaryDog/gaster-code'
const GITHUB_ISSUES = `${GITHUB_REPO}/issues`
const GITHUB_RELEASES = `${GITHUB_REPO}/releases`
const AUTHORS = [
  { name: 'HereditaryDog', github: 'https://github.com/HereditaryDog' },
  { name: 'Till3005', github: 'https://github.com/Till3005' },
  { name: 'jackkkkswwk', github: 'https://github.com/jackkkkswwk' },
]
const ORIGINAL_PROJECT_REPO = 'https://github.com/NanmiCoder/cc-haha'
const ORIGINAL_PROJECT_LABEL = 'NanmiCoder/cc-haha'

function isValidUpdateProxyUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function AboutSettings() {
  const t = useTranslation()
  const [version, setVersion] = useState('')
  const updateProxy = useSettingsStore((s) => s.updateProxy)
  const setUpdateProxy = useSettingsStore((s) => s.setUpdateProxy)
  const updateStatus = useUpdateStore((s) => s.status)
  const availableVersion = useUpdateStore((s) => s.availableVersion)
  const releaseNotes = useUpdateStore((s) => s.releaseNotes)
  const progressPercent = useUpdateStore((s) => s.progressPercent)
  const downloadedBytes = useUpdateStore((s) => s.downloadedBytes)
  const totalBytes = useUpdateStore((s) => s.totalBytes)
  const error = useUpdateStore((s) => s.error)
  const checkedAt = useUpdateStore((s) => s.checkedAt)
  const checkForUpdates = useUpdateStore((s) => s.checkForUpdates)
  const installUpdate = useUpdateStore((s) => s.installUpdate)
  const initialize = useUpdateStore((s) => s.initialize)
  const [showUpdateProxyAdvanced, setShowUpdateProxyAdvanced] = useState(false)
  const [updateProxyDraft, setUpdateProxyDraft] = useState(updateProxy)
  const [updateProxySaveError, setUpdateProxySaveError] = useState<string | null>(null)
  const [isSavingUpdateProxy, setIsSavingUpdateProxy] = useState(false)

  useEffect(() => {
    let cancelled = false

    import('@tauri-apps/api/app')
      .then((mod) => mod.getVersion())
      .then((value) => {
        if (!cancelled) setVersion(value)
      })
      .catch(() => {
        if (!cancelled) setVersion(GASTER_CODE_VERSION)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    setUpdateProxyDraft(updateProxy)
    setUpdateProxySaveError(null)
  }, [updateProxy])

  const openUrl = (url: string) => {
    import('@tauri-apps/plugin-shell').then((mod) => mod.open(url)).catch(() => window.open(url, '_blank'))
  }

  const checkedAtText =
    checkedAt
      ? new Date(checkedAt).toLocaleString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          month: 'short',
          day: 'numeric',
        })
      : null
  const updateProxyModes: Array<{ value: UpdateProxyMode; label: string; description: string }> = [
    {
      value: 'system',
      label: t('update.proxyModeSystem'),
      description: t('update.proxyModeSystemDescription'),
    },
    {
      value: 'manual',
      label: t('update.proxyModeManual'),
      description: t('update.proxyModeManualDescription'),
    },
  ]
  const manualProxyUrl = updateProxyDraft.url.trim()
  const manualProxyError =
    updateProxyDraft.mode === 'manual' && !manualProxyUrl
      ? t('update.proxyUrlRequired')
      : updateProxyDraft.mode === 'manual' && !isValidUpdateProxyUrl(manualProxyUrl)
        ? t('update.proxyUrlInvalid')
        : null
  const updateProxyDirty =
    updateProxyDraft.mode !== updateProxy.mode ||
    updateProxyDraft.url.trim() !== updateProxy.url.trim()

  const saveUpdateProxy = async () => {
    if (manualProxyError) {
      setUpdateProxySaveError(manualProxyError)
      return
    }

    setIsSavingUpdateProxy(true)
    setUpdateProxySaveError(null)
    try {
      await setUpdateProxy({
        mode: updateProxyDraft.mode,
        url: manualProxyUrl,
      })
    } catch (error) {
      setUpdateProxySaveError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsSavingUpdateProxy(false)
    }
  }

  const hasKnownProgress = typeof totalBytes === 'number' && totalBytes > 0
  const downloadedText = formatBytes(downloadedBytes)
  const updateDescription =
    updateStatus === 'checking'
      ? t('update.checking')
      : updateStatus === 'downloading'
        ? hasKnownProgress
          ? t('update.progress', { progress: String(progressPercent) })
          : t('update.progressBytes', { downloaded: downloadedText })
        : updateStatus === 'restarting'
          ? t('update.restarting')
          : updateStatus === 'available' && availableVersion
            ? t('update.newVersion', { version: availableVersion })
            : updateStatus === 'up-to-date'
              ? t('update.upToDate', { version: version || t('update.currentVersionUnknown') })
              : error
                ? t('update.failed', { error })
                : t('update.idle')

  return (
    <div className="w-full min-w-0 max-w-lg mx-auto flex flex-col items-center py-6">
      {/* Logo + App Name + Version */}
      <img src={APP_LOGO_PATH} alt={APP_NAME} className="hero-brand-logo w-20 h-20 mb-4" />
      <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{APP_NAME}</h1>
      {version && (
        <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
          <span>{t('settings.about.version')} {version}</span>
          <span className="text-[var(--color-border)]">·</span>
          <button
            onClick={() => openUrl(GITHUB_RELEASES)}
            className="rounded-[var(--radius-sm)] text-[var(--color-text-accent)] transition-colors hover:text-[var(--color-brand)] focus:outline-none focus:shadow-[var(--shadow-focus-ring)]"
          >
            {t('settings.about.changelog')}
          </button>
        </div>
      )}

      {/* GitHub Repo */}
      <div className="mt-6 w-full">
        <button
          onClick={() => openUrl(GITHUB_REPO)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
        >
          <img src="/icons/github.svg" alt="GitHub" className="w-5 h-5 opacity-70" />
          <div className="flex-1 text-left">
            <div className="text-sm font-medium text-[var(--color-text-primary)]">HereditaryDog/gaster-code</div>
            <div className="text-xs text-[var(--color-text-tertiary)]">{t('settings.about.starHint')}</div>
          </div>
        </button>
      </div>

      <div className="mt-4 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-[var(--color-text-primary)]">{t('settings.about.updates')}</div>
            <div className="text-xs text-[var(--color-text-tertiary)] mt-1">
              {t('settings.about.updatesDesc')}
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void checkForUpdates()}
            loading={updateStatus === 'checking'}
          >
            {t('update.checkNow')}
          </Button>
        </div>

        <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                {t('settings.about.version')}
              </div>
              <div className="text-sm font-medium text-[var(--color-text-primary)] mt-1">
                {version || t('update.currentVersionUnknown')}
              </div>
            </div>

            {availableVersion && (
              <div className="text-right">
                <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                  {t('update.availableLabel')}
                </div>
                <div className="text-sm font-medium text-[var(--color-text-primary)] mt-1">
                  {availableVersion}
                </div>
              </div>
            )}
          </div>

          <p className={`mt-3 text-sm ${error ? 'text-[var(--color-error)]' : 'text-[var(--color-text-secondary)]'}`}>
            {updateDescription}
          </p>

          {checkedAtText && (
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
              {t('update.checkedAt', { time: checkedAtText })}
            </p>
          )}

          <div className="mt-3 border-t border-[var(--color-border)]/60 pt-3">
            <button
              type="button"
              onClick={() => setShowUpdateProxyAdvanced((value) => !value)}
              className="flex w-full items-center justify-between gap-3 rounded-md text-left text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]"
              aria-expanded={showUpdateProxyAdvanced}
            >
              <span>{t('update.proxyAdvanced')}</span>
              <span className="material-symbols-outlined text-[18px]">
                {showUpdateProxyAdvanced ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {showUpdateProxyAdvanced && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {updateProxyModes.map((mode) => (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => {
                        setUpdateProxyDraft((current) => ({ ...current, mode: mode.value }))
                        setUpdateProxySaveError(null)
                      }}
                      aria-pressed={updateProxyDraft.mode === mode.value}
                      className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                        updateProxyDraft.mode === mode.value
                          ? 'border-[var(--color-brand)] bg-[var(--color-surface-selected)] text-[var(--color-text-primary)]'
                          : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                      }`}
                    >
                      <div className="text-xs font-semibold">{mode.label}</div>
                      <div className="mt-1 text-[11px] leading-4 text-[var(--color-text-tertiary)]">
                        {mode.description}
                      </div>
                    </button>
                  ))}
                </div>

                {updateProxyDraft.mode === 'manual' && (
                  <div>
                    <Input
                      id="update-proxy-url"
                      label={t('update.proxyUrl')}
                      value={updateProxyDraft.url}
                      placeholder="http://127.0.0.1:7890"
                      autoComplete="off"
                      onChange={(event) => {
                        setUpdateProxyDraft((current) => ({ ...current, url: event.target.value }))
                        setUpdateProxySaveError(null)
                      }}
                    />
                    <p className={`mt-1 text-[11px] leading-4 ${manualProxyError ? 'text-[var(--color-error)]' : 'text-[var(--color-text-tertiary)]'}`}>
                      {manualProxyError ?? t('update.proxyUrlHint')}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 text-[11px] leading-4 text-[var(--color-text-tertiary)]">
                    {t('update.proxyScopeHint')}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="min-w-[72px] px-4 whitespace-nowrap"
                    disabled={!updateProxyDirty || !!manualProxyError || isSavingUpdateProxy}
                    loading={isSavingUpdateProxy}
                    onClick={() => void saveUpdateProxy()}
                  >
                    {t('update.proxySave')}
                  </Button>
                </div>

                {updateProxySaveError && (
                  <p className="text-[11px] leading-4 text-[var(--color-error)]">
                    {updateProxySaveError}
                  </p>
                )}
              </div>
            )}
          </div>

          {(updateStatus === 'downloading' || updateStatus === 'restarting') && (
            <div className="mt-3">
              <div className="h-1.5 bg-[var(--color-surface-container-low)] rounded-full overflow-hidden">
                {hasKnownProgress || updateStatus === 'restarting' ? (
                  <div
                    className="h-full bg-[var(--color-text-accent)] transition-all duration-300"
                    style={{ width: `${Math.min(progressPercent, 100)}%` }}
                  />
                ) : (
                  <div className="h-full w-1/3 rounded-full bg-[var(--color-text-accent)]/75 animate-pulse" />
                )}
              </div>
              {!hasKnownProgress && updateStatus === 'downloading' && downloadedBytes > 0 && (
                <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                  {downloadedText}
                </p>
              )}
            </div>
          )}

          {releaseNotes && availableVersion && (
            <div className="mt-3 rounded-lg bg-[var(--color-surface-container-low)] px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                {t('update.releaseNotes')}
              </div>
              <MarkdownRenderer
                content={releaseNotes}
                variant="document"
                className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)] [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_p]:text-[13px] [&_p]:leading-6"
              />
            </div>
          )}

          {availableVersion && (
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                onClick={() => void installUpdate()}
                loading={updateStatus === 'downloading' || updateStatus === 'restarting'}
                disabled={updateStatus === 'checking'}
              >
                {updateStatus === 'restarting' ? t('update.restarting') : t('update.now')}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="w-full border-t border-[var(--color-border)]/40 my-6" />

      {/* Author */}
      <div className="w-full">
        <h3 className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">{t('settings.about.author')}</h3>
        <div className="space-y-1">
          {AUTHORS.map((author) => (
            <button
              key={author.github}
              onClick={() => openUrl(author.github)}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
            >
              <img src="/icons/github.svg" alt="GitHub" className="w-4 h-4 opacity-60" />
              <span className="text-sm text-[var(--color-text-primary)]">{author.name}</span>
              <span className="text-xs text-[var(--color-text-tertiary)] ml-auto">GitHub</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined mt-0.5 text-[20px] text-[var(--color-text-tertiary)]">auto_awesome</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-[var(--color-text-primary)]">
              {t('settings.about.originalProject')}
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-tertiary)]">
              {t('settings.about.originalProjectDesc')}
            </p>
            <button
              type="button"
              onClick={() => openUrl(ORIGINAL_PROJECT_REPO)}
              className="mt-2 rounded-[var(--radius-sm)] text-xs font-medium text-[var(--color-text-accent)] transition-colors hover:text-[var(--color-brand)] focus:outline-none focus:shadow-[var(--shadow-focus-ring)]"
            >
              {ORIGINAL_PROJECT_LABEL}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 w-full">
        <button
          onClick={() => openUrl(GITHUB_ISSUES)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px] text-[var(--color-text-tertiary)]">feedback</span>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium text-[var(--color-text-primary)]">{t('settings.about.feedback')}</div>
            <div className="text-xs text-[var(--color-text-tertiary)]">{t('settings.about.feedbackDesc')}</div>
          </div>
        </button>
      </div>
    </div>
  )
}
