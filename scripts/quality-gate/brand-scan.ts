#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dir, '..', '..')
const doubleHa = 'ha' + 'ha'
const oldShortProjectName = ['cc', doubleHa].join('-')
const oldOwner = 'nan' + 'mi'
const oldEnvPrefix = ['CC', doubleHa.toUpperCase()].join('_')
const gasterLegacyEnv = ['GASTER', 'CODE', 'LEGACY'].join('_')
const legacyGasterEnv = ['LEGACY', 'GASTER'].join('_')

const banned = [
  {
    label: 'legacy long source-project brand',
    pattern: new RegExp(`claude[-_ ]?code[-_ ]?${doubleHa}|claudecode[-_ ]?${doubleHa}`, 'i'),
  },
  {
    label: 'legacy short source-project brand',
    pattern: new RegExp(`cc[-_ ]?${doubleHa}|cc${doubleHa}`, 'i'),
  },
  {
    label: 'legacy CLI brand',
    pattern: new RegExp(`claude[-_ ]?${doubleHa}`, 'i'),
  },
  {
    label: 'legacy spaced source-project brand',
    pattern: new RegExp(`(?:code|claude)[-_ ]${doubleHa}`, 'i'),
  },
  {
    label: 'legacy owner identity',
    pattern: new RegExp(`(?:^|[^a-z0-9])${oldOwner}(?:[-_ ]?coder)?(?=$|[^a-z0-9])`, 'i'),
  },
  {
    label: 'legacy bare nickname',
    pattern: new RegExp(`\\b${doubleHa}\\b`, 'i'),
  },
  {
    label: 'legacy env prefix',
    pattern: new RegExp(oldEnvPrefix, 'i'),
  },
  {
    label: 'temporary renamed legacy env marker',
    pattern: new RegExp(`${gasterLegacyEnv}|${legacyGasterEnv}`),
  },
]

const binaryExtensions = new Set([
  '.avif',
  '.gif',
  '.icns',
  '.ico',
  '.jpg',
  '.jpeg',
  '.pdf',
  '.png',
  '.webp',
])

const extraScanDirs = [
  path.join(root, 'desktop', 'dist'),
  path.join(root, 'desktop', 'src-tauri', 'binaries'),
]

type Finding = {
  file: string
  line: number | null
  label: string
  match: string
}

const sourceTransparencyFiles = new Set([
  'README.md',
  'README.en.md',
  'docs/index.md',
  'docs/en/index.md',
])

const findings: Finding[] = []
const files = new Set<string>()

for (const file of getGitVisibleFiles()) {
  files.add(file)
}

for (const dir of extraScanDirs) {
  if (existsSync(dir)) {
    collectFiles(dir, files)
  }
}

for (const file of [...files].sort()) {
  const rel = path.relative(root, file)
  if (!shouldScan(rel)) continue

  for (const entry of banned) {
    const pathMatch = entry.pattern.exec(rel)
    if (pathMatch) {
      findings.push({
        file: rel,
        line: null,
        label: entry.label,
        match: pathMatch[0],
      })
    }
  }

  const content = readFileSafely(file, rel)
  if (content === null) continue

  for (const entry of banned) {
    const match = entry.pattern.exec(content)
    if (!match) continue
    const line = lineNumberForIndex(content, match.index)
    const lineText = lineTextForIndex(content, match.index)
    if (isAllowedSourceTransparencyMention(rel, entry.label, lineText)) continue
    findings.push({
      file: rel,
      line,
      label: entry.label,
      match: match[0],
    })
  }
}

if (findings.length > 0) {
  console.error(`Brand scan failed: ${findings.length} banned identifier(s) found.`)
  for (const finding of findings.slice(0, 200)) {
    const location = finding.line === null ? finding.file : `${finding.file}:${finding.line}`
    console.error(`- ${location} [${finding.label}] ${JSON.stringify(finding.match)}`)
  }
  if (findings.length > 200) {
    console.error(`... ${findings.length - 200} more finding(s) omitted`)
  }
  process.exit(1)
}

console.log(`Brand scan passed: ${files.size} file(s) checked.`)

function getGitVisibleFiles(): string[] {
  const result = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'buffer',
  })
  if (result.status !== 0) {
    const stderr = result.stderr.toString('utf8')
    throw new Error(`git ls-files failed: ${stderr}`)
  }
  return result.stdout
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((file) => path.join(root, file))
    .filter((file) => existsSync(file))
}

function collectFiles(dir: string, target: Set<string>): void {
  for (const entry of readdirSync(dir)) {
    const file = path.join(dir, entry)
    const stat = statSync(file)
    if (stat.isDirectory()) {
      collectFiles(file, target)
      continue
    }
    if (stat.isFile()) target.add(file)
  }
}

function shouldScan(rel: string): boolean {
  const normalized = rel.split(path.sep).join('/')
  if (
    normalized.startsWith('node_modules/') ||
    normalized.startsWith('desktop/node_modules/') ||
    normalized.startsWith('adapters/node_modules/') ||
    normalized.startsWith('desktop/src-tauri/target/') ||
    normalized.startsWith('docs/.vitepress/dist/') ||
    normalized.startsWith('artifacts/') ||
    normalized.startsWith('.git/')
  ) {
    return false
  }
  return !binaryExtensions.has(path.extname(normalized).toLowerCase())
}

function readFileSafely(file: string, rel: string): string | null {
  try {
    const buffer = readFileSync(file)
    if (isReleaseBinaryAsset(rel)) {
      return extractPrintableStrings(buffer)
    }
    return buffer.toString('latin1')
  } catch {
    return null
  }
}

function isReleaseBinaryAsset(rel: string): boolean {
  const normalized = rel.split(path.sep).join('/')
  return normalized.startsWith('desktop/src-tauri/binaries/')
}

function extractPrintableStrings(buffer: Buffer): string {
  const strings: string[] = []
  let current = ''
  for (const byte of buffer) {
    if (byte >= 32 && byte <= 126) {
      current += String.fromCharCode(byte)
      continue
    }
    if (current.length >= 4) strings.push(current)
    current = ''
  }
  if (current.length >= 4) strings.push(current)
  return strings.join('\n')
}

function isAllowedSourceTransparencyMention(rel: string, label: string, lineText: string): boolean {
  const normalized = rel.split(path.sep).join('/')
  if (!sourceTransparencyFiles.has(normalized)) return false
  if (label !== 'legacy short source-project brand' && label !== 'legacy bare nickname') {
    return false
  }
  const normalizedLine = lineText.toLowerCase()
  return (
    normalizedLine.includes(oldShortProjectName) &&
    (normalizedLine.includes('inspiration from') || normalizedLine.includes('claude code'))
  )
}

function lineNumberForIndex(content: string, index: number): number {
  let line = 1
  for (let i = 0; i < index; i += 1) {
    if (content.charCodeAt(i) === 10) line += 1
  }
  return line
}

function lineTextForIndex(content: string, index: number): string {
  const start = content.lastIndexOf('\n', index - 1) + 1
  const end = content.indexOf('\n', index)
  return content.slice(start, end === -1 ? content.length : end)
}
