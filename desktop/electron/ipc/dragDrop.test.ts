import { describe, expect, it } from 'vitest'
import { createElectronDragDropPayload } from './dragDrop'

function file(name: string) {
  return { name } as File
}

function fileList(files: File[]): FileList {
  return {
    ...files,
    length: files.length,
    item: (index: number) => files[index] ?? null,
  } as unknown as FileList
}

function dataTransfer({
  files = [],
  types = [],
}: {
  files?: File[]
  types?: string[]
}) {
  return {
    files: fileList(files),
    types,
  }
}

describe('createElectronDragDropPayload', () => {
  it('normalizes dropped files to native path payloads', () => {
    const result = createElectronDragDropPayload(
      'drop',
      {
        clientX: 12,
        clientY: 34,
        dataTransfer: dataTransfer({ files: [file('one.txt'), file('two.txt')] }),
      },
      (nextFile) => `/Users/alice/project/${nextFile.name}`,
    )

    expect(result).toEqual({
      payload: {
        type: 'drop',
        paths: [
          '/Users/alice/project/one.txt',
          '/Users/alice/project/two.txt',
        ],
        position: { x: 12, y: 34 },
      },
    })
  })

  it('returns null when Electron cannot produce native paths for a drop', () => {
    const result = createElectronDragDropPayload(
      'drop',
      {
        clientX: 12,
        clientY: 34,
        dataTransfer: dataTransfer({ files: [file('one.txt')] }),
      },
      () => '',
    )

    expect(result).toBeNull()
  })

  it('returns null for non-file dragover events', () => {
    const result = createElectronDragDropPayload(
      'over',
      {
        clientX: 12,
        clientY: 34,
        dataTransfer: dataTransfer({ types: ['text/plain'] }),
      },
      () => {
        throw new Error('should not read paths for non-file dragover')
      },
    )

    expect(result).toBeNull()
  })

  it('normalizes file dragover events when only DataTransfer types indicate files', () => {
    const result = createElectronDragDropPayload(
      'over',
      {
        clientX: 12,
        clientY: 34,
        dataTransfer: dataTransfer({ types: ['Files'] }),
      },
      () => '',
    )

    expect(result).toEqual({
      payload: {
        type: 'over',
        position: { x: 12, y: 34 },
      },
    })
  })

  it('normalizes leave events without requiring files or position', () => {
    const result = createElectronDragDropPayload(
      'leave',
      {
        clientX: 0,
        clientY: 0,
        dataTransfer: null,
      },
      () => {
        throw new Error('should not read paths for leave')
      },
    )

    expect(result).toEqual({
      payload: {
        type: 'leave',
      },
    })
  })
})
