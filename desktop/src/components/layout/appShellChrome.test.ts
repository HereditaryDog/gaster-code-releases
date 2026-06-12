import { describe, expect, it } from 'vitest'

import { shouldShowDesktopTabBar } from './AppShell'

describe('AppShell desktop chrome', () => {
  it('hides the global tab title bar when settings is the active page', () => {
    expect(shouldShowDesktopTabBar(false, 'settings')).toBe(false)
  })

  it('keeps the global tab title bar for normal session pages', () => {
    expect(shouldShowDesktopTabBar(false, 'session')).toBe(true)
  })

  it('does not render the desktop tab title bar in the mobile shell', () => {
    expect(shouldShowDesktopTabBar(true, 'session')).toBe(false)
  })
})
