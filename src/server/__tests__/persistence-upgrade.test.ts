import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { ProviderService } from '../services/providerService.js'
import {
  CURRENT_PROVIDER_INDEX_SCHEMA_VERSION,
  ensurePersistentStorageUpgraded,
  resetPersistentStorageMigrationsForTests,
} from '../services/persistentStorageMigrations.js'

let tempDir: string

async function listFiles(dir: string) {
  try {
    return await fs.readdir(dir)
  } catch {
    return []
  }
}

describe('persistent storage upgrade migrations', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gaster-code-persistence-'))
    process.env.CLAUDE_CONFIG_DIR = tempDir
    resetPersistentStorageMigrationsForTests()
  })

  afterEach(async () => {
    resetPersistentStorageMigrationsForTests()
    delete process.env.CLAUDE_CONFIG_DIR
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  test('migrates Gaster provider index and writes a backup before changing it', async () => {
    const gasterDir = path.join(tempDir, 'gaster-code')
    await fs.mkdir(gasterDir, { recursive: true })
    await fs.writeFile(
      path.join(gasterDir, 'providers.json'),
      JSON.stringify({
        activeProviderId: 'provider-1',
        rootFutureField: { keep: true },
        providers: [{
          id: 'provider-1',
          presetId: 'custom',
          name: 'Legacy Provider',
          apiKey: 'token',
          baseUrl: 'https://example.test',
          models: { main: 'model-main', haiku: '', sonnet: '', opus: '' },
          extraFutureField: 'keep-me',
        }],
      }, null, 2),
      'utf-8',
    )

    const report = await ensurePersistentStorageUpgraded()

    expect(report.failures).toEqual([])
    expect(report.migratedEntries).toContain('gaster-code/providers.json')

    const migrated = JSON.parse(await fs.readFile(path.join(gasterDir, 'providers.json'), 'utf-8')) as {
      schemaVersion?: number
      activeId?: string | null
      activeProviderId?: string
      rootFutureField?: unknown
      providers?: Array<Record<string, unknown>>
    }
    expect(migrated.schemaVersion).toBe(CURRENT_PROVIDER_INDEX_SCHEMA_VERSION)
    expect(migrated.activeId).toBe('provider-1')
    expect(migrated.activeProviderId).toBeUndefined()
    expect(migrated.rootFutureField).toEqual({ keep: true })
    expect(migrated.providers?.[0]?.apiFormat).toBe('anthropic')
    expect(migrated.providers?.[0]?.extraFutureField).toBe('keep-me')

    const backups = (await listFiles(gasterDir)).filter((file) => file.startsWith('providers.json.bak-before-migration-'))
    expect(backups.length).toBe(1)

    const service = new ProviderService()
    const { providers, activeId } = await service.listProviders()
    expect(providers).toHaveLength(1)
    expect(activeId).toBe('provider-1')

    await service.updateProvider('provider-1', { name: 'Renamed Provider' })
    const rewritten = JSON.parse(await fs.readFile(path.join(gasterDir, 'providers.json'), 'utf-8')) as {
      rootFutureField?: unknown
      providers?: Array<Record<string, unknown>>
    }
    expect(rewritten.rootFutureField).toEqual({ keep: true })
    expect(rewritten.providers?.[0]?.extraFutureField).toBe('keep-me')
  })

  test('imports legacy cc-haha managed settings into Gaster Code storage', async () => {
    const legacyDir = path.join(tempDir, 'cc-haha')
    await fs.mkdir(legacyDir, { recursive: true })
    await fs.writeFile(
      path.join(legacyDir, 'settings.json'),
      JSON.stringify({ env: { ANTHROPIC_MODEL: 'legacy-model' } }, null, 2),
      'utf-8',
    )

    const report = await ensurePersistentStorageUpgraded()

    expect(report.failures).toEqual([])
    expect(report.migratedEntries).toContain('legacy cc-haha/settings.json')
    expect(JSON.parse(await fs.readFile(path.join(tempDir, 'gaster-code', 'settings.json'), 'utf-8'))).toEqual({
      env: { ANTHROPIC_MODEL: 'legacy-model' },
    })
  })

  test('does not write Gaster schema metadata into shared user settings', async () => {
    await fs.writeFile(
      path.join(tempDir, 'settings.json'),
      JSON.stringify({
        defaultMode: 'acceptEdits',
        userOwnedFutureField: { nested: true },
      }, null, 2),
      'utf-8',
    )

    const report = await ensurePersistentStorageUpgraded()

    expect(report.failures).toEqual([])
    const settings = JSON.parse(await fs.readFile(path.join(tempDir, 'settings.json'), 'utf-8')) as Record<string, unknown>
    expect(settings.schemaVersion).toBeUndefined()
    expect(settings.userOwnedFutureField).toEqual({ nested: true })
  })

  test('quarantines malformed managed settings instead of blocking startup', async () => {
    const gasterDir = path.join(tempDir, 'gaster-code')
    await fs.mkdir(gasterDir, { recursive: true })
    await fs.writeFile(path.join(gasterDir, 'settings.json'), '{"env":', 'utf-8')

    const report = await ensurePersistentStorageUpgraded()

    expect(report.failures).toEqual([])
    expect(report.migratedEntries).toContain('gaster-code/settings.json')
    expect(JSON.parse(await fs.readFile(path.join(gasterDir, 'settings.json'), 'utf-8'))).toEqual({})
    const quarantined = (await listFiles(gasterDir)).filter((file) => file.startsWith('settings.json.invalid-'))
    expect(quarantined.length).toBe(1)
  })
})
