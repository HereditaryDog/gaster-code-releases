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

  it('renders the sidebar as a bounded translucent glass surface', () => {
    const sidebarShellRule = themeCss.match(/\.sidebar-shell\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const contentAreaRule = themeCss.match(/\.app-shell-content\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const sidebarGlassRule = themeCss.match(/\.sidebar-panel--glass\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const whiteSidebarGlassRule = themeCss.match(/\[data-theme="white"\]\s*\.sidebar-panel--glass\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const darkSidebarGlassRule = themeCss.match(/\[data-theme="dark"\]\s*\.sidebar-panel--glass\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const sidebarGlassHighlightRule = themeCss.match(/\.sidebar-panel--glass::before\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const sidebarGlassChildRule = themeCss.match(/\.sidebar-panel--glass\s*>\s*\*\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const sidebarScrollRule = themeCss.match(/\.sidebar-scroll-area\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''

    expect(sidebarShellRule).toContain('background: var(--color-surface-sidebar);')
    expect(sidebarShellRule).toContain('isolation: isolate;')
    expect(sidebarShellRule).toContain('z-index: 20;')
    expect(contentAreaRule).toContain('contain: paint;')
    expect(contentAreaRule).toContain('isolation: isolate;')
    expect(sidebarScrollRule).toContain('contain: paint;')
    expect(themeCss).toContain('--color-sidebar-glass-bg: rgba(255, 255, 255, 0.74);')
    expect(themeCss).toContain('--color-sidebar-glass-bg: rgba(20, 22, 27, 0.72);')
    expect(themeCss).toContain('--color-sidebar-glass-border: rgba(255, 255, 255, 0.105);')
    expect(themeCss).toContain('--color-sidebar-search-bg: rgba(255, 255, 255, 0.038);')
    expect(themeCss).toContain('--color-sidebar-item-active: rgba(255, 255, 255, 0.105);')
    expect(themeCss).toContain('--sidebar-panel-bg-image: none;')
    expect(sidebarGlassRule).toContain('linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.016) 42%, rgba(255, 255, 255, 0))')
    expect(sidebarGlassRule).toContain('var(--color-sidebar-glass-bg);')
    expect(sidebarGlassRule).toContain('border-radius: 24px;')
    expect(sidebarGlassRule).not.toContain('border-radius: 0 24px 24px 0;')
    expect(sidebarGlassRule).toContain('border-right-color: var(--color-sidebar-glass-border);')
    expect(sidebarGlassRule).toContain('backdrop-filter: blur(22px) saturate(1.28);')
    expect(sidebarGlassRule).toContain('-webkit-backdrop-filter: blur(22px) saturate(1.28);')
    expect(sidebarGlassRule).toContain('0 26px 68px rgba(0, 0, 0, 0.46)')
    expect(sidebarGlassRule).toContain('inset 0 1px 0 rgba(255, 255, 255, 0.13)')
    expect(sidebarGlassRule).toContain('isolation: isolate;')
    expect(sidebarGlassRule).toContain('overflow: hidden;')
    expect(sidebarGlassHighlightRule).toContain('linear-gradient(180deg, rgba(255, 255, 255, 0.065), transparent 30%)')
    expect(sidebarGlassHighlightRule).not.toContain('radial-gradient')
    expect(sidebarGlassHighlightRule).toContain('pointer-events: none;')
    expect(sidebarGlassChildRule).toContain('z-index: 1;')
    expect(whiteSidebarGlassRule).toContain('border-right-color: transparent;')
    expect(whiteSidebarGlassRule).toContain('0 18px 44px rgba(15, 23, 42, 0.07)')
    expect(whiteSidebarGlassRule).toContain('inset -1px 0 0 rgba(255, 255, 255, 0.92)')
    expect(whiteSidebarGlassRule).not.toContain('0 26px 68px rgba(0, 0, 0, 0.46)')
    expect(darkSidebarGlassRule).toContain('border-right-color: var(--color-sidebar-glass-border);')
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
    const floatingComposerRule = themeCss.match(/\.chat-composer-shell\.chat-composer-shell--floating\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const floatingTextareaRule = themeCss.match(/\.chat-composer-shell--floating\s+\.chat-composer-textarea--compact\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const floatingToolbarRule = themeCss.match(/\.chat-composer-shell--floating\s+\.chat-composer-toolbar\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const floatingSendRule = themeCss.match(/\.chat-composer-shell--floating\s+\.chat-composer-send-button\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const activeComposerRule = themeCss.match(/\.chat-composer-shell--active\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''

    expect(composerRule).toContain('isolation: isolate;')
    expect(themeCss).toContain('--color-chat-composer-shell: rgba(23, 24, 27, 0.76);')
    expect(themeCss).toContain('--color-chat-composer-shell-border: rgba(255, 255, 255, 0.105);')
    expect(themeCss).toContain('--shadow-chat-composer: 0 24px 68px rgba(0, 0, 0, 0.42), 0 7px 22px rgba(0, 0, 0, 0.3);')
    expect(floatingComposerRule).toContain('border-radius: 999px;')
    expect(floatingComposerRule).toContain('min-height: 56px;')
    expect(floatingComposerRule).toContain('backdrop-filter: blur(24px) saturate(1.22);')
    expect(floatingComposerRule).toContain('-webkit-backdrop-filter: blur(24px) saturate(1.22);')
    expect(floatingComposerRule).toContain('inset 0 1px 0 rgba(255, 255, 255, 0.12)')
    expect(floatingTextareaRule).toContain('height: 36px;')
    expect(floatingTextareaRule).toContain('padding-left: clamp(92px, 11vw, 112px);')
    expect(floatingToolbarRule).toContain('height: 36px;')
    expect(floatingToolbarRule).toContain('border-top: 0;')
    expect(floatingSendRule).toContain('width: 36px;')
    expect(floatingSendRule).toContain('height: 36px;')
    expect(floatingSendRule).toContain('border-radius: 999px;')
    expect(floatingSendRule).toContain('background:')
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
