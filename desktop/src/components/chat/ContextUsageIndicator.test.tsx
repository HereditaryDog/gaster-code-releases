import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'

import { ContextUsageIndicator } from './ContextUsageIndicator'
import { sessionsApi } from '../../api/sessions'

const viewportMocks = vi.hoisted(() => ({
  mobile: false,
  desktop: true,
}))

vi.mock('../../api/sessions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/sessions')>()
  return {
    ...actual,
    sessionsApi: {
      ...actual.sessionsApi,
      getInspection: vi.fn(),
    },
  }
})

vi.mock('../../i18n', () => ({
  useTranslation: () => (key: string, values?: Record<string, string | number>) => {
    const translations: Record<string, string> = {
      'contextIndicator.ariaLabel': `Context usage ${values?.percent ?? ''}`,
      'contextIndicator.estimate': 'Estimate',
      'contextIndicator.free': 'Free',
      'contextIndicator.loading': 'Loading context usage...',
      'contextIndicator.loadingAria': 'Context usage loading',
      'contextIndicator.modelUnknown': 'Unknown model',
      'contextIndicator.pendingAria': 'Context usage not calculated',
      'contextIndicator.pendingDetail': 'Context usage will be calculated after the session starts.',
      'contextIndicator.title': 'Context',
      'contextIndicator.unavailableAria': 'Context usage unavailable',
      'contextIndicator.unavailableDetail': 'Context usage is unavailable.',
      'contextIndicator.updatedMinutes': `${values?.count ?? 0}m ago`,
      'contextIndicator.updatedNow': 'Updated now',
      'contextIndicator.updatedUnknown': 'Not updated yet',
      'contextIndicator.used': 'Used',
      'contextIndicator.window': 'Window',
      'tabs.close': 'Close',
    }
    return translations[key] ?? key
  },
}))

vi.mock('../../hooks/useMobileViewport', () => ({
  useMobileViewport: () => viewportMocks.mobile,
}))

vi.mock('../../lib/desktopRuntime', () => ({
  isDesktopRuntime: () => viewportMocks.desktop,
}))

describe('ContextUsageIndicator', () => {
  beforeEach(() => {
    viewportMocks.mobile = false
    viewportMocks.desktop = true
    vi.mocked(sessionsApi.getInspection).mockReset()
  })

  it('shows a compact hover card on desktop instead of hiding the popover', () => {
    render(
      <ContextUsageIndicator
        chatState="idle"
        messageCount={0}
        fallbackModelLabel="deepseek-reasoner"
        draft
        compact
      />,
    )

    const popover = screen.getByTestId('context-usage-popover')
    expect(popover).toHaveClass('context-usage-popover--compact')
    expect(popover.className).not.toContain('hidden')
    expect(screen.getByText('deepseek-reasoner')).toBeInTheDocument()
    expect(screen.getByText('Context usage will be calculated after the session starts.')).toBeInTheDocument()
  })

  it('keeps the compact desktop popover open after clicking the indicator', () => {
    render(
      <ContextUsageIndicator
        chatState="idle"
        messageCount={0}
        fallbackModelLabel="deepseek-reasoner"
        draft
        compact
      />,
    )

    const popover = screen.getByTestId('context-usage-popover')
    expect(popover).not.toHaveClass('context-usage-popover--open')

    fireEvent.click(screen.getByTestId('context-usage-indicator'))

    expect(popover).toHaveClass('context-usage-popover--open')
    expect(popover).toHaveClass('opacity-100')
    expect(popover).toHaveClass('pointer-events-auto')
  })

  it('only opens the sheet for compact indicators on mobile browser layouts', () => {
    viewportMocks.mobile = true
    viewportMocks.desktop = false

    render(
      <ContextUsageIndicator
        chatState="idle"
        messageCount={0}
        fallbackModelLabel="deepseek-reasoner"
        draft
        compact
      />,
    )

    fireEvent.click(screen.getByTestId('context-usage-indicator'))

    expect(screen.getByRole('dialog', { name: 'Context' })).toBeInTheDocument()
  })
})
