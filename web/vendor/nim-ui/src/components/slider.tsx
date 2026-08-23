import type { CSSProperties, InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  max?: number
  min?: number
  /** Rendered beneath the track, evenly spaced — e.g. ['1M', '8M', '15M']. */
  scale?: string[]
  value: number
}

export function Slider({
  className,
  label,
  max = 100,
  min = 0,
  scale,
  step = 1,
  value,
  ...props
}: SliderProps) {
  const progress = max === min ? 0 : ((value - min) / (max - min)) * 100

  return (
    <div className="nim-field">
      {label ? <span className="nim-field__label">{label}</span> : null}
      <input
        aria-label={label}
        className={cn('nim-slider', className)}
        max={max}
        min={min}
        step={step}
        style={{ '--nim-slider-progress': `${progress}%` } as CSSProperties}
        type="range"
        value={value}
        {...props}
      />
      {scale ? (
        <div aria-hidden="true" className="nim-inline" style={{ justifyContent: 'space-between' }}>
          {scale.map((mark) => (
            <span className="nim-caption" key={mark}>
              {mark}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
