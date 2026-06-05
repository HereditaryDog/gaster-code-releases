import { beforeEach, describe, expect, it, vi } from 'vitest'
import { browserHost } from './desktopHost/browserHost'

let previewHandler: ((payload: unknown) => void) | null = null

const { prefill, sendMessage } = vi.hoisted(() => ({
  prefill: vi.fn(),
  sendMessage: vi.fn(),
}))
vi.mock('../stores/chatStore', () => ({
  useChatStore: {
    getState: () => ({
      queueComposerPrefill: prefill,
      sendMessage,
    }),
  },
}))

import { subscribePreviewEvents } from './previewEvents'

describe('subscribePreviewEvents', () => {
  beforeEach(() => {
    previewHandler = null
    prefill.mockClear()
    sendMessage.mockClear()
    window.desktopHost = {
      ...browserHost,
      kind: 'electron',
      isDesktop: true,
      capabilities: {
        ...browserHost.capabilities,
        previewWebview: true,
      },
      preview: {
        ...browserHost.preview,
        onEvent: async (handler) => {
          previewHandler = handler
          return () => {
            previewHandler = null
          }
        },
      },
    }
  })

  it('screenshot event prefills composer with an image attachment', async () => {
    await subscribePreviewEvents('s1')
    previewHandler!({ v: 1, type: 'screenshot', dataUrl: 'data:image/png;base64,AAAA', kind: 'full' })
    expect(prefill).toHaveBeenCalledWith('s1', expect.objectContaining({
      text: '',
      mode: 'append',
      attachments: [expect.objectContaining({ type: 'image', data: 'data:image/png;base64,AAAA' })],
    }))
  })

  it('selection event sends a chat turn directly with hidden prompt text + annotated screenshot', async () => {
    await subscribePreviewEvents('s1')
    const payload = { pageUrl: 'http://x/', element: { selector: '#t', tag: 'h1', classes: [] }, change: { description: '改一下' }, screenshot: { dataUrl: 'data:image/png;base64,AAAA', kind: 'element' } }
    previewHandler!(JSON.stringify({ v: 1, type: 'selection', payload }))
    expect(prefill).not.toHaveBeenCalled()
    expect(sendMessage).toHaveBeenCalledWith(
      's1',
      expect.stringContaining('改一下'),
      [expect.objectContaining({
        type: 'image',
        name: '<h1>',
        data: 'data:image/png;base64,AAAA',
        note: '改一下',
      })],
      expect.objectContaining({
        displayContent: '<h1>',
        displayAttachments: [expect.objectContaining({ name: '<h1>', note: '改一下' })],
      }),
    )
  })

  it('ignores a malformed selection payload without throwing', async () => {
    await subscribePreviewEvents('s1')
    expect(() => previewHandler!(JSON.stringify({ v: 1, type: 'selection', payload: { pageUrl: 'http://x/' } }))).not.toThrow()
  })
})
