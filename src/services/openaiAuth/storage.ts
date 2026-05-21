import memoize from 'lodash-es/memoize.js'
import { getSecureStorage } from '../../utils/secureStorage/index.js'
import { errorMessage } from '../../utils/errors.js'
import { logError } from '../../utils/log.js'
import type { OpenAIOAuthTokens } from './types.js'

const STORAGE_KEY = 'openaiCodexOauth'

type SecureStorageShape = Record<string, unknown> & {
  openaiCodexOauth?: OpenAIOAuthTokens
}

export function saveOpenAIOAuthTokens(tokens: OpenAIOAuthTokens): {
  success: boolean
  warning?: string
} {
  try {
    const storage = getSecureStorage()
    const data = (storage.read() ?? {}) as SecureStorageShape
    data[STORAGE_KEY] = tokens
    const result = storage.update(data)
    clearOpenAIOAuthTokenCache()
    return result
  } catch (error) {
    logError(error)
    return {
      success: false,
      warning: `Failed to save OpenAI OAuth tokens: ${errorMessage(error)}`,
    }
  }
}

export const getOpenAIOAuthTokens = memoize((): OpenAIOAuthTokens | null => {
  try {
    const storage = getSecureStorage()
    const data = storage.read() as SecureStorageShape | null
    return data?.openaiCodexOauth ?? null
  } catch (error) {
    logError(error)
    return null
  }
})

export async function getOpenAIOAuthTokensAsync(): Promise<OpenAIOAuthTokens | null> {
  try {
    const storage = getSecureStorage()
    const data = (await storage.readAsync()) as SecureStorageShape | null
    return data?.openaiCodexOauth ?? null
  } catch (error) {
    logError(error)
    return null
  }
}

export function clearOpenAIOAuthTokenCache(): void {
  getOpenAIOAuthTokens.cache?.clear?.()
}

export function deleteOpenAIOAuthTokens(): boolean {
  try {
    const storage = getSecureStorage()
    const data = (storage.read() ?? {}) as SecureStorageShape
    delete data[STORAGE_KEY]
    const result = storage.update(data)
    clearOpenAIOAuthTokenCache()
    return result.success
  } catch (error) {
    logError(error)
    return false
  }
}
