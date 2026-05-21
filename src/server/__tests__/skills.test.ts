import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { getCwdState, setCwdState } from '../../bootstrap/state.js'
import { setCuratedCapabilityEnabled } from '../../capabilities/curatedState.js'
import { clearInstalledPluginsCache } from '../../utils/plugins/installedPluginsManager.js'
import { clearPluginCache } from '../../utils/plugins/pluginLoader.js'
import { resetSettingsCache } from '../../utils/settings/settingsCache.js'
import { handlePluginsApi } from '../api/plugins.js'
import { handleSkillsApi } from '../api/skills.js'

let tmpHome: string
let originalHome: string | undefined
let originalUserProfile: string | undefined
let originalClaudeConfigDir: string | undefined
let originalExternalSkillRoots: string | undefined
let originalCwdState: string

function makeRequest(urlStr: string): { req: Request; url: URL; segments: string[] } {
  const url = new URL(urlStr, 'http://localhost:3456')
  const req = new Request(url.toString(), { method: 'GET' })
  return {
    req,
    url,
    segments: url.pathname.split('/').filter(Boolean),
  }
}

function makePostRequest(urlStr: string): { req: Request; url: URL; segments: string[] } {
  const url = new URL(urlStr, 'http://localhost:3456')
  const req = new Request(url.toString(), { method: 'POST' })
  return {
    req,
    url,
    segments: url.pathname.split('/').filter(Boolean),
  }
}

async function writeSkill(root: string, skillName: string, content: string): Promise<void> {
  const skillDir = path.join(root, skillName)
  await fs.mkdir(skillDir, { recursive: true })
  await fs.writeFile(path.join(skillDir, 'SKILL.md'), content, 'utf-8')
}

