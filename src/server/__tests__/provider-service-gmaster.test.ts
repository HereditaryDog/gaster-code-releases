import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { ProviderService } from '../services/providerService.js'

let tmpDir: string
let originalConfigDir: string | undefined
let service: ProviderService

async function setup() {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'provider-gmaster-test-'))
  originalConfigDir = process.env.CLAUDE_CONFIG_DIR
  process.env.CLAUDE_CONFIG_DIR = tmpDir
  ProviderService.setServerPort(3456)
  service = new ProviderService()
}

async function teardown() {
  if (originalConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
  else process.env.CLAUDE_CONFIG_DIR = originalConfigDir
  await fs.rm(tmpDir, { recursive: true, force: true })
}

describe('ProviderService managed G-Master provider', () => {
  beforeEach(setup)
  afterEach(teardown)

  test('upserts and activates managed G-Master provider', async () => {
    const provider = await service.upsertManagedGMasterProvider({
      name: 'G-Master API',
      baseUrl: 'https://gmapi.example.test',
      apiFormat: 'anthropic',
      apiKey: 'sk-gmaster-desktop',
      models: { main: 'gpt-5.4', haiku: 'gpt-5.4-mini', sonnet: 'gpt-5.4', opus: 'gpt-5.4' },
    })

    expect(provider.id).toBe('managed-gmaster-api')
    expect(provider.managed).toEqual({ type: 'gmaster' })
    const listed = await service.listProviders()
    expect(listed.activeId).toBe('managed-gmaster-api')
    expect(listed.providers).toHaveLength(1)

    const settings = await service.getManagedSettings()
    expect((settings.env as Record<string, string>).ANTHROPIC_BASE_URL).toBe('https://gmapi.example.test')
    expect((settings.env as Record<string, string>).ANTHROPIC_API_KEY).toBe('sk-gmaster-desktop')
  })

  test('upsert replaces previous managed token without duplicating provider or overwriting local model mapping', async () => {
    await service.upsertManagedGMasterProvider({
      name: 'G-Master API',
      baseUrl: 'https://gmapi.example.test',
      apiFormat: 'anthropic',
      apiKey: 'first-token',
      models: { main: 'm1', haiku: 'm1', sonnet: 'm1', opus: 'm1' },
      availableModels: ['deepseek-v4-pro'],
    })
    await service.upsertManagedGMasterProvider({
      name: 'G-Master API',
      baseUrl: 'https://gmapi.example.test',
      apiFormat: 'anthropic',
      apiKey: 'second-token',
      models: { main: 'm2', haiku: 'm2', sonnet: 'm2', opus: 'm2' },
      availableModels: ['claude-sonnet-4-6', 'claude-opus-4-7'],
    })

    const listed = await service.listProviders()
    expect(listed.providers).toHaveLength(1)
    expect(listed.providers[0]?.models).toEqual({ main: 'm1', haiku: 'm1', sonnet: 'm1', opus: 'm1' })
    expect((listed.providers[0] as any)?.availableModels).toEqual(['claude-sonnet-4-6', 'claude-opus-4-7'])
    expect(await service.getProviderForProxy('managed-gmaster-api')).toMatchObject({ apiKey: 'second-token' })
  })

  test('upsert does not override manually selected official provider', async () => {
    await service.upsertManagedGMasterProvider({
      name: 'G-Master API',
      baseUrl: 'https://gmapi.example.test',
      apiFormat: 'anthropic',
      apiKey: 'first-token',
      models: { main: 'm1', haiku: 'm1', sonnet: 'm1', opus: 'm1' },
    })
    await service.activateOfficial()

    await service.upsertManagedGMasterProvider({
      name: 'G-Master API',
      baseUrl: 'https://gmapi.example.test',
      apiFormat: 'anthropic',
      apiKey: 'second-token',
      models: { main: 'm2', haiku: 'm2', sonnet: 'm2', opus: 'm2' },
    })

    const listed = await service.listProviders()
    expect(listed.activeId).toBeNull()
    expect(listed.providers[0]?.apiKey).toBe('second-token')
    const settings = await service.getManagedSettings()
    expect(settings.env).toBeUndefined()
  })

  test('upsert does not override manually selected custom provider', async () => {
    await service.upsertManagedGMasterProvider({
      name: 'G-Master API',
      baseUrl: 'https://gmapi.example.test',
      apiFormat: 'anthropic',
      apiKey: 'first-token',
      models: { main: 'm1', haiku: 'm1', sonnet: 'm1', opus: 'm1' },
    })
    const customProvider = await service.addProvider({
      presetId: 'custom',
      name: 'Custom Provider',
      baseUrl: 'https://custom.example.test',
      apiFormat: 'anthropic',
      apiKey: 'sk-custom',
      models: { main: 'custom-main', haiku: 'custom-haiku', sonnet: 'custom-sonnet', opus: 'custom-opus' },
    })
    await service.activateProvider(customProvider.id)

    await service.upsertManagedGMasterProvider({
      name: 'G-Master API',
      baseUrl: 'https://gmapi.example.test',
      apiFormat: 'anthropic',
      apiKey: 'second-token',
      models: { main: 'm2', haiku: 'm2', sonnet: 'm2', opus: 'm2' },
    })

    const listed = await service.listProviders()
    expect(listed.activeId).toBe(customProvider.id)
    expect(listed.providers.find((provider) => provider.id === 'managed-gmaster-api')?.apiKey).toBe('second-token')
    const settings = await service.getManagedSettings()
    expect((settings.env as Record<string, string>).ANTHROPIC_AUTH_TOKEN).toBe('sk-custom')
    expect((settings.env as Record<string, string>).ANTHROPIC_API_KEY).toBe('')
  })

  test('deleteProvider refuses managed G-Master provider', async () => {
    await service.upsertManagedGMasterProvider({
      name: 'G-Master API',
      baseUrl: 'https://gmapi.example.test',
      apiFormat: 'anthropic',
      apiKey: 'sk-gmaster-desktop',
      models: { main: 'm1', haiku: 'm1', sonnet: 'm1', opus: 'm1' },
    })
    await expect(service.deleteProvider('managed-gmaster-api')).rejects.toThrow('Cannot delete managed G-Master provider')
  })

  test('deactivates managed G-Master provider and clears credentials on logout', async () => {
    await service.upsertManagedGMasterProvider({
      name: 'G-Master API',
      baseUrl: 'https://gmapi.example.test',
      apiFormat: 'anthropic',
      apiKey: 'sk-gmaster-desktop',
      models: { main: 'm1', haiku: 'm1', sonnet: 'm1', opus: 'm1' },
    })

    await service.deactivateManagedGMasterProvider()

    const listed = await service.listProviders()
    expect(listed.activeId).toBeNull()
    expect(listed.providers).toHaveLength(1)
    expect(listed.providers[0]?.id).toBe('managed-gmaster-api')
    expect(listed.providers[0]?.apiKey).toBe('')

    const settings = await service.getManagedSettings()
    expect(settings.env).toBeUndefined()
  })
})
