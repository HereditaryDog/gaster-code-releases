import { describe, expect, it } from 'bun:test'
import {
  classifyCliErrorPayload,
  GMASTER_AUTH_EXPIRED_CODE,
  GMASTER_AUTH_EXPIRED_MESSAGE,
  SESSION_MISSING_CODE,
  SESSION_MISSING_MESSAGE,
} from '../services/errorClassification.js'

describe('CLI error classification', () => {
  it('classifies G-Master API login expiration from SDK assistant auth errors', () => {
    const classification = classifyCliErrorPayload({
      type: 'assistant',
      error: 'authentication_failed',
      isApiErrorMessage: true,
      message: {
        content: [
          { type: 'text', text: 'Not logged in · Please run /login' },
        ],
      },
    })

    expect(classification).toEqual({
      kind: 'gmaster_auth_expired',
      code: GMASTER_AUTH_EXPIRED_CODE,
      message: GMASTER_AUTH_EXPIRED_MESSAGE,
    })
  })

  it('classifies missing historical conversations from startup output JSON', () => {
    const classification = classifyCliErrorPayload(
      '{"type":"result","subtype":"error_max_turns","is_error":true,"errors":["No conversation found with session ID: de658bd4-a7c0-4aea-9acc-e2fb0064b752"]}',
    )

    expect(classification).toEqual({
      kind: 'missing_session',
      code: SESSION_MISSING_CODE,
      message: SESSION_MISSING_MESSAGE,
    })
  })

  it('leaves generic SDK errors unclassified', () => {
    const classification = classifyCliErrorPayload({
      type: 'assistant',
      error: 'invalid_request_error',
      isApiErrorMessage: true,
      message: {
        content: [
          { type: 'text', text: 'Prompt is too long for this model.' },
        ],
      },
    })

    expect(classification).toBeNull()
  })

  it('classifies machine-readable G-Master auth reasons from API payloads', () => {
    for (const reason of ['login_required', 'session_expired', 'provider_token_invalid']) {
      expect(classifyCliErrorPayload({
        error: {
          code: 'authentication_failed',
          reason,
          action: 'relogin',
          message: 'G-Master API credential is not usable',
        },
      })).toEqual({
        kind: 'gmaster_auth_expired',
        code: GMASTER_AUTH_EXPIRED_CODE,
        message: GMASTER_AUTH_EXPIRED_MESSAGE,
      })
    }
  })
})
