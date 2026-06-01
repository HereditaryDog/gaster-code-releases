import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GASTER_CODE_VERSION } from '../version'

vi.mock('./client', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
  getBaseUrl: vi.fn(() => 'http://127.0.0.1:56028'),
}))

import { api } from './client'
import { gmasterAuthApi } from './gmasterAuth'

describe('gmasterAuthApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts desktop auth with the packaged desktop version', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      authorizeUrl: 'https://gmapi.example.test/gaster-code/desktop-login',
      state: 'state-1',
    })

    await gmasterAuthApi.start('register')

    expect(api.post).toHaveBeenCalledWith('/api/gmaster-auth/start', {
      serverPort: 56028,
      clientVersion: GASTER_CODE_VERSION,
      intent: 'register',
    })
  })
})
