import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'

import { Settings } from '../pages/Settings'
import { useSettingsStore } from '../stores/settingsStore'
import { useUIStore } from '../stores/uiStore'
import { useUpdateStore } from '../stores/updateStore'
import { useGMasterAuthStore } from '../stores/gmasterAuthStore'
import type { SavedProvider } from '../types/provider'
import type { ProviderPreset } from '../types/providerPreset'
import type { ThemeMode, UpdateProxySettings } from '../types/settings'

const MOCK_DELETE_PROVIDER = vi.fn()
const MOCK_GET_SETTINGS = vi.fn()
const MOCK_UPDATE_SETTINGS = vi.fn()
const desktopNotificationsMock = vi.hoisted(() => ({
  getDesktopNotificationPermission: vi.fn(),
  notifyDesktop: vi.fn(),
  requestDesktopNotificationPermission: vi.fn(),
  openDesktopNotificationSettings: vi.fn(),
}))
const providerStoreState = {
  providers: [] as SavedProvider[],
  activeId: null as string | null,
  hasLoadedProviders: true,
  presets: [] as ProviderPreset[],
  isLoading: false,
  isPresetsLoading: false,
  fetchProviders: vi.fn(),
  fetchPresets: vi.fn(),
  deleteProvider: MOCK_DELETE_PROVIDER,
  activateProvider: vi.fn(),
  activateOfficial: vi.fn(),
  testProvider: vi.fn(),
  createProvider: vi.fn(),
  updateProvider: vi.fn(),
  testConfig: vi.fn(),
}

vi.mock('../api/agents', () => ({
  agentsApi: {
    list: vi.fn().mockResolvedValue({ activeAgents: [], allAgents: [] }),
  },
}))

vi.mock('../stores/providerStore', () => ({
  useProviderStore: () => providerStoreState,
}))

vi.mock('../api/providers', () => ({
  providersApi: {
    getSettings: MOCK_GET_SETTINGS,
    updateSettings: MOCK_UPDATE_SETTINGS,
  },
}))

vi.mock('../lib/desktopNotifications', () => desktopNotificationsMock)

vi.mock('../components/settings/ClaudeOfficialLogin', () => ({
  ClaudeOfficialLogin: () => <div data-testid="claude-official-login" />,
}))

vi.mock('../pages/AdapterSettings', () => ({
  AdapterSettings: () => <div>Adapter Settings Mock</div>,
}))

vi.mock('../stores/agentStore', () => ({
  useAgentStore: () => ({
    activeAgents: [],
    allAgents: [],
    isLoading: false,
    error: null,
    selectedAgent: null,
    fetchAgents: vi.fn(),
    selectAgent: vi.fn(),
  }),
}))

vi.mock('../stores/skillStore', () => ({
  useSkillStore: () => ({
    skills: [],
    selectedSkill: null,
    isLoading: false,
    isDetailLoading: false,
    error: null,
    fetchSkills: vi.fn(),
    fetchSkillDetail: vi.fn(),
    clearSelection: vi.fn(),
  }),
}))

vi.mock('../components/chat/CodeViewer', () => ({
  CodeViewer: ({ code }: { code: string }) => <pre data-testid="code-viewer">{code}</pre>,
}))

vi.mock('../version', () => ({
  GASTER_CODE_VERSION: 'test-gaster-version',
  GASTER_CODE_DISPLAY_VERSION: 'V test-gaster-version',
}))

