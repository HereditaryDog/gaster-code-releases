import fs from 'node:fs/promises'
import path from 'node:path'

const CACHEABLE_ASSET_RE = /^\/assets\//

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function readEnv(primary: string, legacy?: string): string | undefined {
  return process.env[primary] || (legacy ? process.env[legacy] : undefined)
}

export async function handleStaticH5Request(req: Request, url: URL): Promise<Response | null> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return null
  }

  const distDir = await resolveH5DistDir()
  if (!distDir) {
    return null
  }

  const filePath = await resolveStaticFilePath(distDir, url.pathname)
  if (!filePath) {
    return null
  }

  const headers = new Headers({
    'Content-Type': contentTypeForPath(filePath),
    'Cache-Control': CACHEABLE_ASSET_RE.test(url.pathname)
      ? 'public, max-age=31536000, immutable'
      : 'no-store',
  })

  if (req.method === 'HEAD') {
    const stat = await fs.stat(filePath)
    headers.set('Content-Length', String(stat.size))
    return new Response(null, { status: 200, headers })
  }

  return new Response(Bun.file(filePath), { status: 200, headers })
}

async function resolveH5DistDir(): Promise<string | null> {
  const appRoot = readEnv('GASTER_CODE_APP_ROOT', 'CLAUDE_APP_ROOT')
  const candidates = [
    readEnv('GASTER_CODE_H5_DIST_DIR', 'CLAUDE_H5_DIST_DIR'),
    appRoot ? path.resolve(appRoot, '..', 'Resources', '_up_', 'dist') : undefined,
    appRoot ? path.resolve(appRoot, '..', 'Resources', 'dist') : undefined,
    appRoot ? path.resolve(appRoot, 'dist') : undefined,
    path.resolve(process.cwd(), 'desktop', 'dist'),
    path.resolve(process.cwd(), 'dist'),
  ].filter((candidate): candidate is string => !!candidate)

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(path.join(candidate, 'index.html'))
      if (stat.isFile()) {
        return path.resolve(candidate)
      }
    } catch {
      // Try the next candidate.
    }
  }

  return null
}

async function resolveStaticFilePath(distDir: string, pathname: string): Promise<string | null> {
  const requested = containedPath(distDir, pathname)
  if (!requested) {
    return null
  }

  const direct = await fileIfExists(requested)
  if (direct) {
    return direct
  }

  const nestedIndex = await fileIfExists(path.join(requested, 'index.html'))
  if (nestedIndex) {
    return nestedIndex
  }

  if (path.extname(requested)) {
    return null
  }

  return fileIfExists(path.join(distDir, 'index.html'))
}

function containedPath(root: string, pathname: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }

  const relativePath = decoded.replace(/^\/+/, '') || 'index.html'
  const candidate = path.resolve(root, relativePath)
  const relativeToRoot = path.relative(root, candidate)
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    return null
  }

  return candidate
}

async function fileIfExists(filePath: string): Promise<string | null> {
  try {
    const stat = await fs.stat(filePath)
    return stat.isFile() ? filePath : null
  } catch {
    return null
  }
}

function contentTypeForPath(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}
