/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import themeCss from '../theme/globals.css?raw'

describe('theme tokens', () => {
  it('uses blue brand accents instead of the previous orange palette', () => {
    expect(themeCss).toContain('--color-primary: #2563EB;')
    expect(themeCss).toContain('--color-primary-container: #3B82F6;')
    expect(themeCss).toContain('--color-primary: #77A8FF;')
    expect(themeCss).toContain('--color-primary-container: #3B82F6;')

    expect(themeCss).not.toMatch(/#8F482F|#AD5F45|#EFA083|#B86F56|#FFDBD0|#FFB59D/i)
    expect(themeCss).not.toMatch(/rgba\(143,\s*72,\s*47|rgba\(239,\s*160,\s*131|rgba\(255,\s*219,\s*208/i)
  })

  it('keeps the sidebar opaque in the desktop shell', () => {
    const sidebarShellRule = themeCss.match(/\.sidebar-shell\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const contentAreaRule = themeCss.match(/\.app-shell-content\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const sidebarGlassRule = themeCss.match(/\.sidebar-panel--glass\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const darkSidebarGlassRule = themeCss.match(/\[data-theme="dark"\]\s*\.sidebar-panel--glass\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const sidebarScrollRule = themeCss.match(/\.sidebar-scroll-area\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''

    expect(sidebarShellRule).toContain('background: var(--color-surface-sidebar);')
    expect(sidebarShellRule).toContain('isolation: isolate;')
    expect(sidebarShellRule).toContain('z-index: 20;')
    expect(contentAreaRule).toContain('contain: paint;')
    expect(contentAreaRule).toContain('isolation: isolate;')
    expect(sidebarScrollRule).toContain('contain: paint;')
    expect(sidebarGlassRule).not.toContain('backdrop-filter')
    expect(darkSidebarGlassRule).not.toContain('backdrop-filter')
    expect(sidebarGlassRule).not.toContain('transparent')
    expect(darkSidebarGlassRule).not.toContain('transparent')
    expect(sidebarGlassRule).toContain('background: var(--color-surface-sidebar);')
    expect(darkSidebarGlassRule).toContain('background: var(--color-surface-sidebar);')
  })

  it('keeps sidebar live markers inside a small WebView paint area', () => {
    const markerRules = [...themeCss.matchAll(/\.sidebar-session-status-marker[^{}]*\{[^}]*\}/g)]
      .map((match) => match[0])
      .join('\n')

    expect(markerRules).toContain('contain: paint;')
    expect(markerRules).toContain('overflow: hidden;')
    expect(markerRules).not.toMatch(/\bfilter\s*:/)
    expect(markerRules).not.toContain('mix-blend-mode')
    expect(markerRules).not.toContain('-webkit-mask')
    expect(markerRules).not.toMatch(/(^|[^-])\bmask\s*:/)
  })

  it('keeps active composer glow bounded to the content pane', () => {
    const composerRule = themeCss.match(/\.chat-composer-shell\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const activeComposerRule = themeCss.match(/\.chat-composer-shell--active\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''

    expect(composerRule).toContain('isolation: isolate;')
    expect(activeComposerRule).toContain('box-shadow:')
    expect(activeComposerRule).toContain('var(--composer-glow-border-mix, 86%)')
    expect(activeComposerRule).toContain('var(--composer-glow-ring-mix, 50%)')
    expect(activeComposerRule).toContain('clamp(0%, calc(var(--composer-glow-ring-mix, 50%) - 18%), 100%)')
    expect(activeComposerRule).toContain('max(0px, calc(var(--composer-glow-near-blur, 52px) - 16px))')
    expect(activeComposerRule).toContain('max(0px, calc(var(--composer-glow-near-spread, 13px) - 5px))')
    expect(activeComposerRule).toContain('max(0px, calc(var(--composer-glow-far-blur, 99px) - 26px))')
    expect(activeComposerRule).toContain('max(0px, calc(var(--composer-glow-far-spread, 8px) - 4px))')
    expect(activeComposerRule).toContain('animation: composer-glow-breathe 2.8s ease-in-out infinite;')
    expect(themeCss).toContain('@keyframes composer-glow-breathe')
    expect(themeCss).not.toContain('@keyframes composer-edge-light-sweep')
    expect(themeCss).not.toContain('@keyframes composer-border-marquee')
  })

  it('uses system CJK fonts and native smoothing for readable Chinese text', () => {
    expect(themeCss).toContain('--font-body: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", "SF Pro Text", "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Hiragino Sans GB", sans-serif;')
    expect(themeCss).toContain('--font-headline: Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI Variable Display", "Segoe UI", "SF Pro Display", "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Hiragino Sans GB", sans-serif;')
    expect(themeCss).toContain('--font-label: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", "SF Pro Text", "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Hiragino Sans GB", sans-serif;')
    expect(themeCss).toContain('-webkit-font-smoothing: auto;')
    expect(themeCss).not.toContain("--font-body: 'Inter', sans-serif;")
  })
})