describe('Settings > General tab', () => {
  beforeEach(() => {
    MOCK_DELETE_PROVIDER.mockReset()
    desktopNotificationsMock.getDesktopNotificationPermission.mockReset()
    desktopNotificationsMock.notifyDesktop.mockReset()
    desktopNotificationsMock.requestDesktopNotificationPermission.mockReset()
    desktopNotificationsMock.openDesktopNotificationSettings.mockReset()
    desktopNotificationsMock.getDesktopNotificationPermission.mockResolvedValue('default')
    desktopNotificationsMock.notifyDesktop.mockResolvedValue(true)
    desktopNotificationsMock.requestDesktopNotificationPermission.mockResolvedValue('granted')
    desktopNotificationsMock.openDesktopNotificationSettings.mockResolvedValue(true)
    MOCK_GET_SETTINGS.mockResolvedValue({})
    MOCK_UPDATE_SETTINGS.mockResolvedValue({})
    providerStoreState.providers = []
    providerStoreState.activeId = null
    providerStoreState.hasLoadedProviders = true
    providerStoreState.presets = []
    providerStoreState.isLoading = false
    providerStoreState.isPresetsLoading = false
    providerStoreState.fetchProviders = vi.fn()
    providerStoreState.fetchPresets = vi.fn()
    providerStoreState.activateProvider = vi.fn()
    providerStoreState.activateOfficial = vi.fn()
    providerStoreState.testProvider = vi.fn()
    providerStoreState.createProvider = vi.fn()
    providerStoreState.updateProvider = vi.fn()
    providerStoreState.testConfig = vi.fn()

    useSettingsStore.setState({
      locale: 'en',
      theme: 'light',
      thinkingEnabled: true,
      skipWebFetchPreflight: true,
      desktopNotificationsEnabled: true,
      uiZoom: 1,
      webSearch: { mode: 'auto', tavilyApiKey: '', braveApiKey: '' },
      setThinkingEnabled: vi.fn().mockImplementation(async (enabled: boolean) => {
        useSettingsStore.setState({ thinkingEnabled: enabled })
      }),
      setTheme: vi.fn().mockImplementation(async (theme: ThemeMode) => {
        useSettingsStore.setState({ theme })
      }),
      setSkipWebFetchPreflight: vi.fn().mockImplementation(async (enabled: boolean) => {
        useSettingsStore.setState({ skipWebFetchPreflight: enabled })
      }),
      setDesktopNotificationsEnabled: vi.fn().mockImplementation(async (enabled: boolean) => {
        useSettingsStore.setState({ desktopNotificationsEnabled: enabled })
      }),
      setUiZoom: vi.fn().mockImplementation((uiZoom: number) => {
        useSettingsStore.setState({ uiZoom })
      }),
      setWebSearch: vi.fn().mockImplementation(async (webSearch) => {
        useSettingsStore.setState({ webSearch })
      }),
      h5Access: {
        enabled: false,
        tokenPreview: null,
        allowedOrigins: [],
        publicBaseUrl: null,
      },
      h5AccessError: null,
      enableH5Access: vi.fn().mockImplementation(async () => {
        useSettingsStore.setState({
          h5Access: {
            enabled: true,
            tokenPreview: 'h5_1234...',
            allowedOrigins: [],
            publicBaseUrl: 'http://192.168.1.10:3456',
          },
        })
        return 'h5_1234567890'
      }),
      disableH5Access: vi.fn().mockImplementation(async () => {
        useSettingsStore.setState({
          h5Access: {
            enabled: false,
            tokenPreview: null,
            allowedOrigins: [],
            publicBaseUrl: null,
          },
        })
      }),
      regenerateH5AccessToken: vi.fn().mockImplementation(async () => 'h5_regenerated'),
      updateH5AccessSettings: vi.fn().mockImplementation(async ({ publicBaseUrl, allowedOrigins }) => {
        const current = useSettingsStore.getState().h5Access
        useSettingsStore.setState({
          h5Access: {
            ...current,
            publicBaseUrl: publicBaseUrl ?? null,
            allowedOrigins: allowedOrigins ?? current.allowedOrigins,
          },
        })
      }),
    })

    useUIStore.setState({ pendingSettingsTab: null })
    useUpdateStore.setState({
      status: 'idle',
      availableVersion: null,
      releaseNotes: null,
      progressPercent: 0,
      downloadedBytes: 0,
      totalBytes: null,
      error: null,
      checkedAt: null,
      shouldPrompt: false,
      initialize: vi.fn().mockResolvedValue(undefined),
      checkForUpdates: vi.fn().mockResolvedValue(null),
      installUpdate: vi.fn().mockResolvedValue(undefined),
      dismissPrompt: vi.fn(),
    })
  })

  it('shows WebFetch preflight toggle enabled by default', () => {
    render(<Settings />)

    fireEvent.click(screen.getByText('General'))

    const toggle = screen.getByLabelText('Skip WebFetch domain preflight')
    expect(toggle).toBeChecked()
  })

  it('lets the user disable WebFetch preflight skipping', () => {
    render(<Settings />)

    fireEvent.click(screen.getByText('General'))

    const toggle = screen.getByLabelText('Skip WebFetch domain preflight')
    fireEvent.click(toggle)

    expect(useSettingsStore.getState().setSkipWebFetchPreflight).toHaveBeenCalledWith(false)
  })

  it('offers the pure white appearance theme', () => {
    render(<Settings />)

    fireEvent.click(screen.getByText('General'))
    fireEvent.click(screen.getByRole('button', { name: 'Pure White' }))

    expect(useSettingsStore.getState().setTheme).toHaveBeenCalledWith('white')
  })

  it('marks the pure white appearance theme as selected', () => {
    useSettingsStore.setState({ theme: 'white' })
    render(<Settings />)

    fireEvent.click(screen.getByText('General'))

    expect(screen.getByRole('button', { name: 'Pure White' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Warm Classic' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('lets the user disable thinking mode for new sessions', () => {
    render(<Settings />)

    fireEvent.click(screen.getByText('General'))

    const toggle = screen.getByLabelText('Enable thinking mode')
    expect(toggle).toBeChecked()
    fireEvent.click(toggle)

    expect(useSettingsStore.getState().setThinkingEnabled).toHaveBeenCalledWith(false)
  })

  it('lets the user disable desktop system notifications', () => {
    render(<Settings />)

    fireEvent.click(screen.getByText('General'))

    const toggle = screen.getByLabelText('Enable system notifications')
    expect(toggle).toBeChecked()
    fireEvent.click(toggle)

    expect(useSettingsStore.getState().setDesktopNotificationsEnabled).toHaveBeenCalledWith(false)
    expect(desktopNotificationsMock.requestDesktopNotificationPermission).not.toHaveBeenCalled()
  })

  it('requests native notification permission when desktop notifications are enabled', async () => {
    useSettingsStore.setState({ desktopNotificationsEnabled: false })
    render(<Settings />)

    fireEvent.click(screen.getByText('General'))
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Enable system notifications'))
    })

    expect(useSettingsStore.getState().setDesktopNotificationsEnabled).toHaveBeenCalledWith(true)
    await vi.waitFor(() => {
      expect(desktopNotificationsMock.requestDesktopNotificationPermission).toHaveBeenCalledTimes(1)
    })
    expect(desktopNotificationsMock.notifyDesktop).toHaveBeenCalledWith({
      title: 'Gaster Code notifications are enabled',
      body: 'Permission prompts and completed agent replies will now use system notifications.',
    })
  })

  it('opens system settings when enabling notifications finds system denial', async () => {
    useSettingsStore.setState({ desktopNotificationsEnabled: false })
    desktopNotificationsMock.requestDesktopNotificationPermission.mockResolvedValue('denied')
    render(<Settings />)

    fireEvent.click(screen.getByText('General'))
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Enable system notifications'))
    })

    await vi.waitFor(() => {
      expect(desktopNotificationsMock.openDesktopNotificationSettings).toHaveBeenCalledTimes(1)
    })
  })

  it('lets the user adjust and reset UI zoom', () => {
    render(<Settings />)

    fireEvent.click(screen.getByText('General'))

    const slider = screen.getByLabelText('UI Zoom')
    fireEvent.change(slider, { target: { value: '1.25' } })

    expect(useSettingsStore.getState().setUiZoom).toHaveBeenCalledWith(1.25)

    fireEvent.click(screen.getByRole('button', { name: 'Reset UI zoom to 100%' }))

    expect(useSettingsStore.getState().setUiZoom).toHaveBeenLastCalledWith(1)
  })

  it('saves WebSearch fallback provider settings', () => {
    render(<Settings />)

    fireEvent.click(screen.getByText('General'))

    fireEvent.click(screen.getByRole('button', { name: 'Tavily' }))
    fireEvent.change(screen.getByLabelText('Tavily API key'), {
      target: { value: 'tvly-test-key' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(useSettingsStore.getState().setWebSearch).toHaveBeenCalledWith({
      mode: 'tavily',
      tavilyApiKey: 'tvly-test-key',
      braveApiKey: '',
    })
  })

  it('links to WebSearch provider API key dashboards', () => {
    render(<Settings />)

    fireEvent.click(screen.getByText('General'))

    expect(screen.getByRole('link', { name: 'Get Tavily API key' })).toHaveAttribute(
      'href',
      'https://app.tavily.com/home',
    )
    expect(screen.getByRole('link', { name: 'Get Brave Search API key' })).toHaveAttribute(
      'href',
      'https://api-dashboard.search.brave.com/app/keys',
    )
  })

  it('keeps extension tabs available alongside the terminal tab', () => {
    render(<Settings />)

    expect(screen.queryByText('Install')).not.toBeInTheDocument()
    expect(screen.getByText('Terminal')).toBeInTheDocument()
    expect(screen.getByText('MCP')).toBeInTheDocument()
    expect(screen.getByText('Plugins')).toBeInTheDocument()
  })

  it('moves H5 access into a dedicated tab with confirmation before enabling', async () => {
    useSettingsStore.setState({
      h5Access: {
        enabled: false,
        tokenPreview: null,
        allowedOrigins: [],
        publicBaseUrl: 'http://192.168.1.10:3456',
      },
    })
    render(<Settings />)

    fireEvent.click(screen.getByText('H5 Access'))

    expect(screen.getByRole('heading', { name: 'H5 Access' })).toBeInTheDocument()
    expect(screen.getByText('Allowed origins')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Allowed origins'), {
      target: { value: 'https://phone.example, https://tablet.example' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save H5 settings' }))
    })

    await vi.waitFor(() => {
      expect(useSettingsStore.getState().updateH5AccessSettings).toHaveBeenCalledWith({
        publicBaseUrl: 'http://192.168.1.10:3456',
        allowedOrigins: ['https://phone.example', 'https://tablet.example'],
      })
    })

    fireEvent.click(screen.getByLabelText('Enable H5 access'))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Enable and generate token' }))
    })

    await vi.waitFor(() => {
      expect(useSettingsStore.getState().enableH5Access).toHaveBeenCalledTimes(1)
    })
    expect(await screen.findByText(/serverUrl=/)).toBeInTheDocument()
  })
})

