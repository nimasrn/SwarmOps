import { useId, useState } from 'react'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/cn'

export interface RatingProps {
  className?: string
  /** Read-only ratings are a figure, not a control: no focus, no hover. */
  readOnly?: boolean
  count?: number
  label: string
  onChange?: (value: number) => void
  size?: 'lg' | 'md' | 'sm'
  /** Fractional values render a partly filled star; input still snaps to
      whole stars, because half a click is not an opinion anyone holds. */
  value: number
}

/**
 * A radio group behind stars. The stars are decoration painted over real
 * inputs, so arrow keys, form submission and "3 of 5 selected" all come from
 * the platform — a row of `<button>`s gives none of that and is what makes
 * most star ratings unusable by keyboard.
 */
export function Rating({
  className,
  count = 5,
  label,
  onChange,
  readOnly = false,
  size = 'md',
  value,
}: RatingProps) {
  const name = useId()
  const [preview, setPreview] = useState<number | null>(null)
  const shown = preview ?? value

  if (readOnly || !onChange) {
    return (
      <span
        aria-label={`${label}: ${value}/${count}`}
        className={cn('nim-rating', `nim-rating--${size}`, 'nim-rating--static', className)}
        role="img"
      >
        {Array.from({ length: count }, (_, index) => (
          <Star fill={Math.min(Math.max(value - index, 0), 1)} key={index} />
        ))}
      </span>
    )
  }

  return (
    <fieldset
      className={cn('nim-rating', `nim-rating--${size}`, className)}
      onMouseLeave={() => setPreview(null)}
    >
      <legend className="nim-visually-hidden">{label}</legend>
      {Array.from({ length: count }, (_, index) => {
        const star = index + 1
        return (
          <label className="nim-rating__star" key={star} onMouseEnter={() => setPreview(star)}>
            <input
              checked={value === star}
              className="nim-choice__input"
              name={name}
              onChange={() => onChange(star)}
              type="radio"
              value={star}
            />
            <span className="nim-visually-hidden">{star}</span>
            <Star fill={Math.min(Math.max(shown - index, 0), 1)} />
          </label>
        )
      })}
    </fieldset>
  )
}

/**
 * Two stacked glyphs — an outline and a filled one clipped to the fraction —
 * rather than one glyph whose colour is interpolated. Clipping is what makes
 * 3.4 stars look like 3.4 stars instead of like four pale ones.
 */
function Star({ fill }: { fill: number }) {
  return (
    <span aria-hidden="true" className="nim-rating__glyph">
      <Icon className="nim-rating__outline" name="star" size="md" />
      <span className="nim-rating__fill" style={{ inlineSize: `${fill * 100}%` }}>
        <Icon name="star" size="md" />
      </span>
    </span>
  )
}
