import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type ResourceMeterTone = 'accent' | 'danger' | 'success' | 'warning'

export interface ResourceMeterProps extends HTMLAttributes<HTMLDivElement> {
  /** A concise description of the capacity being measured. */
  label: ReactNode
  /** A readable measurement such as `18.4 / 32 GiB`; formatting stays in the product. */
  value: ReactNode
  /** Optional secondary context, for example a node's one-minute load. */
  detail?: ReactNode
  /** Percentage used, clamped to the meter's valid 0–100 range. Omit for capacity-only data. */
  percent?: number
  tone?: ResourceMeterTone
}

/**
 * A compact, accessible capacity reading for operator interfaces.
 *
 * `Progress` is intentionally unlabelled composition; a resource figure needs
 * its numerator, denominator, and qualitative state to travel together. The
 * product supplies formatting because bytes, vCPU, and retention windows do
 * not share a unit.
 */
export function ResourceMeter({
  className,
  detail,
  label,
  percent,
  tone = 'accent',
  value,
  ...props
}: ResourceMeterProps) {
  const hasMeasurement = typeof percent === 'number'
  const clamped = Math.min(100, Math.max(0, percent ?? 0))
  const labelText = typeof label === 'string' ? label : undefined

  return (
    <div className={cn('nim-resource-meter', className)} data-tone={tone} {...props}>
      <div className="nim-resource-meter__head">
        <span className="nim-resource-meter__label">{label}</span>
        <span className="nim-resource-meter__value">{value}</span>
      </div>
      {hasMeasurement ? (
        <div
          aria-label={labelText}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={clamped}
          className="nim-resource-meter__track"
          role="meter"
        >
          <span className="nim-resource-meter__fill" style={{ inlineSize: `${clamped}%` }} />
        </div>
      ) : null}
      {detail ? <span className="nim-resource-meter__detail">{detail}</span> : null}
    </div>
  )
}
