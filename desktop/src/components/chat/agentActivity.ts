import type { AgentTaskNotification, UIMessage } from '../../types/chat'

type ToolCall = Extract<UIMessage, { type: 'tool_use' }>
type ToolResult = Extract<UIMessage, { type: 'tool_result' }>

export function hasRunningAgentActivity(
  messages: UIMessage[],
  agentTaskNotifications: Record<string, AgentTaskNotification>,
): boolean {
  const resultMap = new Map<string, ToolResult>()
  const childToolCallsByParent = new Map<string, ToolCall[]>()

  for (const message of messages) {
    if (message.type === 'tool_result') {
      resultMap.set(message.toolUseId, message)
      continue
    }

    if (message.type === 'tool_use' && message.parentToolUseId) {
      const siblings = childToolCallsByParent.get(message.parentToolUseId)
      if (siblings) {
        siblings.push(message)
      } else {
        childToolCallsByParent.set(message.parentToolUseId, [message])
      }
    }
  }

  return messages.some((message) => {
    if (message.type !== 'tool_use' || message.toolName !== 'Agent') return false

    const taskStatus = agentTaskNotifications[message.toolUseId]?.status
    if (taskStatus === 'completed' || taskStatus === 'failed' || taskStatus === 'stopped') {
      return false
    }

    const result = resultMap.get(message.toolUseId)
    const isLaunchResult = isAgentLaunchResult(result?.content)
    if (result && result.isError && !isLaunchResult) return false
    if (result && !isLaunchResult) return false

    return !result || childToolCallsByParent.has(message.toolUseId) || isLaunchResult
  })
}

function isAgentLaunchResult(content: unknown): boolean {
  const text = extractTextContent(content).trim()
  if (!text) return false

  return (
    text.startsWith('Async agent launched successfully.') ||
    text.startsWith('Remote agent launched in CCR.') ||
    (text.startsWith('Spawned successfully.') &&
      text.includes('The agent is now running and will receive instructions via mailbox.')) ||
    text.includes('The agent is working in the background. You will be notified automatically when it completes.') ||
    text.includes('The agent is running remotely. You will be notified automatically when it completes.')
  )
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((chunk) => {
        if (typeof chunk === 'string') return chunk
        if (chunk && typeof chunk === 'object' && 'text' in chunk) {
          return typeof chunk.text === 'string' ? chunk.text : ''
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  if (content && typeof content === 'object') {
    if (
      'status' in content &&
      (content as Record<string, unknown>).status === 'completed' &&
      Array.isArray((content as Record<string, unknown>).content)
    ) {
      return extractTextContent((content as Record<string, unknown>).content)
    }
    return JSON.stringify(content)
  }
  return ''
}
