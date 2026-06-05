// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RefObject } from 'react'
import { browserHost } from '../../lib/desktopHost/browserHost'

import { useComposerFileDrop } from './useComposerFileDrop'

const onDragDropEvent = vi.fn()

function installDesktopHost() {
  window.desktopHost = {
    ...browserHost,
    kind: 'electron',
    isDesktop: true,
    webview: {
      ...browserHost.webview,
      onDragDropEvent,
    },
  }
}

describe('useComposerFileDrop desktop host integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Reflect.deleteProperty(window, 'desktopHost')
    installDesktopHost()
    onDragDropEvent.mockResolvedValue(vi.fn())
  })

  it('adds path-only attachments from host webview drop payloads inside the composer panel', async () => {
    let dragDropHandler: ((event: unknown) => void) | null = null
    onDragDropEvent.mockImplementation(async (handler: (event: unknown) => void) => {
      dragDropHandler = handler
      return vi.fn()
    })
    const panel = document.createElement('div')
    panel.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      left: 10,
      top: 20,
      right: 210,
      bottom: 220,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    })
    const panelRef = { current: panel } as RefObject<HTMLElement>
    const onAttachments = vi.fn()

    renderHook(() => useComposerFileDrop({
      panelRef,
      onAttachments,
    }))

    await waitFor(() => {
      expect(onDragDropEvent).toHaveBeenCalled()
      expect(dragDropHandler).toBeTruthy()
    })

    act(() => {
      dragDropHandler?.({
        payload: {
          type: 'drop',
          paths: ['/Users/alice/project/native.txt'],
          position: { x: 30, y: 40 },
        },
      })
    })

    expect(onAttachments).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'native.txt',
        path: '/Users/alice/project/native.txt',
        type: 'file',
      }),
    ])
    expect(onAttachments.mock.calls[0]?.[0][0].data).toBeUndefined()
  })

  it('does not also read dropped File blobs after native desktop path handling is installed', async () => {
    let dragDropHandler: ((event: unknown) => void) | null = null
    onDragDropEvent.mockImplementation(async (handler: (event: unknown) => void) => {
      dragDropHandler = handler
      return vi.fn()
    })
    const panel = document.createElement('div')
    panel.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 300,
      bottom: 300,
      width: 300,
      height: 300,
      toJSON: () => ({}),
    })
    const panelRef = { current: panel } as RefObject<HTMLElement>
    const onAttachments = vi.fn()

    const { result } = renderHook(() => useComposerFileDrop({
      panelRef,
      onAttachments,
    }))

    await waitFor(() => {
      expect(dragDropHandler).toBeTruthy()
    })

    act(() => {
      dragDropHandler?.({
        payload: {
          type: 'drop',
          paths: ['/Users/alice/project/native.txt'],
          position: { x: 30, y: 40 },
        },
      })
    })

    const droppedFile = new File(['browser copy'], 'native.txt', { type: 'text/plain' })
    const dropEvent = {
      preventDefault: vi.fn(),
      dataTransfer: {
        types: ['Files'],
        files: [droppedFile],
        dropEffect: 'none',
      },
    } as unknown as React.DragEvent

    act(() => {
      result.current.dragHandlers.onDrop(dropEvent)
    })

    expect(onAttachments).toHaveBeenCalledTimes(1)
    expect(onAttachments.mock.calls[0]?.[0][0]).toEqual(expect.objectContaining({
      path: '/Users/alice/project/native.txt',
    }))
    expect(dropEvent.preventDefault).not.toHaveBeenCalled()
  })
})
