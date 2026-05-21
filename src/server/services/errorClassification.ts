export const GMASTER_AUTH_EXPIRED_CODE = 'GMASTER_AUTH_EXPIRED'
export const GMASTER_AUTH_EXPIRED_MESSAGE = 'G-Master API 登录已失效，请重新登录后再试。'

export const SESSION_MISSING_CODE = 'CLI_SESSION_MISSING'
export const SESSION_MISSING_MESSAGE = '这个历史会话已无法恢复，请新建会话继续。'

export type ClassifiedCliError =
  | {
      kind: 'gmaster_auth_expired'
      code: typeof GMASTER_AUTH_EXPIRED_CODE
      message: typeof GMASTER_AUTH_EXPIRED_MESSAGE
    }
  | {
      kind: 'missing_session'
      code: typeof SESSION_MISSING_CODE
      message: typeof SESSION_MISSING_MESSAGE
    }

const GMASTER_AUTH_EXPIRED_RE =
  /\b(authentication_failed|login_required|session_expired|provider_token_invalid)\b|not logged in\s*·?\s*please run\s+\/login/i
const SESSION_MISSING_RE = /no conversation found with session id\s*:/i

export function classifyCliErrorPayload(payload: unknown): ClassifiedCliError | null {
  const text = extractCliErrorText(payload)

  if (SESSION_MISSING_RE.test(text)) {
    return {
      kind: 'missing_session',
      code: SESSION_MISSING_CODE,
      message: SESSION_MISSING_MESSAGE,
    }
  }

  if (GMASTER_AUTH_EXPIRED_RE.test(text)) {
    return {
      kind: 'gmaster_auth_expired',
      code: GMASTER_AUTH_EXPIRED_CODE,
      message: GMASTER_AUTH_EXPIRED_MESSAGE,
    }
  }

  return null
}

export function extractCliErrorText(payload: unknown): string {
  const parts: string[] = []
  collectCliErrorText(payload, parts, new Set())
  return parts.join('\n')
}

function collectCliErrorText(
  value: unknown,
  parts: string[],
  seen: Set<unknown>,
): void {
  if (value === null || value === undefined) return

  if (typeof value === 'string') {
    parts.push(value)
    const parsed = parseMaybeJson(value)
    if (parsed !== undefined) {
      collectCliErrorText(parsed, parts, seen)
    }
    return
  }

  if (typeof value !== 'object') {
    if (typeof value === 'number' || typeof value === 'boolean') {
      parts.push(String(value))
    }
    return
  }

  if (seen.has(value)) return
  seen.add(value)

  if (Array.isArray(value)) {
    for (const item of value) collectCliErrorText(item, parts, seen)
    return
  }

  const record = value as Record<string, unknown>
  for (const key of [
    'error',
    'message',
    'result',
    'status',
    'summary',
    'code',
    'reason',
    'action',
    'details',
    'errorDetails',
    'messageText',
    'capturedOutput',
    'errors',
  ]) {
    collectCliErrorText(record[key], parts, seen)
  }

  const content = (record.message as Record<string, unknown> | undefined)?.content
  if (Array.isArray(content)) {
    for (const block of content) collectCliErrorText(block, parts, seen)
  }

  if (typeof record.text === 'string') {
    parts.push(record.text)
  }
}

function parseMaybeJson(value: string): unknown | undefined {
  const trimmed = value.trim()
  if (!trimmed || !/^[{[]/.test(trimmed)) return undefined

  try {
    return JSON.parse(trimmed)
  } catch {
    return undefined
  }
}
