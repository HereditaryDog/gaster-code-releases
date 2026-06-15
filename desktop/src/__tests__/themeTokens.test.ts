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

  it('renders the main sidebar as a frosted dark material surface', () => {
    const sidebarShellRule = themeCss.match(/\.sidebar-shell\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const contentAreaRule = themeCss.match(/\.app-shell-content\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const sidebarGlassRule = themeCss.match(/\.sidebar-panel--glass\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const darkSidebarGlassRule = themeCss.match(/\[data-theme="dark"\]\s*\.sidebar-panel--glass\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const sidebarScrollRule = themeCss.match(/\.sidebar-scroll-area\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''

    expect(sidebarShellRule).toContain('background: transparent;')
    expect(sidebarShellRule).toContain('overflow: visible;')
    expect(sidebarShellRule).toContain('isolation: isolate;')
    expect(sidebarShellRule).toContain('z-index: 20;')
    expect(contentAreaRule).toContain('contain: paint;')
    expect(contentAreaRule).toContain('isolation: isolate;')
    expect(sidebarScrollRule).toContain('contain: paint;')
    expect(sidebarGlassRule).toContain('rgba(16, 18, 22, 0.72)')
    expect(sidebarGlassRule).toContain('border-radius: 0 22px 22px 0;')
    expect(sidebarGlassRule).toContain('backdrop-filter: blur(34px) saturate(128%);')
    expect(sidebarGlassRule).toContain('-webkit-backdrop-filter: blur(34px) saturate(128%);')
    expect(sidebarGlassRule).toContain('inset 0 1px 0 rgba(255, 255, 255, 0.13)')
    expect(darkSidebarGlassRule).toContain('rgba(16, 18, 22, 0.72)')
    expect(themeCss).toContain('.sidebar-brand-logo {\n  filter: none;\n}')
    expect(themeCss).toContain('.gaster-brand-mark')
    expect(themeCss).toContain('color: var(--color-brand-wordmark);')
    expect(themeCss).toContain('.hero-brand-lockup')
    expect(themeCss).toContain('.sidebar-nav-item--active,\n.sidebar-session-row--active,\n.sidebar-session-row--selected')
  })

  it('adapts main sidebar corners to the desktop window chrome', () => {
    const desktopSidebarRule = themeCss.match(/\.app-shell--desktop\s+\.sidebar-panel--glass\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const mobileSidebarRule = themeCss.match(/\.app-shell--mobile\s+\.sidebar-panel\s*,\s*\n\.app-shell--mobile\s+\.sidebar-panel\[data-state="closed"\]\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''

    expect(desktopSidebarRule).toContain('border-radius: 14px 0 0 14px;')
    expect(desktopSidebarRule).toContain('border-left-color: rgba(255, 255, 255, 0.09);')
    expect(desktopSidebarRule).toContain('border-right-color: rgba(255, 255, 255, 0.075);')
    expect(mobileSidebarRule).toContain('border-radius: 0 22px 22px 0;')
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

  it('styles the desktop chat composer as a restrained floating material pill', () => {
    const floatingComposerRule = themeCss.match(/\.chat-composer-shell\.chat-composer-shell--floating\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const floatingTextareaRule = themeCss.match(/\.chat-composer-shell--floating\s+\.chat-composer-textarea--compact\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const floatingToolbarRule = themeCss.match(/\.chat-composer-shell--floating\s+\.chat-composer-toolbar\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const floatingSendRule = themeCss.match(/\.chat-composer-shell--floating\s+\.chat-composer-send-button\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''

    expect(floatingComposerRule).toContain('border-radius: 999px;')
    expect(floatingComposerRule).toContain('overflow: visible;')
    expect(floatingComposerRule).toContain('backdrop-filter: blur(24px) saturate(1.22);')
    expect(floatingComposerRule).toContain('inset 0 1px 0 rgba(255, 255, 255, 0.12)')
    expect(floatingTextareaRule).toContain('padding-right: clamp(300px, 36vw, 380px);')
    expect(floatingToolbarRule).toContain('pointer-events: none;')
    expect(floatingSendRule).toContain('width: 36px;')
    expect(floatingSendRule).toContain('border-radius: 999px;')
  })

  it('uses system CJK fonts and native smoothing for readable Chinese text', () => {
    expect(themeCss).toContain('--font-body: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", "SF Pro Text", "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Hiragino Sans GB", sans-serif;')
    expect(themeCss).toContain('--font-headline: Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI Variable Display", "Segoe UI", "SF Pro Display", "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Hiragino Sans GB", sans-serif;')
    expect(themeCss).toContain('--font-label: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", "SF Pro Text", "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", "Hiragino Sans GB", sans-serif;')
    expect(themeCss).toContain('-webkit-font-smoothing: auto;')
    expect(themeCss).not.toContain("--font-body: 'Inter', sans-serif;")
  })
})
