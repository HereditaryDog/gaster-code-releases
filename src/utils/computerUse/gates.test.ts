import { afterEach, describe, expect, test } from 'bun:test'
import { getChicagoEnabled } from './gates.js'

const ORIGINAL_ENABLED = process.env.CLAUDE_COMPUTER_USE_ENABLED
const ORIGINAL_GASTER_ENABLED = process.env.GASTER_CODE_COMPUTER_USE_ENABLED
const ORIGINAL_CC_HAHA_ENABLED = process.env.CC_HAHA_COMPUTER_USE_ENABLED

afterEach(() => {
  if (ORIGINAL_ENABLED === undefined) {
    delete process.env.CLAUDE_COMPUTER_USE_ENABLED
  } else {
    process.env.CLAUDE_COMPUTER_USE_ENABLED = ORIGINAL_ENABLED
  }
  if (ORIGINAL_GASTER_ENABLED === undefined) {
    delete process.env.GASTER_CODE_COMPUTER_USE_ENABLED
  } else {
    process.env.GASTER_CODE_COMPUTER_USE_ENABLED = ORIGINAL_GASTER_ENABLED
  }
  if (ORIGINAL_CC_HAHA_ENABLED === undefined) {
    delete process.env.CC_HAHA_COMPUTER_USE_ENABLED
  } else {
    process.env.CC_HAHA_COMPUTER_USE_ENABLED = ORIGINAL_CC_HAHA_ENABLED
  }
})

describe('getChicagoEnabled', () => {
  test('defaults Computer Use on', () => {
    delete process.env.CLAUDE_COMPUTER_USE_ENABLED
    delete process.env.GASTER_CODE_COMPUTER_USE_ENABLED
    delete process.env.CC_HAHA_COMPUTER_USE_ENABLED
    expect(getChicagoEnabled()).toBe(true)
  })

  test('honors the Gaster Computer Use env override', () => {
    process.env.GASTER_CODE_COMPUTER_USE_ENABLED = '0'
    expect(getChicagoEnabled()).toBe(false)
  })

  test('honors legacy falsy env values', () => {
    process.env.CC_HAHA_COMPUTER_USE_ENABLED = '0'
    expect(getChicagoEnabled()).toBe(false)

    delete process.env.CC_HAHA_COMPUTER_USE_ENABLED
    process.env.CLAUDE_COMPUTER_USE_ENABLED = '0'
    expect(getChicagoEnabled()).toBe(false)

    process.env.CLAUDE_COMPUTER_USE_ENABLED = 'false'
    expect(getChicagoEnabled()).toBe(false)
  })
})
