import type { ReactNode } from 'react'
import { Icon } from '@/components/icon'
import { cn } from '@/lib/cn'

export type StageStatus = 'active' | 'blocked' | 'done' | 'pending'

export interface Stage {
  /** Under the label: what the stage is for, in three or four words. */
  caption?: ReactNode
  id: string
  label: ReactNode
  /** Makes the stage a real button. A stage nobody can return to is a wizard,
      not a track — omit it and the stage renders as static text. */
  onSelect?: () => void
  status: StageStatus
}

export interface StageTrackProps {
  className?: string
  /** Names the ordered list for a screen reader. */
  label?: string
  stages: Stage[]
}

/**
 * The numbered spine of a long console procedure: connect, select, scan,
 * review, deploy.
 *
 * Deliberately not `TaskProgress`. That component reports a job the server is
 * running and the viewer is waiting on; this one reports where a PERSON is in
 * work they are doing themselves — so the stages sit on one horizontal line
 * they can look back along, each is addressable, and there is no percentage,
 * because five decisions are five decisions and none of them is 20% of an
 * outcome.
 *
 * The connector is drawn by the stage, not between stages: a separate rule
 * would need to know which one is last, and every version of that rule that
 * did not eventually drew a line off the end of the track.
 */
export function StageTrack({ className, label = 'Stages', stages }: StageTrackProps) {
  return (
    <ol aria-label={label} className={cn('nim-stages', className)}>
      {stages.map((stage, index) => {
        const body = (
          <>
            <span aria-hidden="true" className="nim-stages__marker">
              {stage.status === 'done' ? (
                <Icon name="check" size="xs" />
              ) : stage.status === 'blocked' ? (
                <Icon name="close" size="xs" />
              ) : (
                index + 1
              )}
            </span>
            <span className="nim-stages__text">
              <span className="nim-stages__label">{stage.label}</span>
              {stage.caption ? <span className="nim-stages__caption">{stage.caption}</span> : null}
            </span>
          </>
        )

        return (
          <li
            aria-current={stage.status === 'active' ? 'step' : undefined}
            className="nim-stages__stage"
            data-status={stage.status}
            key={stage.id}
          >
            {stage.onSelect ? (
              <button className="nim-stages__body" onClick={stage.onSelect} type="button">
                {body}
              </button>
            ) : (
              <span className="nim-stages__body">{body}</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
