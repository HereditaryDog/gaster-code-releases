import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'

const mocks = vi.hoisted(() => ({
  status: vi.fn(),
  me: vi.fn(),
  start: vi.fn(),
  logout: vi.fn(),
  syncProvider: vi.fn(),
  plans: vi.fn(),
  createCheckout: vi.fn(),
  checkoutStatus: vi.fn(),
  transactions: vi.fn(),
  cancelSubscription: vi.fn(),
  resumeSubscription: vi.fn(),
  openExternal: vi.fn(),
  desktopHost: {
    isDesktop: true,
    shell: {
      open: vi.fn(),
    },
  },
}))

vi.mock('../api/gmasterAuth', () => ({
  gmasterAuthApi: {
    status: mocks.status,
    me: mocks.me,
    start: mocks.start,
    logout: mocks.logout,
    syncProvider: mocks.syncProvider,
    plans: mocks.plans,
    createCheckout: mocks.createCheckout,
    checkoutStatus: mocks.checkoutStatus,
    transactions: mocks.transactions,
    cancelSubscription: mocks.cancelSubscription,
    resumeSubscription: mocks.resumeSubscription,
  },
}))

vi.mock('../lib/desktopHost', () => ({
  getDesktopHost: () => mocks.desktopHost,
}))

import { GMasterAccountSettings } from './GMasterAccountSettings'
import { ApiError } from '../api/client'
import { useGMasterAuthStore } from '../stores/gmasterAuthStore'
import { useSettingsStore } from '../stores/settingsStore'

