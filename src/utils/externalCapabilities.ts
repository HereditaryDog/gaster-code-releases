import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import type { FrontmatterData } from './frontmatterParser.js'
import { parseFrontmatter } from './frontmatterParser.js'

const MAX_DISCOVERY_DEPTH = 8
const SKIP_ENTRIES = new Set([
  '.git',
  '.hg',
  '.svn',
  '.DS_Store',
  '__pycache__',
  'node_modules',
  'dist',
  'build',
])

export type CapabilityInstallLocation = {
  id: string
  label: string
  path: string
  description: string
}

export type ExternalSkillLocation = {
  name: string
  skillDir: string
  skillFile: string
  root: string
}

export type ExternalAgentMarkdownFile = {
  filePath: string
  baseDir: string
  frontmatter: FrontmatterData
  content: string
  source: 'userSettings'
}

function getUserHomeDir(): string {
  return (process.env.HOME || process.env.USERPROFILE || os.homedir()).normalize('NFC')
}

function splitEnvRoots(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(path.delimiter)
    .map(root => root.trim())
    .filter(Boolean)
    .map(root => path.resolve(root).normalize('NFC'))
}

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const candidate of paths) {
    const normalized = path.resolve(candidate).normalize('NFC')
    if (seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

function shouldSkipEntry(name: string): boolean {
  return SKIP_ENTRIES.has(name)
}

export function getSkillInstallLocations(): CapabilityInstallLocation[] {
  const home = getUserHomeDir()
  return [
    {
      id: 'claude-user-skills',
      label: 'User skills',
      path: path.join(home, '.claude', 'skills'),
      description: 'Canonical user-level skills directory.',
    },
    {
      id: 'external-skill-repositories',
      label: 'External skill repositories',
      path: path.join(home, 'ai-skills'),
      description: 'GitHub skill repositories cloned by an agent or installed manually.',
    },
    {
      id: 'superpowers-skills',
      label: 'Superpowers skills',
      path: path.join(home, '.config', 'superpowers', 'skills', 'skills'),
      description: 'Superpowers category-based skills repository layout.',
    },
    ...splitEnvRoots(process.env.GASTER_CODE_SKILL_DISCOVERY_ROOTS).map((root, index) => ({
      id: `configured-skill-root-${index + 1}`,
      label: 'Configured skill root',
      path: root,
      description: 'Additional skill discovery root from GASTER_CODE_SKILL_DISCOVERY_ROOTS.',
    })),
  ]
}

export function getAgentInstallLocations(): CapabilityInstallLocation[] {
  const home = getUserHomeDir()
  return [
    {
      id: 'claude-user-agents',
      label: 'User agents',
      path: path.join(home, '.claude', 'agents'),
      description: 'Canonical user-level agents directory.',
    },
    {
      id: 'external-agent-repositories',
      label: 'External agent repositories',
      path: path.join(home, 'ai-skills'),
      description: 'GitHub repositories that include an agents directory.',
    },
    {
      id: 'gaster-code-user-agents',
      label: 'Gaster Code user agents',
      path: path.join(home, '.config', 'gaster-code', 'agents'),
      description: 'Gaster Code user-level agent definitions.',
    },
    ...splitEnvRoots(process.env.GASTER_CODE_AGENT_DISCOVERY_ROOTS).map((root, index) => ({
      id: `configured-agent-root-${index + 1}`,
      label: 'Configured agent root',
      path: root,
      description: 'Additional agent discovery root from GASTER_CODE_AGENT_DISCOVERY_ROOTS.',
    })),
  ]
}

function getExternalSkillDiscoveryRoots(): string[] {
  return uniquePaths(getSkillInstallLocations().map(location => location.path))
}

function getExternalAgentDiscoveryRoots(): string[] {
  return uniquePaths(getAgentInstallLocations().map(location => location.path))
}

async function discoverSkillsInRoot(root: string): Promise<ExternalSkillLocation[]> {
  const locations: ExternalSkillLocation[] = []

  async function walk(currentPath: string, depth: number): Promise<void> {
    if (depth > MAX_DISCOVERY_DEPTH) return

    let entries: import('fs').Dirent[]
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true })
    } catch {
      return
    }

    entries.sort((a, b) => a.name.localeCompare(b.name))

    const skillEntry = entries.find(
      entry => entry.isFile() && entry.name.toLowerCase() === 'skill.md',
    )
    if (skillEntry) {
      locations.push({
        name: path.basename(currentPath),
        skillDir: currentPath,
        skillFile: path.join(currentPath, skillEntry.name),
        root,
      })
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || shouldSkipEntry(entry.name)) continue
      await walk(path.join(currentPath, entry.name), depth + 1)
    }
  }

  await walk(root, 0)
  return locations
}

