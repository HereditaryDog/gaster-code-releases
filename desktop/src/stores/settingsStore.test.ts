import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('settingsStore locale defaults', () => {
  beforeEach(() => {
    vi.resetModules()
    window.localStorage.clear()
  })

  it('defaults to Chinese when no locale is stored', async () => {
    const { useSettingsStore } = await import('./settingsStore')

    expect(useSettingsStore.getState().locale).toBe('zh')
  })

  it('migrates a legacy stored locale override', async () => {
    window.localStorage.setItem('cc-haha-locale', 'en')

    const { useSettingsStore } = await import('./settingsStore')

    expect(useSettingsStore.getState().locale).toBe('en')
    expect(window.localStorage.getItem('gaster-code-locale')).toBe('en')
    expect(window.localStorage.getItem('cc-haha-locale')).toBeNull()
  })

  it('writes locale updates to the Gaster Code storage key', async () => {
    const { useSettingsStore } = await import('./settingsStore')

    useSettingsStore.getState().setLocale('en')

    expect(window.localStorage.getItem('gaster-code-locale')).toBe('en')
    expect(window.localStorage.getItem('cc-haha-locale')).toBeNull()
  })
})

describe('settingsStore update proxy persistence', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('defaults old user settings to automatic system proxy mode', async () => {
    vi.doMock('../api/settings', () => ({
      settingsApi: {
        getUser: vi.fn().mockResolvedValue({}),
        updateUser: vi.fn(),
        getPermissionMode: vi.fn().mockResolvedValue({ mode: 'default' }),
        setPermissionMode: vi.fn(),
        getCliLauncherStatus: vi.fn(),
      },
    }))
    vi.doMock('../api/models', () => ({
      modelsApi: {
        list: vi.fn().mockResolvedValue({ models: [] }),
        getCurrent: vi.fn().mockResolvedValue({ model: null }),
        setCurrent: vi.fn(),
        getEffort: vi.fn().mockResolvedValue({ level: 'medium' }),
        setEffort: vi.fn(),
      },
    }))
    vi.doMock('../api/h5Access', () => ({
      h5AccessApi: {
        get: vi.fn().mockResolvedValue({
          settings: {
            enabled: false,
            tokenPreview: null,
            allowedOrigins: [],
            publicBaseUrl: null,
          },
        }),
        enable: vi.fn(),
        disable: vi.fn(),
        regenerate: vi.fn(),
        update: vi.fn(),
      },
    }))

    const { useSettingsStore } = await import('./settingsStore')

    await useSettingsStore.getState().fetchAll()

    expect(useSettingsStore.getState().updateProxy).toEqual({
      mode: 'system',
      url: '',
    })
  })

  it('persists manual update proxy settings trimmed', async () => {
    const updateUser = vi.fn().mockResolvedValue({})
    vi.doMock('../api/settings', () => ({
      settingsApi: {
        getUser: vi.fn(),
        updateUser,
        getPermissionMode: vi.fn(),
        setPermissionMode: vi.fn(),
        getCliLauncherStatus: vi.fn(),
      },
    }))
    vi.doMock('../api/models', () => ({
      modelsApi: {
        list: vi.fn(),
        getCurrent: vi.fn(),
        setCurrent: vi.fn(),
        getEffort: vi.fn(),
        setEffort: vi.fn(),
      },
    }))
    vi.doMock('../api/h5Access', () => ({
      h5AccessApi: {
        get: vi.fn(),
        enable: vi.fn(),
        disable: vi.fn(),
        regenerate: vi.fn(),
        update: vi.fn(),
      },
    }))

    const { useSettingsStore } = await import('./settingsStore')

    await useSettingsStore.getState().setUpdateProxy({
      mode: 'manual',
      url: '  http://127.0.0.1:7890  ',
    })

    expect(useSettingsStore.getState().updateProxy).toEqual({
      mode: 'manual',
      url: 'http://127.0.0.1:7890',
    })
    expect(updateUser).toHaveBeenCalledWith({
      updateProxy: {
        mode: 'manual',
        url: 'http://127.0.0.1:7890',
      },
    })
  })
})

