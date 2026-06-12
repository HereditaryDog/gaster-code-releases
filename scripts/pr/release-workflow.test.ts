import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

function readText(path: string) {
  return readFileSync(path, 'utf8')
}

function readReleaseWorkflow() {
  return readText('.github/workflows/release-desktop.yml')
}

function extractJob(workflow: string, jobName: string) {
  return workflow.match(
    new RegExp(`${jobName}:[\\s\\S]*?(?:\\n {2}[a-zA-Z0-9_-]+:|$)`),
  )?.[0] ?? ''
}

describe('release desktop workflow', () => {
  test('release packaging does not run PR quality gates', () => {
    const workflow = readReleaseWorkflow()

    expect(workflow).not.toContain('quality-preflight')
    expect(workflow).not.toContain('bun run verify')
    expect(workflow).not.toContain('bun run quality:gate --mode pr')
    expect(workflow).toContain('name: Build (${{ matrix.label }})')
  })

  test('release workflow reads desktop package version and validates the tag', () => {
    const workflow = readReleaseWorkflow()

    expect(workflow).toContain('VERSION=$(node -p "require(\'./desktop/package.json\').version")')
    expect(workflow).toContain('EXPECTED_TAG="v${{ steps.version.outputs.value }}"')
    expect(workflow).toContain('Tag ${GITHUB_REF_NAME} does not match app version ${EXPECTED_TAG}')
  })

  test('release workflow builds Electron bundles instead of Tauri bundles', () => {
    const workflow = readReleaseWorkflow()

    expect(workflow).toContain('signing-preflight:')
    expect(workflow).toContain('Build renderer and Electron bundles')
    expect(workflow).toContain('Build Electron release artifacts')
    expect(workflow).toContain('builder_args=(${{ matrix.builder_args }} --publish never)')
    expect(workflow).toContain('bunx electron-builder "${builder_args[@]}"')
    expect(workflow).toContain('SIDECAR_TARGET_TRIPLE: ${{ matrix.target_triple }}')
    expect(workflow).not.toContain('tauri-apps/tauri-action@v0')
    expect(workflow).not.toContain('TAURI_ENV_TARGET_TRIPLE')
    expect(workflow).not.toContain('latest.json')
  })

  test('release workflow disables notarization for unsigned macOS builds', () => {
    const workflow = readReleaseWorkflow()
    const buildJob = extractJob(workflow, 'build')

    expect(buildJob).toContain('MACOS_SIGNED: ${{ needs.signing-preflight.outputs.macos_signed }}')
    expect(buildJob).toContain('if [ "$MACOS_SIGNED" = "true" ]; then')
    expect(buildJob).toContain('export CSC_LINK="$MACOS_CERTIFICATE"')
    expect(buildJob).toContain('export CSC_IDENTITY_AUTO_DISCOVERY=false')
    expect(buildJob).toContain('builder_args+=(-c.mac.notarize=false)')
    expect(buildJob).not.toContain('CSC_LINK: ${{ secrets.MACOS_CERTIFICATE }}')
    expect(buildJob).not.toContain('CSC_KEY_PASSWORD: ${{ secrets.MACOS_CERTIFICATE_PASSWORD }}')
  })

  test('release workflow runs package smoke before publishing assets', () => {
    const workflow = readReleaseWorkflow()

    expect(workflow).toContain('bun run test:package-smoke --platform ${{ matrix.smoke_platform }} --package-kind release --artifacts-dir desktop/build-artifacts/electron')
    expect(workflow.indexOf('Verify packaged app structure')).toBeLessThan(
      workflow.indexOf('Upload release artifacts for final publish'),
    )
    expect(workflow.indexOf('Verify macOS launch policy')).toBeLessThan(
      workflow.indexOf('Upload release artifacts for final publish'),
    )
  })

  test('release workflow publishes private and public Gaster releases', () => {
    const workflow = readReleaseWorkflow()
    const privateJob = extractJob(workflow, 'publish-private-release')
    const publicJob = extractJob(workflow, 'publish-public-release')

    expect(privateJob).toContain('name: Publish private release')
    expect(privateJob).toContain('softprops/action-gh-release@v2')
    expect(privateJob).toContain('name: Gaster Code v${{ steps.version.outputs.value }}')
    expect(privateJob).toContain('release-notes/v${{ steps.version.outputs.value }}.md')

    expect(publicJob).toContain('name: Publish public release assets')
    expect(publicJob).toContain('needs: publish-private-release')
    expect(publicJob).toContain('PUBLIC_RELEASE_REPOSITORY: HereditaryDog/gaster-code-releases')
    expect(publicJob).toContain('GH_TOKEN: ${{ secrets.PUBLIC_RELEASE_TOKEN }}')
    expect(publicJob).toContain('gh release create "$TAG"')
    expect(publicJob).toContain('gh release upload "$TAG"')
    expect(publicJob).toContain('release-notes/${{ steps.version.outputs.tag }}.md')
  })

  test('release workflow validates exact Electron assets and updater metadata', () => {
    const workflow = readReleaseWorkflow()
    const publishJob = extractJob(workflow, 'publish-private-release')
    const publicJob = extractJob(workflow, 'publish-public-release')
    const expectedFiles = [
      'Gaster-Code-${APP_VERSION}-mac-arm64.dmg',
      'Gaster-Code-${APP_VERSION}-mac-arm64.dmg.blockmap',
      'Gaster-Code-${APP_VERSION}-mac-arm64.zip',
      'Gaster-Code-${APP_VERSION}-mac-arm64.zip.blockmap',
      'Gaster-Code-${APP_VERSION}-win-x64.exe',
      'Gaster-Code-${APP_VERSION}-win-x64.exe.blockmap',
    ]

    for (const file of expectedFiles) {
      expect(workflow).toContain(file)
      expect(publicJob).toContain(file)
    }
    for (const metadata of ['latest-mac.yml', 'latest.yml']) {
      expect(publishJob).toContain(metadata)
      expect(publicJob).toContain(metadata)
    }
    expect(publishJob).toContain('artifacts/release-assets/**/*.zip')
    expect(publishJob).toContain('artifacts/release-assets/**/*.blockmap')
    expect(publicJob).toContain('artifacts/release-assets/*.zip')
    expect(publicJob).toContain('artifacts/release-assets/*.blockmap')
    expect(workflow).toContain('bun run scripts/release-update-metadata.ts --metadata-dir artifacts/update-metadata --out-dir artifacts/update-metadata-standard')
    expect(workflow).not.toContain('macOS-x64')
    expect(workflow).not.toContain('Gaster-Code-${APP_VERSION}-mac-x64')
  })

  test('development desktop workflow uses Electron Builder artifacts', () => {
    const workflow = readText('.github/workflows/build-desktop-dev.yml')

    expect(workflow).toContain('Build renderer and Electron bundles')
    expect(workflow).toContain('Build Electron app')
    expect(workflow).toContain('bunx electron-builder ${{ matrix.builder_args }} --publish never')
    expect(workflow).toContain('bun run test:package-smoke --platform ${{ matrix.smoke_platform }} --package-kind release --artifacts-dir desktop/build-artifacts/electron')
    expect(workflow).toContain('ci-Gaster-Code-v${{ steps.version.outputs.version }}-${{ matrix.artifact_name }}')
    expect(workflow).toContain('Gaster-Code-v${{ steps.version.outputs.version }}-${{ matrix.artifact_name }}')
    expect(workflow).not.toContain('tauri-apps/tauri-action@v0')
    expect(workflow).not.toContain('Build Tauri app')
  })

  test('desktop package metadata matches Gaster Electron release naming', () => {
    const desktopPackage = JSON.parse(readText('desktop/package.json')) as {
      name?: string
      description?: string
      homepage?: string
      author?: { name?: string }
      build?: {
        productName?: string
        artifactName?: string
        dmg?: {
          title?: string
          background?: string
          iconSize?: number
          window?: { width?: number, height?: number }
          contents?: Array<{ x?: number, y?: number, type?: string, path?: string }>
        }
        linux?: { maintainer?: string }
        publish?: Array<{ provider?: string, owner?: string, repo?: string }>
      }
    }

    expect(desktopPackage.name).toBe('gaster-code-desktop')
    expect(desktopPackage.description).toBeTruthy()
    expect(desktopPackage.homepage).toBe('https://github.com/HereditaryDog/gaster-code-releases')
    expect(desktopPackage.author?.name).toBe('HereditaryDog')
    expect(desktopPackage.build?.productName).toBe('Gaster Code')
    expect(desktopPackage.build?.artifactName).toBe('Gaster-Code-${version}-${os}-${arch}.${ext}')
    expect(desktopPackage.build?.dmg).toMatchObject({
      title: 'Gaster Code ${version}',
      background: 'build/dmg-background.png',
      iconSize: 96,
      window: { width: 660, height: 400 },
      contents: [
        { x: 158, y: 200, type: 'file' },
        { x: 502, y: 200, type: 'link', path: '/Applications' },
      ],
    })
    expect(desktopPackage.build?.linux?.maintainer).toBe('HereditaryDog')
    expect(desktopPackage.build?.publish).toEqual([
      {
        provider: 'github',
        owner: 'HereditaryDog',
        repo: 'gaster-code-releases',
      },
    ])
  })

  test('release script uses desktop package version and keeps release notes explicit', () => {
    const releaseScript = readText('scripts/release.ts')

    expect(releaseScript).toContain("readFileSync(path.join(root, 'desktop/package.json'), 'utf-8')")
    expect(releaseScript).toContain("path.join(root, 'release-notes', `v${version}.md`)")
    expect(releaseScript).toContain("path.join(root, 'desktop/src-tauri/tauri.conf.json')")
    expect(releaseScript).toContain("path.join(root, 'desktop/src-tauri/Cargo.toml')")
    expect(releaseScript).toContain("path.join(root, 'desktop/src-tauri/Cargo.lock')")
    expect(releaseScript).toContain("path.join(root, 'desktop/src/version.ts')")
    expect(releaseScript).toContain('git push origin main v${next}')
    expect(releaseScript).not.toContain('git push origin main --tags')
    expect(releaseScript).not.toContain("await run(['cargo', 'generate-lockfile']")
    expect(releaseScript).not.toContain('CHANGELOG.md')
  })
})
