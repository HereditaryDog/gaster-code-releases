import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { imagesApi, type GeneratedImage, type GenerateImageInput, type ImageHistoryItem } from '../api/images'
import { ApiError } from '../api/client'
import { useTranslation } from '../i18n'
import { Textarea } from '../components/shared/Textarea'

type SizeOption = {
  value: GenerateImageInput['size']
  ratio: string
  label: string
  icon: string
  aspectClass: string
}

const SIZE_OPTIONS: SizeOption[] = [
  { value: '1024x1024', ratio: '1:1', label: '1024x1024', icon: 'crop_square', aspectClass: 'aspect-square' },
  { value: '1024x1280', ratio: '4:5', label: '1024x1280', icon: 'crop_5_4', aspectClass: 'aspect-[4/5]' },
  { value: '1024x1365', ratio: '3:4', label: '1024x1365', icon: 'crop_portrait', aspectClass: 'aspect-[3/4]' },
  { value: '1024x1536', ratio: '2:3', label: '1024x1536', icon: 'crop_portrait', aspectClass: 'aspect-[2/3]' },
  { value: '1080x1920', ratio: '9:16', label: '1080x1920', icon: 'crop_9_16', aspectClass: 'aspect-[9/16]' },
  { value: '1536x1024', ratio: '3:2', label: '1536x1024', icon: 'crop_landscape', aspectClass: 'aspect-[3/2]' },
  { value: '1365x1024', ratio: '4:3', label: '1365x1024', icon: 'crop_landscape', aspectClass: 'aspect-[4/3]' },
  { value: '1920x1080', ratio: '16:9', label: '1920x1080', icon: 'crop_16_9', aspectClass: 'aspect-[16/9]' },
  { value: '2048x1024', ratio: '2:1', label: '2048x1024', icon: 'crop_landscape', aspectClass: 'aspect-[2/1]' },
]
const DEFAULT_SIZE_OPTION = SIZE_OPTIONS[0]!

const PROMPT_LIMIT = 1000
const HISTORY_LIMIT = 20

