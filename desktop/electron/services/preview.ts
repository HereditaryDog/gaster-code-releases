import { existsSync, readFileSync } from 'node:fs'
import { ELECTRON_EVENT_CHANNELS } from '../ipc/channels'
import { parsePreviewAgentMessage } from '../ipc/previewMessage'
export { parsePreviewAgentMessage, shouldForwardPreviewMessage } from '../ipc/previewMessage'

export type PreviewBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type PreviewWebContentsLike = {
  loadURL(url: string): Promise<unknown>
  executeJavaScript(script: string): Promise<unknown>
  on(event: 'did-finish-load', handler: () => void): unknown
  close?(): void
  isDestroyed?(): boolean
  send(channel: string, payload: unknown): void
}

export type PreviewViewLike = {
  webContents: PreviewWebContentsLike
  setBounds(bounds: PreviewBounds): void
  setVisible?(visible: boolean): void
}

export type PreviewParentWindowLike = {
  contentView: {
    addChildView(view: unknown): void
    removeChildView(view: unknown): void
  }
}

export type ElectronPreviewServiceOptions = {
  createView: () => PreviewViewLike
  previewScriptPath: string
}

export function normalizePreviewUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('empty url')
  const parsed = new URL(trimmed)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`unsupported url scheme: ${trimmed}`)
  }
  return trimmed
}

export function normalizePreviewBounds(bounds: PreviewBounds): PreviewBounds {
  for (const [key, value] of Object.entries(bounds)) {
    if (!Number.isFinite(value)) throw new Error(`invalid preview bounds ${key}`)
  }
  return {
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.max(0, Math.round(bounds.width)),
    height: Math.max(0, Math.round(bounds.height)),
  }
}

export function resolvePreviewScriptPath(previewScriptPath: string): string {
  if (existsSync(previewScriptPath)) return previewScriptPath
  const unpackedPath = previewScriptPath.replace(/\.asar([/\\])/, '.asar.unpacked$1')
  if (unpackedPath !== previewScriptPath && existsSync(unpackedPath)) return unpackedPath
  return previewScriptPath
}

export class ElectronPreviewService {
  private readonly createView: () => PreviewViewLike
  private readonly previewScriptPath: string
  private view: PreviewViewLike | null = null
  private parent: PreviewParentWindowLike | null = null

  constructor(options: ElectronPreviewServiceOptions) {
    this.createView = options.createView
    this.previewScriptPath = options.previewScriptPath
  }

  async open(parent: PreviewParentWindowLike, url: string, bounds: PreviewBounds): Promise<void> {
    const normalizedUrl = normalizePreviewUrl(url)
    const normalizedBounds = normalizePreviewBounds(bounds)
    const view = this.ensureView(parent)
    view.setBounds(normalizedBounds)
    await view.webContents.loadURL(normalizedUrl)
  }

  async navigate(url: string): Promise<void> {
    const view = this.requireView()
    await view.webContents.loadURL(normalizePreviewUrl(url))
  }

  setBounds(bounds: PreviewBounds): void {
    this.view?.setBounds(normalizePreviewBounds(bounds))
  }

  setVisible(visible: boolean): void {
    this.view?.setVisible?.(visible)
  }

  close(): void {
    if (!this.view) return
    this.parent?.contentView.removeChildView(this.view)
    if (!this.view.webContents.isDestroyed?.()) {
      this.view.webContents.close?.()
    }
    this.view = null
    this.parent = null
  }

  async message(payload: unknown): Promise<void> {
    const raw = JSON.stringify(payload)
    const script = `globalThis.__PREVIEW_BRIDGE__?.handleHostRaw(${JSON.stringify(raw)})`
    await this.requireView().webContents.executeJavaScript(script)
  }

  sendMessageToRenderer(sender: PreviewWebContentsLike, raw: unknown, renderer: PreviewWebContentsLike | null | undefined): void {
    if (sender !== this.view?.webContents) return
    if (typeof raw !== 'string') return
    const message = parsePreviewAgentMessage(raw)
    if (!message) return
    renderer?.send(ELECTRON_EVENT_CHANNELS.previewEvent, message)
  }

  private ensureView(parent: PreviewParentWindowLike): PreviewViewLike {
    if (this.view) return this.view
    const view = this.createView()
    parent.contentView.addChildView(view)
    view.webContents.on('did-finish-load', () => {
      void this.injectPreviewAgent(view)
    })
    this.view = view
    this.parent = parent
    return view
  }

  private requireView(): PreviewViewLike {
    if (!this.view) throw new Error('preview not open')
    return this.view
  }

  private async injectPreviewAgent(view: PreviewViewLike): Promise<void> {
    if (view.webContents.isDestroyed?.()) return
    const script = readFileSync(resolvePreviewScriptPath(this.previewScriptPath), 'utf8')
    await view.webContents.executeJavaScript(script)
  }
}