describe('settingsStore desktop notification persistence', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('defaults desktop notifications to explicit opt-in', async () => {
    vi.doMock('../api/settings', () => ({
      settingsApi: {
        getUser: vi.fn(),
        updateUser: vi.fn(),
        getPermissionMode: vi.fn(),
        setPermissionMode: vi.fn(),
        getCliLauncherStatus: vi.fn(),
      },
    }))
    vi.doMock('../api/models', () => ({
      modelsApi: {
        list: vi.fn(),
        getCurrent: vi.fn(),
        setCurrent: vi.fn(),
        getEffort: vi.fn(),
        setEffort: vi.fn(),
      },
    }))

    const { useSettingsStore } = await import('./settingsStore')

    expect(useSettingsStore.getState().desktopNotificationsEnabled).toBe(false)
  })

  it('keeps desktop notifications disabled when user settings do not opt in', async () => {
    vi.doMock('../api/settings', () => ({
      settingsApi: {
        getUser: vi.fn().mockResolvedValue({}),
        updateUser: vi.fn(),
        getPermissionMode: vi.fn().mockResolvedValue({ mode: 'default' }),
        setPermissionMode: vi.fn(),
        getCliLauncherStatus: vi.fn(),
      },
    }))
    vi.doMock('../api/models', () => ({
      modelsApi: {
        list: vi.fn().mockResolvedValue({ models: [] }),
        getCurrent: vi.fn().mockResolvedValue({ model: null }),
        setCurrent: vi.fn(),
        getEffort: vi.fn().mockResolvedValue({ level: 'medium' }),
        setEffort: vi.fn(),
      },
    }))
    vi.doMock('../api/h5Access', () => ({
      h5AccessApi: {
        get: vi.fn().mockResolvedValue({ settings: { enabled: false, tokenPreview: null, allowedOrigins: [], publicBaseUrl: null } }),
      },
    }))

    const { useSettingsStore } = await import('./settingsStore')

    await useSettingsStore.getState().fetchAll()

    expect(useSettingsStore.getState().desktopNotificationsEnabled).toBe(false)
  })

  it('persists the latest desktop notification toggle when saves overlap', async () => {
    const pendingSaves: Array<() => void> = []
    const updateUser = vi.fn(
      () =>
        new Promise<{ ok: true }>((resolve) => {
          pendingSaves.push(() => resolve({ ok: true }))
        }),
    )

    vi.doMock('../api/settings', () => ({
      settingsApi: {
        getUser: vi.fn(),
        updateUser,
        getPermissionMode: vi.fn(),
        setPermissionMode: vi.fn(),
        getCliLauncherStatus: vi.fn(),
      },
    }))
    vi.doMock('../api/models', () => ({
      modelsApi: {
        list: vi.fn(),
        getCurrent: vi.fn(),
        setCurrent: vi.fn(),
        getEffort: vi.fn(),
        setEffort: vi.fn(),
      },
    }))

    const { useSettingsStore } = await import('./settingsStore')

    const firstSave = useSettingsStore.getState().setDesktopNotificationsEnabled(false)
    await vi.waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ desktopNotificationsEnabled: false })
    })

    const secondSave = useSettingsStore.getState().setDesktopNotificationsEnabled(true)
    expect(useSettingsStore.getState().desktopNotificationsEnabled).toBe(true)

    pendingSaves.shift()?.()
    await vi.waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ desktopNotificationsEnabled: true })
    })
    pendingSaves.shift()?.()
    await Promise.all([firstSave, secondSave])

    expect(updateUser).toHaveBeenLastCalledWith({ desktopNotificationsEnabled: true })
    expect(useSettingsStore.getState().desktopNotificationsEnabled).toBe(true)
  })
})

describe('settingsStore desktop terminal settings', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('persists normalized terminal startup settings', async () => {
    const updateUser = vi.fn().mockResolvedValue({})
    vi.doMock('../api/settings', () => ({
      settingsApi: {
        getUser: vi.fn(),
        updateUser,
        getPermissionMode: vi.fn(),
        setPermissionMode: vi.fn(),
        getCliLauncherStatus: vi.fn(),
      },
    }))
    vi.doMock('../api/models', () => ({
      modelsApi: {
        list: vi.fn(),
        getCurrent: vi.fn(),
        setCurrent: vi.fn(),
        getEffort: vi.fn(),
        setEffort: vi.fn(),
      },
    }))

    const { useSettingsStore } = await import('./settingsStore')

    await useSettingsStore.getState().setDesktopTerminal({
      startupShell: 'pwsh',
      customShellPath: '  ',
    })

    expect(updateUser).toHaveBeenCalledWith({
      desktopTerminal: {
        startupShell: 'pwsh',
        customShellPath: '  ',
      },
    })
    expect(useSettingsStore.getState().desktopTerminal.startupShell).toBe('pwsh')
  })
})

