import { create } from 'zustand'
import { getDesktopHost, type DesktopUpdate } from '../lib/desktopHost'
import {
  readMigratedStorage,
  removeMigratedStorage,
  writeMigratedStorage,
} from '../lib/storageMigration'
import type { UpdateProxySettings } from '../types/settings'
import { useSettingsStore } from './settingsStore'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'up-to-date'
  | 'downloading'
  | 'restarting'
  | 'error'

type CheckOptions = {
  silent?: boolean
}

const DISMISSED_UPDATE_VERSION_KEY = 'gaster-code-dismissed-update-version'
const LEGACY_DISMISSED_UPDATE_VERSION_KEYS = ['cc-haha-dismissed-update-version']

type UpdateStore = {
  status: UpdateStatus
  availableVersion: string | null
  releaseNotes: string | null
  progressPercent: number
  downloadedBytes: number
  totalBytes: number | null
  error: string | null
  checkedAt: number | null
  shouldPrompt: boolean
  initialize: () => Promise<void>
  checkForUpdates: (options?: CheckOptions) => Promise<DesktopUpdate | null>
  installUpdate: () => Promise<void>
  dismissPrompt: () => void
}

let pendingUpdate: DesktopUpdate | null = null
let pendingUpdateProxyKey: string | null = null
let startupCheckPromise: Promise<void> | null = null

function readDismissedUpdateVersion(): string | null {
  if (typeof window === 'undefined') return null

  try {
    return readMigratedStorage(
      DISMISSED_UPDATE_VERSION_KEY,
      LEGACY_DISMISSED_UPDATE_VERSION_KEYS,
    )
  } catch {
    return null
  }
}

function writeDismissedUpdateVersion(version: string | null) {
  if (typeof window === 'undefined') return

  try {
    if (version) {
      writeMigratedStorage(
        DISMISSED_UPDATE_VERSION_KEY,
        version,
        LEGACY_DISMISSED_UPDATE_VERSION_KEYS,
      )
    } else {
      removeMigratedStorage(
        DISMISSED_UPDATE_VERSION_KEY,
        LEGACY_DISMISSED_UPDATE_VERSION_KEYS,
      )
    }
  } catch {
    // Ignore storage write failures.
  }
}

function getUpdateProxyUrl(settings: UpdateProxySettings = useSettingsStore.getState().updateProxy) {
  if (settings.mode !== 'manual') return null
  const proxy = settings.url.trim()
  return proxy || null
}

function getUpdateProxyKey(settings: UpdateProxySettings = useSettingsStore.getState().updateProxy) {
  const proxy = getUpdateProxyUrl(settings)
  return proxy ? `manual:${proxy}` : 'system'
}

function getUpdateCheckOptions() {
  const proxy = getUpdateProxyUrl()
  return proxy ? { proxy } : undefined
}

async function setPendingUpdate(next: DesktopUpdate | null, proxyKey: string | null) {
  const previous = pendingUpdate
  pendingUpdate = next
  pendingUpdateProxyKey = next ? proxyKey : null

  if (previous && previous !== next && next === null) {
    try {
      await previous.close()
    } catch {
      // Ignore stale resource cleanup failures.
    }
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  status: 'idle',
  availableVersion: null,
  releaseNotes: null,
  progressPercent: 0,
  downloadedBytes: 0,
  totalBytes: null,
  error: null,
  checkedAt: null,
  shouldPrompt: false,

  initialize: async () => {
    const host = getDesktopHost()
    if (!host.capabilities.updates) return
    if (!startupCheckPromise) {
      startupCheckPromise = (async () => {
        await new Promise((resolve) => setTimeout(resolve, 5000))
        await get().checkForUpdates({ silent: true })
      })().finally(() => {
        startupCheckPromise = null
      })
    }

    await startupCheckPromise
  },

  checkForUpdates: async ({ silent = false } = {}) => {
    const host = getDesktopHost()
    if (!host.capabilities.updates) return null

    set((state) => ({
      ...state,
      status: 'checking',
      error: null,
    }))

    try {
      const updateProxyKey = getUpdateProxyKey()
      const update = await host.updates.check(getUpdateCheckOptions())
      await setPendingUpdate(update, updateProxyKey)

      const checkedAt = Date.now()

      if (!update) {
        writeDismissedUpdateVersion(null)
        set((state) => ({
          ...state,
          status: 'up-to-date',
          availableVersion: null,
          releaseNotes: null,
          progressPercent: 0,
          downloadedBytes: 0,
          totalBytes: null,
          checkedAt,
          error: null,
          shouldPrompt: false,
        }))
        return null
      }

      const dismissedVersion = readDismissedUpdateVersion()
      const shouldPrompt = dismissedVersion !== update.version

      set((state) => ({
        ...state,
        status: 'available',
        availableVersion: update.version,
        releaseNotes: update.body ?? null,
        progressPercent: 0,
        downloadedBytes: 0,
        totalBytes: null,
        checkedAt,
        error: null,
        shouldPrompt,
      }))
      return update
    } catch (error) {
      if (!silent) {
        set((state) => ({
          ...state,
          status: 'error',
          error: getErrorMessage(error),
          checkedAt: Date.now(),
        }))
      } else {
        set((state) => ({
          ...state,
          status: state.availableVersion ? 'available' : 'idle',
          checkedAt: Date.now(),
        }))
      }
      return null
    }
  },

  installUpdate: async () => {
    const host = getDesktopHost()
    if (!host.capabilities.updates) return

    let update = pendingUpdate
    if (update && pendingUpdateProxyKey !== getUpdateProxyKey()) {
      await setPendingUpdate(null, null)
      update = null
    }
    if (!update) {
      update = await get().checkForUpdates()
      if (!update) return
    }

    set((state) => ({
      ...state,
      status: 'downloading',
      error: null,
      shouldPrompt: true,
      progressPercent: 0,
      downloadedBytes: 0,
      totalBytes: null,
    }))

    let prepareInstallAttempted = false
    try {
      writeDismissedUpdateVersion(null)
      let totalBytes: number | null = null
      let downloadedBytes = 0

      await update.download((event) => {
        if (event.event === 'Started') {
          totalBytes = event.data.contentLength ?? null
          downloadedBytes = 0
          set((state) => ({
            ...state,
            totalBytes,
            downloadedBytes: 0,
            progressPercent: 0,
          }))
        } else if (event.event === 'Progress') {
          downloadedBytes += event.data.chunkLength
          const progressPercent =
            totalBytes && totalBytes > 0
              ? Math.min(Math.round((downloadedBytes / totalBytes) * 100), 100)
              : 0

          set((state) => ({
            ...state,
            downloadedBytes,
            totalBytes,
            progressPercent,
          }))
        } else if (event.event === 'Finished') {
          set((state) => ({
            ...state,
            progressPercent: 100,
          }))
        }
      })

      prepareInstallAttempted = true
      await host.updates.prepareInstall()
      await update.install()

      set((state) => ({
        ...state,
        status: 'restarting',
        progressPercent: 100,
      }))

      await host.updates.relaunch()
    } catch (error) {
      if (prepareInstallAttempted) {
        try {
          await host.updates.cancelInstall()
        } catch {
          // Best effort: keep the update prompt recoverable even if native reset fails.
        }
      }
      set((state) => ({
        ...state,
        status: 'available',
        error: getErrorMessage(error),
        shouldPrompt: true,
      }))
    }
  },

  dismissPrompt: () => {
    writeDismissedUpdateVersion(get().availableVersion)
    set((state) => ({
      ...state,
      shouldPrompt: false,
    }))
  },
}))
