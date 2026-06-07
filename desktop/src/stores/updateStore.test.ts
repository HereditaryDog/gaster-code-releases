// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browserHost } from '../lib/desktopHost/browserHost'

const check = vi.fn()
const relaunch = vi.fn()
const prepareInstall = vi.fn()
const cancelInstall = vi.fn()

function installDesktopUpdateHost() {
  window.desktopHost = {
    ...browserHost,
    kind: 'electron',
    isDesktop: true,
    capabilities: {
      ...browserHost.capabilities,
      updates: true,
    },
    updates: {
      ...browserHost.updates,
      check,
      prepareInstall,
      cancelInstall,
      relaunch,
    },
  }
}

describe('updateStore', () => {
  beforeEach(() => {
    check.mockReset()
    relaunch.mockReset()
    prepareInstall.mockReset()
    cancelInstall.mockReset()
    window.localStorage.clear()
    Reflect.deleteProperty(window, 'desktopHost')
    installDesktopUpdateHost()
  })

  it('stores available update metadata after a successful check', async () => {
    const update = {
      version: '0.2.0',
      body: 'Bug fixes and performance improvements',
      close: vi.fn().mockResolvedValue(undefined),
    }
    check.mockResolvedValue(update)

    vi.resetModules()
    const { useUpdateStore } = await import('./updateStore')

    const result = await useUpdateStore.getState().checkForUpdates()

    expect(result).toBe(update)
    expect(useUpdateStore.getState().status).toBe('available')
    expect(useUpdateStore.getState().availableVersion).toBe('0.2.0')
    expect(useUpdateStore.getState().releaseNotes).toBe('Bug fixes and performance improvements')
    expect(useUpdateStore.getState().shouldPrompt).toBe(true)
  })

  it('passes the configured manual update proxy to update checks', async () => {
    const update = {
      version: '0.2.0',
      body: 'Bug fixes and performance improvements',
      close: vi.fn().mockResolvedValue(undefined),
    }
    check.mockResolvedValue(update)

    vi.resetModules()
    const { useSettingsStore } = await import('./settingsStore')
    useSettingsStore.setState({
      updateProxy: {
        mode: 'manual',
        url: 'http://127.0.0.1:7890',
      },
    })
    const { useUpdateStore } = await import('./updateStore')

    await useUpdateStore.getState().checkForUpdates()

    expect(check).toHaveBeenCalledWith({ proxy: 'http://127.0.0.1:7890' })
  })

  it('does not re-prompt for the same version after dismissing once', async () => {
    check.mockResolvedValue({
      version: '0.2.0',
      body: 'Bug fixes and performance improvements',
      close: vi.fn().mockResolvedValue(undefined),
    })

    vi.resetModules()
    const { useUpdateStore } = await import('./updateStore')

    await useUpdateStore.getState().checkForUpdates()
    useUpdateStore.getState().dismissPrompt()

    expect(useUpdateStore.getState().shouldPrompt).toBe(false)
    expect(window.localStorage.getItem('gaster-code-dismissed-update-version')).toBe('0.2.0')
    expect(window.localStorage.getItem('cc-haha-dismissed-update-version')).toBeNull()

    await useUpdateStore.getState().checkForUpdates({ silent: true })

    expect(useUpdateStore.getState().status).toBe('available')
    expect(useUpdateStore.getState().availableVersion).toBe('0.2.0')
    expect(useUpdateStore.getState().shouldPrompt).toBe(false)
  })

  it('migrates a legacy dismissed update version', async () => {
    window.localStorage.setItem('cc-haha-dismissed-update-version', '0.2.0')
    check.mockResolvedValue({
      version: '0.2.0',
      body: 'Bug fixes and performance improvements',
      close: vi.fn().mockResolvedValue(undefined),
    })

    vi.resetModules()
    const { useUpdateStore } = await import('./updateStore')

    await useUpdateStore.getState().checkForUpdates({ silent: true })

    expect(useUpdateStore.getState().shouldPrompt).toBe(false)
    expect(window.localStorage.getItem('gaster-code-dismissed-update-version')).toBe('0.2.0')
    expect(window.localStorage.getItem('cc-haha-dismissed-update-version')).toBeNull()
  })

  it('prompts again when a newer version is available after dismissing an older one', async () => {
    check
      .mockResolvedValueOnce({
        version: '0.2.0',
        body: 'Bug fixes and performance improvements',
        close: vi.fn().mockResolvedValue(undefined),
      })
      .mockResolvedValueOnce({
        version: '0.3.0',
        body: 'New release',
        close: vi.fn().mockResolvedValue(undefined),
      })

    vi.resetModules()
    const { useUpdateStore } = await import('./updateStore')

    await useUpdateStore.getState().checkForUpdates()
    useUpdateStore.getState().dismissPrompt()
    await useUpdateStore.getState().checkForUpdates({ silent: true })

    expect(useUpdateStore.getState().availableVersion).toBe('0.3.0')
    expect(useUpdateStore.getState().shouldPrompt).toBe(true)
  })

  it('downloads, stops sidecars, installs, and relaunches', async () => {
    const download = vi.fn(async (onEvent?: (event: unknown) => void) => {
      onEvent?.({ event: 'Started', data: { contentLength: 200 } })
      onEvent?.({ event: 'Progress', data: { chunkLength: 50 } })
      onEvent?.({ event: 'Progress', data: { chunkLength: 150 } })
      onEvent?.({ event: 'Finished' })
    })
    const install = vi.fn().mockResolvedValue(undefined)

    check.mockResolvedValue({
      version: '0.2.0',
      body: 'Notes',
      download,
      install,
      close: vi.fn().mockResolvedValue(undefined),
    })
    prepareInstall.mockResolvedValue(undefined)
    cancelInstall.mockResolvedValue(undefined)
    relaunch.mockResolvedValue(undefined)

    vi.resetModules()
    const { useUpdateStore } = await import('./updateStore')

    await useUpdateStore.getState().checkForUpdates()
    await useUpdateStore.getState().installUpdate()

    expect(download).toHaveBeenCalledTimes(1)
    expect(prepareInstall).toHaveBeenCalledTimes(1)
    expect(install).toHaveBeenCalledTimes(1)
    const prepareCallOrder = prepareInstall.mock.invocationCallOrder[0]
    const installCallOrder = install.mock.invocationCallOrder[0]
    expect(prepareCallOrder).toBeDefined()
    expect(installCallOrder).toBeDefined()
    expect(prepareCallOrder!).toBeLessThan(installCallOrder!)
    expect(useUpdateStore.getState().progressPercent).toBe(100)
    expect(useUpdateStore.getState().status).toBe('restarting')
    expect(relaunch).toHaveBeenCalledTimes(1)
  })

  it('keeps the newly checked native update installable after a second available check', async () => {
    let nativePendingUpdate: 'first' | 'second' | null = null
    const staleClose = vi.fn(async () => {
      nativePendingUpdate = null
    })
    const secondDownload = vi.fn(async (onEvent?: (event: unknown) => void) => {
      if (nativePendingUpdate !== 'second') throw new Error('native update was cancelled')
      onEvent?.({ event: 'Started', data: { contentLength: 100 } })
      onEvent?.({ event: 'Progress', data: { chunkLength: 100 } })
      onEvent?.({ event: 'Finished' })
    })
    const secondInstall = vi.fn(async () => {
      if (nativePendingUpdate !== 'second') throw new Error('native update was cancelled')
    })

    check
      .mockImplementationOnce(async () => {
        nativePendingUpdate = 'first'
        return {
          version: '0.2.0',
          body: 'Notes',
          close: staleClose,
        }
      })
      .mockImplementationOnce(async () => {
        nativePendingUpdate = 'second'
        return {
          version: '0.2.0',
          body: 'Notes',
          download: secondDownload,
          install: secondInstall,
          close: vi.fn().mockResolvedValue(undefined),
        }
      })
    prepareInstall.mockResolvedValue(undefined)
    cancelInstall.mockResolvedValue(undefined)
    relaunch.mockResolvedValue(undefined)

    vi.resetModules()
    const { useUpdateStore } = await import('./updateStore')

    await useUpdateStore.getState().checkForUpdates()
    await useUpdateStore.getState().checkForUpdates()
    await useUpdateStore.getState().installUpdate()

    expect(staleClose).not.toHaveBeenCalled()
    expect(secondDownload).toHaveBeenCalledTimes(1)
    expect(secondInstall).toHaveBeenCalledTimes(1)
    expect(cancelInstall).not.toHaveBeenCalled()
    expect(useUpdateStore.getState().status).toBe('restarting')
  })

  it('refreshes the pending update when the proxy changes before install', async () => {
    const staleClose = vi.fn().mockResolvedValue(undefined)
    const freshDownload = vi.fn(async (onEvent?: (event: unknown) => void) => {
      onEvent?.({ event: 'Started', data: { contentLength: 100 } })
      onEvent?.({ event: 'Progress', data: { chunkLength: 100 } })
      onEvent?.({ event: 'Finished' })
    })
    const freshInstall = vi.fn().mockResolvedValue(undefined)

    check
      .mockResolvedValueOnce({
        version: '0.2.0',
        body: 'Notes',
        close: staleClose,
      })
      .mockResolvedValueOnce({
        version: '0.2.0',
        body: 'Notes',
        download: freshDownload,
        install: freshInstall,
        close: vi.fn().mockResolvedValue(undefined),
      })
    prepareInstall.mockResolvedValue(undefined)
    cancelInstall.mockResolvedValue(undefined)
    relaunch.mockResolvedValue(undefined)

    vi.resetModules()
    const { useSettingsStore } = await import('./settingsStore')
    const { useUpdateStore } = await import('./updateStore')

    await useUpdateStore.getState().checkForUpdates()
    useSettingsStore.setState({
      updateProxy: {
        mode: 'manual',
        url: 'http://127.0.0.1:7890',
      },
    })
    await useUpdateStore.getState().installUpdate()

    expect(staleClose).toHaveBeenCalledTimes(1)
    expect(check).toHaveBeenNthCalledWith(2, { proxy: 'http://127.0.0.1:7890' })
    expect(freshDownload).toHaveBeenCalledTimes(1)
    expect(freshInstall).toHaveBeenCalledTimes(1)
  })

  it('clears the native exit guard when install fails after sidecars stop', async () => {
    const download = vi.fn(async (onEvent?: (event: unknown) => void) => {
      onEvent?.({ event: 'Started', data: { contentLength: 100 } })
      onEvent?.({ event: 'Finished' })
    })
    const install = vi.fn().mockRejectedValue(new Error('installer failed'))

    check.mockResolvedValue({
      version: '0.2.0',
      body: 'Notes',
      download,
      install,
      close: vi.fn().mockResolvedValue(undefined),
    })
    prepareInstall.mockResolvedValue(undefined)
    cancelInstall.mockResolvedValue(undefined)

    vi.resetModules()
    const { useUpdateStore } = await import('./updateStore')

    await useUpdateStore.getState().checkForUpdates()
    await useUpdateStore.getState().installUpdate()

    expect(prepareInstall).toHaveBeenCalledTimes(1)
    expect(cancelInstall).toHaveBeenCalledTimes(1)
    expect(useUpdateStore.getState().status).toBe('available')
    expect(useUpdateStore.getState().error).toContain('installer failed')
    expect(useUpdateStore.getState().shouldPrompt).toBe(true)
  })

  it('does not cancel native update state when download fails before install preparation', async () => {
    check.mockResolvedValue({
      version: '0.2.0',
      body: 'Notes',
      download: vi.fn().mockRejectedValue(new Error('download failed')),
      install: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    })

    vi.resetModules()
    const { useUpdateStore } = await import('./updateStore')

    await useUpdateStore.getState().checkForUpdates()
    await useUpdateStore.getState().installUpdate()

    expect(cancelInstall).not.toHaveBeenCalled()
    expect(useUpdateStore.getState().status).toBe('available')
    expect(useUpdateStore.getState().error).toBe('download failed')
  })

  it('cancels native update state when install fails after preparation', async () => {
    check.mockResolvedValue({
      version: '0.2.0',
      body: 'Notes',
      download: vi.fn().mockResolvedValue(undefined),
      install: vi.fn().mockRejectedValue(new Error('install failed')),
      close: vi.fn().mockResolvedValue(undefined),
    })
    prepareInstall.mockResolvedValue(undefined)
    cancelInstall.mockResolvedValue(undefined)

    vi.resetModules()
    const { useUpdateStore } = await import('./updateStore')

    await useUpdateStore.getState().checkForUpdates()
    await useUpdateStore.getState().installUpdate()

    expect(prepareInstall).toHaveBeenCalledTimes(1)
    expect(cancelInstall).toHaveBeenCalledTimes(1)
    expect(useUpdateStore.getState().status).toBe('available')
    expect(useUpdateStore.getState().error).toBe('install failed')
  })
})
