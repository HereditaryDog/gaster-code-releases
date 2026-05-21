import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import {
  listCuratedCapabilities,
  type CuratedCapabilityDefinition,
} from '../../capabilities/curatedCatalog.js'
import { isCuratedCapabilityEnabled } from '../../capabilities/curatedState.js'
import { registerBundledSkill } from '../bundledSkills.js'

function promptForSkill(
  skill: CuratedCapabilityDefinition,
  args: string,
): string {
  return [
    `Use the GasterCode curated skill "${skill.displayName}" (${skill.id}).`,
    '',
    `Purpose: ${skill.description}`,
    '',
    'Work style:',
    '- Stay focused on the requested task.',
    '- Prefer existing repository patterns.',
    '- State assumptions and verification steps clearly.',
    '- Do not invent files or external services that are not needed.',
    '',
    args.trim()
      ? `User arguments: ${args.trim()}`
      : 'No extra user arguments were provided.',
  ].join('\n')
}

export function buildCuratedSkillMarkdown(
  skill: CuratedCapabilityDefinition,
): string {
  return [
    '---',
    `name: ${skill.displayName}`,
    `description: ${skill.description}`,
    `version: ${skill.version}`,
    '---',
    '',
    `# ${skill.displayName}`,
    '',
    skill.description,
    '',
    'This is a GasterCode curated bundled Skill. It is enabled by default and can be disabled from Settings.',
  ].join('\n')
}

export function registerCuratedSkills(): void {
  for (const skill of listCuratedCapabilities('skills')) {
    registerBundledSkill({
      name: skill.id,
      description: skill.description,
      whenToUse: skill.description,
      userInvocable: true,
      isEnabled: () => isCuratedCapabilityEnabled('skills', skill.id),
      getPromptForCommand: async (args): Promise<ContentBlockParam[]> => [
        { type: 'text', text: promptForSkill(skill, args) },
      ],
    })
  }
}
