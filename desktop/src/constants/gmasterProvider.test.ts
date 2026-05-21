import { describe, expect, it } from 'vitest'

import { getGMasterModelOptions } from './gmasterProvider'

const AVAILABLE_GMASTER_MODELS = [
  'MiniMax-M2.5',
  'deepseek-v4-flash-max',
  'deepseek-chat',
  'deepseek-v4-pro-max',
  'claude-3-5-sonnet-20240620',
  'claude-sonnet-4-5-20250929',
  'deepseek-reasoner',
  'claude-sonnet-4-20250514',
  'claude-3-5-sonnet-20241022',
  'deepseek-v4-pro',
  'Doubao-Seed-2.0-lite',
  'Kimi-K2.6',
  'gemini-3.1-pro-preview',
  'Doubao-Seed-2.0-pro',
  'MiniMax-M2.7',
  'claude-opus-4-1-20250805',
  'claude-haiku-4-5-20251001',
  'GLM-5.1',
  'deepseek-v4-flash-none',
  'kimi-k2.5',
  'claude-3-5-haiku-20241022',
  'GLM-4.7',
  'deepseek-v4-flash',
  'deepseek-v4-pro-none',
  'DeepSeek-V3.2',
  'Doubao-Seed-2.0-Code',
  'gpt-5.4',
  'gpt-5.3-codex',
  'gemini-2.5-flash',
  'gpt-5.4-mini',
  'gemini-3-pro-preview',
  'gpt-5.2',
  'claude-sonnet-4-6',
  'claude-opus-4-7',
  'claude-opus-4-20250514',
  'gemini-2.5-flash-lite',
  'claude-opus-4-6',
  'gpt-5.5',
  'gemini-3-flash-preview',
  'claude-opus-4-5-20251101',
  'claude-3-7-sonnet-20250219',
  'gemini-2.5-pro',
  'gemini-3.1-flash-lite-preview',
]

const UNAVAILABLE_GMASTER_MODELS = [
  'gpt-image-2',
]

describe('G-Master official provider model options', () => {
  it('includes every verified usable G-Master API chat model', () => {
    const options = getGMasterModelOptions()

    for (const model of AVAILABLE_GMASTER_MODELS) {
      expect(options).toContain(model)
    }
  })

  it('excludes models that failed G-Master API chat connectivity checks', () => {
    const options = getGMasterModelOptions()

    for (const model of UNAVAILABLE_GMASTER_MODELS) {
      expect(options).not.toContain(model)
    }
  })

  it('merges live G-Master API model catalog values into options', () => {
    const options = getGMasterModelOptions(undefined, ['claude-sonnet-4-8-20260101'])

    expect(options).toContain('claude-sonnet-4-8-20260101')
  })
})
