import { api } from './client'

const IMAGE_GENERATION_TIMEOUT_MS = 930_000
const PROMPT_ENHANCEMENT_TIMEOUT_MS = 90_000

export type ImageSize =
  | '1024x1024'
  | '1024x1280'
  | '1024x1365'
  | '1024x1536'
  | '1080x1920'
  | '1536x1024'
  | '1365x1024'
  | '1920x1080'
  | '2048x1024'

export type GenerateImageInput = {
  prompt: string
  size: ImageSize
}

export type EnhancePromptInput = {
  prompt: string
  size: ImageSize
}

export type GeneratedImage = {
  src: string
  dataUrl?: string
  url?: string
  mimeType: string
  model: string
  revisedPrompt: string | null
}

export type ImageHistoryItem = {
  id: string
  prompt: string
  size: ImageSize
  image: GeneratedImage
  createdAt: number
}

export type EnhancedPrompt = {
  prompt: string
  model: string
}

export const imagesApi = {
  generate(input: GenerateImageInput) {
    return api.post<{ image: GeneratedImage; historyItem?: ImageHistoryItem }>('/api/images/generate', input, { timeout: IMAGE_GENERATION_TIMEOUT_MS })
  },
  enhancePrompt(input: EnhancePromptInput) {
    return api.post<EnhancedPrompt>('/api/images/enhance-prompt', input, { timeout: PROMPT_ENHANCEMENT_TIMEOUT_MS })
  },
  listHistory() {
    return api.get<{ history: ImageHistoryItem[] }>('/api/images/history')
  },
}
