import { describe, expect, test } from 'bun:test'
import type Anthropic from '@anthropic-ai/sdk'
import { APIConnectionError } from '@anthropic-ai/sdk'
import { _resetKeepAliveForTesting, getProxyFetchOptions } from '../../utils/proxy.js'
import { withRetry } from './withRetry.js'

describe('withRetry stale connections', () => {
  test('disables keep-alive before retrying ECONNRESET connection failures', async () => {
    _resetKeepAliveForTesting()
    let attempts = 0
    const cause = Object.assign(new Error('socket hang up'), {
      code: 'ECONNRESET',
    })
    const staleConnection = new APIConnectionError({
      message: 'Connection error.',
      cause,
    })

    const generator = withRetry(
      async () => ({} as Anthropic),
      async () => {
        attempts += 1
        if (attempts === 1) {
          throw staleConnection
        }
        return 'ok'
      },
      {
        model: 'claude-opus-4-7',
        thinkingConfig: { type: 'disabled' },
        maxRetries: 1,
      },
    )

    let finalValue: string | undefined
    for (;;) {
      const next = await generator.next()
      if (next.done) {
        finalValue = next.value
        break
      }
    }

    expect(finalValue).toBe('ok')
    expect(attempts).toBe(2)
    expect(getProxyFetchOptions().keepalive).toBe(false)
    _resetKeepAliveForTesting()
  })
})
