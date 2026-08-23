import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@/components/button'
import { IconButton } from '@/components/icon-button'
import { cn } from '@/lib/cn'

export interface OnboardingSlide {
  /** Illustration, video, or anything else. Sized by the caller. */
  art?: ReactNode
  body?: ReactNode
  id: string
  /** The chip above the title — the promise, in three or four words. */
  label?: string
  /** A caption card under the art: a headline and its supporting points. */
  proof?: { icon?: ReactNode; points?: string[]; title: ReactNode }
  title: ReactNode
}

export interface OnboardingProps {
  className?: string
  /** Label for the button on the last slide. */
  finishLabel: string
  /** Label for the button on every other slide. */
  nextLabel: string
  /** Reached from the finish button, or from skip. */
  onDone: () => void
  onSkip?: () => void
  /** Notified on every slide change, including from a dot. */
  onStep?: (index: number) => void
  slides: OnboardingSlide[]
  skipLabel?: string
  /** Version string, support line — whatever sits under the CTA. */
  footnote?: ReactNode
  /** Brand mark in the top bar. */
  brand?: ReactNode
  /** Accessible names for the controls. */
  labels?: { back: string; dot: (index: number) => string }
}

const DEFAULT_LABELS = {
  back: 'Back',
  dot: (index: number) => `Slide ${index + 1}`,
}

/**
 * The three-screen intro a product opens with: art, a promise, a body, and one
 * CTA that advances.
 *
 * State is the component's, because a first-run carousel is never resumed from
 * a URL — `onStep` reports it for analytics and `onDone` fires when the viewer
 * either finishes or skips, so the caller routes in one place instead of two.
 * Slides are announced through a live region rather than by moving focus,
 * which would yank a screen reader out of the CTA it is already on.
 */
export function Onboarding({
  brand,
  className,
  finishLabel,
  footnote,
  labels,
  nextLabel,
  onDone,
  onSkip,
  onStep,
  skipLabel,
  slides,
}: OnboardingProps) {
  const [index, setIndex] = useState(0)
  const text = { ...DEFAULT_LABELS, ...labels }
  const slide = slides[Math.min(index, slides.length - 1)]
  const last = index === slides.length - 1

  const goTo = useCallback(
    (next: number) => {
      setIndex(next)
      onStep?.(next)
    },
    [onStep],
  )

  return (
    <section className={cn('nim-onboarding', className)}>
      <header className="nim-onboarding__bar">
        <span className="nim-onboarding__brand">{brand}</span>
        {skipLabel ? (
          <Button
            iconEnd="chevron-forward"
            onClick={onSkip ?? onDone}
            size="sm"
            variant="ghost"
          >
            {skipLabel}
          </Button>
        ) : null}
      </header>

      <div aria-live="polite" className="nim-onboarding__stage">
        {slide.art ? <div className="nim-onboarding__art">{slide.art}</div> : null}
        {slide.proof ? (
          <div className="nim-onboarding__proof">
            {slide.proof.icon ? (
              <span className="nim-onboarding__proof-icon">{slide.proof.icon}</span>
            ) : null}
            <span className="nim-onboarding__proof-text">
              <span className="nim-onboarding__proof-title">{slide.proof.title}</span>
              {slide.proof.points?.length ? (
                <span className="nim-onboarding__proof-points">{slide.proof.points.join(' · ')}</span>
              ) : null}
            </span>
          </div>
        ) : null}
      </div>

      <div className="nim-onboarding__copy">
        {slide.label ? <span className="nim-onboarding__chip">{slide.label}</span> : null}
        <h1 className="nim-onboarding__title">{slide.title}</h1>
        {slide.body ? <p className="nim-onboarding__body">{slide.body}</p> : null}
      </div>

      <footer className="nim-onboarding__controls">
        <div className="nim-onboarding__dots">
          {slides.map((item, dot) => (
            <button
              aria-current={dot === index ? 'step' : undefined}
              aria-label={text.dot(dot)}
              className="nim-onboarding__dot"
              key={item.id}
              onClick={() => goTo(dot)}
              type="button"
            />
          ))}
        </div>
        <div className="nim-onboarding__cta">
          {index > 0 ? (
            <IconButton
              label={text.back}
              name="chevron-back"
              onClick={() => goTo(index - 1)}
              size="lg"
              variant="outline"
            />
          ) : null}
          <Button
            fullWidth
            iconEnd={last ? 'arrow-forward' : undefined}
            onClick={() => (last ? onDone() : goTo(index + 1))}
            size="lg"
            variant="accent"
          >
            {last ? finishLabel : nextLabel}
          </Button>
        </div>
        {footnote ? <p className="nim-onboarding__footnote">{footnote}</p> : null}
      </footer>
    </section>
  )
}
