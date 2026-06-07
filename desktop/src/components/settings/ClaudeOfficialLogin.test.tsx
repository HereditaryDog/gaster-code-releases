import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'

const mocks = vi.hoisted(() => ({
  shellOpen: vi.fn(),
  desktopHost: {
    shell: {
      open: vi.fn(),
    },
  },
}))

vi.mock('../../lib/desktopHost', () => ({
  getDesktopHost: () => mocks.desktopHost,
}))

import { useSettingsStore } from '../../stores/settingsStore'
import { useHahaOAuthStore } from '../../stores/hahaOAuthStore'
import { ClaudeOfficialLogin } from './ClaudeOfficialLogin'

describe('ClaudeOfficialLogin desktop host integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.desktopHost = {
      shell: {
        open: mocks.shellOpen,
      },
    }
    useSettingsStore.setState({ locale: 'en' })
    useHahaOAuthStore.setState({
      status: { loggedIn: false },
      isPolling: false,
      isLoading: false,
      error: null,
      fetchStatus: vi.fn().mockResolvedValue(undefined),
      login: vi.fn().mockResolvedValue({
        authorizeUrl: 'https://claude.ai/oauth/authorize?state=abc',
      }),
      logout: vi.fn().mockResolvedValue(undefined),
      startPolling: vi.fn(),
      stopPolling: vi.fn(),
    })
    mocks.shellOpen.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    useHahaOAuthStore.setState(useHahaOAuthStore.getInitialState(), true)
    vi.restoreAllMocks()
  })

  it('opens the authorize URL through the desktop host shell and starts polling', async () => {
    render(<ClaudeOfficialLogin />)

    fireEvent.click(screen.getByRole('button', { name: 'Sign in to Claude' }))

    await waitFor(() => {
      expect(mocks.shellOpen).toHaveBeenCalledWith('https://claude.ai/oauth/authorize?state=abc')
    })
    expect(useHahaOAuthStore.getState().startPolling).toHaveBeenCalled()
  })

  it('sets the existing open-browser failure message when host shell open fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.shellOpen.mockRejectedValueOnce(new Error('shell unavailable'))

    render(<ClaudeOfficialLogin />)

    fireEvent.click(screen.getByRole('button', { name: 'Sign in to Claude' }))

    expect(await screen.findByText(
      'Error: Failed to open browser; please visit the authorization URL manually.',
    )).toBeInTheDocument()
    expect(useHahaOAuthStore.getState().startPolling).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
