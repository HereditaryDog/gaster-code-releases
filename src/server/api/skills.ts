/**
 * Skills REST API
 *
 * GET /api/skills              — List all installed skills (metadata only)
 * GET /api/skills/detail       — Full skill data (tree + files)
 *       ?source=user&name=xxx
 */

import * as path from 'path'
import * as fs from 'fs/promises'
import { parseFrontmatter } from '../../utils/frontmatterParser.js'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { getProjectDirsUpToHome } from '../../utils/markdownConfigLoader.js'
import { getCwd } from '../../utils/cwd.js'
import { loadAllPlugins, loadAllPluginsCacheOnly } from '../../utils/plugins/pluginLoader.js'
import { getSkillDirCommands } from '../../skills/loadSkillsDir.js'
import type { LoadedPlugin } from '../../types/plugin.js'
import { ApiError, errorResponse } from '../middleware/errorHandler.js'
import {
  findCuratedCapability,
  listCuratedCapabilities,
} from '../../capabilities/curatedCatalog.js'
import { isCuratedCapabilityEnabled } from '../../capabilities/curatedState.js'
import { buildCuratedSkillMarkdown } from '../../skills/bundled/curated.js'
import {
  discoverExternalSkillLocations,
  getSkillInstallLocations,
  type ExternalSkillLocation,
} from '../../utils/externalCapabilities.js'

// ─── Types ───────────────────────────────────────────────────────────────────

type SkillMeta = {
  name: string
  displayName?: string
  description: string
  source: 'user' | 'project' | 'command' | 'plugin' | 'external' | 'bundled'
  userInvocable: boolean
  version?: string
  contentLength: number
  hasDirectory: boolean
  pluginName?: string
  curated?: boolean
  enabled?: boolean
  category?: string
}

type SkillSource = SkillMeta['source']

type FileTreeNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

