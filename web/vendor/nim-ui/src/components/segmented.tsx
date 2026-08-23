import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface SegmentedOption<T extends string> {
  disabled?: boolean
  label: string
  value: T
}

export interface SegmentedProps<T extends string> extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  fullWidth?: boolean
  label: string
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  value: T
}

/**
 * A tablist rather than a row of buttons: arrow-key navigation and the
 * selected state both come from the platform's tab semantics.
 */
export function Segmented<T extends string>({
  className,
  fullWidth = false,
  label,
  onChange,
  options,
  value,
  ...props
}: SegmentedProps<T>) {
  return (
    <div
      aria-label={label}
      className={cn('nim-segmented', fullWidth && 'nim-segmented--full', className)}
      role="tablist"
      {...props}
    >
      {options.map((option) => (
        <button
          aria-selected={option.value === value}
          className="nim-segmented__option"
          disabled={option.disabled}
          key={option.value}
          onClick={() => onChange(option.value)}
          role="tab"
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