describe('GMasterAccountSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.desktopHost = {
      isDesktop: true,
      shell: {
        open: mocks.openExternal,
      },
    }
    useSettingsStore.setState({ locale: 'en' })
    useGMasterAuthStore.setState(useGMasterAuthStore.getInitialState(), true)
    mocks.status.mockResolvedValue({ loggedIn: false })
    mocks.start.mockResolvedValue({
      authorizeUrl: 'https://gmapi.example.test/gaster-code/desktop-login?state=abc',
      state: 'abc',
    })
    mocks.plans.mockResolvedValue({ plans: [] })
    mocks.transactions.mockResolvedValue({ transactions: [] })
    mocks.syncProvider.mockResolvedValue(undefined)
    mocks.openExternal.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    act(() => {
      useGMasterAuthStore.getState().stopPolling()
      useGMasterAuthStore.setState(useGMasterAuthStore.getInitialState(), true)
    })
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
    mocks.desktopHost = {
      isDesktop: false,
      shell: {
        open: mocks.openExternal,
      },
    }
    mockAuthStoreActions()
    let resolveStart: (value: { authorizeUrl: string; state: string }) => void = () => {}
    mocks.start.mockReturnValueOnce(new Promise((resolve) => {
      resolveStart = resolve
    }))
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
      expect(mocks.openExternal).not.toHaveBeenCalled()
      expect(registerButton).toBeEnabled()
    })
  })

  it('renders wallet, subscription, and billing history for signed-in accounts', async () => {
    mocks.status.mockResolvedValue({ loggedIn: true, expiresAt: null, user: { id: 1, username: 'alice', displayName: 'Alice' } })
    mocks.me.mockResolvedValue(buildAccount())
    mocks.plans.mockResolvedValue({
      plans: [
        buildPlan({ id: 'topup_10', kind: 'topup', name: '10M credits', interval: 'one_time' }),
        buildPlan({ id: 'subscription_2', kind: 'subscription', name: 'Monthly Pro', interval: 'month' }),
      ],
    })
    mocks.transactions.mockResolvedValue({
      transactions: [{
        id: 'txn_1',
        kind: 'topup',
        status: 'paid',
        amount: 1000,
        currency: 'USD',
        createdAt: 1770000000,
        description: 'Top up',
      }],
    })

    render(<GMasterAccountSettings />)

    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Wallet')).toBeInTheDocument()
    expect(screen.getByText('2,500 credits')).toBeInTheDocument()
    expect(screen.getByText('Subscription')).toBeInTheDocument()
    expect(screen.getByText('Billing history')).toBeInTheDocument()
    expect(screen.getAllByText('Top up').length).toBeGreaterThan(0)
  })

  it('creates top-up checkout and refreshes after paid status', async () => {
    mocks.status.mockResolvedValue({ loggedIn: true, expiresAt: null, user: { id: 1, username: 'alice', displayName: 'Alice' } })
    mocks.me.mockResolvedValue(buildAccount())
    mocks.plans.mockResolvedValue({
      plans: [buildPlan({ id: 'topup_10', kind: 'topup', name: '10M credits', interval: 'one_time' })],
    })
    mocks.transactions.mockResolvedValue({ transactions: [] })
    mocks.createCheckout.mockResolvedValue({
      id: 'cs_1',
      url: 'https://gmapi.example.test/checkout/cs_1',
      status: 'paid',
      kind: 'topup',
      expiresAt: 1770000300,
    })

    render(<GMasterAccountSettings />)

    fireEvent.click(await screen.findByRole('button', { name: 'Top up' }))
    expect(await screen.findByText('Top up balance')).toBeInTheDocument()
    const topUpButtons = screen.getAllByRole('button', { name: 'Top up' })
    fireEvent.click(topUpButtons[topUpButtons.length - 1]!)

    await waitFor(() => {
      expect(mocks.createCheckout).toHaveBeenCalledWith({
        kind: 'topup',
        planId: 'topup_10',
        returnTo: 'account',
      })
    })
    expect(mocks.openExternal).toHaveBeenCalledWith('https://gmapi.example.test/checkout/cs_1')

    await waitFor(() => {
      expect(mocks.syncProvider).toHaveBeenCalled()
    })
  })

  it('maps stable billing errors to account recovery actions', async () => {
    mocks.status.mockResolvedValue({ loggedIn: true, expiresAt: null, user: { id: 1, username: 'alice', displayName: 'Alice' } })
    mocks.me.mockResolvedValue(buildAccount())
    mocks.plans.mockResolvedValue({
      plans: [buildPlan({ id: 'topup_10', kind: 'topup', name: '10M credits', interval: 'one_time' })],
    })
    mocks.transactions.mockResolvedValue({ transactions: [] })
    mocks.createCheckout.mockRejectedValue(new ApiError(400, {
      error: 'GMASTER_BILLING_PLAN_UNAVAILABLE',
      message: 'subscription plan is unavailable',
    }))

    render(<GMasterAccountSettings />)

    fireEvent.click(await screen.findByRole('button', { name: 'Top up' }))
    const topUpButtons = screen.getAllByRole('button', { name: 'Top up' })
    fireEvent.click(topUpButtons[topUpButtons.length - 1]!)

    expect(await screen.findByText('This plan is currently unavailable. Refresh the plan list and try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh plans' })).toBeInTheDocument()
  })

  it('resumes subscriptions from the account page', async () => {
    mocks.status.mockResolvedValue({ loggedIn: true, expiresAt: null, user: { id: 1, username: 'alice', displayName: 'Alice' } })
    mocks.me.mockResolvedValue(buildAccount({
      subscription: {
        active: true,
        items: [{
          id: 10,
          planId: 2,
          status: 'active',
          startTime: 1770000000,
          endTime: 1772592000,
          amountTotal: 1000,
          amountUsed: 100,
          amountRemaining: 900,
          unlimited: false,
          upgradeGroup: '',
          cancelAtPeriodEnd: true,
          resumable: true,
        }],
      },
    }))
    mocks.plans.mockResolvedValue({
      plans: [buildPlan({ id: 'subscription_2', kind: 'subscription', name: 'Monthly Pro', interval: 'month' })],
    })
    mocks.transactions.mockResolvedValue({ transactions: [] })
    mocks.resumeSubscription.mockResolvedValue({ ok: true })

    render(<GMasterAccountSettings />)

    fireEvent.click(await screen.findByRole('button', { name: 'Resume' }))

    await waitFor(() => {
      expect(mocks.resumeSubscription).toHaveBeenCalled()
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

function buildAccount(overrides: Partial<Awaited<ReturnType<typeof mocks.me>>> = {}) {
  return {
    user: {
      id: 1,
      username: 'alice',
      displayName: 'Alice',
      email: 'alice@example.test',
      group: 'default',
    },
    subscription: {
      active: true,
      items: [{
        id: 10,
        planId: 2,
        status: 'active',
        startTime: 1770000000,
        endTime: 1772592000,
        amountTotal: 1000,
        amountUsed: 100,
        amountRemaining: 900,
        unlimited: false,
        upgradeGroup: '',
      }],
    },
    quota: { remaining: 900, used: 100, unlimited: false },
    wallet: { balance: 2500, currency: 'credits', lowBalance: false },
    entitlements: {
      canUseBuiltinProvider: true,
      enabledModels: ['gpt-5.4'],
      enabledFeatures: ['chat'],
      expiresAt: null,
    },
    canUseBuiltinProvider: true,
    billingUrl: 'https://gmapi.example.test/billing',
    accountUrl: 'https://gmapi.example.test/account',
    ...overrides,
  }
}

function buildPlan(overrides: Partial<{
  id: string
  kind: 'topup' | 'subscription'
  name: string
  interval: 'month' | 'year' | 'one_time'
}>) {
  return {
    id: overrides.id ?? 'topup_10',
    kind: overrides.kind ?? 'topup',
    name: overrides.name ?? '10M credits',
    description: 'Plan description',
    price: 1000,
    currency: 'USD',
    interval: overrides.interval ?? 'one_time',
    quotaAmount: 10000000,
    unlimited: false,
    recommended: true,
  }
}
