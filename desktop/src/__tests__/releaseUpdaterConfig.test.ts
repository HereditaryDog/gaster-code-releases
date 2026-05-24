/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import releaseWorkflowYaml from '../../../.github/workflows/release-desktop.yml?raw'
import releaseConfigJson from '../../src-tauri/tauri.release-ci.json?raw'
import tauriConfigJson from '../../src-tauri/tauri.conf.json?raw'

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

  it('passes the encoded Tauri signing key directly to tauri-action', () => {
    expect(releaseWorkflowYaml).not.toContain('Normalize Tauri signing key')
    expect(releaseWorkflowYaml).toContain(
      'TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}',
    )
  })

  it('builds the macOS x64 release on an Intel runner', () => {
    const macosX64Block = releaseWorkflowYaml.match(
      /platform:\s*"macos-15-intel"[\s\S]+?label:\s*"macOS-x64"/,
    )?.[0]

    expect(macosX64Block).toContain('rust_target: "x86_64-apple-darwin"')
    expect(macosX64Block).toContain('tauri_args: "--target x86_64-apple-darwin"')
  })

  it('rewrites updater manifest asset URLs before publishing the public release', () => {
    expect(releaseWorkflowYaml).toContain('PRIVATE_ASSET_BASE')
    expect(releaseWorkflowYaml).toContain('PUBLIC_ASSET_BASE')
    expect(releaseWorkflowYaml).toContain('.value.url |= if startswith($private)')
  })
})
