import { GASTER_CODE_APP_NAME, GASTER_CODE_G_PATH } from '../../constants/branding'

type GasterBrandMarkProps = {
  className?: string
  testId?: string
  ariaLabel?: string
}

type GasterBrandLockupProps = {
  className?: string
  markClassName?: string
  testId?: string
}

export function GasterBrandMark({
  className = '',
  testId = 'gaster-brand-mark',
  ariaLabel,
}: GasterBrandMarkProps) {
  return (
    <span
      data-testid={testId}
      className={`gaster-brand-mark ${className}`.trim()}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
    >
      <svg viewBox="0 0 1024 1024" focusable="false" aria-hidden="true">
        <path d={GASTER_CODE_G_PATH} fill="currentColor" />
      </svg>
    </span>
  )
}

export function GasterBrandLockup({
  className = '',
  markClassName = 'h-5 w-5',
  testId = 'gaster-brand-lockup',
}: GasterBrandLockupProps) {
  return (
    <div data-testid={testId} className={`gaster-brand-lockup hero-brand-lockup ${className}`.trim()}>
      <GasterBrandMark className={`hero-brand-logo ${markClassName}`.trim()} />
      <div className="hero-brand-wordmark" aria-label={GASTER_CODE_APP_NAME}>
        <span>Gaster</span>
        <span>Code</span>
      </div>
    </div>
  )
}
