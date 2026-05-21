export const OPENAI_DEFAULT_MAIN_MODEL = 'gpt-5.3-codex'
export const OPENAI_DEFAULT_SONNET_MODEL = 'gpt-5.4'
export const OPENAI_DEFAULT_HAIKU_MODEL = 'gpt-5.4-mini'
export const OPENAI_GPT5_STANDARD_CONTEXT_WINDOW = 400_000
export const OPENAI_GPT5_LARGE_CONTEXT_WINDOW = 1_050_000

export type OpenAIModelCatalogEntry = {
  value: string
  label: string
  description: string
  descriptionForModel?: string
}

export const OPENAI_CODEX_MODEL_CATALOG: OpenAIModelCatalogEntry[] = [
  {
    value: OPENAI_DEFAULT_MAIN_MODEL,
    label: 'GPT-5.3 Codex',
    description: 'Best for coding and agentic work',
    descriptionForModel: 'GPT-5.3 Codex - best for coding and agentic work',
  },
  {
    value: OPENAI_DEFAULT_SONNET_MODEL,
    label: 'GPT-5.4',
    description: 'Strong general-purpose model',
    descriptionForModel: 'GPT-5.4 - strong general-purpose model',
  },
  {
    value: 'gpt-5.5',
    label: 'GPT-5.5',
    description: 'Latest general-purpose model',
    descriptionForModel: 'GPT-5.5 - latest general-purpose model',
  },
  {
    value: OPENAI_DEFAULT_HAIKU_MODEL,
    label: 'GPT-5.4 Mini',
    description: 'Fastest for quick tasks',
    descriptionForModel: 'GPT-5.4 Mini - fastest for quick tasks',
  },
]

export function isOpenAIResponsesModel(model: string): boolean {
  const normalized = model.trim().toLowerCase()
  return normalized.startsWith('gpt-') || /^o\d/.test(normalized)
}

export function resolveOpenAICodexModel(model: string): string {
  if (process.env.OPENAI_CODEX_MODEL?.trim()) {
    return process.env.OPENAI_CODEX_MODEL.trim()
  }

  const normalized = model.trim().toLowerCase()
  if (isOpenAIResponsesModel(normalized)) {
    return model
  }

  if (normalized.includes('haiku')) {
    return (
      process.env.OPENAI_CODEX_HAIKU_MODEL?.trim() ||
      OPENAI_DEFAULT_HAIKU_MODEL
    )
  }

  if (normalized.includes('sonnet')) {
    return (
      process.env.OPENAI_CODEX_SONNET_MODEL?.trim() ||
      OPENAI_DEFAULT_SONNET_MODEL
    )
  }

  if (normalized.includes('opus')) {
    return (
      process.env.OPENAI_CODEX_OPUS_MODEL?.trim() || OPENAI_DEFAULT_MAIN_MODEL
    )
  }

  return OPENAI_DEFAULT_MAIN_MODEL
}

export function getOpenAIModelDisplayName(model: string): string | null {
  switch (model.trim().toLowerCase()) {
    case 'gpt-5.3-codex':
      return 'GPT-5.3 Codex'
    case 'gpt-5.5':
      return 'GPT-5.5'
    case 'gpt-5.4':
      return 'GPT-5.4'
    case 'gpt-5.4-mini':
      return 'GPT-5.4 Mini'
    case 'gpt-5.2':
      return 'GPT-5.2'
    case 'gpt-5.2-codex':
      return 'GPT-5.2 Codex'
    case 'gpt-5.1-codex':
      return 'GPT-5.1 Codex'
    case 'gpt-5.1-codex-max':
      return 'GPT-5.1 Codex Max'
    case 'gpt-5.1-codex-mini':
      return 'GPT-5.1 Codex Mini'
    default:
      return null
  }
}

export function getOpenAIContextWindowForModel(model: string): number | null {
  const normalized = model.trim().toLowerCase()

  // Current OpenAI model docs split GPT-5-family context windows into
  // standard 400k models and larger 1.05M models.
  if (
    normalized === 'gpt-5.5' ||
    normalized === 'gpt-5.5-pro' ||
    normalized === 'gpt-5.4' ||
    normalized === 'gpt-5.4-pro'
  ) {
    return OPENAI_GPT5_LARGE_CONTEXT_WINDOW
  }

  if (
    normalized === 'gpt-5.4-mini' ||
    normalized === 'gpt-5.4-nano' ||
    normalized === 'gpt-5.3-codex' ||
    normalized === 'gpt-5.2' ||
    normalized === 'gpt-5.2-codex' ||
    normalized === 'gpt-5.1' ||
    normalized === 'gpt-5.1-codex' ||
    normalized === 'gpt-5.1-codex-max' ||
    normalized === 'gpt-5.1-codex-mini' ||
    normalized === 'gpt-5-codex' ||
    normalized === 'gpt-5' ||
    normalized === 'gpt-5-mini' ||
    normalized === 'gpt-5-nano'
  ) {
    return OPENAI_GPT5_STANDARD_CONTEXT_WINDOW
  }

  return null
}
