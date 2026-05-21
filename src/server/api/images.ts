import { Buffer } from 'node:buffer'
import { randomBytes, randomUUID } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { z } from 'zod'
import { ApiError, errorResponse } from '../middleware/errorHandler.js'
import { ProviderService } from '../services/providerService.js'
import { syncManagedGMasterProviderFromAuth } from '../services/gmasterProviderSync.js'
import type { SavedProvider } from '../types/provider.js'
import { getClaudeConfigDir, getGasterConfigPath } from '../../utils/gasterConfig.js'

const GMASTER_MANAGED_PROVIDER_ID = 'managed-gmaster-api'
const GMASTER_API_BASE_URL = 'https://gmapi.fun'
const GMASTER_IMAGE_MODEL = 'gpt-image-2'
const GMASTER_PROMPT_ENHANCEMENT_MODEL = 'deepseek-v4-flash'
const IMAGE_GENERATION_TIMEOUT_MS = 300_000
const PROMPT_ENHANCEMENT_TIMEOUT_MS = 90_000
const IMAGE_HISTORY_LIMIT = 20
const IMAGE_SIZE_VALUES = [
  '1024x1024',
  '1024x1280',
  '1024x1365',
  '1024x1536',
  '1080x1920',
  '1536x1024',
  '1365x1024',
  '1920x1080',
  '2048x1024',
] as const

type ImageSize = (typeof IMAGE_SIZE_VALUES)[number]
type NativeImageSize = '1024x1024' | '1024x1536' | '1536x1024'

const NATIVE_IMAGE_SIZE_BY_REQUESTED: Record<ImageSize, NativeImageSize> = {
  '1024x1024': '1024x1024',
  '1024x1280': '1024x1536',
  '1024x1365': '1024x1536',
  '1024x1536': '1024x1536',
  '1080x1920': '1024x1536',
  '1536x1024': '1536x1024',
  '1365x1024': '1536x1024',
  '1920x1080': '1536x1024',
  '2048x1024': '1536x1024',
}

const GenerateImageSchema = z.object({
  prompt: z.string().trim().min(1, 'Prompt is required').max(4000),
  size: z.enum(IMAGE_SIZE_VALUES).default('1024x1024'),
})
const EnhancePromptSchema = GenerateImageSchema

type ImageGenerationResponse = {
  data?: Array<{
    b64_json?: string
    url?: string
    revised_prompt?: string
  }>
}

type GeneratedImagePayload = {
  src: string
  dataUrl?: string
  url?: string
  mimeType: string
  model: string
  revisedPrompt: string | null
}

type ImageHistoryItem = {
  id: string
  prompt: string
  size: ImageSize
  image: GeneratedImagePayload
  createdAt: number
}

type StoredImageHistoryItem = {
  id: string
  prompt: string
  size: ImageSize
  image: {
    fileName?: string
    url?: string
    mimeType: string
    model: string
    revisedPrompt: string | null
  }
  createdAt: number
}

type ErrorResponseBody = {
  error?: string | {
    message?: string
    type?: string
    code?: string
  }
  message?: string
}

type MessagesResponse = {
  content?: Array<{
    type?: string
    text?: string
  }>
  error?: {
    message?: string
  }
}

const providerService = new ProviderService()

export async function handleImagesApi(req: Request, url: URL, segments: string[]): Promise<Response> {
  try {
    const action = segments[2]
    if (action === 'generate') {
      if (req.method !== 'POST') throw methodNotAllowed(req.method)
      return await handleGenerate(req, url)
    }
    if (action === 'enhance-prompt') {
      if (req.method !== 'POST') throw methodNotAllowed(req.method)
      return await handleEnhancePrompt(req)
    }
    if (action === 'history') {
      if (segments[3] && segments[4] === 'file') {
        if (req.method !== 'GET') throw methodNotAllowed(req.method)
        return await handleHistoryFile(segments[3])
      }
      if (!segments[3]) {
        if (req.method !== 'GET') throw methodNotAllowed(req.method)
        return await handleHistoryList(url)
      }
    }

    throw ApiError.notFound(`Unknown images action: ${action ?? ''}`)
  } catch (error) {
    return errorResponse(error)
  }
}

