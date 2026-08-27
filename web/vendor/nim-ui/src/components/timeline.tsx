import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/icon'
import { cn } from '@/lib/cn'

export type TimelineTone = 'accent' | 'danger' | 'muted' | 'success' | 'warning'

export interface TimelineEntry {
  body?: ReactNode
  icon?: IconName
  id: string
  /** Already formatted. The kit never decides how a date reads in a locale. */
  time?: string
  title: ReactNode
  tone?: TimelineTone
}

export interface TimelineProps {
  className?: string
  entries: TimelineEntry[]
  /** `compact` drops the body block and keeps one line per entry. */
  density?: 'compact' | 'default'
}

/**
 * An ordered list, because a timeline's whole claim is that these things
 * happened in this order — a `<div>` stack says nothing of the sort to a
 * screen reader.
 *
 * The rail is drawn by the marker column rather than by a pseudo-element on
 * each row, so it stops cleanly at the last entry instead of trailing past it.
 */
export function Timeline({ className, density = 'default', entries }: TimelineProps) {
  return (
    <ol className={cn('nim-timeline', density === 'compact' && 'nim-timeline--compact', className)}>
      {entries.map((entry) => (
        <li className="nim-timeline__entry" data-tone={entry.tone} key={entry.id}>
          <span aria-hidden="true" className="nim-timeline__marker">
            {entry.icon ? <Icon name={entry.icon} size="xs" /> : <span className="nim-timeline__dot" />}
          </span>
          <div className="nim-timeline__content">
            <div className="nim-timeline__head">
              <span className="nim-timeline__title">{entry.title}</span>
              {entry.time ? <time className="nim-timeline__time">{entry.time}</time> : null}
            </div>
            {entry.body && density !== 'compact' ? (
              <div className="nim-timeline__body">{entry.body}</div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
