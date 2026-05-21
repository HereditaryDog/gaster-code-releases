import { describe, expect, test } from 'bun:test'
import {
  OPENAI_DEFAULT_MAIN_MODEL,
  OPENAI_GPT5_LARGE_CONTEXT_WINDOW,
  OPENAI_GPT5_STANDARD_CONTEXT_WINDOW,
  getOpenAIContextWindowForModel,
  isOpenAIResponsesModel,
  resolveOpenAICodexModel,
} from './models.js'

describe('openai auth model resolution', () => {
  test('does not treat opus as an OpenAI Responses model', () => {
    expect(isOpenAIResponsesModel('opus')).toBe(false)
  })

  test('accepts gpt and o-series models', () => {
    expect(isOpenAIResponsesModel('gpt-5.4')).toBe(true)
    expect(isOpenAIResponsesModel('o3-mini')).toBe(true)
  })

  test('maps opus aliases to the OpenAI default model', () => {
    expect(resolveOpenAICodexModel('opus')).toBe(OPENAI_DEFAULT_MAIN_MODEL)
  })

  test('maps large-context GPT-5 models to a 1.05M context window', () => {
    expect(getOpenAIContextWindowForModel('gpt-5.5')).toBe(
      OPENAI_GPT5_LARGE_CONTEXT_WINDOW,
    )
    expect(getOpenAIContextWindowForModel('gpt-5.4')).toBe(
      OPENAI_GPT5_LARGE_CONTEXT_WINDOW,
    )
  })

  test('maps standard GPT-5 models to a 400k context window', () => {
    expect(getOpenAIContextWindowForModel('gpt-5.3-codex')).toBe(
      OPENAI_GPT5_STANDARD_CONTEXT_WINDOW,
    )
    expect(getOpenAIContextWindowForModel('gpt-5.4-mini')).toBe(
      OPENAI_GPT5_STANDARD_CONTEXT_WINDOW,
    )
  })
})
