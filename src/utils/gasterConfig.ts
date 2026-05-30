import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const GASTER_CONFIG_SUBDIR = 'gaster-code'
export const LEGACY_GASTER_CONFIG_SUBDIR = 'cc-haha'

export function getClaudeConfigDir(): string {
  return process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
}

export function getGasterConfigDir(configDir = getClaudeConfigDir()): string {
  return join(configDir, GASTER_CONFIG_SUBDIR)
}

export function getGasterConfigPath(configDir: string, ...parts: string[]): string {
  return join(configDir, GASTER_CONFIG_SUBDIR, ...parts)
}

export function getLegacyGasterConfigPath(configDir: string, ...parts: string[]): string {
  return join(configDir, LEGACY_GASTER_CONFIG_SUBDIR, ...parts)
}

export function resolveExistingGasterConfigPath(configDir: string, ...parts: string[]): string {
  const currentPath = getGasterConfigPath(configDir, ...parts)
  if (existsSync(currentPath)) return currentPath

  const legacyPath = getLegacyGasterConfigPath(configDir, ...parts)
  if (existsSync(legacyPath)) return legacyPath

  return currentPath
}