async function handleGenerate(req: Request, url: URL): Promise<Response> {
  const body = await parseJsonBody(req)
  const input = parseGenerateImageInput(body)
  const provider = await getManagedGMasterProvider()
  const baseUrl = provider.baseUrl.replace(/\/+$/, '')

  const response = await fetchImageGeneration(baseUrl, provider, input)

  const responseBody = await response.json().catch(() => null) as ImageGenerationResponse | ErrorResponseBody | null
  if (!response.ok) {
    const failure = getImageGenerationFailure(response.status, responseBody)
    throw new ApiError(failure.statusCode, failure.message, failure.code)
  }

  const image = responseBody && 'data' in responseBody ? responseBody.data?.[0] : undefined
  if (!image?.b64_json && !image?.url) {
    throw ApiError.internal('Image generation response did not include an image')
  }

  const dataUrl = image.b64_json ? `data:image/png;base64,${image.b64_json}` : undefined
  const generatedImage: GeneratedImagePayload = {
    src: dataUrl ?? image.url!,
    ...(dataUrl && { dataUrl }),
    ...(image.url && { url: image.url }),
    mimeType: 'image/png',
    model: GMASTER_IMAGE_MODEL,
    revisedPrompt: image.revised_prompt ?? null,
  }
  const historyItem = await saveGeneratedImageHistory(input, generatedImage, url.origin)

  return Response.json({
    image: generatedImage,
    historyItem,
  })
}

async function handleHistoryList(url: URL): Promise<Response> {
  const history = await readStoredImageHistory()
  return Response.json({
    history: history.map((item) => toPublicHistoryItem(item, url.origin)),
  })
}

async function handleHistoryFile(id: string): Promise<Response> {
  if (!isSafeHistoryId(id)) {
    throw ApiError.notFound('Image history item not found')
  }

  const history = await readStoredImageHistory()
  const item = history.find((entry) => entry.id === id)
  if (!item?.image.fileName || !isSafeHistoryFileName(item.image.fileName)) {
    throw ApiError.notFound('Image history item not found')
  }

  const filePath = path.join(getImageHistoryDir(), item.image.fileName)
  const file = await fs.readFile(filePath).catch(() => null)
  if (!file) {
    throw ApiError.notFound('Image history file not found')
  }

  return new Response(file, {
    headers: {
      'content-type': item.image.mimeType,
      'cache-control': 'private, max-age=31536000, immutable',
    },
  })
}

async function handleEnhancePrompt(req: Request): Promise<Response> {
  const body = await parseJsonBody(req)
  const input = parseEnhancePromptInput(body)
  const provider = await getManagedGMasterProvider()
  const baseUrl = provider.baseUrl.replace(/\/+$/, '')

  const response = await fetchPromptEnhancement(baseUrl, provider, input)
  const responseBody = await response.json().catch(() => null) as MessagesResponse | null

  if (!response.ok) {
    const message = responseBody?.error?.message
      ? responseBody.error.message
      : `Prompt enhancement failed with HTTP ${response.status}`
    throw new ApiError(response.status >= 400 && response.status < 500 ? response.status : 502, message, 'PROMPT_ENHANCEMENT_FAILED')
  }

  const text = responseBody?.content?.find((block) => block.type === 'text' && block.text)?.text
  const prompt = parseEnhancedPromptText(text ?? '')
  if (!prompt) {
    throw ApiError.internal('Prompt enhancement response did not include a prompt')
  }

  return Response.json({
    prompt,
    model: GMASTER_PROMPT_ENHANCEMENT_MODEL,
  })
}

function parseGenerateImageInput(body: Record<string, unknown>): z.infer<typeof GenerateImageSchema> {
  try {
    return GenerateImageSchema.parse(body)
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw ApiError.badRequest(err.issues.map((issue) => issue.message).join('; '))
    }
    throw err
  }
}

function parseEnhancePromptInput(body: Record<string, unknown>): z.infer<typeof EnhancePromptSchema> {
  try {
    return EnhancePromptSchema.parse(body)
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw ApiError.badRequest(err.issues.map((issue) => issue.message).join('; '))
    }
    throw err
  }
}

async function getManagedGMasterProvider(): Promise<SavedProvider> {
  const provider = await findManagedGMasterProvider()
  if (provider?.apiKey.trim()) return provider

  await syncManagedGMasterProviderFromAuth(providerService)
  const syncedProvider = await findManagedGMasterProvider()
  if (!syncedProvider || !syncedProvider.apiKey.trim()) {
    throw ApiError.conflict('G-Master API provider is not connected. Sign in with G-Master API first.')
  }
  return syncedProvider
}

async function findManagedGMasterProvider(): Promise<SavedProvider | undefined> {
  const { providers } = await providerService.listProviders()
  return providers.find((item) =>
    item.id === GMASTER_MANAGED_PROVIDER_ID ||
    item.managed?.type === 'gmaster' ||
    item.presetId === 'gmaster' ||
    normalizeBaseUrl(item.baseUrl) === normalizeBaseUrl(GMASTER_API_BASE_URL)
  )
}