export function Drawing() {
  const t = useTranslation()
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState<GenerateImageInput['size']>('1024x1024')
  const [image, setImage] = useState<GeneratedImage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const [isCompareMode, setIsCompareMode] = useState(false)
  const [history, setHistory] = useState<ImageHistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const trimmedPrompt = prompt.trim()
  const selectedSize = useMemo(
    () => SIZE_OPTIONS.find((option) => option.value === size) ?? DEFAULT_SIZE_OPTION,
    [size],
  )

  useEffect(() => {
    let cancelled = false

    imagesApi.listHistory()
      .then(({ history: loadedHistory }) => {
        if (cancelled) return
        if (loadedHistory.length === 0) return
        const latest = loadedHistory[0]
        if (!latest) return
        setHistory(loadedHistory)
        setPrompt(latest.prompt.slice(0, PROMPT_LIMIT))
        setSize(latest.size)
        setImage(latest.image)
        setIsFavorite(false)
        setIsCompareMode(false)
      })
      .catch(() => {
        // Drawing history is a convenience layer; generation should stay usable if it cannot load.
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function generateImage(nextPrompt: string, nextSize: GenerateImageInput['size']) {
    setIsGenerating(true)
    setError(null)
    try {
      const result = await imagesApi.generate({ prompt: nextPrompt, size: nextSize })
      setImage(result.image)
      setIsFavorite(false)
      const createdAt = Date.now()
      const historyItem = result.historyItem ?? {
        id: `${createdAt}`,
        prompt: nextPrompt,
        size: nextSize,
        image: result.image,
        createdAt,
      }
      const visibleHistoryItem = {
        ...historyItem,
        image: {
          ...historyItem.image,
          ...result.image,
        },
      }
      setHistory((items) => [
        visibleHistoryItem,
        ...items.filter((item) => item.id !== visibleHistoryItem.id),
      ].slice(0, HISTORY_LIMIT))
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      setError(getGenerationErrorMessage(message, t, err))
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleGenerate(event: FormEvent) {
    event.preventDefault()
    if (!trimmedPrompt || isGenerating) return
    await generateImage(prompt, size)
  }

  async function handleOptimizePrompt() {
    if (!trimmedPrompt || isEnhancingPrompt) return
    setIsEnhancingPrompt(true)
    setError(null)
    try {
      const result = await imagesApi.enhancePrompt({ prompt, size })
      setPrompt(result.prompt.slice(0, PROMPT_LIMIT))
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      setError(message || t('drawing.promptEnhanceErrorFallback'))
    } finally {
      setIsEnhancingPrompt(false)
    }
  }

  function handleDownload() {
    if (!image?.src) return
    const link = document.createElement('a')
    link.href = image.src
    link.download = `gaster-code-${image.model}-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  function handleSelectHistory(item: ImageHistoryItem) {
    setPrompt(item.prompt)
    setSize(item.size)
    setImage(item.image)
    setIsFavorite(false)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,var(--color-surface-container-low)_0%,var(--color-surface)_100%)] text-[var(--color-text-primary)]">
      <header className="flex h-[76px] flex-none items-center justify-between border-b border-[var(--color-border)] px-7">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
            aria-label={t('drawing.back')}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold leading-6 text-[var(--color-text-primary)]">
              {t('drawing.headerTitle')}
            </h1>
            <p className="truncate text-xs leading-5 text-[var(--color-text-tertiary)]">
              {t('drawing.subtitle')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHistory((value) => !value)}
            className={`flex h-10 items-center gap-2 rounded-[var(--radius-md)] border px-4 text-sm font-medium transition-colors ${
              showHistory
                ? 'border-[var(--color-model-option-selected-border)] bg-[var(--color-model-option-selected-bg)] text-[var(--color-brand)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
            }`}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">history</span>
            {t('drawing.history')}
          </button>
        </div>
      </header>

      <div className={`grid min-h-0 flex-1 grid-cols-[minmax(300px,360px)_minmax(0,1fr)] gap-4 overflow-hidden px-5 py-4 ${
        showHistory
          ? 'xl:grid-cols-[minmax(320px,370px)_minmax(420px,1fr)_260px]'
          : 'xl:grid-cols-[minmax(320px,370px)_minmax(420px,1fr)]'
      }`}
      >
        <form id="drawing-form" onSubmit={handleGenerate} className="drawing-scroll flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
          <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] p-4 shadow-[0_10px_35px_rgba(23,23,23,0.04)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {t('drawing.prompt')}
                <span className="ml-0.5 text-[var(--color-error)]">*</span>
              </h2>
            </div>
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value.slice(0, PROMPT_LIMIT))}
              placeholder={t('drawing.promptPlaceholder')}
              className="min-h-[168px] rounded-[12px] border-[var(--color-border)] bg-[var(--color-surface)] text-[14px] leading-6 shadow-none"
              aria-label={t('drawing.prompt')}
              required
            />
            <div className="mt-2 flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
              <span>{prompt.length} / {PROMPT_LIMIT}</span>
              <button
                type="button"
                onClick={() => setPrompt('')}
                className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] px-2 py-1 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[14px]">cleaning_services</span>
                {t('drawing.clear')}
              </button>
            </div>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] p-4 shadow-[0_10px_35px_rgba(23,23,23,0.04)]">
            <div className="mb-2 flex items-baseline gap-2">
              <h2 className="text-sm font-semibold">{t('drawing.promptOptimizeTitle')}</h2>
              <span className="text-xs text-[var(--color-text-tertiary)]">{t('drawing.optional')}</span>
            </div>
            <p className="mb-4 text-xs leading-5 text-[var(--color-text-tertiary)]">{t('drawing.promptOptimizeDescription')}</p>
            <button
              type="button"
              onClick={handleOptimizePrompt}
              disabled={!trimmedPrompt || isEnhancingPrompt}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-model-option-selected-border)] bg-[var(--color-model-option-selected-bg)] text-sm font-semibold text-[var(--color-brand)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{isEnhancingPrompt ? 'progress_activity' : 'auto_fix_high'}</span>
              {isEnhancingPrompt ? t('drawing.enhancingPrompt') : t('drawing.optimizePrompt')}
            </button>
            <p className="mt-3 text-center text-xs text-[var(--color-text-tertiary)]">{t('drawing.optimizeHint')}</p>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] p-4 shadow-[0_10px_35px_rgba(23,23,23,0.04)]">
            <h2 className="mb-3 text-sm font-semibold">{t('drawing.size')}</h2>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('drawing.size')}>
              {SIZE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={size === option.value}
                  onClick={() => setSize(option.value)}
                  className={`flex h-[74px] flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border text-xs transition-colors ${
                    size === option.value
                      ? 'border-[var(--color-model-option-selected-border)] bg-[var(--color-model-option-selected-bg)] text-[var(--color-brand)] shadow-[var(--shadow-focus-ring)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                  }`}
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{option.icon}</span>
                  <span className="font-semibold">{option.ratio}</span>
                  <span className="text-[11px] text-[var(--color-text-tertiary)]">{option.label}</span>
                </button>
              ))}
            </div>
          </section>

          {error && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-error)]/25 bg-[var(--color-error)]/10 px-3 py-2 text-sm text-[var(--color-error)]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!trimmedPrompt || isGenerating}
            className="mt-1 flex h-11 flex-none items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#1f2228] text-sm font-semibold text-white shadow-[0_18px_38px_rgba(23,23,23,0.18)] transition-colors hover:bg-[#2d323a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden="true" className={`material-symbols-outlined text-[18px] ${isGenerating ? 'animate-spin' : ''}`}>
              {isGenerating ? 'progress_activity' : 'draw'}
            </span>
            {isGenerating ? t('drawing.generating') : t('drawing.generate')}
          </button>
        </form>

        <main className="drawing-scroll min-h-0 overflow-y-auto">
          <section className="flex min-h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] p-4 shadow-[0_10px_35px_rgba(23,23,23,0.04)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">{t('drawing.previewTitle')}</h2>
                <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{selectedSize.ratio} · {selectedSize.label}</p>
              </div>
              <div className="flex items-center gap-2">
                <PreviewButton
                  icon="compare"
                  label={t('drawing.compare')}
                  disabled={!image}
                  active={isCompareMode}
                  onClick={() => setIsCompareMode((value) => !value)}
                />
                <PreviewButton icon="download" label={t('drawing.download')} disabled={!image} onClick={handleDownload} />
                <PreviewButton
                  icon={isFavorite ? 'star' : 'star_outline'}
                  label={t('drawing.favorite')}
                  disabled={!image}
                  active={isFavorite}
                  onClick={() => setIsFavorite((value) => !value)}
                />
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-container-low)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
                  aria-label={t('drawing.more')}
                  onClick={() => setShowHistory(true)}
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px]">more_horiz</span>
                </button>
              </div>
            </div>

            <div className="flex min-h-[440px] flex-1 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-container-low)] p-4">
              <div className={`relative w-full max-w-[720px] overflow-hidden rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] ${selectedSize.aspectClass}`}>
                {image && isCompareMode && (
                  <div className="absolute left-3 top-3 z-10 rounded-full bg-[var(--color-surface-container-lowest)] px-3 py-1 text-xs font-medium text-[var(--color-brand)] shadow-[0_6px_18px_rgba(23,23,23,0.12)]">
                    {t('drawing.compareMode')}
                  </div>
                )}
                {image ? (
                  <img
                    src={image.src}
                    alt={trimmedPrompt || t('drawing.resultAlt')}
                    className={`h-full w-full object-contain transition-opacity ${isCompareMode ? 'opacity-80' : 'opacity-100'}`}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="text-center text-[var(--color-text-tertiary)]">
                      <span aria-hidden="true" className="material-symbols-outlined mb-3 block text-[38px]">image</span>
                      <div className="text-sm font-medium text-[var(--color-text-secondary)]">{t('drawing.empty')}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {image?.revisedPrompt && (
              <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-container-low)] px-3 py-2 text-xs leading-5 text-[var(--color-text-secondary)]">
                <span className="font-medium text-[var(--color-text-primary)]">{t('drawing.revisedPrompt')}</span>
                <span className="ml-2">{image.revisedPrompt}</span>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {history.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectHistory(item)}
                  className={`h-[70px] w-[70px] overflow-hidden rounded-[var(--radius-md)] border bg-[var(--color-surface)] transition-colors ${
                    image?.src === item.image.src ? 'border-[var(--color-brand)] shadow-[var(--shadow-focus-ring)]' : 'border-[var(--color-border)] hover:border-[var(--color-border-focus)]'
                  }`}
                  aria-label={t('drawing.historyItem')}
                >
                  <img src={item.image.src} alt={t('drawing.historyItem')} className="h-full w-full object-cover" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  if (trimmedPrompt && !isGenerating) void generateImage(prompt, size)
                }}
                disabled={!trimmedPrompt || isGenerating}
                className="flex h-[70px] w-[70px] flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-container-low)] text-xs text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[22px]">add</span>
                {t('drawing.regenerate')}
              </button>
            </div>
          </section>
        </main>

        {showHistory && (
          <aside className="drawing-scroll hidden min-h-0 flex-col gap-4 overflow-y-auto xl:flex">
            <InfoPanel title={t('drawing.history')}>
              {history.length > 0 ? (
                <div className="space-y-2">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectHistory(item)}
                      className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-transparent p-2 text-left transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
                    >
                      <img src={item.image.src} alt={t('drawing.historyItem')} className="h-11 w-11 rounded-[var(--radius-md)] object-cover" />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium text-[var(--color-text-primary)]">{item.prompt}</span>
                        <span className="mt-0.5 block text-[11px] text-[var(--color-text-tertiary)]">{formatTime(item.createdAt)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs leading-5 text-[var(--color-text-tertiary)]">{t('drawing.noHistory')}</p>
              )}
            </InfoPanel>
          </aside>
        )}
      </div>
    </div>
  )
}

