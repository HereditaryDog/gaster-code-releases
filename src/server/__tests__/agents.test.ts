import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { getCwdState, setCwdState } from '../../bootstrap/state.js'
import { clearAgentDefinitionsCache } from '../../tools/AgentTool/loadAgentsDir.js'
import { handleAgentsApi } from '../api/agents.js'

let tmpHome: string
let originalHome: string | undefined
let originalUserProfile: string | undefined
let originalClaudeConfigDir: string | undefined
let originalExternalAgentRoots: string | undefined
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

async function writeUserAgent(agentName: string): Promise<void> {
  const agentsDir = path.join(tmpHome, '.claude', 'agents')
  await fs.mkdir(agentsDir, { recursive: true })
  await fs.writeFile(
    path.join(agentsDir, `${agentName}.md`),
    [
      '---',
      `name: ${agentName}`,
      `description: Use this agent to verify ${agentName}.`,
      '---',
      '',
      `You are ${agentName}.`,
    ].join('\n'),
    'utf-8',
  )
}

describe('Agents API', () => {
  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'agents-api-test-'))
    originalHome = process.env.HOME
    originalUserProfile = process.env.USERPROFILE
    originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR
    originalExternalAgentRoots = process.env.GASTER_CODE_AGENT_DISCOVERY_ROOTS
    originalCwdState = getCwdState()

    process.env.HOME = tmpHome
    process.env.USERPROFILE = tmpHome
    process.env.CLAUDE_CONFIG_DIR = path.join(tmpHome, '.claude')
    delete process.env.GASTER_CODE_AGENT_DISCOVERY_ROOTS
    setCwdState(tmpHome)
    clearAgentDefinitionsCache()
  })

  afterEach(async () => {
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

    if (originalExternalAgentRoots === undefined) {
      delete process.env.GASTER_CODE_AGENT_DISCOVERY_ROOTS
    } else {
      process.env.GASTER_CODE_AGENT_DISCOVERY_ROOTS = originalExternalAgentRoots
    }

    setCwdState(originalCwdState)
    clearAgentDefinitionsCache()
    await fs.rm(tmpHome, { recursive: true, force: true })
  })

  it('refreshes externally installed user agents after an initial list read', async () => {
    const first = makeRequest(`/api/agents?cwd=${encodeURIComponent(tmpHome)}`)
    const firstRes = await handleAgentsApi(first.req, first.url, first.segments)

    expect(firstRes.status).toBe(200)
    const firstBody = await firstRes.json() as {
      allAgents: Array<{ agentType: string }>
    }
    expect(firstBody.allAgents.some(agent => agent.agentType === 'nature-polishing')).toBe(false)

    await writeUserAgent('nature-polishing')

    const second = makeRequest(`/api/agents?cwd=${encodeURIComponent(tmpHome)}`)
    const secondRes = await handleAgentsApi(second.req, second.url, second.segments)

    expect(secondRes.status).toBe(200)
    const secondBody = await secondRes.json() as {
      allAgents: Array<{ agentType: string; source: string }>
    }
    expect(secondBody.allAgents).toContainEqual(
      expect.objectContaining({
        agentType: 'nature-polishing',
        source: 'userSettings',
      }),
    )
  })

  it('lists agents cloned into an external repository without copying them to ~/.claude/agents', async () => {
    const externalAgentsDir = path.join(tmpHome, 'ai-skills', 'nature-skills', 'agents')
    await fs.mkdir(externalAgentsDir, { recursive: true })
    await fs.writeFile(
      path.join(externalAgentsDir, 'nature-reader.md'),
      [
        '---',
        'name: nature-reader',
        'description: Use this agent to read and summarize research papers.',
        'tools: Read, Grep',
        '---',
        '',
        'You are a research paper reader.',
      ].join('\n'),
      'utf-8',
    )

    const { req, url, segments } = makeRequest(`/api/agents?cwd=${encodeURIComponent(tmpHome)}`)
    const res = await handleAgentsApi(req, url, segments)

    expect(res.status).toBe(200)
    const body = await res.json() as {
      allAgents: Array<{
        agentType: string
        source: string
        baseDir?: string
        description: string
        tools?: string[]
      }>
    }
    expect(body.allAgents).toContainEqual(
      expect.objectContaining({
        agentType: 'nature-reader',
        source: 'userSettings',
        baseDir: externalAgentsDir,
        description: 'Use this agent to read and summarize research papers.',
        tools: ['Read', 'Grep'],
      }),
    )
  })
})
