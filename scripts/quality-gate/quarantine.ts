import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export type QuarantineEntry = {
  id: string
  path: string
  reason: string
  owner: string
  reviewAfter: string
}

export type QuarantineManifest = {
  quarantined: QuarantineEntry[]
}

const defaultManifestPath = join(dirname(fileURLToPath(import.meta.url)), 'quarantine.json')

export function loadQuarantineManifest(path = defaultManifestPath): QuarantineManifest {
  const manifest = JSON.parse(readFileSync(path, 'utf8')) as QuarantineManifest
  validateQuarantineManifest(manifest)
  return manifest
}

export function validateQuarantineManifest(manifest: QuarantineManifest) {
  if (!Array.isArray(manifest.quarantined)) {
    throw new Error('quarantine manifest must contain a quarantined array')
  }

  const ids = new Set<string>()
  const paths = new Set<string>()

  for (const entry of manifest.quarantined) {
    if (!entry.id || !entry.path || !entry.reason || !entry.owner || !entry.reviewAfter) {
      throw new Error(`invalid quarantine entry: ${JSON.stringify(entry)}`)
    }
    if (ids.has(entry.id)) {
      throw new Error(`duplicate quarantine id: ${entry.id}`)
    }
    if (paths.has(entry.path)) {
      throw new Error(`duplicate quarantine path: ${entry.path}`)
    }
    ids.add(entry.id)
    paths.add(entry.path)
  }
}

export function quarantinedPathSet(manifest = loadQuarantineManifest()) {
  return new Set(manifest.quarantined.map((entry) => entry.path))
}
