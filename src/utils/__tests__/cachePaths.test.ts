import { afterEach, describe, expect, test } from 'bun:test'
import { join } from 'path'
import { CACHE_PATHS } from '../cachePaths.js'

const originalConfigDir = process.env.CLAUDE_CONFIG_DIR

afterEach(() => {
  if (originalConfigDir === undefined) {
    delete process.env.CLAUDE_CONFIG_DIR
  } else {
    process.env.CLAUDE_CONFIG_DIR = originalConfigDir
  }
})

describe('CACHE_PATHS', () => {
  test('uses CLAUDE_CONFIG_DIR Cache when portable mode is active', () => {
    process.env.CLAUDE_CONFIG_DIR = '/tmp/gaster-code-portable-config'

    expect(CACHE_PATHS.baseLogs()).toContain(
      join('/tmp/gaster-code-portable-config', 'Cache'),
    )
    expect(CACHE_PATHS.errors()).toContain(
      join('/tmp/gaster-code-portable-config', 'Cache'),
    )
    expect(CACHE_PATHS.mcpLogs('gaster:server')).toContain(
      join('/tmp/gaster-code-portable-config', 'Cache'),
    )
  })
})
