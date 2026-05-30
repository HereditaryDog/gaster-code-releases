/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'

declare const process: {
  cwd(): string
}

// @ts-expect-error desktop build does not include Node types, but Vitest runs this file in Node.
const { readFileSync } = await import('node:fs')
// @ts-expect-error desktop build does not include Node types, but Vitest runs this file in Node.
const { resolve } = await import('node:path')

const releaseWorkflowYaml = readFileSync(
  resolve(process.cwd(), '../.github/workflows/release-desktop.yml'),
  'utf8',
)
const releaseConfigJson = readFileSync(
  resolve(process.cwd(), 'src-tauri/tauri.release-ci.json'),
  'utf8',
)
const tauriConfigJson = readFileSync(
  resolve(process.cwd(), 'src-tauri/tauri.conf.json'),
  'utf8',
)

const GASTER_CODE_UPDATER_PUBLIC_KEY =
  'dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDI4ODI2NDJBRkFBNTlBMzAKUldRd21xWDZLbVNDS0UwbzkyMXF5ZExwaWg0U1YrdkRtbC9jMnVtdWpZR3crNFlOb0JyMjZack8K'

describe('desktop release updater configuration', () => {
  it('keeps updater artifacts enabled for the release workflow config', () => {
    const releaseConfig = JSON.parse(releaseConfigJson) as {
      bundle?: { createUpdaterArtifacts?: boolean }
    }

    expect(releaseConfig.bundle?.createUpdaterArtifacts).not.toBe(false)
  })

  it('uses the current updater public key expected by release signing secrets', () => {
    const tauriConfig = JSON.parse(tauriConfigJson) as {
      plugins?: { updater?: { pubkey?: string } }
    }

    expect(tauriConfig.plugins?.updater?.pubkey).toBe(GASTER_CODE_UPDATER_PUBLIC_KEY)
  })

  it('checks for updates from the public release-only repository', () => {
    const tauriConfig = JSON.parse(tauriConfigJson) as {
      plugins?: { updater?: { endpoints?: string[] } }
    }

    expect(tauriConfig.plugins?.updater?.endpoints).toEqual([
      'https://github.com/HereditaryDog/gaster-code-releases/releases/latest/download/latest.json',
    ])
  })

  it('serializes release jobs so updater manifests merge into one release', () => {
    const strategyBlock = releaseWorkflowYaml.match(/strategy:\n(?<body>(?: {6,}.+\n)+)/)
      ?.groups?.body

    expect(strategyBlock).toMatch(/^\s{6}max-parallel:\s*1$/m)
  })

  it('publishes built updater assets to the public release-only repository', () => {
    expect(releaseWorkflowYaml).toContain('public-release')
    expect(releaseWorkflowYaml).toContain('HereditaryDog/gaster-code-releases')
    expect(releaseWorkflowYaml).toContain('PUBLIC_RELEASE_TOKEN')
  })

  it('rewrites updater manifest asset URLs before publishing the public release', () => {
    expect(releaseWorkflowYaml).toContain('PRIVATE_ASSET_BASE')
    expect(releaseWorkflowYaml).toContain('PUBLIC_ASSET_BASE')
    expect(releaseWorkflowYaml).toContain('.value.url |= if startswith($private)')
  })
})
