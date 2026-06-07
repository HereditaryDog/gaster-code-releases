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

  it('gives the desktop sidebar a restrained macOS frosted material', () => {
    const sidebarShellRule = themeCss.match(/\.sidebar-shell\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const contentAreaRule = themeCss.match(/\.app-shell-content\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const sidebarGlassRule = themeCss.match(/\.sidebar-panel--glass\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const darkSidebarGlassRule = themeCss.match(/\[data-theme="dark"\]\s*\.sidebar-panel--glass\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const sidebarScrollRule = themeCss.match(/\.sidebar-scroll-area\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const activePillRule = themeCss.match(
      /\.sidebar-nav-item--active,\s*\.sidebar-session-row--active,\s*\.sidebar-session-row--selected\s*\{(?<body>[^}]*)\}/,
    )?.groups?.body ?? ''
    const controlSurfaceRule = themeCss.match(/\.sidebar-control-surface\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''

    expect(sidebarShellRule).toContain('background: transparent;')
    expect(sidebarShellRule).toContain('isolation: isolate;')
    expect(sidebarShellRule).toContain('z-index: 20;')
    expect(sidebarShellRule).toContain('overflow: visible;')
    expect(contentAreaRule).toContain('contain: paint;')
    expect(contentAreaRule).toContain('isolation: isolate;')
    expect(sidebarScrollRule).toContain('contain: paint;')
    expect(sidebarGlassRule).toContain('backdrop-filter: blur(34px) saturate(128%);')
    expect(sidebarGlassRule).toContain('-webkit-backdrop-filter: blur(34px) saturate(128%);')
    expect(sidebarGlassRule).toContain('border: 1px solid rgba(255, 255, 255, 0.095);')
    expect(sidebarGlassRule).toContain('border-right-color: transparent;')
    expect(sidebarGlassRule).toContain('overflow: hidden;')
    expect(sidebarGlassRule).toContain('inset 0 1px 0 rgba(255, 255, 255, 0.13)')
    const sidebarShadow = sidebarGlassRule.match(/box-shadow:\s*(?<shadow>[^;]+);/)?.groups?.shadow ?? ''
    const sidebarShadowLayers = sidebarShadow.split(',\n').map((layer) => layer.trim()).filter(Boolean)
    expect(sidebarShadowLayers).toEqual(expect.arrayContaining([
      'inset 0 1px 0 rgba(255, 255, 255, 0.13)',
      'inset 1px 0 0 rgba(255, 255, 255, 0.045)',
    ]))
    expect(sidebarShadowLayers.every((layer) => layer.startsWith('inset '))).toBe(true)
    expect(sidebarGlassRule).not.toContain('0 34px 90px')
    expect(sidebarGlassRule).not.toContain('0 14px 38px')
    expect(sidebarGlassRule).not.toContain('12px 0 26px')
    expect(sidebarGlassRule).not.toContain('3px 0 10px')
    expect(darkSidebarGlassRule).toContain('linear-gradient(180deg, rgba(27, 29, 33, 0.78), rgba(11, 13, 16, 0.84))')
    expect(darkSidebarGlassRule).not.toContain('background: var(--color-surface-sidebar);')
    expect(activePillRule).toContain('border-radius: 13px;')
    expect(activePillRule).toContain('rgba(255, 255, 255, 0.078)')
    expect(activePillRule).toContain('inset 0 1px 0 rgba(255, 255, 255, 0.12)')
    expect(controlSurfaceRule).toContain('background: rgba(255, 255, 255, 0.044);')
    expect(controlSurfaceRule).toContain('box-shadow:')

    for (const ruleBody of [controlSurfaceRule, activePillRule]) {
      const shadow = ruleBody.match(/box-shadow:\s*(?<shadow>[^;]+);/)?.groups?.shadow ?? ''
      expect(shadow.split(',\n').map((layer) => layer.trim()).filter(Boolean).every((layer) => layer.startsWith('inset ')))
        .toBe(true)
      expect(shadow).not.toMatch(/(?:^|,\n)\s*0\s+\d/)
    }
  })

  it('prevents release sync from restoring the old sidebar menu shadow', () => {
    const sidebarShellRule = themeCss.match(/\.sidebar-shell\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const sidebarGlassRule = themeCss.match(/\.sidebar-panel--glass\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''
    const darkSidebarGlassRule = themeCss.match(/\[data-theme="dark"\]\s*\.sidebar-panel--glass\s*\{(?<body>[^}]*)\}/)?.groups?.body ?? ''

    expect(sidebarShellRule).toContain('background: transparent;')
    expect(sidebarShellRule).toContain('overflow: visible;')
    expect(sidebarGlassRule).toContain('backdrop-filter: blur(34px) saturate(128%);')
    expect(sidebarGlassRule).toContain('border-right-color: transparent;')
    expect(sidebarGlassRule).not.toContain('background: var(--color-surface-sidebar);')
    expect(sidebarGlassRule).not.toMatch(/\n\s*\d+px\s+0\s+\d+px\s+rgba/)
    expect(darkSidebarGlassRule).not.toContain('background: var(--color-surface-sidebar);')
    expect(darkSidebarGlassRule).not.toMatch(/\n\s*\d+px\s+0\s+\d+px\s+rgba/)
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
