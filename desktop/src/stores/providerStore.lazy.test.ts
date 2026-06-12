import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  providersApiMock,
  providersModuleLoadedMock,
} = vi.hoisted(() => ({
  providersApiMock: {
    list: vi.fn(),
    presets: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    activate: vi.fn(),
    activateOfficial: vi.fn(),
    test: vi.fn(),
    testConfig: vi.fn(),
  },
  providersModuleLoadedMock: vi.fn(),
}))

vi.mock('./chatStore', () => ({
  useChatStore: {
    getState: () => ({
      sessions: {},
      setSessionRuntime: vi.fn(),
    }),
  },
}))

vi.mock('./sessionRuntimeStore', () => ({
  useSessionRuntimeStore: {
    getState: () => ({
      selections: {},
      setSelection: vi.fn(),
    }),
  },
}))

vi.mock('./settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      setModel: vi.fn(),
      fetchAll: vi.fn(),
    }),
  },
}))

describe('providerStore provider API loading', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    providersApiMock.list.mockResolvedValue({
      providers: [],
      activeId: null,
    })
    vi.doMock('../api/providers', () => {
      providersModuleLoadedMock()
      return { providersApi: providersApiMock }
    })
  })

  it('loads the providers API only when a provider action needs it', async () => {
    const { useProviderStore } = await import('./providerStore')

    expect(providersModuleLoadedMock).not.toHaveBeenCalled()

    await useProviderStore.getState().fetchProviders()

    expect(providersModuleLoadedMock).toHaveBeenCalledTimes(1)
    expect(providersApiMock.list).toHaveBeenCalledTimes(1)
    expect(useProviderStore.getState()).toMatchObject({
      providers: [],
      activeId: null,
      hasLoadedProviders: true,
      isLoading: false,
      error: null,
    })
  })
})
