import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import type { ServerWebSocket } from 'bun'
import {
  __markPrewarmPendingForTests,
  __resetWebSocketHandlerStateForTests,
  handleWebSocket,
  type WebSocketData,
} from '../ws/handler.js'
import { conversationService } from '../services/conversationService.js'

function makeClientSocket(sessionId: string) {
  const sent: string[] = []
  return {
    data: {
      sessionId,
      connectedAt: Date.now(),
      channel: 'client',
      sdkToken: null,
      serverPort: 0,
      serverHost: '127.0.0.1',
    },
    send: mock((payload: string) => {
      sent.push(payload)
    }),
    close: mock(() => {}),
    sent,
  } as unknown as ServerWebSocket<WebSocketData> & { sent: string[] }
}

describe('WebSocket handler prewarm reconnects', () => {
  afterEach(() => {
    __resetWebSocketHandlerStateForTests()
    mock.restore()
  })

  it('does not forward prewarm startup status to a reconnecting client', () => {
    const sessionId = `prewarm-reconnect-${crypto.randomUUID()}`
    const ws = makeClientSocket(sessionId)
    let outputCallback: ((cliMsg: any) => void) | null = null

    __markPrewarmPendingForTests(sessionId)
    spyOn(conversationService, 'hasSession').mockReturnValue(true)
    spyOn(conversationService, 'getRecentSdkMessages').mockReturnValue([])
    spyOn(conversationService, 'clearOutputCallbacks').mockImplementation(() => {
      outputCallback = null
    })
    spyOn(conversationService, 'onOutput').mockImplementation((_sid, callback) => {
      outputCallback = callback
    })

    handleWebSocket.open(ws)
    outputCallback?.({
      type: 'stream_event',
      event: { type: 'message_start' },
    })

    const messages = ws.sent.map((payload) => JSON.parse(payload))
    expect(messages).not.toContainEqual({ type: 'status', state: 'thinking' })
  })
})
