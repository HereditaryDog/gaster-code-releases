type DragDropPosition = {
  x: number
  y: number
}

type DragDropPayload =
  | { type: 'enter'; paths: string[]; position: DragDropPosition }
  | { type: 'over'; position: DragDropPosition }
  | { type: 'drop'; paths: string[]; position: DragDropPosition }
  | { type: 'leave' }
  | { type: 'cancel' }

export type ElectronDragDropPayload = {
  payload: DragDropPayload
}

export type ElectronDragDropType = DragDropPayload['type']

type DragDropLikeEvent = {
  clientX: number
  clientY: number
  dataTransfer: Pick<DataTransfer, 'files' | 'types'> | null
}

type NativePathForFile = (file: File) => string

function nativePathsFromFiles(
  files: Pick<DataTransfer, 'files'>['files'] | undefined,
  getPathForFile: NativePathForFile,
): string[] {
  return Array.from(files ?? [])
    .map((file) => getPathForFile(file))
    .filter((filePath) => filePath.length > 0)
}

function dataTransferHasFileType(dataTransfer: DragDropLikeEvent['dataTransfer']): boolean {
  return Array.from(dataTransfer?.types ?? []).includes('Files')
}

function dataTransferFileCount(dataTransfer: DragDropLikeEvent['dataTransfer']): number {
  return dataTransfer?.files?.length ?? 0
}

export function createElectronDragDropPayload(
  type: ElectronDragDropType,
  event: DragDropLikeEvent,
  getPathForFile: NativePathForFile,
): ElectronDragDropPayload | null {
  if (type === 'leave' || type === 'cancel') {
    return {
      payload: { type },
    }
  }

  const position = {
    x: event.clientX,
    y: event.clientY,
  }

  const paths = nativePathsFromFiles(event.dataTransfer?.files, getPathForFile)
  const isFileDrag =
    paths.length > 0 ||
    dataTransferFileCount(event.dataTransfer) > 0 ||
    dataTransferHasFileType(event.dataTransfer)

  if (!isFileDrag) return null

  if (type === 'over') {
    return {
      payload: { type, position },
    }
  }

  if (type === 'drop' && paths.length === 0) return null

  return {
    payload: {
      type,
      paths,
      position,
    },
  }
}

export function subscribeToElectronDragDrop(
  target: Window,
  getPathForFile: NativePathForFile,
  handler: (payload: ElectronDragDropPayload) => void,
): () => void {
  const listeners: Array<[keyof WindowEventMap, EventListener]> = [
    ['dragenter', (event) => emitDragDrop('enter', event)],
    ['dragover', (event) => emitDragDrop('over', event)],
    ['drop', (event) => emitDragDrop('drop', event)],
    ['dragleave', (event) => emitDragDrop('leave', event)],
    ['dragend', (event) => emitDragDrop('cancel', event)],
  ]

  function emitDragDrop(type: ElectronDragDropType, event: Event) {
    const dragEvent = event as DragEvent
    const payload = createElectronDragDropPayload(type, dragEvent, getPathForFile)
    if (!payload) return

    if (type !== 'leave' && type !== 'cancel') {
      dragEvent.preventDefault()
      if (dragEvent.dataTransfer) dragEvent.dataTransfer.dropEffect = 'copy'
    }
    handler(payload)
  }

  for (const [eventName, listener] of listeners) {
    target.addEventListener(eventName, listener)
  }

  return () => {
    for (const [eventName, listener] of listeners) {
      target.removeEventListener(eventName, listener)
    }
  }
}
