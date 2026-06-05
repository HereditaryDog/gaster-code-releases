/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'

declare const process: {
  cwd(): string
}

const { readFileSync } = await import('node:fs')
const { resolve } = await import('node:path')

const releaseWorkflowYaml = readFileSync(
  resolve(process.cwd(), '../.github/workflows/release-desktop.yml'),
  'utf8',
)
const desktopPackageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
) as {
  build?: {
    publish?: Array<{ provider?: string, owner?: string, repo?: string }>
  }
}

describe('desktop release updater configuration', () => {
  it('uses Electron Builder publish metadata for the public release-only repository', () => {
    expect(desktopPackageJson.build?.publish).toEqual([
      {
        provider: 'github',
        owner: 'HereditaryDog',
        repo: 'gaster-code-releases',
      },
    ])
  })

  it('builds Electron updater metadata before publishing releases', () => {
    expect(releaseWorkflowYaml).toContain('Build Electron release artifacts')
    expect(releaseWorkflowYaml).toContain('desktop-update-metadata-${{ matrix.label }}')
    expect(releaseWorkflowYaml).toContain('bun run scripts/release-update-metadata.ts --metadata-dir artifacts/update-metadata --out-dir artifacts/update-metadata-standard')
    expect(releaseWorkflowYaml).toContain('Validate standard update metadata set')
    expect(releaseWorkflowYaml).toContain('latest-mac.yml')
    expect(releaseWorkflowYaml).toContain('latest-linux.yml')
    expect(releaseWorkflowYaml).toContain('latest-linux-arm64.yml')
    expect(releaseWorkflowYaml).toContain('latest.yml')
  })

  it('publishes private and public release assets with updater metadata', () => {
    expect(releaseWorkflowYaml).toContain('publish-private-release:')
    expect(releaseWorkflowYaml).toContain('publish-public-release:')
    expect(releaseWorkflowYaml).toContain('PUBLIC_RELEASE_REPOSITORY: HereditaryDog/gaster-code-releases')
    expect(releaseWorkflowYaml).toContain('PUBLIC_RELEASE_TOKEN')
    expect(releaseWorkflowYaml).toContain('artifacts/release-assets/**/*.blockmap')
    expect(releaseWorkflowYaml).toContain('artifacts/update-metadata-standard/*.yml')
    expect(releaseWorkflowYaml).toContain('artifacts/release-assets/*.blockmap')
    expect(releaseWorkflowYaml).toContain('artifacts/update-metadata-standard/*.yml')
  })

  it('does not depend on legacy Tauri updater manifest rewriting', () => {
    expect(releaseWorkflowYaml).not.toContain('tauri-apps/tauri-action@v0')
    expect(releaseWorkflowYaml).not.toContain('PRIVATE_ASSET_BASE')
    expect(releaseWorkflowYaml).not.toContain('PUBLIC_ASSET_BASE')
    expect(releaseWorkflowYaml).not.toContain('.value.url |= if startswith($private)')
    expect(releaseWorkflowYaml).not.toContain('latest.json')
  })
})