async function discoverAgentFilesInRoot(root: string): Promise<Array<{ filePath: string; baseDir: string }>> {
  const files: Array<{ filePath: string; baseDir: string }> = []

  async function walk(currentPath: string, depth: number, agentBaseDir?: string): Promise<void> {
    if (depth > MAX_DISCOVERY_DEPTH) return

    let entries: import('fs').Dirent[]
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true })
    } catch {
      return
    }

    entries.sort((a, b) => a.name.localeCompare(b.name))

    const currentAgentBaseDir =
      agentBaseDir ?? (path.basename(currentPath) === 'agents' ? currentPath : undefined)

    for (const entry of entries) {
      if (shouldSkipEntry(entry.name)) continue

      const fullPath = path.join(currentPath, entry.name)
      if (entry.isDirectory()) {
        const nextAgentBaseDir =
          currentAgentBaseDir ?? (entry.name === 'agents' ? fullPath : undefined)
        await walk(fullPath, depth + 1, nextAgentBaseDir)
      } else if (
        currentAgentBaseDir &&
        entry.isFile() &&
        entry.name.toLowerCase().endsWith('.md')
      ) {
        files.push({ filePath: fullPath, baseDir: currentAgentBaseDir })
      }
    }
  }

  await walk(root, 0)
  return files
}

export async function discoverExternalSkillLocations(): Promise<ExternalSkillLocation[]> {
  const roots = getExternalSkillDiscoveryRoots()
  const discovered = await Promise.all(roots.map(root => discoverSkillsInRoot(root)))
  const seen = new Set<string>()
  const locations: ExternalSkillLocation[] = []

  for (const location of discovered.flat()) {
    const key = path.resolve(location.skillFile).normalize('NFC')
    if (seen.has(key)) continue
    seen.add(key)
    locations.push(location)
  }

  locations.sort((a, b) => a.name.localeCompare(b.name) || a.skillDir.localeCompare(b.skillDir))
  return locations
}

export async function loadExternalAgentMarkdownFiles(): Promise<ExternalAgentMarkdownFile[]> {
  const roots = getExternalAgentDiscoveryRoots()
  const discovered = await Promise.all(roots.map(root => discoverAgentFilesInRoot(root)))
  const seen = new Set<string>()
  const files: ExternalAgentMarkdownFile[] = []

  for (const file of discovered.flat()) {
    const key = path.resolve(file.filePath).normalize('NFC')
    if (seen.has(key)) continue
    seen.add(key)

    try {
      const raw = await fs.readFile(file.filePath, 'utf-8')
      const parsed = parseFrontmatter(raw, file.filePath)
      files.push({
        filePath: file.filePath,
        baseDir: file.baseDir,
        frontmatter: parsed.frontmatter,
        content: parsed.content,
        source: 'userSettings',
      })
    } catch {
      // Ignore unreadable external agent files; the normal agent parser will
      // still report parse failures for readable files that declare agent intent.
    }
  }

  files.sort((a, b) => a.filePath.localeCompare(b.filePath))
  return files
}
