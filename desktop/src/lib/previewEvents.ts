import { useChatStore } from '../stores/chatStore'
import { getDesktopHost } from './desktopHost'

type SelectionPayload = {
  pageUrl?: string
  sourceHint?: string
  element?: {
    selector?: string
    tag?: string
    text?: string
    nthPath?: string
  }
  change?: {
    description?: string
    text?: { from: string; to: string }
    color?: { from: string; to: string }
    background?: { from: string; to: string }
    opacity?: { from: string; to: string }
    fontFamily?: { from: string; to: string }
  }
  screenshot?: {
    dataUrl?: string
    kind?: string
  }
}

function buildSelectionNote(payload: SelectionPayload): string {
  const change = payload.change
  const lines: string[] = []
  if (change?.description) lines.push(change.description)
  if (change?.text) lines.push(`- 文本：「${change.text.from}」→「${change.text.to}」`)
  if (change?.color) lines.push(`- 文字颜色：${change.color.from} → ${change.color.to}`)
  if (change?.background) lines.push(`- 背景：${change.background.from} → ${change.background.to}`)
  if (change?.opacity) lines.push(`- 不透明度：${change.opacity.from} → ${change.opacity.to}`)
  if (change?.fontFamily) lines.push(`- 字体：${change.fontFamily.from} → ${change.fontFamily.to}`)
  return lines.join('\n')
}

function buildSelectionDirectMessage(payload: SelectionPayload) {
  const element = payload.element
  const displayName = `<${element?.tag || 'element'}>`
  const note = buildSelectionNote(payload)
  const lines = [
    '请根据截图中编号 1 的蓝色标注修改本地前端。',
    `目标元素：${displayName}`,
  ]
  if (element?.selector) lines.push(`Selector：${element.selector}`)
  if (element?.nthPath) lines.push(`DOM 路径：${element.nthPath}`)
  if (payload.sourceHint) lines.push(`页面标题：${payload.sourceHint}`)
  if (payload.pageUrl) lines.push(`页面 URL：${payload.pageUrl}`)
  if (element?.text) lines.push(`当前文本：${element.text}`)
  if (note) {
    lines.push('用户注释：')
    lines.push(note)
  } else {
    lines.push('用户没有提供额外注释；请只依据截图中的选中元素理解修改目标。')
  }
  lines.push('请优先依据截图里的编号标注定位元素，selector 只作为辅助线索。')
  return { modelText: lines.join('\n'), displayName, note: note || undefined }
}

function kindLabel(kind?: string): string {
  if (kind === 'viewport') return 'viewport'
  if (kind === 'element') return 'element'
  return 'full'
}

export async function subscribePreviewEvents(sessionId: string): Promise<() => void> {
  const host = getDesktopHost()
  if (!host.capabilities.previewWebview) return () => {}

  return host.preview.onEvent((payload) => {
    let msg: { type?: string; url?: string; title?: string; dataUrl?: string; kind?: string; payload?: unknown }
    try {
      msg = typeof payload === 'string'
        ? JSON.parse(payload)
        : payload as typeof msg
    } catch { return }
    if (msg.type === 'screenshot' && msg.dataUrl) {
      useChatStore.getState().queueComposerPrefill(sessionId, {
        text: '',
        mode: 'append',
        attachments: [{ type: 'image', name: `screenshot-${kindLabel(msg.kind)}.png`, mimeType: 'image/png', data: msg.dataUrl }],
      })
    }
    else if (msg.type === 'selection') {
      const p = msg.payload as (SelectionPayload & { screenshot?: { dataUrl?: string; kind?: string } }) | undefined
      if (!p || typeof p !== 'object' || !p.element) return
      const selection = buildSelectionDirectMessage(p)
      const attachments = p.screenshot?.dataUrl
        ? [{
            type: 'image' as const,
            name: selection.displayName,
            mimeType: 'image/png',
            data: p.screenshot.dataUrl,
            note: selection.note,
            quote: p.element.selector,
          }]
        : []
      useChatStore.getState().sendMessage(sessionId, selection.modelText, attachments, {
        displayContent: selection.displayName,
        displayAttachments: attachments,
      })
    }
    else if (msg.type === 'error') {
      console.warn('[preview-agent]', msg)
    }
  })
}
