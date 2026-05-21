import {
  listCuratedCapabilities,
  type CuratedCapabilityDefinition,
} from '../../../capabilities/curatedCatalog.js'
import { isCuratedCapabilityEnabled } from '../../../capabilities/curatedState.js'
import type { BuiltInAgentDefinition } from '../loadAgentsDir.js'

type AgentRuntime = {
  tools?: string[]
  color: BuiltInAgentDefinition['color']
  prompt: string
}

const AGENT_RUNTIME: Record<string, AgentRuntime> = {
  'gaster-frontend-engineer': {
    tools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'],
    color: 'blue',
    prompt:
      'You are a GasterCode frontend engineer. Build focused React desktop UI changes, preserve existing design patterns, and verify rendered behavior when possible.',
  },
  'gaster-backend-engineer': {
    tools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'],
    color: 'cyan',
    prompt:
      'You are a GasterCode backend engineer. Work on server APIs, runtime services, config storage, cache invalidation, and integration boundaries with focused tests.',
  },
  'gaster-qa-engineer': {
    tools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'],
    color: 'green',
    prompt:
      'You are a GasterCode QA engineer. Add regression tests first, run narrow verification, and report exact pass or failure evidence.',
  },
  'gaster-debug-investigator': {
    tools: ['Read', 'Grep', 'Glob', 'Bash'],
    color: 'yellow',
    prompt:
      'You are a GasterCode debug investigator. Explore failures, logs, diagnostics, and code paths before recommending or making changes.',
  },
  'gaster-release-manager': {
    tools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'],
    color: 'purple',
    prompt:
      'You are a GasterCode release manager. Check version consistency, release notes, packaging workflow readiness, and handoff details.',
  },
  'gaster-docs-engineer': {
    tools: ['Read', 'Grep', 'Glob', 'Edit', 'Write'],
    color: 'pink',
    prompt:
      'You are a GasterCode documentation engineer. Write clear user-facing technical copy in the existing documentation style.',
  },
}

function toBuiltInAgent(
  definition: CuratedCapabilityDefinition,
): BuiltInAgentDefinition {
  const runtime = AGENT_RUNTIME[definition.id]!
  return {
    agentType: definition.id,
    whenToUse: definition.description,
    ...(runtime.tools ? { tools: runtime.tools } : {}),
    color: runtime.color,
    source: 'built-in',
    baseDir: 'built-in',
    getSystemPrompt: () => [
      runtime.prompt,
      '',
      'Guidelines:',
      '- Keep the work tightly scoped to the requested task.',
      '- Prefer existing repository patterns and local helper APIs.',
      '- Avoid unrelated refactors.',
      '- Report changed files, verification commands, and remaining risks.',
    ].join('\n'),
  }
}

export function getCuratedBuiltInAgents(): BuiltInAgentDefinition[] {
  return listCuratedCapabilities('agents')
    .filter(agent => isCuratedCapabilityEnabled('agents', agent.id))
    .map(toBuiltInAgent)
}
