import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

describe('feature quality contract', () => {
  test('documents the local gates agents must run for changed areas', () => {
    const agents = readFileSync('AGENTS.md', 'utf8')

    expect(agents).toContain('## Quality Gate Automation')
    expect(agents).toContain('run the narrow relevant check first, then `bun run quality:pr`')
    expect(agents).toContain('Use `bun run check:native` for `desktop/src-tauri`, sidecars, native packaging, release, or platform startup behavior changes.')
    expect(agents).toContain('run the release gate with live baseline coverage')
    expect(agents).toContain('Do not claim "complete", "ready to merge", or "ready to release"')
  })

  test('keeps PR authors accountable for verification and risk', () => {
    const template = readFileSync('.github/pull_request_template.md', 'utf8')

    expect(template).toContain('## Verification')
    expect(template).toContain('I ran the relevant local checks')
    expect(template).toContain('## Risk')
    expect(template).toContain('CLI core paths')
    expect(template).toContain('User-facing behavior changes include tests')
  })

  test('keeps package smoke wired into policy and native scripts', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts?: Record<string, string>
    }

    expect(packageJson.scripts?.['check:policy']).toBe(
      'bun test scripts/pr/change-policy.test.ts scripts/pr/pr-triage-workflow.test.ts scripts/pr/release-workflow.test.ts scripts/pr/quality-contract.test.ts scripts/release-update-metadata.test.ts scripts/quality-gate/package-smoke/index.test.ts && bun run check:quarantine',
    )
    expect(packageJson.scripts?.['check:quarantine']).toBe('bun test scripts/quality-gate/quarantine.test.ts')
    expect(packageJson.scripts?.['check:electron']).toBe('cd desktop && bun run check:electron')
    expect(packageJson.scripts?.['check:native']).toBe(
      'cd desktop && bun run build:sidecars && bun run check:electron && CSC_IDENTITY_AUTO_DISCOVERY=false bun run electron:package:dir && cd .. && bun run test:package-smoke:current',
    )
    expect(packageJson.scripts?.['test:package-smoke']).toBe('bun run scripts/quality-gate/package-smoke/index.ts')
    expect(packageJson.scripts?.['test:package-smoke:current']).toBe('bun run scripts/quality-gate/package-smoke/current.ts')
  })

  test('keeps PR native CI aligned with the local native gate', () => {
    const prQuality = readFileSync('.github/workflows/pr-quality.yml', 'utf8')

    expect(prQuality).toContain('run: bun run check:policy')
    expect(prQuality).toContain('run: bun run check:native')
    expect(prQuality).toContain('desktop_native_checks')
  })

  test('keeps contributor docs pointing at quality reports and native checks', () => {
    const contributing = readFileSync('docs/guide/contributing.md', 'utf8')
    const englishContributing = readFileSync('docs/en/guide/contributing.md', 'utf8')
    const rootContributing = readFileSync('CONTRIBUTING.md', 'utf8')

    expect(contributing).toContain('bun run quality:pr')
    expect(contributing).toContain('bun run check:native')
    expect(contributing).toContain('artifacts/quality-runs/<timestamp>/')
    expect(englishContributing).toContain('bun run quality:pr')
    expect(englishContributing).toContain('bun run check:native')
    expect(englishContributing).toContain('artifacts/quality-runs/<timestamp>/')
    expect(rootContributing).toContain('bun run quality:pr')
    expect(rootContributing).toContain('artifacts/quality-runs/<timestamp>/')
  })
})