function PreviewButton({
  icon,
  label,
  disabled,
  active = false,
  onClick,
}: {
  icon: string
  label: string
  disabled?: boolean
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
        active
          ? 'border-[var(--color-model-option-selected-border)] bg-[var(--color-model-option-selected-bg)] text-[var(--color-brand)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface-container-low)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
      }`}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{icon}</span>
      {label}
    </button>
  )
}

function InfoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] p-4 shadow-[0_10px_35px_rgba(23,23,23,0.04)]">
      <h2 className="mb-3 border-b border-[var(--color-border)] pb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function getGenerationErrorMessage(message: string, t: ReturnType<typeof useTranslation>, error?: unknown): string {
  const apiErrorCode = getApiErrorCode(error)
  if (apiErrorCode === 'IMAGE_GENERATION_UPSTREAM_TIMEOUT') {
    return t('drawing.upstreamTimeoutError')
  }
  if (apiErrorCode === 'IMAGE_GENERATION_TIMEOUT') {
    return t('drawing.timeoutError')
  }
  if (apiErrorCode === 'IMAGE_GENERATION_UPSTREAM_FORBIDDEN') {
    return t('drawing.upstreamForbiddenError')
  }
  if (apiErrorCode === 'IMAGE_GENERATION_UPSTREAM_REQUEST_FAILED') {
    return t('drawing.upstreamRequestFailedError')
  }

  const lowerMessage = message.toLowerCase()
  if (lowerMessage.includes('http 524') || lowerMessage.includes('status_code=524') || lowerMessage.includes('status code 524')) {
    return t('drawing.upstreamTimeoutError')
  }
  if (lowerMessage.includes('timed out')) return t('drawing.timeoutError')
  if (lowerMessage.includes('openai_error') || lowerMessage.includes('status_code=403') || lowerMessage.includes('bad response status code 403')) {
    return t('drawing.upstreamForbiddenError')
  }
  if (
    lowerMessage.includes('load failed') ||
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('fetch failed') ||
    lowerMessage.includes('network error')
  ) {
    return t('drawing.upstreamRequestFailedError')
  }
  if (lowerMessage.includes('do request failed') || lowerMessage.includes('upstream error')) {
    return t('drawing.upstreamError')
  }
  return message || t('drawing.errorFallback')
}

function getApiErrorCode(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null
  const body = error.body
  if (!body || typeof body !== 'object' || !('error' in body)) return null
  const code = (body as { error?: unknown }).error
  return typeof code === 'string' ? code : null
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}
