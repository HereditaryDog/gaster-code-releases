import * as fs from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import * as path from 'node:path'
import { getClaudeConfigDir, getGasterConfigPath } from '../utils/gasterConfig.js'
import {
  findCuratedCapability,
  listCuratedCapabilities,
  type CuratedCapabilityItem,
  type CuratedCapabilityKind,
} from './curatedCatalog.js'

const CONFIG_FILE = 'capabilities.json'

type CuratedCapabilityConfig = {
  version: 1
  disabled?: {
    skills?: string[]
    agents?: string[]
  }
}

type ParsedConfig = {
  config: CuratedCapabilityConfig
  warnings: string[]
}

function defaultConfig(): CuratedCapabilityConfig {
  return { version: 1, disabled: { skills: [], agents: [] } }
}

function getConfigPath(): string {
  return getGasterConfigPath(getClaudeConfigDir(), CONFIG_FILE)
}

function normalizeConfig(value: unknown): CuratedCapabilityConfig {
  if (!value || typeof value !== 'object') return defaultConfig()

  const raw = value as { disabled?: { skills?: unknown; agents?: unknown } }
  return {
    version: 1,
    disabled: {
      skills: Array.isArray(raw.disabled?.skills)
        ? raw.disabled.skills.filter((item): item is string => typeof item === 'string')
        : [],
      agents: Array.isArray(raw.disabled?.agents)
        ? raw.disabled.agents.filter((item): item is string => typeof item === 'string')
        : [],
    },
  }
}

async function readConfig(): Promise<ParsedConfig> {
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf-8')
    if (!raw.trim()) {
      return {
        config: defaultConfig(),
        warnings: [
          'Curated capabilities config is empty; using default enabled state.',
        ],
      }
    }
    return { config: normalizeConfig(JSON.parse(raw)), warnings: [] }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return { config: defaultConfig(), warnings: [] }

    return {
      config: defaultConfig(),
      warnings: [
        `Failed to read curated capabilities config; using default enabled state: ${error instanceof Error ? error.message : String(error)}`,
      ],
    }
  }
}

function readConfigSync(): CuratedCapabilityConfig {
  try {
    const filePath = getConfigPath()
    if (!existsSync(filePath)) return defaultConfig()

    const raw = readFileSync(filePath, 'utf-8')
    if (!raw.trim()) return defaultConfig()

    return normalizeConfig(JSON.parse(raw))
  } catch {
    return defaultConfig()
  }
}

function disabledSet(
  config: CuratedCapabilityConfig,
  kind: CuratedCapabilityKind,
): Set<string> {
  return new Set(config.disabled?.[kind] ?? [])
}

function toItems(
  kind: CuratedCapabilityKind,
  disabled: Set<string>,
): CuratedCapabilityItem[] {
  return listCuratedCapabilities(kind).map(item => ({
    ...item,
    enabled: !disabled.has(item.id),
  }))
}

export async function getCuratedCapabilityState(): Promise<{
  skills: CuratedCapabilityItem[]
  agents: CuratedCapabilityItem[]
  warnings: string[]
}> {
  const { config, warnings } = await readConfig()
  return {
    skills: toItems('skills', disabledSet(config, 'skills')),
    agents: toItems('agents', disabledSet(config, 'agents')),
    warnings,
  }
}

export function isCuratedCapabilityEnabled(
  kind: CuratedCapabilityKind,
  id: string,
): boolean {
  if (!findCuratedCapability(kind, id)) return false
  return !disabledSet(readConfigSync(), kind).has(id)
}

export async function setCuratedCapabilityEnabled(
  kind: CuratedCapabilityKind,
  id: string,
  enabled: boolean,
): Promise<CuratedCapabilityItem> {
  const definition = findCuratedCapability(kind, id)
  if (!definition) {
    throw new Error(`Unknown curated ${kind} capability: ${id}`)
  }

  const { config } = await readConfig()
  const disabled: Record<CuratedCapabilityKind, Set<string>> = {
    skills: new Set(config.disabled?.skills ?? []),
    agents: new Set(config.disabled?.agents ?? []),
  }

  if (enabled) disabled[kind].delete(id)
  else disabled[kind].add(id)

  const nextConfig: CuratedCapabilityConfig = {
    version: 1,
    disabled: {
      skills: [...disabled.skills]
        .filter(skillId => findCuratedCapability('skills', skillId))
        .sort(),
      agents: [...disabled.agents]
        .filter(agentId => findCuratedCapability('agents', agentId))
        .sort(),
    },
  }

  const filePath = getConfigPath()
  await fs.mkdir(path.dirname(filePath), { recursive: true })

  const tmpFile = `${filePath}.tmp.${process.pid}.${crypto.randomUUID()}`
  try {
    await fs.writeFile(tmpFile, JSON.stringify(nextConfig, null, 2) + '\n', 'utf-8')
    await fs.rename(tmpFile, filePath)
  } catch (error) {
    await fs.unlink(tmpFile).catch(() => {})
    throw error
  }

  return { ...definition, enabled }
}
