import { spawn } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { promisify } from 'node:util'
import { execFile as execFileCallback } from 'node:child_process'
import { ApiError } from '../middleware/errorHandler.js'

const execFile = promisify(execFileCallback)
const DEFAULT_TTL_MS = 30_000

export type OpenTargetKind = 'ide' | 'file_manager'

export type OpenTarget = {
  id: string
  kind: OpenTargetKind
  label: string
  icon: string
  iconUrl?: string
  platform: NodeJS.Platform
}

export type OpenTargetList = {
  platform: NodeJS.Platform
  targets: OpenTarget[]
  primaryTargetId: string | null
  cachedAt: number
  ttlMs: number
}

type TargetDefinition = {
  id: string
  kind: OpenTargetKind
  label: string
  icon: string
  platforms: NodeJS.Platform[]
  commands?: Partial<Record<NodeJS.Platform, string[]>>
  fallback?: boolean
}

const TARGETS: TargetDefinition[] = [
  {
    id: 'vscode',
    kind: 'ide',
    label: 'VS Code',
    icon: 'vscode',
    platforms: ['darwin', 'win32', 'linux'],
    commands: {
      darwin: ['code'],
      win32: ['code.cmd', 'code.exe'],
      linux: ['code'],
    },
  },
  {
    id: 'cursor',
    kind: 'ide',
    label: 'Cursor',
    icon: 'cursor',
    platforms: ['darwin', 'win32', 'linux'],
    commands: {
      darwin: ['cursor'],
      win32: ['cursor.cmd', 'cursor.exe'],
      linux: ['cursor'],
    },
  },
  {
    id: 'finder',
    kind: 'file_manager',
    label: 'Finder',
    icon: 'finder',
    platforms: ['darwin'],
    fallback: true,
  },
  {
    id: 'explorer',
    kind: 'file_manager',
    label: 'Explorer',
    icon: 'folder',
    platforms: ['win32'],
    fallback: true,
  },
  {
    id: 'file-manager',
    kind: 'file_manager',
    label: 'File Manager',
    icon: 'folder',
    platforms: ['linux'],
    fallback: true,
  },
]

type DetectedTarget = OpenTarget & {
  command?: string
}

let cache: { value: DetectedTarget[]; platform: NodeJS.Platform; cachedAt: number } | null = null

async function commandExists(command: string): Promise<boolean> {
  const probe = process.platform === 'win32' ? 'where' : 'which'
  try {
    await execFile(probe, [command], {
      timeout: 3_000,
      windowsHide: true,
    })
    return true
  } catch {
    return false
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    const entry = await stat(targetPath)
    return entry.isFile() || entry.isDirectory()
  } catch {
    return false
  }
}

async function detectTargets(): Promise<DetectedTarget[]> {
  const platform = process.platform
  if (cache && cache.platform === platform && Date.now() - cache.cachedAt < DEFAULT_TTL_MS) {
    return cache.value
  }

  const detected: DetectedTarget[] = []
  for (const target of TARGETS) {
    if (!target.platforms.includes(platform)) continue

    let command: string | undefined
    for (const candidate of target.commands?.[platform] ?? []) {
      if (await commandExists(candidate)) {
        command = candidate
        break
      }
    }

    if (!command && !target.fallback) continue
    detected.push({
      id: target.id,
      kind: target.kind,
      label: target.label,
      icon: target.icon,
      platform,
      command,
    })
  }

  const fallback = detected.find((target) => target.kind === 'file_manager')
  if (!fallback) {
    detected.push({
      id: platform === 'win32' ? 'explorer' : platform === 'darwin' ? 'finder' : 'file-manager',
      kind: 'file_manager',
      label: platform === 'win32' ? 'Explorer' : platform === 'darwin' ? 'Finder' : 'File Manager',
      icon: 'folder',
      platform,
    })
  }

  cache = { value: detected, platform, cachedAt: Date.now() }
  return detected
}

function publicTarget(target: DetectedTarget): OpenTarget {
  return {
    id: target.id,
    kind: target.kind,
    label: target.label,
    icon: target.icon,
    platform: target.platform,
  }
}

async function launch(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })
      child.once('error', reject)
      child.once('spawn', () => {
        child.unref()
        resolve()
      })
    } catch (error) {
      reject(error)
    }
  })
}

function fallbackLaunchPlan(platform: NodeJS.Platform, targetPath: string): { command: string; args: string[] } {
  if (platform === 'darwin') return { command: 'open', args: [targetPath] }
  if (platform === 'win32') return { command: 'explorer.exe', args: [targetPath] }
  return { command: 'xdg-open', args: [targetPath] }
}

export const openTargetService = {
  async listTargets(): Promise<OpenTargetList> {
    const targets = await detectTargets()
    const primaryTargetId =
      targets.find((target) => target.kind === 'ide')?.id ??
      targets.find((target) => target.kind === 'file_manager')?.id ??
      null

    return {
      platform: process.platform,
      targets: targets.map(publicTarget),
      primaryTargetId,
      cachedAt: Date.now(),
      ttlMs: DEFAULT_TTL_MS,
    }
  },

  async openTarget(input: { targetId: string; path: string }): Promise<{ ok: true; targetId: string; path: string }> {
    const targetPath = input.path.trim()
    if (!targetPath) throw ApiError.badRequest('Missing project path')
    if (!(await pathExists(targetPath))) {
      throw ApiError.notFound(`Project path not found: ${targetPath}`)
    }

    const targets = await detectTargets()
    const target = targets.find((item) => item.id === input.targetId)
    if (!target) throw ApiError.notFound(`Open target not found: ${input.targetId}`)

    if (target.kind === 'ide' && target.command) {
      await launch(target.command, [targetPath])
    } else {
      const plan = fallbackLaunchPlan(process.platform, targetPath)
      await launch(plan.command, plan.args)
    }

    return { ok: true, targetId: target.id, path: targetPath }
  },

  async getTargetIcon(_targetId: string): Promise<{ contentType: 'image/png'; data: Uint8Array }> {
    throw ApiError.notFound('Open target icon not available')
  },

  clearCacheForTests() {
    cache = null
  },
}
