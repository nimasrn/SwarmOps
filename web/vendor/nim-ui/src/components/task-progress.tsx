import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/icon'
import { Progress, Spinner } from '@/components/feedback'
import { cn } from '@/lib/cn'

export type TaskStepStatus = 'active' | 'done' | 'failed' | 'pending' | 'skipped'

export interface TaskStep {
  /** What went wrong, or what is happening. Shown under the label — a status
      word alone leaves a stuck viewer with nothing to act on. */
  detail?: ReactNode
  id: string
  label: ReactNode
  status: TaskStepStatus
}

export interface TaskProgressProps {
  /** Rendered under the steps: a cancel control, a support line. */
  action?: ReactNode
  className?: string
  /** The headline under the ring — what the job is doing right now. */
  caption?: ReactNode
  labels?: { of: (done: number, total: number) => string; status: Record<TaskStepStatus, string> }
  steps: TaskStep[]
  title?: ReactNode
  /** 0–100. Omit to derive it from the steps, which is what a job with equal
      stages wants; pass it when the server knows better. */
  value?: number
}

const DEFAULT_LABELS = {
  of: (done: number, total: number) => `${done} of ${total} steps`,
  status: {
    active: 'In progress',
    done: 'Done',
    failed: 'Failed',
    pending: 'Waiting',
    skipped: 'Skipped',
  } as Record<TaskStepStatus, string>,
}

const STATUS_ICON: Record<Exclude<TaskStepStatus, 'active'>, IconName> = {
  done: 'check',
  failed: 'close',
  pending: 'clock',
  skipped: 'minus',
}

/**
 * A long-running job the viewer is waiting on: a scan, an import, a render.
 *
 * The steps are the point. A bare percentage tells someone how long to wait;
 * a named stage tells them what is happening and, when it fails, which part
 * failed — which is the difference between "try again" and "try again with a
 * better photo". Failure is a state of a step, not a replacement for the list.
 *
 * The region is `aria-live="polite"`, so a stage completing is announced
 * without the viewer having to keep looking at it.
 */
export function TaskProgress({
  action,
  caption,
  className,
  labels,
  steps,
  title,
  value,
}: TaskProgressProps) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const done = steps.filter((step) => step.status === 'done' || step.status === 'skipped').length
  const percent = value ?? (steps.length ? Math.round((done / steps.length) * 100) : 0)
  const failed = steps.some((step) => step.status === 'failed')

  return (
    <section
      aria-live="polite"
      className={cn('nim-task', failed && 'nim-task--failed', className)}
    >
      <header className="nim-task__head">
        {title ? <h2 className="nim-task__title">{title}</h2> : null}
        {caption ? <p className="nim-task__caption">{caption}</p> : null}
        {/* The bar takes the danger tone from the section, not from a prop:
            a failed job is a state of the whole task, and Progress owns one
            fill in one colour. */}
        <Progress label={text.of(done, steps.length)} value={percent} />
      </header>

      <ol className="nim-task__steps">
        {steps.map((step) => (
          <li className="nim-task__step" data-status={step.status} key={step.id}>
            <span className="nim-task__marker">
              {step.status === 'active' ? (
                <Spinner size="sm" />
              ) : (
                <Icon name={STATUS_ICON[step.status]} size="xs" />
              )}
            </span>
            <span className="nim-task__step-text">
              <span className="nim-task__step-label">{step.label}</span>
              <span className="nim-task__step-detail">
                {step.detail ?? text.status[step.status]}
              </span>
            </span>
          </li>
        ))}
      </ol>

      {action ? <div className="nim-task__action">{action}</div> : null}
    </section>
  )
}