describe('settingsStore theme persistence', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
  })

  it('hydrates the pure white theme from user settings', async () => {
    vi.doMock('../api/settings', () => ({
      settingsApi: {
        getUser: vi.fn().mockResolvedValue({ theme: 'white' }),
        updateUser: vi.fn(),
        getPermissionMode: vi.fn().mockResolvedValue({ mode: 'default' }),
        setPermissionMode: vi.fn(),
        getCliLauncherStatus: vi.fn(),
      },
    }))
    vi.doMock('../api/models', () => ({
      modelsApi: {
        list: vi.fn().mockResolvedValue({ models: [] }),
        getCurrent: vi.fn().mockResolvedValue({ model: null }),
        setCurrent: vi.fn(),
        getEffort: vi.fn().mockResolvedValue({ level: 'medium' }),
        setEffort: vi.fn(),
      },
    }))
    vi.doMock('../api/h5Access', () => ({
      h5AccessApi: {
        get: vi.fn().mockResolvedValue({ settings: { enabled: false, tokenPreview: null, allowedOrigins: [], publicBaseUrl: null } }),
      },
    }))

    const { useSettingsStore } = await import('./settingsStore')
    const { useUIStore } = await import('./uiStore')

    await useSettingsStore.getState().fetchAll()

    expect(useSettingsStore.getState().theme).toBe('white')
    expect(useUIStore.getState().theme).toBe('white')
    expect(document.documentElement.getAttribute('data-theme')).toBe('white')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('falls back to pure white when user settings omit theme', async () => {
    vi.doMock('../api/settings', () => ({
      settingsApi: {
        getUser: vi.fn().mockResolvedValue({}),
        updateUser: vi.fn(),
        getPermissionMode: vi.fn().mockResolvedValue({ mode: 'default' }),
        setPermissionMode: vi.fn(),
        getCliLauncherStatus: vi.fn(),
      },
    }))
    vi.doMock('../api/models', () => ({
      modelsApi: {
        list: vi.fn().mockResolvedValue({ models: [] }),
        getCurrent: vi.fn().mockResolvedValue({ model: null }),
        setCurrent: vi.fn(),
        getEffort: vi.fn().mockResolvedValue({ level: 'medium' }),
        setEffort: vi.fn(),
      },
    }))
    vi.doMock('../api/h5Access', () => ({
      h5AccessApi: {
        get: vi.fn().mockResolvedValue({ settings: { enabled: false, tokenPreview: null, allowedOrigins: [], publicBaseUrl: null } }),
      },
    }))

    const { useSettingsStore } = await import('./settingsStore')
    const { useUIStore } = await import('./uiStore')

    await useSettingsStore.getState().fetchAll()

    expect(useSettingsStore.getState().theme).toBe('white')
    expect(useUIStore.getState().theme).toBe('white')
  })
})

describe('settingsStore thinking and zoom persistence', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-app-zoom-mode')
    document.documentElement.removeAttribute('data-app-zoom-percent')
    document.documentElement.style.removeProperty('--app-zoom')
    document.body.style.removeProperty('zoom')
  })

  it('persists explicit thinking mode on and off', async () => {
    const updateUser = vi.fn().mockResolvedValue({})
    vi.doMock('../api/settings', () => ({
      settingsApi: {
        getUser: vi.fn(),
        updateUser,
        getPermissionMode: vi.fn(),
        setPermissionMode: vi.fn(),
        getCliLauncherStatus: vi.fn(),
      },
    }))
    vi.doMock('../api/models', () => ({
      modelsApi: {
        list: vi.fn(),
        getCurrent: vi.fn(),
        setCurrent: vi.fn(),
        getEffort: vi.fn(),
        setEffort: vi.fn(),
      },
    }))

    const { useSettingsStore } = await import('./settingsStore')

    await useSettingsStore.getState().setThinkingEnabled(false)
    await useSettingsStore.getState().setThinkingEnabled(true)

    expect(updateUser).toHaveBeenNthCalledWith(1, { alwaysThinkingEnabled: false })
    expect(updateUser).toHaveBeenNthCalledWith(2, { alwaysThinkingEnabled: true })
    expect(useSettingsStore.getState().thinkingEnabled).toBe(true)
  })

  it('rolls back failed thinking mode updates', async () => {
    vi.doMock('../api/settings', () => ({
      settingsApi: {
        getUser: vi.fn(),
        updateUser: vi.fn().mockRejectedValue(new Error('save failed')),
        getPermissionMode: vi.fn(),
        setPermissionMode: vi.fn(),
        getCliLauncherStatus: vi.fn(),
      },
    }))
    vi.doMock('../api/models', () => ({
      modelsApi: {
        list: vi.fn(),
        getCurrent: vi.fn(),
        setCurrent: vi.fn(),
        getEffort: vi.fn(),
        setEffort: vi.fn(),
      },
    }))

    const { useSettingsStore } = await import('./settingsStore')

    await useSettingsStore.getState().setThinkingEnabled(false)

    expect(useSettingsStore.getState().thinkingEnabled).toBe(true)
  })

  it('reads legacy UI zoom and stores updates in the Gaster Code key', async () => {
    window.localStorage.setItem('cc-haha-ui-zoom', '1.25')

    const { useSettingsStore } = await import('./settingsStore')

    expect(useSettingsStore.getState().uiZoom).toBe(1.25)
    expect(window.localStorage.getItem('gaster-code-app-zoom')).toBe('1.25')
    expect(window.localStorage.getItem('cc-haha-ui-zoom')).toBeNull()

    useSettingsStore.getState().setUiZoom(1.4)
    await vi.waitFor(() => {
      expect(window.localStorage.getItem('gaster-code-app-zoom')).toBe('1.4')
    })
    expect(useSettingsStore.getState().uiZoom).toBe(1.4)
    expect(document.documentElement.getAttribute('data-app-zoom-percent')).toBe('140')
  })
})