type SkillFile = {
  path: string
  content: string
  language: string
  frontmatter?: Record<string, unknown>
  body?: string
  isEntry?: boolean
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_FILES = 50
const MAX_FILE_SIZE = 100 * 1024 // 100 KB
const SKIP_ENTRIES = new Set(['node_modules', '.git', '__pycache__', '.DS_Store'])

const LANG_MAP: Record<string, string> = {
  md: 'markdown', ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript', json: 'json',
  yaml: 'yaml', yml: 'yaml', sh: 'bash', bash: 'bash',
  py: 'python', toml: 'toml', css: 'css', html: 'html',
  txt: 'text', xml: 'xml', sql: 'sql', rs: 'rust', go: 'go',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return LANG_MAP[ext] || 'text'
}

function normalizeFrontmatter(content: string, sourcePath?: string): {
  frontmatter: Record<string, unknown>
  body: string
} {
  const parsed = parseFrontmatter(content, sourcePath)
  return {
    frontmatter: parsed.frontmatter as Record<string, unknown>,
    body: parsed.content,
  }
}

function getUserSkillsDir(): string {
  return path.join(getClaudeConfigHomeDir(), 'skills')
}

function getUserCommandsDir(): string {
  return path.join(getClaudeConfigHomeDir(), 'commands')
}

function getRequestedCwd(url: URL): string {
  return url.searchParams.get('cwd') || getCwd()
}

function getProjectSkillsDirs(cwd: string): string[] {
  return getProjectDirsUpToHome('skills', cwd)
}

function getProjectCommandsDirs(cwd: string): string[] {
  return getProjectDirsUpToHome('commands', cwd)
}

async function loadSkillMeta(
  skillDir: string,
  skillName: string,
  source: SkillSource,
  pluginName?: string,
): Promise<SkillMeta | null> {
  const skillFile = path.join(skillDir, 'SKILL.md')
  try {
    const raw = await fs.readFile(skillFile, 'utf-8')
    const { frontmatter, body } = normalizeFrontmatter(raw, skillFile)

    const description =
      (frontmatter.description as string) ||
      body
        .split('\n')
        .find((l) => l.trim().length > 0)
        ?.trim() ||
      'No description'

    return {
      name: skillName,
      displayName: (frontmatter.name as string) || undefined,
      description,
      source,
      userInvocable: frontmatter['user-invocable'] !== false,
      version: frontmatter.version != null ? String(frontmatter.version) : undefined,
      contentLength: raw.length,
      hasDirectory: true,
      pluginName,
    }
  } catch {
    return null
  }
}

async function buildFileTree(
  dirPath: string,
): Promise<{ tree: FileTreeNode[]; files: SkillFile[] }> {
  const tree: FileTreeNode[] = []
  const files: SkillFile[] = []
  let fileCount = 0

  async function walk(currentPath: string, nodes: FileTreeNode[]) {
    if (fileCount >= MAX_FILES) return

    let entries: import('fs').Dirent[]
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true })
    } catch {
      return
    }

    // directories first, then alphabetical
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    for (const entry of entries) {
      if (fileCount >= MAX_FILES) break
      if (SKIP_ENTRIES.has(entry.name) || entry.name.startsWith('.')) continue

      const fullPath = path.join(currentPath, entry.name)
      const relPath = path.relative(dirPath, fullPath)

      if (entry.isDirectory()) {
        const node: FileTreeNode = {
          name: entry.name,
          path: relPath,
          type: 'directory',
          children: [],
        }
        nodes.push(node)
        await walk(fullPath, node.children!)
        if (node.children!.length === 0) delete node.children
      } else if (entry.isFile()) {
        nodes.push({ name: entry.name, path: relPath, type: 'file' })

        try {
          const stat = await fs.stat(fullPath)
          if (stat.size <= MAX_FILE_SIZE) {
            const content = await fs.readFile(fullPath, 'utf-8')
            const language = detectLanguage(entry.name)
            const isEntry = relPath === 'SKILL.md'

            if (isEntry && language === 'markdown') {
              const { frontmatter, body } = normalizeFrontmatter(content, fullPath)
              files.push({
                path: relPath,
                content: body,
                body,
                frontmatter,
                language,
                isEntry: true,
              })
            } else {
              files.push({
                path: relPath,
                content,
                language,
                isEntry: false,
              })
            }
            fileCount++
          }
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  await walk(dirPath, tree)
  return { tree, files }
}

async function collectSkillsFromRoots(
  skillRoots: string[],
  source: SkillSource,
): Promise<SkillMeta[]> {
  const skills: SkillMeta[] = []
  const seenNames = new Set<string>()

  for (const root of skillRoots) {
    let entries: import('fs').Dirent[]
    try {
      entries = await fs.readdir(root, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (
        (!entry.isDirectory() && !entry.isSymbolicLink()) ||
        entry.name.startsWith('.') ||
        seenNames.has(entry.name)
      ) {
        continue
      }

      const meta = await loadSkillMeta(path.join(root, entry.name), entry.name, source)
      if (!meta) continue

      seenNames.add(entry.name)
      skills.push(meta)
    }
  }

  return skills
}

type CommandSkillLocation = {
  commandFile: string
  commandRoot: string
  skillDir?: string
  skillFile?: string
  meta: SkillMeta
}

async function collectMarkdownFiles(root: string): Promise<string[]> {
  const files: string[] = []

  async function walk(currentPath: string) {
    let entries: import('fs').Dirent[]
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true })
    } catch {
      return
    }

    entries.sort((a, b) => a.name.localeCompare(b.name))

    for (const entry of entries) {
      if (SKIP_ENTRIES.has(entry.name) || entry.name.startsWith('.')) continue

      const fullPath = path.join(currentPath, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        files.push(fullPath)
      }
    }
  }

  await walk(root)
  return files
}

function getCommandSkillName(commandRoot: string, commandFile: string): string {
  const relativePath = path.relative(commandRoot, commandFile)
  const withoutExtension = relativePath.replace(/\.md$/i, '')
  return withoutExtension.split(path.sep).filter(Boolean).join(':')
}

