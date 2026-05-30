import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { shouldSkipWebFetchPreflight } from './utils.js'

describe('shouldSkipWebFetchPreflight', () => {
  const originalGasterDesktopServerUrl = process.env.GASTER_CODE_DESKTOP_SERVER_URL
  const originalDesktopServerUrl = process.env.CC_HAHA_DESKTOP_SERVER_URL

  beforeEach(() => {
    delete process.env.GASTER_CODE_DESKTOP_SERVER_URL
    delete process.env.CC_HAHA_DESKTOP_SERVER_URL
  })

  afterEach(() => {
    if (originalGasterDesktopServerUrl === undefined) {
      delete process.env.GASTER_CODE_DESKTOP_SERVER_URL
    } else {
      process.env.GASTER_CODE_DESKTOP_SERVER_URL = originalGasterDesktopServerUrl
    }
    if (originalDesktopServerUrl === undefined) {
      delete process.env.CC_HAHA_DESKTOP_SERVER_URL
    } else {
      process.env.CC_HAHA_DESKTOP_SERVER_URL = originalDesktopServerUrl
    }
  })

  test('respects explicit true from settings', () => {
    expect(
      shouldSkipWebFetchPreflight({ skipWebFetchPreflight: true }),
    ).toBe(true)
  })

  test('respects explicit false from settings even on desktop', () => {
    process.env.GASTER_CODE_DESKTOP_SERVER_URL = 'http://127.0.0.1:3456'

    expect(
      shouldSkipWebFetchPreflight({ skipWebFetchPreflight: false }),
    ).toBe(false)
  })

  test('defaults to enabled for desktop sessions', () => {
    process.env.GASTER_CODE_DESKTOP_SERVER_URL = 'http://127.0.0.1:3456'

    expect(shouldSkipWebFetchPreflight({})).toBe(true)
  })

  test('keeps the legacy desktop server env var as a fallback', () => {
    process.env.CC_HAHA_DESKTOP_SERVER_URL = 'http://127.0.0.1:3456'

    expect(shouldSkipWebFetchPreflight({})).toBe(true)
  })

  test('defaults to disabled outside desktop sessions', () => {
    expect(shouldSkipWebFetchPreflight({})).toBe(false)
  })
})
