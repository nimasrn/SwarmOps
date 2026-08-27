import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  label?: string
  size?: 'lg' | 'md' | 'sm'
}

export function Spinner({ className, label = 'Loading', size = 'md', ...props }: SpinnerProps) {
  return (
    <span
      className={cn('nim-spinner', size !== 'md' && `nim-spinner--${size}`, className)}
      role="status"
      {...props}
    >
      <span className="nim-visually-hidden">{label}</span>
    </span>
  )
}

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  label?: string
  /** Omit for an indeterminate bar. */
  value?: number
}

export function Progress({ className, label, value, ...props }: ProgressProps) {
  const indeterminate = value === undefined
  const clamped = indeterminate ? 0 : Math.min(100, Math.max(0, value))

  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={indeterminate ? undefined : clamped}
      className={cn('nim-progress', indeterminate && 'nim-progress--indeterminate', className)}
      role="progressbar"
      {...props}
    >
      <div className="nim-progress__fill" style={indeterminate ? undefined : { inlineSize: `${clamped}%` }} />
    </div>
  )
}

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  height?: number | string
  radius?: string
  width?: number | string
}

export function Skeleton({ className, height = '1em', radius, width = '100%', ...props }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('nim-skeleton', className)}
      style={{ blockSize: height, borderRadius: radius, inlineSize: width }}
      {...props}
    />
  )
}
