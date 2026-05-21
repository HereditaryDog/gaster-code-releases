import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, rawRecordDiagnosticEvent } from './client'

describe('api diagnostics reporting', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports non-diagnostics API failures without request bodies', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Nope' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))

    await expect(api.post('/api/providers/test', { apiKey: 'sk-should-not-report' })).rejects.toThrow('Nope')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const diagnosticCall = fetchMock.mock.calls[1]
    expect(diagnosticCall).toBeDefined()
    const [diagnosticUrl, diagnosticInit] = diagnosticCall!
    expect(String(diagnosticUrl)).toContain('/api/diagnostics/events')
    const body = JSON.parse(String((diagnosticInit as RequestInit).body))
    expect(body.type).toBe('client_api_request_failed')
    expect(body.details.path).toBe('/api/providers/test')
    expect(JSON.stringify(body)).not.toContain('sk-should-not-report')
  })

  it('does not recursively report diagnostics endpoint failures', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'diagnostics down' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(api.get('/api/diagnostics/status')).rejects.toThrow('diagnostics down')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries without AbortSignal when the runtime rejects the signal option', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock
      .mockRejectedValueOnce(new TypeError('RequestInit: Expected signal ("AbortSignal {}") to be an instance of AbortSignal.'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))

    await expect(api.get('/api/providers')).resolves.toEqual({ ok: true })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).signal).toBeDefined()
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).signal).toBeUndefined()
  })

  it('can report raw client exceptions', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    await rawRecordDiagnosticEvent({
      type: 'client_window_error',
      severity: 'error',
      summary: 'boom',
      details: { filename: 'App.tsx' },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0]
    expect(call).toBeDefined()
    const [, init] = call!
    const body = JSON.parse(String((init as RequestInit).body))
    expect(body.type).toBe('client_window_error')
  })
})
