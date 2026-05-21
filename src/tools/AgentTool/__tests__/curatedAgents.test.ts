import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { setCuratedCapabilityEnabled } from '../../../capabilities/curatedState.js'
import { getBuiltInAgents } from '../builtInAgents.js'

let tmpHome: string
let originalClaudeConfigDir: string | undefined

beforeEach(async () => {
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'gaster-curated-agent-test-'))
  originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR
  process.env.CLAUDE_CONFIG_DIR = path.join(tmpHome, '.claude')
})

afterEach(async () => {
  if (originalClaudeConfigDir === undefined) {
    delete process.env.CLAUDE_CONFIG_DIR
  } else {
    process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir
  }

  await fs.rm(tmpHome, { recursive: true, force: true })
})

describe('curated built-in agents', () => {
  it('includes curated agents by default', () => {
    const agents = getBuiltInAgents()

    expect(agents).toContainEqual(
      expect.objectContaining({
        agentType: 'gaster-frontend-engineer',
        source: 'built-in',
        baseDir: 'built-in',
      }),
    )
    expect(agents).toContainEqual(
      expect.objectContaining({
        agentType: 'gaster-release-manager',
      }),
    )
  })

  it('omits disabled curated agents', async () => {
    await setCuratedCapabilityEnabled('agents', 'gaster-release-manager', false)

    const agents = getBuiltInAgents()

    expect(agents.some(agent => agent.agentType === 'gaster-release-manager')).toBe(false)
    expect(agents.some(agent => agent.agentType === 'gaster-frontend-engineer')).toBe(true)
  })
})
