import { THEME_MODES } from '../types/settings'
import {
  APP_ZOOM_STORAGE_KEY,
  LEGACY_APP_ZOOM_STORAGE_KEYS,
  isValidStoredAppZoomLevel,
  normalizeAppZoomLevel,
} from './appZoom'

export const CURRENT_DESKTOP_PERSISTENCE_SCHEMA_VERSION = 1
export const DESKTOP_PERSISTENCE_VERSION_KEY = 'gaster-code.persistence.schemaVersion'
const LEGACY_DESKTOP_PERSISTENCE_VERSION_KEYS = ['gaster-code-legacy.persistence.schemaVersion']

type DesktopMigrationReport = {
  migratedKeys: string[]
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const TAB_STORAGE_KEY = 'gaster-code-open-tabs'
const LEGACY_TAB_STORAGE_KEYS = ['gaster-code-legacy-open-tabs']
const SESSION_RUNTIME_STORAGE_KEY = 'gaster-code-session-runtime'
const LEGACY_SESSION_RUNTIME_STORAGE_KEYS = ['gaster-code-legacy-session-runtime']
const THEME_STORAGE_KEY = 'gaster-code-theme'
const LEGACY_THEME_STORAGE_KEYS = ['gaster-code-legacy-theme']
const LOCALE_STORAGE_KEY = 'gaster-code-locale'
const LEGACY_LOCALE_STORAGE_KEYS = ['gaster-code-legacy-locale']
const DISMISSED_UPDATE_VERSION_KEY = 'gaster-code-dismissed-update-version'
const LEGACY_DISMISSED_UPDATE_VERSION_KEYS = ['gaster-code-legacy-dismissed-update-version']
const NOTIFIED_RUNS_STORAGE_KEY = 'gaster-code.notifiedDesktopTaskRuns.v1'
const LEGACY_NOTIFIED_RUNS_STORAGE_KEYS = ['gaster-code-legacy.notifiedDesktopTaskRuns.v1']

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readJson(storage: StorageLike, key: string): unknown {
  const raw = storage.getItem(key)
  if (!raw) return null
  return JSON.parse(raw)
}

function writeJson(storage: StorageLike, key: string, value: unknown): void {
  storage.setItem(key, JSON.stringify(value))
}

function removeKeys(storage: StorageLike, keys: string[]): void {
  for (const key of keys) {
    storage.removeItem(key)
  }
}

function markMigrated(report: DesktopMigrationReport, key: string): void {
  if (!report.migratedKeys.includes(key)) {
    report.migratedKeys.push(key)
  }
}

function migrateTabs(storage: StorageLike, report: DesktopMigrationReport): void {
  for (const key of [TAB_STORAGE_KEY, ...LEGACY_TAB_STORAGE_KEYS]) {
    const raw = storage.getItem(key)
    if (!raw) continue

    try {
      const parsed = readJson(storage, key)
      const rawTabs = Array.isArray(parsed)
        ? parsed
        : isRecord(parsed) && Array.isArray(parsed.openTabs)
          ? parsed.openTabs
          : []
      const openTabs = rawTabs
        .filter((tab): tab is Record<string, unknown> => isRecord(tab))
        .filter((tab) => typeof tab.sessionId === 'string' && typeof tab.title === 'string')
        .filter((tab) => tab.type !== 'terminal' && !String(tab.sessionId).startsWith('__terminal__'))
        .map((tab) => ({
          sessionId: tab.sessionId as string,
          title: tab.title as string,
          type: tab.type === 'settings' || tab.type === 'scheduled' || tab.type === 'drawing'
            ? tab.type
            : 'session',
        }))
      const activeTabId =
        isRecord(parsed) &&
        typeof parsed.activeTabId === 'string' &&
        openTabs.some((tab) => tab.sessionId === parsed.activeTabId)
          ? parsed.activeTabId
          : (openTabs[0]?.sessionId ?? null)

      if (openTabs.length === 0) {
        storage.removeItem(TAB_STORAGE_KEY)
      } else {
        writeJson(storage, TAB_STORAGE_KEY, { openTabs, activeTabId })
      }
      removeKeys(storage, LEGACY_TAB_STORAGE_KEYS)
      markMigrated(report, key)
      return
    } catch {
      storage.removeItem(key)
      markMigrated(report, key)
    }
  }
}

function migrateSessionRuntime(storage: StorageLike, report: DesktopMigrationReport): void {
  for (const key of [SESSION_RUNTIME_STORAGE_KEY, ...LEGACY_SESSION_RUNTIME_STORAGE_KEYS]) {
    const raw = storage.getItem(key)
    if (!raw) continue

    try {
      const parsed = readJson(storage, key)
      if (!isRecord(parsed)) {
        storage.removeItem(key)
        markMigrated(report, key)
        continue
      }

      const next = Object.fromEntries(
        Object.entries(parsed).filter(([, selection]) => (
          isRecord(selection) &&
          typeof selection.modelId === 'string' &&
          (selection.providerId === null || typeof selection.providerId === 'string')
        )),
      )

      if (Object.keys(next).length === 0) {
        storage.removeItem(SESSION_RUNTIME_STORAGE_KEY)
      } else {
        writeJson(storage, SESSION_RUNTIME_STORAGE_KEY, next)
      }
      removeKeys(storage, LEGACY_SESSION_RUNTIME_STORAGE_KEYS)

      if (key !== SESSION_RUNTIME_STORAGE_KEY || JSON.stringify(next) !== JSON.stringify(parsed)) {
        markMigrated(report, key)
      }
      return
    } catch {
      storage.removeItem(key)
      markMigrated(report, key)
    }
  }
}

function normalizeEnumKey(
  storage: StorageLike,
  primaryKey: string,
  legacyKeys: string[],
  allowedValues: string[],
  report: DesktopMigrationReport,
): void {
  const keys = [primaryKey, ...legacyKeys]
  for (const key of keys) {
    const value = storage.getItem(key)
    if (value === null) continue

    if (allowedValues.includes(value)) {
      storage.setItem(primaryKey, value)
      removeKeys(storage, legacyKeys)
    } else {
      removeKeys(storage, keys)
    }

    if (key !== primaryKey || !allowedValues.includes(value)) {
      markMigrated(report, key)
    }
    return
  }
}

function migrateStringKey(
  storage: StorageLike,
  primaryKey: string,
  legacyKeys: string[],
  report: DesktopMigrationReport,
): void {
  if (storage.getItem(primaryKey) !== null) {
    removeKeys(storage, legacyKeys)
    return
  }

  for (const legacyKey of legacyKeys) {
    const legacyValue = storage.getItem(legacyKey)
    if (legacyValue === null) continue
    storage.setItem(primaryKey, legacyValue)
    removeKeys(storage, legacyKeys)
    markMigrated(report, legacyKey)
    return
  }
}

function migrateAppZoom(storage: StorageLike, report: DesktopMigrationReport): void {
  const currentValue = storage.getItem(APP_ZOOM_STORAGE_KEY)
  if (currentValue !== null) {
    if (isValidStoredAppZoomLevel(currentValue)) {
      storage.setItem(APP_ZOOM_STORAGE_KEY, String(normalizeAppZoomLevel(currentValue)))
    } else {
      storage.removeItem(APP_ZOOM_STORAGE_KEY)
      markMigrated(report, APP_ZOOM_STORAGE_KEY)
    }
    removeKeys(storage, LEGACY_APP_ZOOM_STORAGE_KEYS)
    return
  }

  for (const legacyKey of LEGACY_APP_ZOOM_STORAGE_KEYS) {
    const legacyValue = storage.getItem(legacyKey)
    if (legacyValue === null) continue

    if (isValidStoredAppZoomLevel(legacyValue)) {
      storage.setItem(APP_ZOOM_STORAGE_KEY, String(normalizeAppZoomLevel(legacyValue)))
    }
    removeKeys(storage, LEGACY_APP_ZOOM_STORAGE_KEYS)
    markMigrated(report, legacyKey)
    return
  }
}

export function runDesktopPersistenceMigrations(
  storage: StorageLike | null = globalThis.localStorage ?? null,
): DesktopMigrationReport {
  const report: DesktopMigrationReport = { migratedKeys: [] }
  if (!storage) return report

  migrateTabs(storage, report)
  migrateSessionRuntime(storage, report)
  normalizeEnumKey(storage, THEME_STORAGE_KEY, LEGACY_THEME_STORAGE_KEYS, [...THEME_MODES], report)
  normalizeEnumKey(storage, LOCALE_STORAGE_KEY, LEGACY_LOCALE_STORAGE_KEYS, ['zh', 'en'], report)
  migrateStringKey(storage, DISMISSED_UPDATE_VERSION_KEY, LEGACY_DISMISSED_UPDATE_VERSION_KEYS, report)
  migrateStringKey(storage, NOTIFIED_RUNS_STORAGE_KEY, LEGACY_NOTIFIED_RUNS_STORAGE_KEYS, report)
  migrateAppZoom(storage, report)

  storage.setItem(DESKTOP_PERSISTENCE_VERSION_KEY, String(CURRENT_DESKTOP_PERSISTENCE_SCHEMA_VERSION))
  removeKeys(storage, LEGACY_DESKTOP_PERSISTENCE_VERSION_KEYS)

  return report
}
