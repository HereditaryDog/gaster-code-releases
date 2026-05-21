// desktop/src/types/provider.ts

export type ApiFormat = 'anthropic' | 'openai_chat' | 'openai_responses'

export type ProviderAuthStrategy =
  | 'api_key'
  | 'auth_token'
  | 'auth_token_empty_api_key'
  | 'dual_same_token'
  | 'dual_dummy'

export type ModelMapping = {
  main: string
  haiku: string
  sonnet: string
  opus: string
}

export type ModelContextWindows = Record<string, number>

export type SavedProvider = {
  id: string
  presetId: string
  name: string
  apiKey: string  // masked from server
  authStrategy?: ProviderAuthStrategy
  baseUrl: string
  apiFormat: ApiFormat
  models: ModelMapping
  availableModels?: string[]
  modelCatalogUpdatedAt?: number
  autoCompactWindow?: number
  modelContextWindows?: ModelContextWindows
  notes?: string
  managed?: { type: 'gmaster' }
}

export type CreateProviderInput = {
  presetId: string
  name: string
  apiKey: string
  authStrategy?: ProviderAuthStrategy
  baseUrl: string
  apiFormat?: ApiFormat
  models: ModelMapping
  availableModels?: string[]
  modelCatalogUpdatedAt?: number
  autoCompactWindow?: number
  modelContextWindows?: ModelContextWindows
  notes?: string
}

export type UpdateProviderInput = {
  name?: string
  apiKey?: string
  authStrategy?: ProviderAuthStrategy
  baseUrl?: string
  apiFormat?: ApiFormat
  models?: ModelMapping
  availableModels?: string[]
  modelCatalogUpdatedAt?: number | null
  autoCompactWindow?: number | null
  modelContextWindows?: ModelContextWindows | null
  notes?: string
}

export type TestProviderConfigInput = {
  baseUrl: string
  apiKey: string
  modelId: string
  authStrategy?: ProviderAuthStrategy
  apiFormat?: ApiFormat
}

export type ProviderTestStepResult = {
  success: boolean
  latencyMs: number
  error?: string
  modelUsed?: string
  httpStatus?: number
}

export type ProviderTestResult = {
  /** Step 1: Basic connectivity */
  connectivity: ProviderTestStepResult
  /** Step 2: Proxy pipeline (only for openai_* formats) */
  proxy?: ProviderTestStepResult
}
