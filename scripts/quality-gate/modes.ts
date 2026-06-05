import { baselineCases } from './baseline/cases'
import type { BaselineTarget, LaneDefinition, QualityGateMode } from './types'

export function currentPackageSmokePlatform(platform: NodeJS.Platform = process.platform) {
  if (platform === 'darwin') return 'macos'
  if (platform === 'win32') return 'windows'
  if (platform === 'linux') return 'linux'
  return null
}

export function currentReleaseArtifactsDir(
  platform: NodeJS.Platform = process.platform,
  arch: NodeJS.Architecture = process.arch,
) {
  if (platform === 'darwin') return arch === 'x64' ? 'desktop/build-artifacts/macos-x64' : 'desktop/build-artifacts/macos-arm64'
  if (platform === 'win32') return arch === 'arm64' ? 'desktop/build-artifacts/windows-arm64' : 'desktop/build-artifacts/windows-x64'
  if (platform === 'linux') return arch === 'arm64' ? 'desktop/build-artifacts/linux-arm64' : 'desktop/build-artifacts/linux-x64'
  return null
}

export function lanesForMode(mode: QualityGateMode, baselineTargets: BaselineTarget[] = []): LaneDefinition[] {
  const packageSmokePlatform = currentPackageSmokePlatform()
  const releaseArtifactsDir = currentReleaseArtifactsDir()
  const lanes: LaneDefinition[] = [
    {
      id: 'impact-report',
      title: 'Impact report',
      description: 'Summarize changed areas, required local checks, and risk notes.',
      kind: 'command',
      command: ['bun', 'run', 'check:impact'],
      requiredForModes: ['pr', 'baseline', 'release'],
    },
    {
      id: 'pr-checks',
      title: 'Path-aware PR checks',
      description: 'Run the existing local PR gate with stable path-aware checks.',
      kind: 'command',
      command: ['bun', 'run', 'check:pr'],
      requiredForModes: ['pr', 'release'],
    },
    {
      id: 'baseline-catalog',
      title: 'Baseline case catalog validation',
      description: 'Validate real Coding Agent baseline case definitions and fixture metadata.',
      kind: 'command',
      command: ['bun', 'test', 'scripts/quality-gate/baseline/cases.test.ts'],
      requiredForModes: ['baseline', 'release'],
    },
    {
      id: 'native-checks',
      title: 'Native desktop checks',
      description: 'Build sidecars and run the Tauri native compile check.',
      kind: 'command',
      command: ['bun', 'run', 'check:native'],
      requiredForModes: ['release'],
    },
    {
      id: 'persistence-upgrade',
      title: 'Persistence upgrade checks',
      description: 'Validate local JSON and desktop localStorage migrations against old-version fixtures.',
      kind: 'command',
      command: ['bun', 'run', 'check:persistence-upgrade'],
      requiredForModes: ['pr', 'release'],
    },
  ]

  if (packageSmokePlatform && releaseArtifactsDir) {
    const packageSmokeCommand = [
      'bun',
      'run',
      'test:package-smoke',
      '--platform',
      packageSmokePlatform,
      '--package-kind',
      'release',
      '--artifacts-dir',
      releaseArtifactsDir,
    ]
    if (packageSmokePlatform === 'macos') {
      packageSmokeCommand.push('--require-macos-gatekeeper')
    }

    lanes.push({
      id: `desktop-package-smoke:${packageSmokePlatform}`,
      title: `Desktop packaged artifact smoke (${packageSmokePlatform})`,
      description: 'Inspect the current-platform canonical Electron release artifact for app metadata, app.asar, sidecar binaries, update metadata, and unpacked native runtime resources.',
      kind: 'command',
      command: packageSmokeCommand,
      requiredForModes: ['release'],
    })
  }

  const targets = baselineTargets.length > 0
    ? baselineTargets
    : [{ providerId: null, modelId: 'current', label: 'current-runtime' }]

  for (const testCase of baselineCases) {
    for (const target of targets) {
      const targetSlug = target.label.replace(/[^a-zA-Z0-9._-]+/g, '-')
      lanes.push({
        id: `baseline:${testCase.id}:${targetSlug}`,
        title: `${testCase.title} (${target.label})`,
        description: testCase.description,
        kind: 'baseline-case',
        baselineCaseId: testCase.id,
        baselineTarget: target,
        requiredForModes: ['baseline', 'release'],
        live: true,
      })
    }
  }

  for (const target of targets) {
    const targetSlug = target.label.replace(/[^a-zA-Z0-9._-]+/g, '-')
    lanes.push({
      id: `desktop-smoke:agent-browser-chat:${targetSlug}`,
      title: `Desktop agent-browser chat smoke (${target.label})`,
      description: 'Open the desktop web app with agent-browser, send a real chat task, and verify the model edits a fixture project through the UI.',
      kind: 'desktop-smoke',
      baselineTarget: target,
      requiredForModes: ['baseline', 'release'],
      live: true,
    })
  }

  return lanes.filter((lane) => lane.requiredForModes.includes(mode))
}
