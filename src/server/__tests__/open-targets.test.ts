import { describe, expect, it } from 'bun:test'
import { handleOpenTargetsApi } from '../api/open-targets.js'

describe('open targets API', () => {
  it('lists available open targets with a file-manager fallback', async () => {
    const response = await request('GET', '/api/open-targets')
    expect(response.status).toBe(200)
    const body = await response.json() as {
      targets: Array<{ id: string; kind: string; label: string }>
      primaryTargetId: string | null
    }

    expect(body.targets.some((target) => target.kind === 'file_manager')).toBe(true)
    expect(body.primaryTargetId).toBeTruthy()
  })

  it('validates open requests before launching anything', async () => {
    const response = await request('POST', '/api/open-targets/open', {
      targetId: '',
      path: '',
    })

    expect(response.status).toBe(400)
  })
})

function request(method: string, pathname: string, body?: Record<string, unknown>): Promise<Response> {
  const url = new URL(pathname, 'http://localhost:3456')
  const init: RequestInit = { method }
  if (body) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  return handleOpenTargetsApi(
    new Request(url.toString(), init),
    url,
    url.pathname.split('/').filter(Boolean),
  )
}
