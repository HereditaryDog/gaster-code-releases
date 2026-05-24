import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'

import { handleApiRequest } from '../router.js'
import { ProviderService } from '../services/providerService.js'

let tmpDir: string
let originalConfigDir: string | undefined
let originalFetch: typeof fetch

function buildReq(method: string, pathname: string, body?: unknown) {
  const url = new URL(`http://127.0.0.1:3456${pathname}`)
  const req = new Request(url.toString(), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return { req, url }
}

async function setupGMasterProvider() {
  const providerService = new ProviderService()
  await providerService.upsertManagedGMasterProvider({
    name: 'G-Master API',
    baseUrl: 'https://gmapi.example.test',
    apiFormat: 'anthropic',
    apiKey: 'sk-gmaster-desktop',
    models: { main: 'gpt-5.5', haiku: 'gpt-5.4-mini', sonnet: 'gpt-5.4', opus: 'gpt-5.4' },
  })
}

describe('images API', () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'images-api-test-'))
    originalConfigDir = process.env.CLAUDE_CONFIG_DIR
    process.env.CLAUDE_CONFIG_DIR = tmpDir
    originalFetch = globalThis.fetch
  })

  afterEach(async () => {
    if (originalConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
    else process.env.CLAUDE_CONFIG_DIR = originalConfigDir
    globalThis.fetch = originalFetch
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  test('POST /api/images/generate uses the managed G-Master async gpt-image-2 channel', async () => {
    await setupGMasterProvider()
    let capturedUrl = ''
    let capturedBody: Record<string, unknown> | null = null
    let capturedAuthorization = ''
    globalThis.fetch = (async (url, init) => {
      capturedUrl = String(url)
      capturedAuthorization = String((init?.headers as Record<string, string>).Authorization)
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return Response.json({
        created: 1760000000,
        data: [{ b64_json: 'iVBORw0KGgo=', revised_prompt: 'A precise neon cat poster' }],
      })
    }) as typeof fetch

    const { req, url } = buildReq('POST', '/api/images/generate', {
      prompt: 'a neon cat poster',
      size: '1024x1024',
    })

    const res = await handleApiRequest(req, url)
    const body = await res.json() as {
      image: { dataUrl: string; mimeType: string; model: string; revisedPrompt: string }
    }

    expect(res.status).toBe(200)
    expect(capturedUrl).toBe('https://gmapi.example.test/v1/images/generations/async')
    expect(capturedAuthorization).toBe('Bearer sk-gmaster-desktop')
    expect(capturedBody).toEqual({
      model: 'gpt-image-2',
      prompt: 'a neon cat poster',
      size: '1024x1024',
      n: 1,
    })
    expect(body.image).toEqual({
      src: 'data:image/png;base64,iVBORw0KGgo=',
      dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      mimeType: 'image/png',
      model: 'gpt-image-2',
      revisedPrompt: 'A precise neon cat poster',
    })
  })

  test('POST /api/images/generate maps common UI sizes to native GPT Image 2 sizes', async () => {
    await setupGMasterProvider()
    let capturedBody: Record<string, unknown> | null = null
    globalThis.fetch = (async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return Response.json({
        created: 1760000000,
        data: [{ b64_json: 'iVBORw0KGgo=' }],
      })
    }) as typeof fetch

    const { req, url } = buildReq('POST', '/api/images/generate', {
      prompt: 'a mobile wallpaper',
      size: '1080x1920',
    })

    const res = await handleApiRequest(req, url)

    expect(res.status).toBe(200)
    expect(capturedBody).toMatchObject({
      model: 'gpt-image-2',
      prompt: 'a mobile wallpaper',
      size: '1024x1536',
    })
  })

  test('POST /api/images/generate persists generated images in drawing history', async () => {
    await setupGMasterProvider()
    globalThis.fetch = (async () => {
      return Response.json({
        created: 1760000000,
        data: [{ b64_json: 'aGVsbG8=', revised_prompt: 'A precise neon cat poster' }],
      })
    }) as typeof fetch

    const { req, url } = buildReq('POST', '/api/images/generate', {
      prompt: 'a neon cat poster',
      size: '1024x1024',
    })

    const res = await handleApiRequest(req, url)
    const body = await res.json() as {
      historyItem: {
        id: string
        prompt: string
        image: { src: string; mimeType: string; model: string; revisedPrompt: string }
      }
    }

    expect(res.status).toBe(200)
    expect(body.historyItem.prompt).toBe('a neon cat poster')
    expect(body.historyItem.image.src).toContain(`/api/images/history/${body.historyItem.id}/file`)

    const historyReq = buildReq('GET', '/api/images/history')
    const historyRes = await handleApiRequest(historyReq.req, historyReq.url)
    const historyBody = await historyRes.json() as { history: Array<{ id: string; prompt: string }> }

    expect(historyRes.status).toBe(200)
    expect(historyBody.history).toEqual([
      expect.objectContaining({
        id: body.historyItem.id,
        prompt: 'a neon cat poster',
      }),
    ])

    const fileReq = buildReq('GET', `/api/images/history/${body.historyItem.id}/file`)
    const fileRes = await handleApiRequest(fileReq.req, fileReq.url)

    expect(fileRes.status).toBe(200)
    expect(fileRes.headers.get('content-type')).toBe('image/png')
    expect(Buffer.from(await fileRes.arrayBuffer()).toString('utf-8')).toBe('hello')
  })

  test('POST /api/images/enhance-prompt uses the managed G-Master text model', async () => {
    await setupGMasterProvider()
    let capturedUrl = ''
    let capturedBody: Record<string, unknown> | null = null
    let capturedApiKey = ''
    globalThis.fetch = (async (url, init) => {
      capturedUrl = String(url)
      capturedApiKey = String((init?.headers as Record<string, string>)['x-api-key'])
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return Response.json({
        content: [{
          type: 'text',
          text: JSON.stringify({
            prompt: 'A cinematic neon cat poster, dramatic rim lighting, crisp fur texture, bold graphic composition, 16:9 frame',
          }),
        }],
      })
    }) as typeof fetch

    const { req, url } = buildReq('POST', '/api/images/enhance-prompt', {
      prompt: 'neon cat poster',
      size: '1920x1080',
    })

    const res = await handleApiRequest(req, url)
    const body = await res.json() as { prompt: string; model: string }

    expect(res.status).toBe(200)
    expect(capturedUrl).toBe('https://gmapi.example.test/v1/messages')
    expect(capturedApiKey).toBe('sk-gmaster-desktop')
    expect(capturedBody?.model).toBe('deepseek-v4-flash')
    expect(capturedBody?.max_tokens).toBe(1200)
    expect(String(capturedBody?.system)).toContain('GPT Image 2')
    expect(String(capturedBody?.messages && (capturedBody.messages as Array<{ content: string }>)[0]?.content)).toContain('1920x1080')
    expect(String(capturedBody?.messages && (capturedBody.messages as Array<{ content: string }>)[0]?.content)).toContain('neon cat poster')
    expect(body).toEqual({
      prompt: 'A cinematic neon cat poster, dramatic rim lighting, crisp fur texture, bold graphic composition, 16:9 frame',
      model: 'deepseek-v4-flash',
    })
  })

  test('POST /api/images/generate reports upstream image generation timeouts', async () => {
    await setupGMasterProvider()
    globalThis.fetch = (async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError')
    }) as typeof fetch

    const { req, url } = buildReq('POST', '/api/images/generate', {
      prompt: 'a neon cat poster',
      size: '1024x1024',
    })

    const res = await handleApiRequest(req, url)
    const body = await res.json() as { error: string; message: string }

    expect(res.status).toBe(504)
    expect(body.error).toBe('IMAGE_GENERATION_TIMEOUT')
    expect(body.message).toContain('60s')
  })

  test('POST /api/images/generate classifies upstream request failures before a response', async () => {
    await setupGMasterProvider()
    globalThis.fetch = (async () => {
      throw new TypeError('Load failed')
    }) as typeof fetch

    const { req, url } = buildReq('POST', '/api/images/generate', {
      prompt: 'a long portrait prompt with detailed lighting, fabric, room, mirror, and natural window reflections',
      size: '1024x1365',
    })

    const res = await handleApiRequest(req, url)
    const body = await res.json() as { error: string; message: string }

    expect(res.status).toBe(502)
    expect(body.error).toBe('IMAGE_GENERATION_UPSTREAM_REQUEST_FAILED')
    expect(body.message).toContain('G-Master API image request was interrupted')
    expect(body.message).toContain('prompt is not rewritten')
  })

  test('POST /api/images/generate classifies upstream 524 as an image channel timeout', async () => {
    await setupGMasterProvider()
    globalThis.fetch = (async () => {
      return Response.json({
        error: { message: 'Image generation failed with HTTP 524' },
      }, { status: 524 })
    }) as typeof fetch

    const { req, url } = buildReq('POST', '/api/images/generate', {
      prompt: 'a neon cat poster',
      size: '1024x1024',
    })

    const res = await handleApiRequest(req, url)
    const body = await res.json() as { error: string; message: string }

    expect(res.status).toBe(504)
    expect(body.error).toBe('IMAGE_GENERATION_UPSTREAM_TIMEOUT')
    expect(body.message).toContain('HTTP 524')
  })

  test('POST /api/images/generate classifies upstream image channel 403 errors', async () => {
    await setupGMasterProvider()
    globalThis.fetch = (async () => {
      return Response.json({
        error: { message: 'openai_error' },
      }, { status: 403 })
    }) as typeof fetch

    const { req, url } = buildReq('POST', '/api/images/generate', {
      prompt: 'a neon cat poster',
      size: '1024x1024',
    })

    const res = await handleApiRequest(req, url)
    const body = await res.json() as { error: string; message: string }

    expect(res.status).toBe(403)
    expect(body.error).toBe('IMAGE_GENERATION_UPSTREAM_FORBIDDEN')
    expect(body.message).toContain('G-Master API image channel returned 403')
  })

  test('POST /api/images/generate reports a missing managed G-Master provider', async () => {
    const { req, url } = buildReq('POST', '/api/images/generate', { prompt: 'a cat' })

    const res = await handleApiRequest(req, url)
    const body = await res.json() as { message: string }

    expect(res.status).toBe(409)
    expect(body.message).toContain('G-Master API')
  })
})