describe('Settings > Providers tab', () => {
  beforeEach(() => {
    MOCK_DELETE_PROVIDER.mockReset()
    MOCK_GET_SETTINGS.mockResolvedValue({})
    MOCK_UPDATE_SETTINGS.mockResolvedValue({})
    useSettingsStore.setState({
      locale: 'en',
      fetchAll: vi.fn().mockResolvedValue(undefined),
    })
    providerStoreState.providers = [
      {
        id: 'provider-1',
        name: 'MiniMax-M2.7-highspeed(openai)',
        presetId: 'custom',
        apiKey: '***',
        baseUrl: 'https://api.minimaxi.com',
        apiFormat: 'openai_chat',
        models: {
          main: 'MiniMax-M2.7-highspeed',
          haiku: '',
          sonnet: '',
          opus: '',
        },
        notes: '',
      },
    ]
    providerStoreState.activeId = null
    providerStoreState.hasLoadedProviders = true
    useGMasterAuthStore.setState({ status: { loggedIn: false }, isPolling: false, isLoading: false, error: null })
  })

  it('keeps the G-Master API official provider visible before sign-in', () => {
    render(<Settings />)

    const panel = screen.getByTestId('official-gmaster-provider-panel')
    expect(within(panel).getByText('G-Master API')).toBeInTheDocument()
    expect(within(panel).getByText('Not signed in')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Test' })).toBeDisabled()
    expect(within(panel).getByRole('button', { name: 'Edit' })).toBeDisabled()
  })

  it('highlights the G-Master API official provider after sign-in even when another provider is default', () => {
    providerStoreState.providers.unshift({
      id: 'managed-gmaster-api',
      name: 'G-Master API',
      presetId: 'gmaster',
      apiKey: '***',
      baseUrl: 'https://gmapi.fun',
      apiFormat: 'anthropic',
      models: {
        main: 'gpt-5.4',
        haiku: 'gpt-5.4-mini',
        sonnet: 'gpt-5.4',
        opus: 'gpt-5.4',
      },
      notes: '',
      managed: { type: 'gmaster' },
    })
    providerStoreState.activeId = 'provider-1'
    useGMasterAuthStore.setState({
      status: {
        loggedIn: true,
        expiresAt: null,
        user: {
          id: 1,
          username: 'gmaster',
          displayName: 'G-Master',
          email: null,
          group: null,
        },
      },
      isPolling: false,
      isLoading: false,
      error: null,
    })

    render(<Settings />)

    const panel = screen.getByTestId('official-gmaster-provider-panel')
    expect(panel.className).toContain('border-[var(--color-brand)]')
    expect(within(panel).getByRole('button', { name: 'Edit' })).not.toBeDisabled()
    expect(within(panel).queryByText('Default')).not.toBeInTheDocument()
  })

  it('does not query official OAuth status before providers finish loading', () => {
    providerStoreState.providers = []
    providerStoreState.activeId = null
    providerStoreState.hasLoadedProviders = false

    render(<Settings />)

    expect(screen.queryByTestId('claude-official-login')).not.toBeInTheDocument()
  })

  it('shows official OAuth status only after official provider is confirmed active', () => {
    providerStoreState.providers = []
    providerStoreState.activeId = null
    providerStoreState.hasLoadedProviders = true

    render(<Settings />)

    expect(screen.getByTestId('claude-official-login')).toBeInTheDocument()
  })

  it('requires confirmation before deleting a provider', async () => {
    render(<Settings />)

    fireEvent.click(screen.getAllByText('Delete')[0]!)

    expect(MOCK_DELETE_PROVIDER).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Delete provider "MiniMax-M2.7-highspeed(openai)"? This cannot be undone.')).toBeInTheDocument()

    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(MOCK_DELETE_PROVIDER).toHaveBeenCalledWith('provider-1')
  })

  it('uses the shared dropdown for API format in the provider form', () => {
    providerStoreState.presets = [
      {
        id: 'custom',
        name: 'Custom',
        baseUrl: 'https://api.example.com/anthropic',
        apiFormat: 'anthropic',
        defaultModels: {
          main: 'custom-main',
          haiku: '',
          sonnet: '',
          opus: '',
        },
        needsApiKey: true,
        websiteUrl: '',
      },
    ]

    render(<Settings />)

    fireEvent.click(screen.getByRole('button', { name: /Add Provider/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: /Anthropic Messages \(native\)/i }))
    fireEvent.click(within(dialog).getByRole('button', { name: /OpenAI Responses API \(proxy\)/i }))

    expect(within(dialog).getByRole('button', { name: /OpenAI Responses API \(proxy\)/i })).toBeInTheDocument()
    expect(within(dialog).getByText('Requests will be translated via the local proxy')).toBeInTheDocument()
  })

  it('normalizes blank model mappings to the main model when saving a provider', async () => {
    providerStoreState.createProvider = vi.fn().mockResolvedValue({
      id: 'provider-new',
      presetId: 'custom',
      name: 'Custom',
      apiKey: 'sk-test',
      baseUrl: 'https://api.example.com/anthropic',
      apiFormat: 'anthropic',
      models: {
        main: 'gpt-5.5',
        haiku: 'gpt-5.5',
        sonnet: 'gpt-5.5',
        opus: 'gpt-5.5',
      },
    })
    providerStoreState.presets = [
      {
        id: 'custom',
        name: 'Custom',
        baseUrl: 'https://api.example.com/anthropic',
        apiFormat: 'anthropic',
        defaultModels: {
          main: '',
          haiku: '',
          sonnet: '',
          opus: '',
        },
        needsApiKey: true,
        websiteUrl: '',
      },
    ]

    render(<Settings />)

    fireEvent.click(screen.getByRole('button', { name: /Add Provider|添加服务商/i }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByPlaceholderText('sk-...'), { target: { value: 'sk-test' } })
    fireEvent.change(within(dialog).getByLabelText(/Main Model|主模型/i), { target: { value: 'gpt-5.5' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /Save|Add|保存|添加/i }))

    await waitFor(() => {
      expect(providerStoreState.createProvider).toHaveBeenCalledWith(expect.objectContaining({
        models: {
          main: 'gpt-5.5',
          haiku: 'gpt-5.5',
          sonnet: 'gpt-5.5',
          opus: 'gpt-5.5',
        },
      }))
    })
  })

  it('hides the API key by default and reveals it from the eye button', () => {
    providerStoreState.presets = [
      {
        id: 'custom',
        name: 'Custom',
        baseUrl: 'https://api.example.com/anthropic',
        apiFormat: 'anthropic',
        defaultModels: {
          main: 'custom-main',
          haiku: '',
          sonnet: '',
          opus: '',
        },
        needsApiKey: true,
        websiteUrl: '',
      },
    ]

    render(<Settings />)

    fireEvent.click(screen.getByRole('button', { name: /Add Provider/i }))

    const dialog = screen.getByRole('dialog')
    const apiKeyInput = within(dialog).getByPlaceholderText('sk-...')

    expect(apiKeyInput).toHaveAttribute('type', 'password')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Show API Key' }))

    expect(apiKeyInput).toHaveAttribute('type', 'text')
    expect(within(dialog).getByRole('button', { name: 'Hide API Key' })).toBeInTheDocument()
  })
})

describe('Settings > About tab', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' })
    useUIStore.setState({ pendingSettingsTab: 'about' })
    useSettingsStore.setState({
      locale: 'en',
      updateProxy: { mode: 'system', url: '' },
      setUpdateProxy: vi.fn().mockImplementation(async (next: UpdateProxySettings) => {
        useSettingsStore.setState({ updateProxy: next })
      }),
    })
    useUpdateStore.setState({
      status: 'available',
      availableVersion: '0.1.5',
      releaseNotes: '# Gaster Code v0.1.5\n\n- Fixed updater rendering\n- Added markdown support',
      progressPercent: 0,
      downloadedBytes: 0,
      totalBytes: null,
      error: null,
      checkedAt: null,
      shouldPrompt: true,
      initialize: vi.fn().mockResolvedValue(undefined),
      checkForUpdates: vi.fn().mockResolvedValue(null),
      installUpdate: vi.fn().mockResolvedValue(undefined),
      dismissPrompt: vi.fn(),
    })
  })

  it('renders release notes with markdown formatting', async () => {
    render(<Settings />)

    expect(await screen.findByRole('heading', { name: 'Gaster Code v0.1.5' })).toBeInTheDocument()
    expect(screen.getByText('Fixed updater rendering')).toBeInTheDocument()
    expect(screen.getByText('Added markdown support')).toBeInTheDocument()
  })

  it('shows Gaster owner info, removes upstream social links, and credits the original project', async () => {
    render(<Settings />)

    const logo = await screen.findByRole('img', { name: 'Gaster Code' })
    expect(logo).toHaveAttribute('src', '/app-icon.svg')
    expect(logo).toHaveClass('hero-brand-logo')

    expect(screen.getByText('HereditaryDog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /HereditaryDog GitHub/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Till3005 GitHub/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /jackkkkswwk GitHub/ })).toBeInTheDocument()
    expect(screen.getByText('Original Project')).toBeInTheDocument()
    expect(screen.getByText('NanmiCoder/cc-haha')).toBeInTheDocument()

    expect(screen.queryByText('程序员阿江-Relakkes')).not.toBeInTheDocument()
    expect(screen.queryByText('Social Media')).not.toBeInTheDocument()
    expect(screen.queryByText('Bilibili')).not.toBeInTheDocument()
    expect(screen.queryByText('Douyin')).not.toBeInTheDocument()
    expect(screen.queryByText('Xiaohongshu')).not.toBeInTheDocument()
  })

  it('uses the bundled version constant when Tauri does not provide a version', async () => {
    render(<Settings />)

    expect(await screen.findByText('Version test-gaster-version')).toBeInTheDocument()
    expect(screen.getByText('test-gaster-version')).toBeInTheDocument()
  })

  it('shows downloaded bytes instead of a fake zero percent when total size is unknown', async () => {
    useUpdateStore.setState({
      status: 'downloading',
      availableVersion: '0.1.5',
      releaseNotes: '# Gaster Code v0.1.5',
      progressPercent: 0,
      downloadedBytes: 1536,
      totalBytes: null,
      error: null,
      checkedAt: null,
      shouldPrompt: true,
      initialize: vi.fn().mockResolvedValue(undefined),
      checkForUpdates: vi.fn().mockResolvedValue(null),
      installUpdate: vi.fn().mockResolvedValue(undefined),
      dismissPrompt: vi.fn(),
    })

    render(<Settings />)

    expect(await screen.findByText('Downloading update... 1.5 KB downloaded')).toBeInTheDocument()
    expect(screen.queryByText('Downloading update... 0%')).not.toBeInTheDocument()
  })

  it('saves a manual update proxy from the advanced update controls', async () => {
    render(<Settings />)

    fireEvent.click(screen.getByRole('button', { name: /Advanced update proxy/i }))
    expect(screen.getByRole('button', { name: /System proxy/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('This only affects app update checks and downloads.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Manual proxy/i }))
    const proxyInput = screen.getByLabelText('Proxy URL')
    const saveButton = screen.getByRole('button', { name: 'Save' })

    expect(screen.getByText('Enter a proxy URL.')).toBeInTheDocument()
    expect(saveButton).toBeDisabled()

    fireEvent.change(proxyInput, { target: { value: 'socks5://127.0.0.1:7890' } })
    expect(screen.getByText('Enter an HTTP or HTTPS proxy URL.')).toBeInTheDocument()
    expect(saveButton).toBeDisabled()

    fireEvent.change(proxyInput, { target: { value: '  http://127.0.0.1:7890  ' } })
    expect(screen.getByText('HTTP and HTTPS proxy URLs are supported, for example http://127.0.0.1:7890.')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(saveButton)
    })

    expect(useSettingsStore.getState().setUpdateProxy).toHaveBeenCalledWith({
      mode: 'manual',
      url: 'http://127.0.0.1:7890',
    })
  })

  it('can switch update proxy settings back to system mode', async () => {
    useSettingsStore.setState({
      updateProxy: { mode: 'manual', url: 'http://127.0.0.1:7890' },
    })
    render(<Settings />)

    fireEvent.click(screen.getByRole('button', { name: /Advanced update proxy/i }))
    expect(screen.getByRole('button', { name: /Manual proxy/i })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: /System proxy/i }))
    const saveButton = screen.getByRole('button', { name: 'Save' })

    await act(async () => {
      fireEvent.click(saveButton)
    })

    expect(useSettingsStore.getState().setUpdateProxy).toHaveBeenCalledWith({
      mode: 'system',
      url: 'http://127.0.0.1:7890',
    })
  })
})
