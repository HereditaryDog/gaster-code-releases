import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { createElectronHost } from '../src/lib/desktopHost/electronHost'
import type { DesktopHostUnlisten } from '../src/lib/desktopHost/types'
import type { ElectronEventChannel, ElectronIpcChannel } from './ipc/channels'
import { ELECTRON_EVENT_CHANNELS } from './ipc/channels'
import { subscribeToElectronDragDrop } from './ipc/dragDrop'

const electronHost = createElectronHost({
  invoke<T>(channel: ElectronIpcChannel, payload?: unknown): Promise<T> {
    return ipcRenderer.invoke(channel, payload) as Promise<T>
  },
  subscribe<T>(
    channel: ElectronEventChannel,
    handler: (payload: T) => void,
  ): Promise<DesktopHostUnlisten> {
    if (channel === ELECTRON_EVENT_CHANNELS.webviewDragDrop) {
      return Promise.resolve(
        subscribeToElectronDragDrop(
          window,
          (file) => webUtils.getPathForFile(file),
          (payload) => handler(payload as T),
        ),
      )
    }

    const listener = (_event: Electron.IpcRendererEvent, payload: T) => handler(payload)
    ipcRenderer.on(channel, listener)
    return Promise.resolve(() => {
      ipcRenderer.removeListener(channel, listener)
    })
  },
})

contextBridge.exposeInMainWorld('desktopHost', electronHost)
