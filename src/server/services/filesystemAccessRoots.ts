import * as path from 'node:path'

const registeredRoots = new Set<string>()

function normalizeComparablePath(filePath: string): string {
  const resolved = path.resolve(filePath)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function isWithinRoot(targetPath: string, rootPath: string): boolean {
  const target = normalizeComparablePath(targetPath)
  const root = normalizeComparablePath(rootPath)
  return target === root || target.startsWith(`${root}${path.sep}`)
}

export function registerFilesystemAccessRoot(rootPath: string | null | undefined): void {
  if (!rootPath) return
  registeredRoots.add(path.resolve(rootPath))
}

export function isWithinRegisteredFilesystemRoot(targetPath: string): boolean {
  for (const rootPath of registeredRoots) {
    if (isWithinRoot(targetPath, rootPath)) return true
  }
  return false
}

export function clearFilesystemAccessRootsForTests(): void {
  registeredRoots.clear()
}