describe('Skills API', () => {
  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-skills-test-'))
    originalHome = process.env.HOME
    originalUserProfile = process.env.USERPROFILE
    originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR
    originalExternalSkillRoots = process.env.GASTER_CODE_SKILL_DISCOVERY_ROOTS
    originalCwdState = getCwdState()

    process.env.HOME = tmpHome
    process.env.USERPROFILE = tmpHome
    process.env.CLAUDE_CONFIG_DIR = path.join(tmpHome, '.claude')
    delete process.env.GASTER_CODE_SKILL_DISCOVERY_ROOTS
    setCwdState(tmpHome)
    clearInstalledPluginsCache()
    clearPluginCache('skills-api-test-setup')
    resetSettingsCache()
  })

  afterEach(async () => {
    clearInstalledPluginsCache()
    clearPluginCache('skills-api-test-teardown')
    resetSettingsCache()
    if (originalHome === undefined) {
      delete process.env.HOME
    } else {
      process.env.HOME = originalHome
    }

    if (originalUserProfile === undefined) {
      delete process.env.USERPROFILE
    } else {
      process.env.USERPROFILE = originalUserProfile
    }

    if (originalClaudeConfigDir === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR
    } else {
      process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir
    }

    if (originalExternalSkillRoots === undefined) {
      delete process.env.GASTER_CODE_SKILL_DISCOVERY_ROOTS
    } else {
      process.env.GASTER_CODE_SKILL_DISCOVERY_ROOTS = originalExternalSkillRoots
    }

    setCwdState(originalCwdState)
    await fs.rm(tmpHome, { recursive: true, force: true })
  })

  it('lists user and project skills for the requested cwd', async () => {
    const userSkillsRoot = path.join(tmpHome, '.claude', 'skills')
    const projectRoot = path.join(tmpHome, 'workspace')
    const cwd = path.join(projectRoot, 'packages', 'app')

    await writeSkill(
      userSkillsRoot,
      'user-skill',
      ['---', 'description: User scope', '---', '', '# User skill'].join('\n'),
    )
    await writeSkill(
      path.join(projectRoot, '.claude', 'skills'),
      'project-skill',
      ['---', 'description: Project scope', '---', '', '# Project skill'].join('\n'),
    )

    const { req, url, segments } = makeRequest(`/api/skills?cwd=${encodeURIComponent(cwd)}`)
    const res = await handleSkillsApi(req, url, segments)

    expect(res.status).toBe(200)
    const body = await res.json() as { skills: Array<{ name: string; source: string }> }
    expect(body.skills).toContainEqual(expect.objectContaining({ name: 'user-skill', source: 'user' }))
    expect(body.skills).toContainEqual(expect.objectContaining({ name: 'project-skill', source: 'project' }))
  })

  it('lists user skills installed through a directory symlink or junction', async () => {
    const linkedSkillsRoot = path.join(tmpHome, '.agents', 'skills')
    const userSkillsRoot = path.join(tmpHome, '.claude', 'skills')
    const projectRoot = path.join(tmpHome, 'workspace')
    const cwd = path.join(projectRoot, 'packages', 'app')

    await writeSkill(
      linkedSkillsRoot,
      'linked-skill',
      ['---', 'description: Linked skill', '---', '', '# Linked skill'].join('\n'),
    )
    await fs.mkdir(userSkillsRoot, { recursive: true })
    await fs.symlink(
      path.join(linkedSkillsRoot, 'linked-skill'),
      path.join(userSkillsRoot, 'linked-skill'),
      process.platform === 'win32' ? 'junction' : 'dir',
    )

    const { req, url, segments } = makeRequest(`/api/skills?cwd=${encodeURIComponent(cwd)}`)
    const res = await handleSkillsApi(req, url, segments)

    expect(res.status).toBe(200)
    const body = await res.json() as { skills: Array<{ name: string; source: string }> }
    expect(body.skills).toContainEqual(
      expect.objectContaining({ name: 'linked-skill', source: 'user' }),
    )
  })

  it('lists slash command wrappers that point to external skill folders', async () => {
    const externalSkillRoot = path.join(tmpHome, 'ai-skills', 'nature-skills', 'skills')
    const userCommandsRoot = path.join(tmpHome, '.claude', 'commands')
    const externalSkillDir = path.join(externalSkillRoot, 'nature-polishing')
    const externalSkillFile = path.join(externalSkillDir, 'SKILL.md')

    await fs.mkdir(externalSkillDir, { recursive: true })
    await fs.writeFile(
      externalSkillFile,
      [
        '---',
        'name: nature-polishing',
        'description: Polish academic prose for publication-quality English.',
        'version: 5.0.2',
        '---',
        '',
        '# Nature-Style Academic Polishing',
      ].join('\n'),
      'utf-8',
    )
    await fs.mkdir(userCommandsRoot, { recursive: true })
    await fs.writeFile(
      path.join(userCommandsRoot, 'nature-polishing.md'),
      [
        `Read \`${externalSkillFile}\` first and follow it strictly.`,
        `Read any directly needed supporting files from \`${externalSkillDir}/\`.`,
        '',
        '$ARGUMENTS',
      ].join('\n'),
      'utf-8',
    )

    const { req, url, segments } = makeRequest(`/api/skills?cwd=${encodeURIComponent(tmpHome)}`)
    const res = await handleSkillsApi(req, url, segments)

    expect(res.status).toBe(200)
    const body = await res.json() as {
      skills: Array<{
        name: string
        source: string
        description: string
        version?: string
        hasDirectory: boolean
      }>
    }
    expect(body.skills).toContainEqual(
      expect.objectContaining({
        name: 'nature-polishing',
        source: 'command',
        description: 'Polish academic prose for publication-quality English.',
        version: '5.0.2',
        hasDirectory: true,
      }),
    )

    const detailRequest = makeRequest(
      '/api/skills/detail?source=command&name=nature-polishing',
    )
    const detailRes = await handleSkillsApi(
      detailRequest.req,
      detailRequest.url,
      detailRequest.segments,
    )
    expect(detailRes.status).toBe(200)
    const detailBody = await detailRes.json() as {
      detail: {
        skillRoot: string
        files: Array<{ path: string; body?: string; isEntry?: boolean }>
      }
    }
    expect(detailBody.detail.skillRoot).toBe(externalSkillDir)
    expect(detailBody.detail.files).toContainEqual(
      expect.objectContaining({
        path: 'SKILL.md',
        isEntry: true,
        body: '# Nature-Style Academic Polishing',
      }),
    )
  })

  it('lists skills cloned into an external skills repository without slash command wrappers', async () => {
    const externalSkillDir = path.join(
      tmpHome,
      'ai-skills',
      'nature-skills',
      'skills',
      'nature-reader',
    )

    await fs.mkdir(externalSkillDir, { recursive: true })
    await fs.writeFile(
      path.join(externalSkillDir, 'SKILL.md'),
      [
        '---',
        'name: Nature Reader',
        'description: Read and summarize Nature-style research papers.',
        'version: 1.3.0',
        '---',
        '',
        '# Nature Reader',
      ].join('\n'),
      'utf-8',
    )

    const { req, url, segments } = makeRequest(`/api/skills?cwd=${encodeURIComponent(tmpHome)}`)
    const res = await handleSkillsApi(req, url, segments)

    expect(res.status).toBe(200)
    const body = await res.json() as {
      skills: Array<{
        name: string
        source: string
        displayName?: string
        description: string
        version?: string
        hasDirectory: boolean
      }>
    }
    expect(body.skills).toContainEqual(
      expect.objectContaining({
        name: 'nature-reader',
        source: 'external',
        displayName: 'Nature Reader',
        description: 'Read and summarize Nature-style research papers.',
        version: '1.3.0',
        hasDirectory: true,
      }),
    )

    const detailRequest = makeRequest(
      '/api/skills/detail?source=external&name=nature-reader',
    )
    const detailRes = await handleSkillsApi(
      detailRequest.req,
      detailRequest.url,
      detailRequest.segments,
    )

    expect(detailRes.status).toBe(200)
    const detailBody = await detailRes.json() as {
      detail: {
        skillRoot: string
        files: Array<{ path: string; body?: string; isEntry?: boolean }>
      }
    }
    expect(detailBody.detail.skillRoot).toBe(externalSkillDir)
    expect(detailBody.detail.files).toContainEqual(
      expect.objectContaining({
        path: 'SKILL.md',
        isEntry: true,
        body: '# Nature Reader',
      }),
    )
  })

  it('lists Superpowers-style category skills installed under ~/.config/superpowers', async () => {
    const superpowersSkillDir = path.join(
      tmpHome,
      '.config',
      'superpowers',
      'skills',
      'skills',
      'collaboration',
      'brainstorming',
    )

    await fs.mkdir(superpowersSkillDir, { recursive: true })
    await fs.writeFile(
      path.join(superpowersSkillDir, 'SKILL.md'),
      [
        '---',
        'name: Brainstorming Ideas Into Designs',
        'description: Interactive idea refinement using Socratic method.',
        'version: 2.2.0',
        '---',
        '',
        '# Brainstorming',
      ].join('\n'),
      'utf-8',
    )

    const { req, url, segments } = makeRequest(`/api/skills?cwd=${encodeURIComponent(tmpHome)}`)
    const res = await handleSkillsApi(req, url, segments)

    expect(res.status).toBe(200)
    const body = await res.json() as {
      skills: Array<{
        name: string
        source: string
        displayName?: string
        description: string
        version?: string
      }>
    }
    expect(body.skills).toContainEqual(
      expect.objectContaining({
        name: 'brainstorming',
        source: 'external',
        displayName: 'Brainstorming Ideas Into Designs',
        description: 'Interactive idea refinement using Socratic method.',
        version: '2.2.0',
      }),
    )
  })

  it('resolves project skill details from the nearest project skills directory', async () => {
    const projectRoot = path.join(tmpHome, 'workspace')
    const nestedRoot = path.join(projectRoot, 'packages', 'app')
    const nestedSkillsRoot = path.join(nestedRoot, '.claude', 'skills')
    const parentSkillsRoot = path.join(projectRoot, '.claude', 'skills')

    await writeSkill(
      parentSkillsRoot,
      'shared-skill',
      ['---', 'description: Parent version', '---', '', 'parent body'].join('\n'),
    )
    await writeSkill(
      nestedSkillsRoot,
      'shared-skill',
      ['---', 'description: Child version', '---', '', 'child body'].join('\n'),
    )

    const { req, url, segments } = makeRequest(
      `/api/skills/detail?source=project&name=shared-skill&cwd=${encodeURIComponent(nestedRoot)}`,
    )
    const res = await handleSkillsApi(req, url, segments)

    expect(res.status).toBe(200)
    const body = await res.json() as {
      detail: { meta: { description: string }; skillRoot: string; files: Array<{ path: string; body?: string }> }
    }

    expect(body.detail.meta.description).toBe('Child version')
    expect(body.detail.skillRoot).toBe(path.join(nestedSkillsRoot, 'shared-skill'))
    expect(body.detail.files).toContainEqual(
      expect.objectContaining({ path: 'SKILL.md', body: 'child body' }),
    )
  })

  it('lists plugin skills after reload rereads an external enable toggle', async () => {
    const marketplaceRoot = path.join(tmpHome, 'marketplace-root')
    const pluginRoot = path.join(marketplaceRoot, 'plugins', 'draw')
    const pluginsDir = path.join(tmpHome, '.claude', 'plugins')
    const marketplaceFile = path.join(
      marketplaceRoot,
      '.claude-plugin',
      'marketplace.json',
    )

    await fs.mkdir(path.join(pluginRoot, '.claude-plugin'), { recursive: true })
    await fs.mkdir(path.join(pluginRoot, 'skills', 'render'), { recursive: true })
    await fs.mkdir(path.dirname(marketplaceFile), { recursive: true })
    await fs.mkdir(pluginsDir, { recursive: true })

    await fs.writeFile(
      path.join(pluginRoot, '.claude-plugin', 'plugin.json'),
      JSON.stringify({
        name: 'draw',
        version: '1.0.0',
        description: 'Drawing plugin',
      }),
      'utf-8',
    )
    await fs.writeFile(
      path.join(pluginRoot, 'skills', 'render', 'SKILL.md'),
      [
        '---',
        'description: Render with the drawing plugin.',
        '---',
        '',
        '# Render',
      ].join('\n'),
      'utf-8',
    )
    await fs.writeFile(
      marketplaceFile,
      JSON.stringify({
        name: 'test-market',
        owner: { name: 'Test' },
        plugins: [
          {
            name: 'draw',
            source: './plugins/draw',
            version: '1.0.0',
          },
        ],
      }),
      'utf-8',
    )
    await fs.writeFile(
      path.join(pluginsDir, 'known_marketplaces.json'),
      JSON.stringify({
        'test-market': {
          source: { source: 'directory', path: marketplaceRoot },
          installLocation: marketplaceRoot,
          lastUpdated: new Date(0).toISOString(),
        },
      }),
      'utf-8',
    )

    const settingsPath = path.join(tmpHome, '.claude', 'settings.json')
    await fs.writeFile(
      settingsPath,
      JSON.stringify({
        enabledPlugins: {
          'draw@test-market': false,
        },
      }),
      'utf-8',
    )

    const initial = makeRequest('/api/skills')
    const initialRes = await handleSkillsApi(initial.req, initial.url, initial.segments)
    const initialBody = await initialRes.json() as {
      skills: Array<{ name: string; source: string }>
    }
    expect(initialBody.skills).not.toContainEqual(
      expect.objectContaining({ name: 'draw:render', source: 'plugin' }),
    )

    await fs.writeFile(
      settingsPath,
      JSON.stringify({
        enabledPlugins: {
          'draw@test-market': true,
        },
      }),
      'utf-8',
    )

    const reload = makePostRequest('/api/plugins/reload')
    const reloadRes = await handlePluginsApi(reload.req, reload.url, reload.segments)
    expect(reloadRes.status).toBe(200)

    const refreshed = makeRequest('/api/skills')
    const refreshedRes = await handleSkillsApi(
      refreshed.req,
      refreshed.url,
      refreshed.segments,
    )
    const refreshedBody = await refreshedRes.json() as {
      skills: Array<{ name: string; source: string; description: string }>
    }
    expect(refreshedBody.skills).toContainEqual(
      expect.objectContaining({
        name: 'draw:render',
        source: 'plugin',
        description: 'Render with the drawing plugin.',
      }),
    )
  })

  it('lists enabled curated bundled skills', async () => {
    const { req, url, segments } = makeRequest(`/api/skills?cwd=${encodeURIComponent(tmpHome)}`)

    const res = await handleSkillsApi(req, url, segments)
    const body = await res.json() as {
      skills: Array<{
        name: string
        source: string
        curated?: boolean
        enabled?: boolean
      }>
    }

    expect(res.status).toBe(200)
    expect(body.skills).toContainEqual(
      expect.objectContaining({
        name: 'diagnostics-analyzer',
        source: 'bundled',
        curated: true,
        enabled: true,
      }),
    )
  })

  it('hides disabled curated bundled skills from the settings skill list', async () => {
    await setCuratedCapabilityEnabled('skills', 'frontend-review', false)
    const { req, url, segments } = makeRequest(`/api/skills?cwd=${encodeURIComponent(tmpHome)}`)

    const res = await handleSkillsApi(req, url, segments)
    const body = await res.json() as { skills: Array<{ name: string }> }

    expect(res.status).toBe(200)
    expect(body.skills.some(skill => skill.name === 'frontend-review')).toBe(false)
  })

  it('returns synthesized detail for a curated bundled skill', async () => {
    const { req, url, segments } = makeRequest(
      '/api/skills/detail?source=bundled&name=diagnostics-analyzer',
    )

    const res = await handleSkillsApi(req, url, segments)
    const body = await res.json() as {
      detail: {
        meta: { name: string; source: string; displayName?: string }
        files: Array<{ path: string; body?: string; isEntry?: boolean }>
      }
    }

    expect(res.status).toBe(200)
    expect(body.detail.meta).toMatchObject({
      name: 'diagnostics-analyzer',
      source: 'bundled',
      displayName: '诊断包分析',
    })
    expect(body.detail.files).toContainEqual(
      expect.objectContaining({
        path: 'SKILL.md',
        isEntry: true,
      }),
    )
  })
})
