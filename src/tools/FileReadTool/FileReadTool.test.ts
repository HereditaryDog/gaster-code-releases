import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

type Operation =
  | { type: 'resize'; width: number; height: number }
  | { type: 'jpeg'; quality?: number }
  | { type: 'png'; compressionLevel?: number; palette?: boolean }
  | { type: 'webp'; quality?: number; lossless?: boolean }

let imageBuffer: Buffer
let metadata: { width?: number; height?: number; format?: string }
let resizeCalls: Array<{ width: number; height: number }> = []

mock.module('./imageProcessor.js', () => ({
  getImageProcessor: async () => {
    return (_input: Buffer) => {
      const operations: Operation[] = []
      const instance = {
        metadata: async () => metadata,
        resize: (width: number, height: number) => {
          resizeCalls.push({ width, height })
          operations.push({ type: 'resize', width, height })
          return instance
        },
        jpeg: (options?: { quality?: number }) => {
          operations.push({ type: 'jpeg', quality: options?.quality })
          return instance
        },
        png: (options?: { compressionLevel?: number; palette?: boolean }) => {
          operations.push({
            type: 'png',
            compressionLevel: options?.compressionLevel,
            palette: options?.palette,
          })
          return instance
        },
        webp: (options?: { quality?: number; lossless?: boolean }) => {
          operations.push({
            type: 'webp',
            quality: options?.quality,
            lossless: options?.lossless,
          })
          return instance
        },
        toBuffer: async () => {
          const lastResize = [...operations]
            .reverse()
            .find((operation): operation is Extract<Operation, { type: 'resize' }> => operation.type === 'resize')
          if (!lastResize) return imageBuffer
          const buffer = Buffer.from(imageBuffer)
          buffer.writeUInt32BE(lastResize.width, 16)
          buffer.writeUInt32BE(lastResize.height, 20)
          return buffer
        },
      }
      return instance
    }
  },
}))

const { readImageWithTokenBudget } = await import('./FileReadTool.js')
const { setFsImplementation, setOriginalFsImplementation } = await import('../../utils/fsOperations.js')

function makePngHeader(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(32)
  buffer[0] = 0x89
  buffer[1] = 0x50
  buffer[2] = 0x4e
  buffer[3] = 0x47
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  return buffer
}

describe('readImageWithTokenBudget', () => {
  beforeEach(() => {
    imageBuffer = makePngHeader(1200, 1200)
    metadata = { width: 1200, height: 1200, format: 'png' }
    resizeCalls = []
    setFsImplementation({
      readFileBytes: async () => imageBuffer,
    } as never)
  })

  afterEach(() => {
    setOriginalFsImplementation()
  })

  test('downsamples image blocks by vision token budget instead of base64 text length', async () => {
    const maxTokens = 100

    const result = await readImageWithTokenBudget('/tmp/screenshot.png', maxTokens)

    expect(resizeCalls.length).toBeGreaterThan(0)
    expect(result.file.dimensions?.displayWidth).toBeDefined()
    expect(result.file.dimensions?.displayHeight).toBeDefined()
    expect(
      (result.file.dimensions?.displayWidth ?? 0) *
        (result.file.dimensions?.displayHeight ?? 0),
    ).toBeLessThanOrEqual(maxTokens * 750)
  })
})
