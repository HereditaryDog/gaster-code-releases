import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('uiStore theme persistence', () => {
  beforeEach(() => {
    vi.resetModules()
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
  })

  it('migrates the legacy theme to the Gaster Code storage key', async () => {
    window.localStorage.setItem('cc-haha-theme', 'dark')

    const { useUIStore } = await import('./uiStore')

    expect(useUIStore.getState().theme).toBe('dark')
    expect(window.localStorage.getItem('gaster-code-theme')).toBe('dark')
    expect(window.localStorage.getItem('cc-haha-theme')).toBeNull()
  })

  it('writes theme changes to the Gaster Code storage key', async () => {
    const { useUIStore } = await import('./uiStore')

    useUIStore.getState().setTheme('dark')

    expect(window.localStorage.getItem('gaster-code-theme')).toBe('dark')
    expect(window.localStorage.getItem('cc-haha-theme')).toBeNull()
  })

  it('defaults new installs to the pure white theme', async () => {
    const { initializeTheme, useUIStore } = await import('./uiStore')

    expect(useUIStore.getState().theme).toBe('white')
    initializeTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('white')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('hydrates and applies the pure white theme as a light color scheme', async () => {
    window.localStorage.setItem('gaster-code-theme', 'white')

    const { initializeTheme, useUIStore } = await import('./uiStore')

    expect(useUIStore.getState().theme).toBe('white')
    initializeTheme()
    expect(document.documentElement.getAttribute('data-theme')).toBe('white')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('cycles through pure white, warm classic, and dark themes', async () => {
    const { useUIStore } = await import('./uiStore')

    useUIStore.getState().toggleTheme()
    expect(useUIStore.getState().theme).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')

    useUIStore.getState().toggleTheme()
    expect(useUIStore.getState().theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')

    useUIStore.getState().toggleTheme()
    expect(useUIStore.getState().theme).toBe('white')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('uses the desktop app default sidebar width on first launch', async () => {
    const { useUIStore } = await import('./uiStore')

    expect(useUIStore.getState().sidebarWidth).toBe(280)
  })

  it('persists a clamped sidebar width', async () => {
    const { useUIStore, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } = await import('./uiStore')

    useUIStore.getState().setSidebarWidth(SIDEBAR_MAX_WIDTH + 80)

    expect(useUIStore.getState().sidebarWidth).toBe(SIDEBAR_MAX_WIDTH)
    expect(window.localStorage.getItem('gaster-code-sidebar-width')).toBe(String(SIDEBAR_MAX_WIDTH))

    useUIStore.getState().setSidebarWidth(SIDEBAR_MIN_WIDTH - 40)

    expect(useUIStore.getState().sidebarWidth).toBe(SIDEBAR_MIN_WIDTH)
    expect(window.localStorage.getItem('gaster-code-sidebar-width')).toBe(String(SIDEBAR_MIN_WIDTH))
  })

  it('can update sidebar width without persisting until drag end', async () => {
    const { useUIStore } = await import('./uiStore')

    useUIStore.getState().setSidebarWidth(360, { persist: false })

    expect(useUIStore.getState().sidebarWidth).toBe(360)
    expect(window.localStorage.getItem('gaster-code-sidebar-width')).toBeNull()

    useUIStore.getState().setSidebarWidth(360)

    expect(window.localStorage.getItem('gaster-code-sidebar-width')).toBe('360')
  })

  it('allows the sidebar to expand wider for roomy navigation', async () => {
    const { useUIStore } = await import('./uiStore')

    useUIStore.getState().setSidebarWidth(560)

    expect(useUIStore.getState().sidebarWidth).toBe(560)
    expect(window.localStorage.getItem('gaster-code-sidebar-width')).toBe('560')
  })

  it('ignores invalid sidebar width updates', async () => {
    const { useUIStore, SIDEBAR_DEFAULT_WIDTH } = await import('./uiStore')

    useUIStore.getState().setSidebarWidth(Number.NaN)

    expect(useUIStore.getState().sidebarWidth).toBe(SIDEBAR_DEFAULT_WIDTH)
    expect(window.localStorage.getItem('gaster-code-sidebar-width')).toBeNull()
  })
})
