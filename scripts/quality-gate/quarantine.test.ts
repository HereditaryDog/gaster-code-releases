import { describe, expect, test } from 'bun:test'
import { loadQuarantineManifest, quarantinedPathSet, validateQuarantineManifest } from './quarantine'

describe('quarantine manifest', () => {
  test('loads the default manifest', () => {
    const manifest = loadQuarantineManifest()
    expect(manifest.quarantined.length).toBeGreaterThan(0)
  })

  test('exposes quarantined paths as a set', () => {
    const paths = quarantinedPathSet()
    expect(paths.has('src/server/__tests__/providers-real.test.ts')).toBe(true)
  })

  test('rejects duplicate ids', () => {
    expect(() => validateQuarantineManifest({
      quarantined: [
        {
          id: 'duplicate',
          path: 'a.test.ts',
          reason: 'test',
          owner: 'maintainers',
          reviewAfter: '2026-06-01',
        },
        {
          id: 'duplicate',
          path: 'b.test.ts',
          reason: 'test',
          owner: 'maintainers',
          reviewAfter: '2026-06-01',
        },
      ],
    })).toThrow('duplicate quarantine id')
  })
})
