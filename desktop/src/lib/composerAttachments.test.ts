import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dialogOpen: vi.fn(),
  desktopHost: {
    isDesktop: true,
    capabilities: {
      dialogs: true,
    },
    dialogs: {
      open: vi.fn(),
    },
  },
}))

vi.mock('./desktopHost', () => ({
  getDesktopHost: () => mocks.desktopHost,
}))

import {
  filesToComposerAttachments,
  pathToComposerAttachment,
  selectNativeFileAttachments,
} from './composerAttachments'

describe('composer attachment payloads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.desktopHost = {
      isDesktop: true,
      capabilities: {
        dialogs: true,
      },
      dialogs: {
        open: mocks.dialogOpen,
      },
    }
  })

  it('keeps many selected desktop project files as paths instead of request-body data', () => {
    const projectRoot = '/tmp/gaster-code-large-attachment-regression'
    const files = Array.from({ length: 12 }, (_, index) => (
      `${projectRoot}/assets/large-${index + 1}.bin`
    ))

    const oldInlineAttachments = files.map((filePath) => ({
      type: 'file',
      name: filePath.split('/').pop(),
      data: `data:application/octet-stream;base64,${'A'.repeat(256 * 1024)}`,
      mimeType: 'application/octet-stream',
    }))
    const oldInlinePayload = JSON.stringify({
      type: 'user_message',
      content: 'analyze these files',
      attachments: oldInlineAttachments,
    })

    const pathOnlyAttachments = files.map(pathToComposerAttachment)
    const pathOnlyPayload = JSON.stringify({
      type: 'user_message',
      content: 'analyze these files',
      attachments: pathOnlyAttachments,
    })

    expect(oldInlinePayload.length).toBeGreaterThan(3 * 1024 * 1024)
    expect(pathOnlyPayload.length).toBeLessThan(3 * 1024)
    expect(pathOnlyAttachments.every((attachment) => attachment.path && !attachment.data)).toBe(true)
  })

  it('uses desktop host dialogs for path-only native file selections', async () => {
    mocks.dialogOpen.mockResolvedValueOnce([
      '/Users/alice/project/input.txt',
      '/Users/alice/project/screenshot.png',
    ])

    const attachments = await selectNativeFileAttachments()

    expect(mocks.dialogOpen).toHaveBeenCalledWith({
      multiple: true,
      directory: false,
    })
    expect(attachments).toEqual([
      expect.objectContaining({
        name: 'input.txt',
        path: '/Users/alice/project/input.txt',
        type: 'file',
      }),
      expect.objectContaining({
        name: 'screenshot.png',
        path: '/Users/alice/project/screenshot.png',
        type: 'file',
      }),
    ])
    expect(attachments?.every((attachment) => !attachment.data)).toBe(true)
  })

  it('returns null for native picker failures so browser file input can handle fallback', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.dialogOpen.mockRejectedValueOnce(new Error('dialog failed'))

    await expect(selectNativeFileAttachments()).resolves.toBeNull()

    expect(warnSpy).toHaveBeenCalledWith(
      '[attachments] Native file picker failed; falling back to browser file input',
      expect.any(Error),
    )
    warnSpy.mockRestore()
  })

  it('keeps desktop File.path attachments path-only', async () => {
    const file = new File(['large payload'], 'fallback.txt', { type: 'text/plain' })
    Object.defineProperty(file, 'path', {
      configurable: true,
      value: '/Users/alice/project/native.txt',
    })

    const attachments = await filesToComposerAttachments([file])

    expect(attachments).toEqual([
      expect.objectContaining({
        name: 'native.txt',
        path: '/Users/alice/project/native.txt',
        type: 'file',
      }),
    ])
    expect(attachments[0]?.data).toBeUndefined()
  })
})
