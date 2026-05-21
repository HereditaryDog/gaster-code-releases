import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('sessionRuntimeStore', () => {
  beforeEach(() => {
    vi.resetModules()
    window.localStorage.clear()
  })

  it('migrates legacy runtime selections to the Gaster Code storage key', async () => {
    window.localStorage.setItem(
      'gaster-code-legacy-session-runtime',
      JSON.stringify({
        'session-1': { providerId: null, modelId: 'claude-sonnet-4-6' },
      }),
    )

    const { useSessionRuntimeStore } = await import('./sessionRuntimeStore')

    expect(useSessionRuntimeStore.getState().selections).toEqual({
      'session-1': { providerId: null, modelId: 'claude-sonnet-4-6' },
    })
    expect(window.localStorage.getItem('gaster-code-session-runtime')).toContain('claude-sonnet-4-6')
    expect(window.localStorage.getItem('gaster-code-legacy-session-runtime')).toBeNull()
  })

  it('writes runtime selections to the Gaster Code storage key', async () => {
    const { useSessionRuntimeStore } = await import('./sessionRuntimeStore')

    useSessionRuntimeStore.getState().setSelection('session-2', {
      providerId: 'provider-1',
      modelId: 'model-1',
    })

    expect(window.localStorage.getItem('gaster-code-session-runtime')).toContain('model-1')
    expect(window.localStorage.getItem('gaster-code-legacy-session-runtime')).toBeNull()
  })
})