async function parseJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    return await req.json() as Record<string, unknown>
  } catch {
    throw ApiError.badRequest('Invalid JSON body')
  }
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '').toLowerCase()
}

async function saveGeneratedImageHistory(
  input: z.infer<typeof GenerateImageSchema>,
  image: GeneratedImagePayload,
  origin: string,
): Promise<ImageHistoryItem> {
  const id = randomUUID()
  const createdAt = Date.now()
  const storedImage: StoredImageHistoryItem['image'] = {
    ...(image.url && { url: image.url }),
    mimeType: image.mimeType,
    model: image.model,
    revisedPrompt: image.revisedPrompt,
  }

  if (image.dataUrl) {
    const data = parseImageDataUrl(image.dataUrl)
    if (!data) throw ApiError.internal('Generated image data could not be persisted')

    const fileName = `${id}.${data.extension}`
    await fs.mkdir(getImageHistoryDir(), { recursive: true })
    await fs.writeFile(path.join(getImageHistoryDir(), fileName), data.buffer)
    storedImage.fileName = fileName
    storedImage.mimeType = data.mimeType
  }

  const storedItem: StoredImageHistoryItem = {
    id,
    prompt: input.prompt,
    size: input.size,
    image: storedImage,
    createdAt,
  }

  const previous = await readStoredImageHistory()
  const next = [storedItem, ...previous.filter((item) => item.id !== id)].slice(0, IMAGE_HISTORY_LIMIT)
  await writeStoredImageHistory(next)
  await pruneRemovedHistoryFiles(previous, next)

  return toPublicHistoryItem(storedItem, origin)
}

function parseImageDataUrl(dataUrl: string): { mimeType: string; extension: string; buffer: Buffer } | null {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl)
  if (!match) return null

  const mimeType = match[1] || 'image/png'
  const extension = getExtensionForMimeType(mimeType)
  return {
    mimeType,
    extension,
    buffer: Buffer.from(match[2].replace(/\s/g, ''), 'base64'),
  }
}

function getExtensionForMimeType(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    default:
      return 'png'
  }
}

async function readStoredImageHistory(): Promise<StoredImageHistoryItem[]> {
  let raw: string
  try {
    raw = await fs.readFile(getImageHistoryIndexPath(), 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    const entries = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { history?: unknown })?.history)
        ? (parsed as { history: unknown[] }).history
        : []

    return entries
      .map(normalizeStoredHistoryItem)
      .filter((item): item is StoredImageHistoryItem => Boolean(item))
      .slice(0, IMAGE_HISTORY_LIMIT)
  } catch {
    return []
  }
}

function normalizeStoredHistoryItem(value: unknown): StoredImageHistoryItem | null {
  if (!value || typeof value !== 'object') return null
  const entry = value as Partial<StoredImageHistoryItem>
  const image = entry.image
  if (
    typeof entry.id !== 'string' ||
    typeof entry.prompt !== 'string' ||
    !isImageSize(entry.size) ||
    typeof entry.createdAt !== 'number' ||
    !image ||
    typeof image !== 'object' ||
    typeof image.mimeType !== 'string' ||
    typeof image.model !== 'string'
  ) {
    return null
  }

  const fileName = typeof image.fileName === 'string' && isSafeHistoryFileName(image.fileName)
    ? image.fileName
    : undefined
  const imageUrl = typeof image.url === 'string' && image.url.length > 0 ? image.url : undefined
  if (!fileName && !imageUrl) return null

  return {
    id: entry.id,
    prompt: entry.prompt,
    size: entry.size,
    image: {
      ...(fileName && { fileName }),
      ...(imageUrl && { url: imageUrl }),
      mimeType: image.mimeType,
      model: image.model,
      revisedPrompt: typeof image.revisedPrompt === 'string' ? image.revisedPrompt : null,
    },
    createdAt: entry.createdAt,
  }
}

async function writeStoredImageHistory(history: StoredImageHistoryItem[]): Promise<void> {
  const filePath = getImageHistoryIndexPath()
  const tmpFile = `${filePath}.tmp.${process.pid}.${Date.now()}.${randomBytes(6).toString('hex')}`
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  try {
    await fs.writeFile(tmpFile, JSON.stringify({ history }, null, 2) + '\n', 'utf-8')
    await fs.rename(tmpFile, filePath)
  } catch (error) {
    await fs.unlink(tmpFile).catch(() => {})
    throw error
  }
}