async function resolveReferencedSkillFile(
  commandFile: string,
  content: string,
): Promise<string | null> {
  const candidates = Array.from(
    content.matchAll(/[`'"]([^`'"]*SKILL\.md)[`'"]/gi),
    match => match[1]?.trim(),
  ).filter((candidate): candidate is string => Boolean(candidate))

  for (const candidate of candidates) {
    if (/^[a-z]+:\/\//i.test(candidate)) continue

    const skillFile = path.isAbsolute(candidate)
      ? candidate
      : path.resolve(path.dirname(commandFile), candidate)
    if (path.basename(skillFile).toLowerCase() !== 'skill.md') continue

    try {
      const stat = await fs.stat(skillFile)
      if (stat.isFile()) return skillFile
    } catch {
      // Try the next candidate.
    }
  }

  return null
}

async function loadCommandSkillLocation(
  commandRoot: string,
  commandFile: string,
): Promise<CommandSkillLocation | null> {
  let raw: string
  try {
    raw = await fs.readFile(commandFile, 'utf-8')
  } catch {
    return null
  }

  const name = getCommandSkillName(commandRoot, commandFile)
  if (!name) return null

  const skillFile = await resolveReferencedSkillFile(commandFile, raw)
  if (skillFile) {
    const skillDir = path.dirname(skillFile)
    const meta = await loadSkillMeta(skillDir, name, 'command')
    if (meta) {
      return { commandFile, commandRoot, skillDir, skillFile, meta }
    }
  }

  const { frontmatter, body } = normalizeFrontmatter(raw, commandFile)
  const description =
    (frontmatter.description as string) ||
    body
      .split('\n')
      .find((line) => line.trim().length > 0)
      ?.trim() ||
    'Slash command'

  return {
    commandFile,
    commandRoot,
    meta: {
      name,
      displayName: (frontmatter.name as string) || undefined,
      description,
      source: 'command',
      userInvocable: true,
      version: frontmatter.version != null ? String(frontmatter.version) : undefined,
      contentLength: raw.length,
      hasDirectory: false,
    },
  }
}

async function collectCommandSkillLocations(cwd: string): Promise<Map<string, CommandSkillLocation>> {
  const locations = new Map<string, CommandSkillLocation>()
  const commandRoots = [...getProjectCommandsDirs(cwd), getUserCommandsDir()]

  for (const root of commandRoots) {
    const commandFiles = await collectMarkdownFiles(root)
    for (const commandFile of commandFiles) {
      const location = await loadCommandSkillLocation(root, commandFile)
      if (!location || locations.has(location.meta.name)) continue
      locations.set(location.meta.name, location)
    }
  }

  return locations
}

async function collectCommandSkills(cwd: string): Promise<SkillMeta[]> {
  return Array.from((await collectCommandSkillLocations(cwd)).values(), location => location.meta)
}

async function resolveSkillDir(
  source: SkillSource,
  name: string,
  cwd: string,
): Promise<string | null> {
  const skillRoots =
    source === 'user'
      ? [getUserSkillsDir()]
      : source === 'project'
        ? getProjectSkillsDirs(cwd)
        : []

  for (const root of skillRoots) {
    const skillDir = path.join(root, name)
    try {
      const stat = await fs.stat(skillDir)
      if (stat.isDirectory()) {
        return skillDir
      }
    } catch {
      // Try the next candidate root.
    }
  }

  return null
}

type PluginSkillLocation = {
  skillDir: string
  pluginName: string
}

type ExternalSkillLocationMap = Map<string, ExternalSkillLocation>

export type SkillSlashCommand = {
  name: string
  description: string
  argumentHint?: string
}

async function collectLegacySlashCommands(cwd: string): Promise<SkillSlashCommand[]> {
  const commands = await getSkillDirCommands(cwd)
  return commands
    .filter((command) =>
      command.type === 'prompt' &&
      command.loadedFrom === 'commands_DEPRECATED' &&
      command.userInvocable !== false &&
      !command.isHidden)
    .map((command) => ({
      name: command.name,
      description: command.description || '',
      ...(command.argumentHint ? { argumentHint: command.argumentHint } : {}),
    }))
}

function buildPluginSkillName(pluginName: string, skillDir: string): string {
  return `${pluginName}:${path.basename(skillDir)}`
}

async function collectPluginSkillDirectories(): Promise<Map<string, PluginSkillLocation>> {
  const locations = new Map<string, PluginSkillLocation>()

  let enabledPlugins: LoadedPlugin[]
  try {
    const result = await loadAllPluginsCacheOnly()
    if (result.errors.some((error) => error.type === 'plugin-cache-miss')) {
      enabledPlugins = (await loadAllPlugins()).enabled
    } else {
      enabledPlugins = result.enabled
    }
  } catch {
    return locations
  }

  for (const plugin of enabledPlugins) {
    const candidateRoots = [plugin.skillsPath, ...(plugin.skillsPaths ?? [])]

    for (const root of candidateRoots) {
      if (!root) continue

      const directSkillFile = path.join(root, 'SKILL.md')
      try {
        const stat = await fs.stat(directSkillFile)
        if (stat.isFile()) {
          const name = buildPluginSkillName(plugin.name, root)
          if (!locations.has(name)) {
            locations.set(name, { skillDir: root, pluginName: plugin.name })
          }
          continue
        }
      } catch {
        // Fall through and inspect as a skills root.
      }

      let entries: import('fs').Dirent[]
      try {
        entries = await fs.readdir(root, { withFileTypes: true })
      } catch {
        continue
      }

      for (const entry of entries) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue

        const skillDir = path.join(root, entry.name)
        const skillFile = path.join(skillDir, 'SKILL.md')
        try {
          const stat = await fs.stat(skillFile)
          if (!stat.isFile()) continue
        } catch {
          continue
        }

        const name = buildPluginSkillName(plugin.name, skillDir)
        if (!locations.has(name)) {
          locations.set(name, { skillDir, pluginName: plugin.name })
        }
      }
    }
  }

  return locations
}

async function collectPluginSkills(): Promise<SkillMeta[]> {
  const locations = await collectPluginSkillDirectories()
  const skills: SkillMeta[] = []

  for (const [name, location] of locations) {
    const meta = await loadSkillMeta(
      location.skillDir,
      name,
      'plugin',
      location.pluginName,
    )
    if (meta) {
      skills.push(meta)
    }
  }

  return skills
}

async function collectExternalSkillDirectories(): Promise<ExternalSkillLocationMap> {
  const locations = new Map<string, ExternalSkillLocation>()
  for (const location of await discoverExternalSkillLocations()) {
    if (!locations.has(location.name)) {
      locations.set(location.name, location)
    }
  }
  return locations
}

async function collectExternalSkills(): Promise<SkillMeta[]> {
  const locations = await collectExternalSkillDirectories()
  const skills: SkillMeta[] = []

  for (const [name, location] of locations) {
    const meta = await loadSkillMeta(location.skillDir, name, 'external')
    if (meta) {
      skills.push(meta)
    }
  }

  return skills
}

function collectCuratedBundledSkills(): SkillMeta[] {
  return listCuratedCapabilities('skills')
    .filter(skill => isCuratedCapabilityEnabled('skills', skill.id))
    .map(skill => {
      const markdown = buildCuratedSkillMarkdown(skill)
      return {
        name: skill.id,
        displayName: skill.displayName,
        description: skill.description,
        source: 'bundled',
        userInvocable: true,
        version: skill.version,
        contentLength: markdown.length,
        hasDirectory: true,
        curated: true,
        enabled: true,
        category: skill.category,
      }
    })
}

function dedupeSkillsByName(skills: SkillMeta[]): SkillMeta[] {
  const seen = new Set<string>()
  const result: SkillMeta[] = []

  for (const skill of skills) {
    if (seen.has(skill.name)) continue
    seen.add(skill.name)
    result.push(skill)
  }

  return result
}

async function collectAllSkills(cwd: string): Promise<SkillMeta[]> {
  const [userSkills, projectSkills, commandSkills, pluginSkills, externalSkills] = await Promise.all([
    collectSkillsFromRoots([getUserSkillsDir()], 'user'),
    collectSkillsFromRoots(getProjectSkillsDirs(cwd), 'project'),
    collectCommandSkills(cwd),
    collectPluginSkills(),
    collectExternalSkills(),
  ])

  const skills = dedupeSkillsByName([
    ...collectCuratedBundledSkills(),
    ...userSkills,
    ...projectSkills,
    ...commandSkills,
    ...pluginSkills,
    ...externalSkills,
  ])
  skills.sort((a, b) => a.name.localeCompare(b.name))
  return skills
}

export async function listSkillSlashCommands(cwd?: string): Promise<SkillSlashCommand[]> {
  const requestedCwd = cwd || getCwd()
  const [skills, legacyCommands] = await Promise.all([
    collectAllSkills(requestedCwd),
    collectLegacySlashCommands(requestedCwd),
  ])

  const byName = new Map<string, SkillSlashCommand>()

  for (const skill of skills) {
    if (skill.source === 'command') continue
    if (!skill.userInvocable) continue
    byName.set(skill.name, {
      name: skill.name,
      description: skill.description || '',
    })
  }

  for (const command of legacyCommands) {
    if (!byName.has(command.name)) {
      byName.set(command.name, command)
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

// ─── Router ──────────────────────────────────────────────────────────────────

export async function handleSkillsApi(
  req: Request,
  url: URL,
  segments: string[],
): Promise<Response> {
  try {
    if (req.method !== 'GET') {
      throw new ApiError(405, `Method ${req.method} not allowed`, 'METHOD_NOT_ALLOWED')
    }

    const sub = segments[2]

    switch (sub) {
      case undefined:
        return await listSkills(url)
      case 'detail':
        return await getSkillDetail(url)
      default:
        throw ApiError.notFound(`Unknown skills endpoint: ${sub}`)
    }
  } catch (error) {
    return errorResponse(error)
  }
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function listSkills(url: URL): Promise<Response> {
  const cwd = getRequestedCwd(url)
  const skills = await collectAllSkills(cwd)
  return Response.json({ skills, installLocations: getSkillInstallLocations() })
}

async function getSkillDetail(url: URL): Promise<Response> {
  const source = url.searchParams.get('source')
  const name = url.searchParams.get('name')

  if (!source || !name) {
    throw ApiError.badRequest('Missing required query parameters: source, name')
  }

  // Prevent path traversal
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    throw ApiError.badRequest('Invalid skill name')
  }

  if (
    source !== 'user' &&
    source !== 'project' &&
    source !== 'command' &&
    source !== 'plugin' &&
    source !== 'external' &&
    source !== 'bundled'
  ) {
    throw ApiError.badRequest(`Unsupported source: ${source}`)
  }

  if (source === 'bundled') {
    const skill = findCuratedCapability('skills', name)
    if (!skill || !isCuratedCapabilityEnabled('skills', skill.id)) {
      throw ApiError.notFound(`Skill not found: ${name}`)
    }

    const content = buildCuratedSkillMarkdown(skill)
    const { frontmatter, body } = normalizeFrontmatter(content, `${skill.id}/SKILL.md`)
    const meta: SkillMeta = {
      name: skill.id,
      displayName: skill.displayName,
      description: skill.description,
      source: 'bundled',
      userInvocable: true,
      version: skill.version,
      contentLength: content.length,
      hasDirectory: true,
      curated: true,
      enabled: true,
      category: skill.category,
    }

    return Response.json({
      detail: {
        meta,
        tree: [{ name: 'SKILL.md', path: 'SKILL.md', type: 'file' }],
        files: [{
          path: 'SKILL.md',
          content: body,
          body,
          frontmatter,
          language: 'markdown',
          isEntry: true,
        }],
        skillRoot: 'bundled',
      },
    })
  }

  const cwd = getRequestedCwd(url)
  if (source === 'command') {
    const commandLocation = (await collectCommandSkillLocations(cwd)).get(name)
    if (!commandLocation) {
      throw ApiError.notFound(`Skill not found: ${name}`)
    }

    if (commandLocation.skillDir) {
      const meta = await loadSkillMeta(commandLocation.skillDir, name, 'command')
      if (!meta) {
        throw ApiError.notFound(`Skill missing SKILL.md: ${name}`)
      }

      const { tree, files } = await buildFileTree(commandLocation.skillDir)
      return Response.json({
        detail: { meta, tree, files, skillRoot: commandLocation.skillDir },
      })
    }

    const raw = await fs.readFile(commandLocation.commandFile, 'utf-8')
    const { frontmatter, body } = normalizeFrontmatter(raw, commandLocation.commandFile)
    return Response.json({
      detail: {
        meta: commandLocation.meta,
        tree: [{ name: path.basename(commandLocation.commandFile), path: path.basename(commandLocation.commandFile), type: 'file' }],
        files: [{
          path: path.basename(commandLocation.commandFile),
          content: body,
          body,
          frontmatter,
          language: 'markdown',
          isEntry: true,
        }],
        skillRoot: path.dirname(commandLocation.commandFile),
      },
    })
  }

  if (source === 'external') {
    const location = (await collectExternalSkillDirectories()).get(name)
    if (!location) {
      throw ApiError.notFound(`Skill not found: ${name}`)
    }

    const meta = await loadSkillMeta(location.skillDir, name, 'external')
    if (!meta) {
      throw ApiError.notFound(`Skill missing SKILL.md: ${name}`)
    }

    const { tree, files } = await buildFileTree(location.skillDir)
    return Response.json({
      detail: { meta, tree, files, skillRoot: location.skillDir },
    })
  }

  const pluginLocations =
    source === 'plugin' ? await collectPluginSkillDirectories() : null

  const pluginLocation = pluginLocations?.get(name)
  const skillDir =
    source === 'plugin'
      ? pluginLocation?.skillDir ?? null
      : await resolveSkillDir(source, name, cwd)

  if (!skillDir) {
    throw ApiError.notFound(`Skill not found: ${name}`)
  }

  const meta = await loadSkillMeta(
    skillDir,
    name,
    source,
    pluginLocation?.pluginName,
  )
  if (!meta) {
    throw ApiError.notFound(`Skill missing SKILL.md: ${name}`)
  }

  const { tree, files } = await buildFileTree(skillDir)

  return Response.json({
    detail: { meta, tree, files, skillRoot: skillDir },
  })
}
