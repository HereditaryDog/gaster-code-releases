import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'

const mocks = vi.hoisted(() => ({
  status: vi.fn(),
  me: vi.fn(),
  start: vi.fn(),
  logout: vi.fn(),
  syncProvider: vi.fn(),
  openExternal: vi.fn(),
}))

vi.mock('../api/gmasterAuth', () => ({
  gmasterAuthApi: {
    status: mocks.status,
    me: mocks.me,
    start: mocks.start,
    logout: mocks.logout,
    syncProvider: mocks.syncProvider,
  },
}))

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: mocks.openExternal,
}))

import { GMasterAccountSettings } from './GMasterAccountSettings'
import { useGMasterAuthStore } from '../stores/gmasterAuthStore'
import { useSettingsStore } from '../stores/settingsStore'

describe('GMasterAccountSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    })
    useSettingsStore.setState({ locale: 'en' })
    useGMasterAuthStore.setState(useGMasterAuthStore.getInitialState(), true)
    mocks.status.mockResolvedValue({ loggedIn: false })
    mocks.start.mockResolvedValue({
      authorizeUrl: 'https://gmapi.example.test/gaster-code/desktop-login?state=abc',
      state: 'abc',
    })
    mocks.openExternal.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    act(() => {
      useGMasterAuthStore.getState().stopPolling()
      useGMasterAuthStore.setState(useGMasterAuthStore.getInitialState(), true)
    })
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
    vi.restoreAllMocks()
  })

  it('offers separate sign-in and registration actions while signed out', async () => {
    render(<GMasterAccountSettings />)

    expect(await screen.findByRole('button', { name: 'Sign in with G-Master API' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create G-Master account' })).toBeInTheDocument()
  })

  it('starts auth with register intent from the registration action', async () => {
    mockAuthStoreActions()
    render(<GMasterAccountSettings />)

    const registerButton = await screen.findByRole('button', { name: 'Create G-Master account' })
    await act(async () => {
      fireEvent.click(registerButton)
      await flushAsyncUpdates()
    })

    await waitFor(() => {
      expect(mocks.start).toHaveBeenCalledWith('register')
    })
    await waitFor(() => {
      expect(mocks.openExternal).toHaveBeenCalledWith('https://gmapi.example.test/gaster-code/desktop-login?state=abc')
      expect(registerButton).toBeEnabled()
    })
  })

  it('reserves a browser popup before waiting for the registration URL when shell open is unavailable', async () => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
    mockAuthStoreActions()
    let resolveStart: (value: { authorizeUrl: string; state: string }) => void = () => {}
    mocks.start.mockReturnValueOnce(new Promise((resolve) => {
      resolveStart = resolve
    }))
    mocks.openExternal.mockRejectedValueOnce(new Error('shell unavailable'))
    const popup = {
      closed: false,
      close: vi.fn(),
      location: { href: 'about:blank' },
      opener: window,
    } as unknown as Window
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(popup)

    render(<GMasterAccountSettings />)

    const registerButton = await screen.findByRole('button', { name: 'Create G-Master account' })
    await act(async () => {
      fireEvent.click(registerButton)
      await Promise.resolve()
    })

    expect(openSpy).toHaveBeenCalledWith('about:blank', '_blank')

    await act(async () => {
      resolveStart({
        authorizeUrl: 'https://gmapi.example.test/register?redirect=%2Fgaster-code%2Fdesktop-login',
        state: 'abc',
      })
      await flushAsyncUpdates()
    })

    await waitFor(() => {
      expect(popup.location.href).toBe('https://gmapi.example.test/register?redirect=%2Fgaster-code%2Fdesktop-login')
      expect(registerButton).toBeEnabled()
    })
  })
})

async function flushAsyncUpdates() {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function mockAuthStoreActions() {
  type AuthState = ReturnType<typeof useGMasterAuthStore.getState>
  const login: AuthState['login'] = vi.fn(async (intent) => {
    const res = await mocks.start(intent)
    return { authorizeUrl: res.authorizeUrl }
  })
  const startPolling: AuthState['startPolling'] = vi.fn()
  useGMasterAuthStore.setState({ login, startPolling })
  return { login, startPolling }
}
