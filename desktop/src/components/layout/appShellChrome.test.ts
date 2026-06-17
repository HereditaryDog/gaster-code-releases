import { describe, expect, it } from 'vitest'

import { getAppShellChromeClassName, shouldShowDesktopTabBar } from './AppShell'

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

  it('marks only the desktop runtime shell for desktop-specific chrome styling', () => {
    expect(getAppShellChromeClassName(false, true)).toContain('app-shell--desktop')
    expect(getAppShellChromeClassName(false, false)).not.toContain('app-shell--desktop')
    expect(getAppShellChromeClassName(true, false)).toContain('app-shell--mobile')
  })
})
