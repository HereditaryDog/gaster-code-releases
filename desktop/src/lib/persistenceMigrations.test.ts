import { beforeEach, describe, expect, test } from 'vitest'
import {
  APP_ZOOM_STORAGE_KEY,
  LEGACY_UI_ZOOM_STORAGE_KEY,
} from './appZoom'
import {
  CURRENT_DESKTOP_PERSISTENCE_SCHEMA_VERSION,
  DESKTOP_PERSISTENCE_VERSION_KEY,
  runDesktopPersistenceMigrations,
} from './persistenceMigrations'

describe('desktop persistence migrations', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  test('migrates legacy open-tab arrays into the current Gaster Code tab persistence shape', () => {
    window.localStorage.setItem('cc-haha-open-tabs', JSON.stringify([
      { sessionId: 'session-1', title: 'Old tab' },
      { sessionId: '__terminal__legacy', title: 'Terminal 1', type: 'terminal' },
      { sessionId: 123, title: 'bad' },
    ]))

    const report = runDesktopPersistenceMigrations()

    expect(report.migratedKeys).toContain('cc-haha-open-tabs')
    expect(JSON.parse(window.localStorage.getItem('gaster-code-open-tabs') || '{}')).toEqual({
      openTabs: [{ sessionId: 'session-1', title: 'Old tab', type: 'session' }],
      activeTabId: 'session-1',
    })
    expect(window.localStorage.getItem('cc-haha-open-tabs')).toBeNull()
    expect(window.localStorage.getItem(DESKTOP_PERSISTENCE_VERSION_KEY)).toBe(String(CURRENT_DESKTOP_PERSISTENCE_SCHEMA_VERSION))
  })

  test('filters stale session runtime selections without clearing unrelated keys', () => {
    window.localStorage.setItem('unrelated-user-key', 'keep')
    window.localStorage.setItem('gaster-code-session-runtime', JSON.stringify({
      good: { providerId: null, modelId: 'claude-sonnet' },
      alsoGood: { providerId: 'provider-1', modelId: 'gpt-5.4' },
      bad: { providerId: 'provider-2' },
    }))

    runDesktopPersistenceMigrations()

    expect(JSON.parse(window.localStorage.getItem('gaster-code-session-runtime') || '{}')).toEqual({
      alsoGood: { providerId: 'provider-1', modelId: 'gpt-5.4' },
      good: { providerId: null, modelId: 'claude-sonnet' },
    })
    expect(window.localStorage.getItem('unrelated-user-key')).toBe('keep')
  })

  test('removes malformed known keys without throwing during startup', () => {
    window.localStorage.setItem('gaster-code-open-tabs', '{"openTabs":')
    window.localStorage.setItem('gaster-code-theme', 'sepia')

    const report = runDesktopPersistenceMigrations()

    expect(report.migratedKeys).toContain('gaster-code-open-tabs')
    expect(report.migratedKeys).toContain('gaster-code-theme')
    expect(window.localStorage.getItem('gaster-code-open-tabs')).toBeNull()
    expect(window.localStorage.getItem('gaster-code-theme')).toBeNull()
  })

  test('preserves the pure white theme as a valid persisted theme', () => {
    window.localStorage.setItem('gaster-code-theme', 'white')

    const report = runDesktopPersistenceMigrations()

    expect(report.migratedKeys).not.toContain('gaster-code-theme')
    expect(window.localStorage.getItem('gaster-code-theme')).toBe('white')
  })

  test('uses a valid legacy value when the current key is malformed', () => {
    window.localStorage.setItem('gaster-code-session-runtime', '{bad')
    window.localStorage.setItem('cc-haha-session-runtime', JSON.stringify({
      restored: { providerId: null, modelId: 'claude-sonnet-4-6' },
    }))

    runDesktopPersistenceMigrations()

    expect(JSON.parse(window.localStorage.getItem('gaster-code-session-runtime') || '{}')).toEqual({
      restored: { providerId: null, modelId: 'claude-sonnet-4-6' },
    })
    expect(window.localStorage.getItem('cc-haha-session-runtime')).toBeNull()
  })

  test('preserves a valid Gaster Code app zoom value', () => {
    window.localStorage.setItem(APP_ZOOM_STORAGE_KEY, '1.25')

    const report = runDesktopPersistenceMigrations()

    expect(report.migratedKeys).not.toContain(APP_ZOOM_STORAGE_KEY)
    expect(window.localStorage.getItem(APP_ZOOM_STORAGE_KEY)).toBe('1.25')
  })

  test('removes an invalid Gaster Code app zoom value', () => {
    window.localStorage.setItem(APP_ZOOM_STORAGE_KEY, 'huge')

    const report = runDesktopPersistenceMigrations()

    expect(report.migratedKeys).toContain(APP_ZOOM_STORAGE_KEY)
    expect(window.localStorage.getItem(APP_ZOOM_STORAGE_KEY)).toBeNull()
  })

  test('migrates legacy UI zoom into the Gaster Code app zoom key', () => {
    window.localStorage.setItem(LEGACY_UI_ZOOM_STORAGE_KEY, '1.4')

    const report = runDesktopPersistenceMigrations()

    expect(report.migratedKeys).toContain(LEGACY_UI_ZOOM_STORAGE_KEY)
    expect(window.localStorage.getItem(APP_ZOOM_STORAGE_KEY)).toBe('1.4')
    expect(window.localStorage.getItem(LEGACY_UI_ZOOM_STORAGE_KEY)).toBeNull()
  })
})
