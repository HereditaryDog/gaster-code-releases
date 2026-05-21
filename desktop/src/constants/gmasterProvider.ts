import type { ModelMapping, SavedProvider } from '../types/provider'

export const GMASTER_MANAGED_PROVIDER_ID = 'managed-gmaster-api'
export const GMASTER_API_BASE_URL = 'https://gmapi.fun'

export const GMASTER_SUPPORTED_MODELS = [
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
] as const

export const GMASTER_DEFAULT_MODELS: ModelMapping = {
  main: 'gpt-5.4',
  haiku: 'gpt-5.4-mini',
  sonnet: 'gpt-5.4',
  opus: 'gpt-5.4',
}

type ProviderIdentity = Pick<SavedProvider, 'id' | 'presetId' | 'baseUrl' | 'managed'>

export function isGMasterOfficialProvider(provider?: ProviderIdentity | null): boolean {
  if (!provider) return false
  return (
    provider.id === GMASTER_MANAGED_PROVIDER_ID ||
    provider.managed?.type === 'gmaster' ||
    provider.presetId === 'gmaster' ||
    normalizeBaseUrl(provider.baseUrl) === normalizeBaseUrl(GMASTER_API_BASE_URL)
  )
}

export function getGMasterModelOptions(
  models?: Partial<ModelMapping>,
  availableModels: string[] = [],
): string[] {
  return normalizeModelOptions([
    ...availableModels,
    ...GMASTER_SUPPORTED_MODELS,
    ...Object.values(models ?? {}).filter((model): model is string => Boolean(model?.trim())),
  ])
}

function normalizeModelOptions(models: string[]): string[] {
  return Array.from(new Set(
    models
      .map((model) => model.trim())
      .filter((model) => model && isLikelyChatModel(model)),
  ))
}

function isLikelyChatModel(modelId: string): boolean {
  return !/(^|[-_])(image|embedding|audio|tts|whisper|rerank)([-_]|$)/i.test(modelId)
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '').toLowerCase()
}
