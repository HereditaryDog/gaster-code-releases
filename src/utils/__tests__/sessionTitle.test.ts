import { describe, expect, test } from 'bun:test'
import { normalizeGeneratedSessionTitle } from '../sessionTitle.js'

describe('normalizeGeneratedSessionTitle', () => {
  test('normalizes command metadata returned by the title model', () => {
    expect(normalizeGeneratedSessionTitle([
      '<command-message>frontend-design</command-message>',
      '<command-name>/frontend-design</command-name>',
      '<command-args>@website</command-args>',
    ].join(' '))).toBe('/frontend-design @website')
  })

  test('rejects overlong generated titles', () => {
    expect(normalizeGeneratedSessionTitle('a'.repeat(81))).toBeNull()
  })
})