async function pruneRemovedHistoryFiles(previous: StoredImageHistoryItem[], next: StoredImageHistoryItem[]): Promise<void> {
  const retained = new Set(next.map((item) => item.image.fileName).filter(Boolean))
  await Promise.all(previous
    .map((item) => item.image.fileName)
    .filter((fileName): fileName is string => Boolean(fileName) && !retained.has(fileName) && isSafeHistoryFileName(fileName))
    .map((fileName) => fs.unlink(path.join(getImageHistoryDir(), fileName)).catch(() => {})))
}

function toPublicHistoryItem(item: StoredImageHistoryItem, origin: string): ImageHistoryItem {
  const fileSrc = item.image.fileName
    ? `${origin}/api/images/history/${encodeURIComponent(item.id)}/file`
    : undefined

  return {
    id: item.id,
    prompt: item.prompt,
    size: item.size,
    image: {
      src: fileSrc ?? item.image.url!,
      ...(item.image.url && { url: item.image.url }),
      mimeType: item.image.mimeType,
      model: item.image.model,
      revisedPrompt: item.image.revisedPrompt,
    },
    createdAt: item.createdAt,
  }
}

function getImageHistoryDir(): string {
  return getGasterConfigPath(getClaudeConfigDir(), 'images', 'history')
}

function getImageHistoryIndexPath(): string {
  return path.join(getImageHistoryDir(), 'history.json')
}

function isImageSize(value: unknown): value is ImageSize {
  return typeof value === 'string' && (IMAGE_SIZE_VALUES as readonly string[]).includes(value)
}

function isSafeHistoryId(value: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(value)
}

function isSafeHistoryFileName(value: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(value) && !value.includes('..')
}

async function fetchPromptEnhancement(
  baseUrl: string,
  provider: SavedProvider,
  input: z.infer<typeof EnhancePromptSchema>,
): Promise<Response> {
  try {
    return await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: GMASTER_PROMPT_ENHANCEMENT_MODEL,
        max_tokens: 1200,
        temperature: 0.6,
        system: PROMPT_ENHANCEMENT_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: buildPromptEnhancementUserMessage(input.prompt, input.size),
        }],
      }),
      signal: AbortSignal.timeout(PROMPT_ENHANCEMENT_TIMEOUT_MS),
    })
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new ApiError(
        504,
        'Prompt enhancement timed out after 90s. The upstream text model did not finish in time.',
        'PROMPT_ENHANCEMENT_TIMEOUT',
      )
    }
    throw error
  }
}

const PROMPT_ENHANCEMENT_SYSTEM_PROMPT = `You rewrite user image prompts for GPT Image 2.

Rules:
- Preserve the user's core intent, subject, and language.
- Add concrete visual details that help image generation: subject, environment, composition, lighting, color, texture, camera/framing, and mood.
- Respect the requested output size/aspect ratio.
- Do not add policy-sensitive, sexual, violent, hateful, private, or trademark-infringing details.
- Return JSON only with one field: {"prompt":"..."}.
- The prompt value must be a single paragraph, under 900 characters, with no markdown.`

function buildPromptEnhancementUserMessage(prompt: string, size: z.infer<typeof EnhancePromptSchema>['size']): string {
  return `Original prompt:
${prompt}

Target GPT Image 2 size: ${size}

Rewrite it into a stronger image prompt.`
}

function parseEnhancedPromptText(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const jsonPrompt = parsePromptJson(trimmed)
  if (jsonPrompt) return normalizeEnhancedPrompt(jsonPrompt)

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]?.trim()
  if (fenced) {
    const fencedPrompt = parsePromptJson(fenced)
    if (fencedPrompt) return normalizeEnhancedPrompt(fencedPrompt)
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const embeddedPrompt = parsePromptJson(trimmed.slice(firstBrace, lastBrace + 1))
    if (embeddedPrompt) return normalizeEnhancedPrompt(embeddedPrompt)
  }

  return normalizeEnhancedPrompt(trimmed)
}

function parsePromptJson(candidate: string): string | null {
  try {
    const parsed = JSON.parse(candidate)
    if (parsed && typeof parsed === 'object' && typeof (parsed as { prompt?: unknown }).prompt === 'string') {
      return (parsed as { prompt: string }).prompt
    }
  } catch {
    return null
  }
  return null
}

function normalizeEnhancedPrompt(prompt: string): string | null {
  const clean = prompt.replace(/\s+/g, ' ').trim()
  if (!clean) return null
  return clean.slice(0, 1000)
}

