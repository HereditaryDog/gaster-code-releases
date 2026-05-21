function getStorage(): Storage | null {
  try {
    return typeof globalThis.localStorage === 'undefined'
      ? null
      : globalThis.localStorage
  } catch {
    return null
  }
}

export function readMigratedStorage(
  primaryKey: string,
  legacyKeys: string[] = [],
): string | null {
  const storage = getStorage()
  if (!storage) return null

  try {
    const primaryValue = storage.getItem(primaryKey)
    if (primaryValue !== null) return primaryValue

    for (const legacyKey of legacyKeys) {
      const legacyValue = storage.getItem(legacyKey)
      if (legacyValue === null) continue
      storage.setItem(primaryKey, legacyValue)
      removeLegacyStorageKeys(storage, legacyKeys)
      return legacyValue
    }
  } catch {
    return null
  }

  return null
}

export function writeMigratedStorage(
  primaryKey: string,
  value: string,
  legacyKeys: string[] = [],
) {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.setItem(primaryKey, value)
    removeLegacyStorageKeys(storage, legacyKeys)
  } catch {
    // noop
  }
}

export function removeMigratedStorage(
  primaryKey: string,
  legacyKeys: string[] = [],
) {
  const storage = getStorage()
  if (!storage) return

  try {
    storage.removeItem(primaryKey)
    removeLegacyStorageKeys(storage, legacyKeys)
  } catch {
    // noop
  }
}

function removeLegacyStorageKeys(storage: Storage, legacyKeys: string[]) {
  for (const legacyKey of legacyKeys) {
    storage.removeItem(legacyKey)
  }
}
