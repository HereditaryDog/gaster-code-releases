import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { clearCommandsCache, getCommands } from '../../commands.js'
import {
  CURATED_AGENT_COUNT,
  CURATED_SKILL_COUNT,
  listCuratedCapabilities,
} from '../../capabilities/curatedCatalog.js'
import {
  getCuratedCapabilityState,
  isCuratedCapabilityEnabled,
  setCuratedCapabilityEnabled,
} from '../../capabilities/curatedState.js'
import { initBundledSkills } from '../../skills/bundled/index.js'
import { clearBundledSkills } from '../../skills/bundledSkills.js'
import { handleCapabilitiesApi } from '../api/capabilities.js'

let tmpHome: string
let originalClaudeConfigDir: string | undefined
let originalAnthropicApiKey: string | undefined

function makeRequest(
  urlStr: string,
  init: RequestInit = {},
): { req: Request; url: URL; segments: string[] } {
  const url = new URL(urlStr, 'http://localhost:3456')
  const req = new Request(url.toString(), init)
  return { req, url, segments: url.pathname.split('/').filter(Boolean) }
}

beforeEach(async () => {
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'gaster-curated-test-'))
  originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR
  originalAnthropicApiKey = process.env.ANTHROPIC_API_KEY
  process.env.CLAUDE_CONFIG_DIR = path.join(tmpHome, '.claude')
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
  clearBundledSkills()
  clearCommandsCache()
})

afterEach(async () => {
  if (originalClaudeConfigDir === undefined) {
    delete process.env.CLAUDE_CONFIG_DIR
  } else {
    process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir
  }

  if (originalAnthropicApiKey === undefined) {
    delete process.env.ANTHROPIC_API_KEY
  } else {
    process.env.ANTHROPIC_API_KEY = originalAnthropicApiKey
  }

  clearBundledSkills()
  clearCommandsCache()
  await fs.rm(tmpHome, { recursive: true, force: true })
})

describe('curated capability catalog and state', () => {
  it('ships 10 skills and 6 agents enabled by default', async () => {
    expect(listCuratedCapabilities('skills')).toHaveLength(CURATED_SKILL_COUNT)
    expect(listCuratedCapabilities('agents')).toHaveLength(CURATED_AGENT_COUNT)

    const state = await getCuratedCapabilityState()

    expect(state.skills).toHaveLength(10)
    expect(state.agents).toHaveLength(6)
    expect(state.skills.every(item => item.enabled)).toBe(true)
    expect(state.agents.every(item => item.enabled)).toBe(true)
    expect(isCuratedCapabilityEnabled('skills', 'diagnostics-analyzer')).toBe(true)
    expect(isCuratedCapabilityEnabled('agents', 'gaster-release-manager')).toBe(true)
  })

  it('persists disabled overrides and re-enables by removing the override', async () => {
    await setCuratedCapabilityEnabled('skills', 'frontend-review', false)
    expect(isCuratedCapabilityEnabled('skills', 'frontend-review')).toBe(false)

    const configPath = path.join(tmpHome, '.claude', 'gaster-code', 'capabilities.json')
    const disabledRaw = JSON.parse(await fs.readFile(configPath, 'utf-8')) as {
      disabled: { skills: string[] }
    }
    expect(disabledRaw.disabled.skills).toEqual(['frontend-review'])

    await setCuratedCapabilityEnabled('skills', 'frontend-review', true)
    expect(isCuratedCapabilityEnabled('skills', 'frontend-review')).toBe(true)

    const enabledRaw = JSON.parse(await fs.readFile(configPath, 'utf-8')) as {
      disabled: { skills?: string[] }
    }
    expect(enabledRaw.disabled.skills ?? []).toEqual([])
  })

  it('treats malformed config as default enabled and reports a warning', async () => {
    const dir = path.join(tmpHome, '.claude', 'gaster-code')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'capabilities.json'), '{broken', 'utf-8')

    const state = await getCuratedCapabilityState()

    expect(state.skills.every(item => item.enabled)).toBe(true)
    expect(state.agents.every(item => item.enabled)).toBe(true)
    expect(state.warnings[0]).toContain('Failed to read curated capabilities')
  })
})

describe('Curated Capabilities API', () => {
  it('returns merged curated capability state', async () => {
    const { req, url, segments } = makeRequest('/api/capabilities/curated')

    const res = await handleCapabilitiesApi(req, url, segments)
    const body = await res.json() as {
      skills: Array<{ id: string; enabled: boolean }>
      agents: Array<{ id: string; enabled: boolean }>
      warnings: string[]
    }

    expect(res.status).toBe(200)
    expect(body.skills).toHaveLength(10)
    expect(body.agents).toHaveLength(6)
    expect(body.skills.find(item => item.id === 'diagnostics-analyzer')?.enabled).toBe(true)
    expect(body.warnings).toEqual([])
  })

  it('updates a curated capability toggle', async () => {
    const put = makeRequest('/api/capabilities/curated/agents/gaster-release-manager', {
      method: 'PUT',
      body: JSON.stringify({ enabled: false }),
    })

    const putRes = await handleCapabilitiesApi(put.req, put.url, put.segments)
    const putBody = await putRes.json() as {
      item: { id: string; enabled: boolean }
    }

    expect(putRes.status).toBe(200)
    expect(putBody.item).toMatchObject({
      id: 'gaster-release-manager',
      enabled: false,
    })
    expect(isCuratedCapabilityEnabled('agents', 'gaster-release-manager')).toBe(false)
  })

  it('rejects an unknown curated capability id', async () => {
    const put = makeRequest('/api/capabilities/curated/skills/not-real', {
      method: 'PUT',
      body: JSON.stringify({ enabled: false }),
    })

    const res = await handleCapabilitiesApi(put.req, put.url, put.segments)

    expect(res.status).toBe(404)
  })
})

describe('curated bundled skill runtime availability', () => {
  it('removes disabled curated skills from command availability', async () => {
    initBundledSkills()

    let commands = await getCommands(tmpHome)
    expect(commands.some(command => command.name === 'frontend-review')).toBe(true)

    await setCuratedCapabilityEnabled('skills', 'frontend-review', false)
    clearCommandsCache()
    commands = await getCommands(tmpHome)

    expect(commands.some(command => command.name === 'frontend-review')).toBe(false)
  })
})