function getImageGenerationFailure(
  status: number,
  responseBody: ImageGenerationResponse | ErrorResponseBody | null,
): { statusCode: number; message: string; code: string } {
  const upstreamMessage = getErrorMessageFromBody(responseBody) ?? `Image generation failed with HTTP ${status}`
  if (isImageUpstreamTimeout(status, upstreamMessage)) {
    return {
      statusCode: 504,
      code: 'IMAGE_GENERATION_UPSTREAM_TIMEOUT',
      message: `G-Master API image channel timed out upstream (HTTP ${status}). The gpt-image-2 request did not finish before the upstream gateway timeout. Upstream message: ${upstreamMessage}`,
    }
  }

  if (isImageUpstreamForbidden(status, upstreamMessage)) {
    return {
      statusCode: status,
      code: 'IMAGE_GENERATION_UPSTREAM_FORBIDDEN',
      message: `G-Master API image channel returned 403 from upstream. The gpt-image-2 channel may be unavailable or missing image-generation permission. Upstream message: ${upstreamMessage}`,
    }
  }

  return {
    statusCode: status >= 400 && status < 500 ? status : 502,
    code: 'IMAGE_GENERATION_FAILED',
    message: upstreamMessage,
  }
}

function getErrorMessageFromBody(responseBody: ImageGenerationResponse | ErrorResponseBody | null): string | null {
  if (!responseBody || typeof responseBody !== 'object') return null
  if (!('error' in responseBody) && !('message' in responseBody)) return null

  const body = responseBody as ErrorResponseBody
  if (typeof body.error === 'string' && body.error.trim()) return body.error.trim()
  if (body.error && typeof body.error === 'object' && typeof body.error.message === 'string' && body.error.message.trim()) {
    return body.error.message.trim()
  }
  if (typeof body.message === 'string' && body.message.trim()) return body.message.trim()
  return null
}

function isImageUpstreamForbidden(status: number, message: string): boolean {
  return status === 403 || /status_code=403|bad response status code 403/i.test(message)
}

function isImageUpstreamTimeout(status: number, message: string): boolean {
  return status === 524 || /http 524|status_code=524|status code 524/i.test(message)
}

async function fetchImageGeneration(
  baseUrl: string,
  provider: SavedProvider,
  input: z.infer<typeof GenerateImageSchema>,
): Promise<Response> {
  try {
    return await fetch(`${baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: GMASTER_IMAGE_MODEL,
        prompt: input.prompt,
        size: getNativeImageSize(input.size),
        n: 1,
      }),
      signal: AbortSignal.timeout(IMAGE_GENERATION_TIMEOUT_MS),
    })
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new ApiError(
        504,
        'Image generation timed out after 300s. The upstream image service did not finish in time.',
        'IMAGE_GENERATION_TIMEOUT',
      )
    }
    if (isUpstreamRequestError(error)) {
      throw new ApiError(
        502,
        'G-Master API image request was interrupted before returning a response. The upstream image channel may close longer prompt requests or reset during gateway pressure. Try a shorter prompt or retry later.',
        'IMAGE_GENERATION_UPSTREAM_REQUEST_FAILED',
      )
    }
    throw error
  }
}

function getNativeImageSize(size: ImageSize): NativeImageSize {
  return NATIVE_IMAGE_SIZE_BY_REQUESTED[size]
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')
}

function isUpstreamRequestError(error: unknown): boolean {
  const signal = collectErrorSignal(error).join(' ')
  return /load failed|failed to fetch|fetch failed|network ?error|do request failed|econnreset|econnrefused|etimedout|socket hang up|connection (?:closed|reset|terminated)|other side closed|terminated|und_err/i.test(signal)
}

function collectErrorSignal(error: unknown, seen = new Set<unknown>()): string[] {
  if (!error || seen.has(error)) return []
  seen.add(error)

  if (typeof error === 'string') return [error]
  if (error instanceof Error) {
    return [
      error.name,
      error.message,
      ...collectErrorSignal((error as Error & { cause?: unknown }).cause, seen),
    ]
  }

  if (typeof error !== 'object') return [String(error)]

  const record = error as Record<string, unknown>
  return [
    typeof record.name === 'string' ? record.name : '',
    typeof record.message === 'string' ? record.message : '',
    typeof record.code === 'string' ? record.code : '',
    typeof record.errno === 'string' ? record.errno : '',
    ...collectErrorSignal(record.cause, seen),
  ].filter(Boolean)
}

function methodNotAllowed(method: string): ApiError {
  return new ApiError(405, `Method ${method} not allowed`, 'METHOD_NOT_ALLOWED')
}
